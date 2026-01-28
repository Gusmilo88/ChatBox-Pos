import { Router, Request, Response } from 'express'
import { logger } from '../utils/logger'
import { simulateIncoming } from '../services/conversations'
import { detectOperatorResponse, forwardOperatorResponseToClient, forwardClientUpdateToOperator } from '../services/operatorForwarding'
import { getOperatorByPhone } from '../services/autoDerivation'
import { collections } from '../firebase'
import { markWhatsAppMessageAsRead } from '../services/whatsappSender'

/**
 * Cache de messageIds procesados para dedupe
 * Evita procesar el mismo mensaje dos veces por reintentos del webhook
 */
const processedMessageIds = new Set<string>()
const messageIdTimestamps = new Map<string, number>()

// Limpiar IDs antiguos cada hora (TTL: 1 hora)
setInterval(() => {
  const now = Date.now()
  const maxAge = 60 * 60 * 1000 // 1 hora en ms
  
  for (const [messageId, timestamp] of messageIdTimestamps.entries()) {
    if (now - timestamp > maxAge) {
      processedMessageIds.delete(messageId)
      messageIdTimestamps.delete(messageId)
    }
  }
}, 60 * 60 * 1000) // Ejecutar limpieza cada hora

/**
 * Rutas webhook para Meta WhatsApp Cloud API
 * 
 * Variables de entorno requeridas:
 * - WHATSAPP_VERIFY_TOKEN: Token para verificación del webhook
 */

const router = Router()

/**
 * Estructura esperada del webhook POST de Meta WhatsApp Cloud API
 * Documentación: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */
interface MetaWebhookEntry {
  id: string
  changes: Array<{
    value: {
      messaging_product?: string
      metadata?: {
        phone_number_id: string
        display_phone_number: string
      }
      messages?: Array<{
        from: string
        id: string
        timestamp: string
        type: string
        text?: {
          body: string
        }
        image?: {
          id?: string
          mime_type?: string
        }
        document?: {
          id?: string
          mime_type?: string
          filename?: string
        }
        video?: {
          id?: string
          mime_type?: string
        }
        interactive?: {
          type: 'list_reply' | 'button_reply'
          list_reply?: {
            id: string
            title: string
            description?: string
          }
          button_reply?: {
            id: string
            title: string
          }
        }
        context?: {
          from: string
          id: string
        }
      }>
      statuses?: Array<{
        id: string
        status: string
        timestamp: string
        recipient_id: string
      }>
    }
    field: string
  }>
}

interface MetaWebhookPayload {
  object: string
  entry: MetaWebhookEntry[]
}

/**
 * GET /api/webhook/whatsapp
 * Verificación del webhook (handshake inicial de Meta)
 * 
 * Query params esperados:
 * - hub.mode: debe ser 'subscribe'
 * - hub.verify_token: debe coincidir con WHATSAPP_VERIFY_TOKEN
 * - hub.challenge: string aleatorio que debemos retornar
 */
export function handleWebhookVerify(req: Request, res: Response): void {
  const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query

  logger.info('whatsapp_webhook_verify_request', {
    mode,
    hasVerifyToken: !!verifyToken,
    hasChallenge: !!challenge
  })

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (!expectedToken) {
    logger.error('whatsapp_verify_token_not_configured', {
      message: 'WHATSAPP_VERIFY_TOKEN no está configurado en .env'
    })
    res.status(500).json({ error: 'verify_token_not_configured' })
    return
  }

  // Validar modo y token
  if (mode === 'subscribe' && verifyToken === expectedToken) {
    logger.info('whatsapp_webhook_verified', {
      mode,
      challenge: challenge?.toString().substring(0, 10) + '...'
    })

    // Retornar el challenge para completar la verificación
    res.status(200).send(challenge)
    return
  }

  logger.warn('whatsapp_webhook_verification_failed', {
    mode,
    verifyToken: verifyToken ? '***' + String(verifyToken).slice(-4) : 'none',
    expectedToken: '***' + expectedToken.slice(-4)
  })

  res.status(403).json({ error: 'verification_failed' })
}

/**
 * POST /api/webhook/whatsapp
 * Recibe eventos de mensajes entrantes de Meta WhatsApp Cloud API
 * 
 * IMPORTANTE: Responde rápidamente (200 OK) y procesa de forma asíncrona
 * para no bloquear el ciclo de eventos y cumplir con el timeout de Meta (20 segundos).
 */
export async function handleWebhookMessage(req: Request, res: Response): Promise<void> {
  try {
    // Responder inmediatamente para no bloquear
    res.status(200).json({ ok: true })

    // Parsear el body (viene como Buffer por express.raw())
    let payload: MetaWebhookPayload
    try {
      const rawBody = req.body
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
    } catch (parseError) {
      logger.error('whatsapp_webhook_parse_error', {
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      })
      return
    }

    logger.info('whatsapp_webhook_received', {
      object: payload.object,
      entryCount: payload.entry?.length || 0
    })

    // Procesar mensajes de forma asíncrona
    let processedMessages = 0

    if (payload.entry && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            // OPTIMIZACIÓN: Si no hay mensajes, NO consultar Firestore
            if (!change.value?.messages || !Array.isArray(change.value.messages) || change.value.messages.length === 0) {
              logger.debug('webhook_no_messages_skip', {
                entryId: entry.id,
                changeField: change.field
              });
              continue;
            }
            
            // Procesar mensajes entrantes (texto y audio)
            for (const message of change.value.messages) {
                // DEDUPE: Verificar si este messageId ya fue procesado (ANTES de cualquier consulta)
                const messageId = message.id
                if (processedMessageIds.has(messageId)) {
                  logger.debug('whatsapp_message_duplicate_skipped', {
                    messageId,
                    from: message.from ? message.from.replace(/\d(?=\d{4})/g, '*') : 'unknown',
                    type: message.type
                  })
                  // Ya fue procesado, saltar sin re-procesar
                  continue
                }
                
                // Marcar como procesado ANTES de procesar (para evitar race conditions)
                processedMessageIds.add(messageId)
                messageIdTimestamps.set(messageId, Date.now())
                
                // MARCAR MENSAJE COMO "READ" (tilde azul) - instantáneo, no bloquea
                // Esto mejora la UX mostrando que el mensaje fue leído
                markWhatsAppMessageAsRead(messageId)
                  .then((result) => {
                    if (result.success) {
                      logger.debug('whatsapp_mark_read_ok', { messageId })
                    } else {
                      logger.debug('whatsapp_mark_read_failed', { 
                        messageId, 
                        error: result.error 
                      })
                    }
                  })
                  .catch((error) => {
                    // No bloquear el flujo si falla marcar como read
                    logger.debug('whatsapp_mark_read_exception', {
                      messageId,
                      error: error instanceof Error ? error.message : 'Unknown error'
                    })
                  })
                
                // MANEJO DE AUDIOS (OBLIGATORIO)
                if (message.type === 'audio' || message.type === 'voice') {
                  const from = message.from
                  const normalizedFrom = from.startsWith('+') ? from : `+${from}`
                  
                  // Procesar audio: responder que no puede escucharlos
                  simulateIncoming({
                    phone: normalizedFrom,
                    text: '', // Texto vacío, el botReply detectará el tipo de mensaje
                    via: 'whatsapp',
                    messageType: message.type
                  })
                    .then(async (result) => {
                      logger.info('whatsapp_audio_processed', {
                        from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                        messageId: message.id,
                        conversationId: result.conversationId
                      })
                    })
                    .catch((error) => {
                      logger.error('whatsapp_audio_process_error', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                        messageId: message.id
                      })
                    })
                  
                  processedMessages++
                  continue
                }
                
                // MANEJO DE IMÁGENES, DOCUMENTOS Y VIDEOS
                if (message.type === 'image' || message.type === 'document' || message.type === 'video') {
                  const from = message.from
                  const normalizedFrom = from.startsWith('+') ? from : `+${from}`
                  
                  // Extraer mediaId y mimeType si están disponibles
                  const mediaId = message.image?.id || message.document?.id || message.video?.id || undefined
                  const mimeType = message.image?.mime_type || message.document?.mime_type || message.video?.mime_type || undefined
                  
                  logger.info('whatsapp_media_received', {
                    type: message.type,
                    messageId: message.id,
                    from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                    hasMediaId: !!mediaId,
                    mimeType
                  })
                  
                  // Procesar media: pasar por el mismo pipeline que texto (FSM responderá según estado)
                  simulateIncoming({
                    phone: normalizedFrom,
                    text: '', // Texto vacío, el FSM detectará el messageType
                    via: 'whatsapp',
                    messageType: message.type
                  })
                    .then(async (result) => {
                      logger.info('whatsapp_media_processed', {
                        type: message.type,
                        from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                        messageId: message.id,
                        conversationId: result.conversationId
                      })
                    })
                    .catch((error) => {
                      logger.error('whatsapp_media_process_error', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        type: message.type,
                        from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                        messageId: message.id
                      })
                    })
                  
                  processedMessages++
                  continue
                }
                
                // MANEJO DE RESPUESTAS DE MENÚ INTERACTIVO
                if (message.type === 'interactive' && message.interactive?.type === 'list_reply') {
                  const from = message.from
                  const normalizedFrom = from.startsWith('+') ? from : `+${from}`
                  const selectedId = message.interactive.list_reply?.id || ''
                  
                  logger.info('whatsapp_interactive_list_reply', {
                    from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                    selectedId,
                    messageId: message.id
                  });
                  
                  // Procesar como selección de menú (NO como CUIT ni texto libre)
                  // El FSM procesará el selectedId como comando del menú
                  logger.info('menu_selection_received', {
                    selectedId,
                    phone: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                    messageId: message.id
                  });
                  
                  simulateIncoming({
                    phone: normalizedFrom,
                    text: selectedId, // Enviar el ID como texto (ej: "facturacion", "pagos", etc.)
                    via: 'whatsapp',
                    messageType: 'menu_selection' // Marcar como selección de menú para evitar validación CUIT
                  })
                    .then(async (result) => {
                      logger.info('whatsapp_interactive_reply_processed', {
                        from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                        selectedId,
                        conversationId: result.conversationId
                      });
                    })
                    .catch((error) => {
                      logger.error('whatsapp_interactive_reply_process_error', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                        selectedId
                      });
                    });
                  
                  processedMessages++
                  continue
                }
                
                // Procesar mensajes de texto
                if (message.type === 'text' && message.text?.body) {
                  const from = message.from
                  const text = message.text.body

                  // Normalizar número de teléfono (agregar + si no lo tiene)
                  const normalizedFrom = from.startsWith('+') ? from : `+${from}`

                  // DETECCIÓN DE RESPUESTA DE OPERADOR
                  // Primero verificar si el mensaje viene de un operador (secretaria)
                  const operatorResponse = await detectOperatorResponse(normalizedFrom, text)
                  
                  if (operatorResponse?.isOperatorResponse && operatorResponse.operator && operatorResponse.targetClientPhone) {
                    // Es una respuesta de operador, reenviar al cliente
                    logger.info('operator_response_detected', {
                      operator: operatorResponse.operator.name,
                      operatorPhone: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                      targetClient: operatorResponse.targetClientPhone.replace(/\d(?=\d{4})/g, '*'),
                      messagePreview: operatorResponse.cleanMessage?.substring(0, 50)
                    })

                    // Buscar conversación asignada a este operador con este cliente
                    const conversationSnapshot = await collections.conversations()
                      .where('phone', '==', operatorResponse.targetClientPhone)
                      .where('assignedTo', '==', operatorResponse.operator.phone)
                      .limit(1)
                      .get()

                    if (!conversationSnapshot.empty) {
                      const conversationDoc = conversationSnapshot.docs[0]
                      const conversationId = conversationDoc.id

                      // Reenviar respuesta del operador al cliente
                      await forwardOperatorResponseToClient(
                        conversationId,
                        operatorResponse.targetClientPhone,
                        operatorResponse.cleanMessage || text,
                        operatorResponse.operator
                      )

                      logger.info('operator_response_forwarded', {
                        conversationId,
                        operator: operatorResponse.operator.name,
                        clientPhone: operatorResponse.targetClientPhone.replace(/\d(?=\d{4})/g, '*')
                      })
                    } else {
                      logger.warn('conversation_not_found_for_operator_response', {
                        operator: operatorResponse.operator.name,
                        clientPhone: operatorResponse.targetClientPhone.replace(/\d(?=\d{4})/g, '*')
                      })
                    }

                    processedMessages++
                    continue // No procesar como mensaje de cliente
                  }

                  // Si no es respuesta de operador, procesar como mensaje normal de cliente
                  // Pero primero verificar si hay una conversación asignada y actualizar al operador
                  const existingConversation = await collections.conversations()
                    .where('phone', '==', normalizedFrom)
                    .limit(1)
                    .get()

                  if (!existingConversation.empty) {
                    const conversationDoc = existingConversation.docs[0]
                    const conversationData = conversationDoc.data()
                    
                    // Si la conversación está asignada a un operador, reenviar actualización
                    if (conversationData.assignedTo) {
                      const assignedOperator = getOperatorByPhone(conversationData.assignedTo)
                      if (assignedOperator) {
                        await forwardClientUpdateToOperator(
                          conversationDoc.id,
                          normalizedFrom,
                          conversationData.name || null,
                          text,
                          assignedOperator
                        ).catch(err => {
                          logger.error('error_forwarding_client_update', {
                            error: err instanceof Error ? err.message : String(err)
                          })
                        })
                      }
                    }
                  }

                  // Procesar mensaje entrante (crea conversación, genera respuesta, encola en outbox)
                  simulateIncoming({
                    phone: normalizedFrom,
                    text: text,
                    via: 'whatsapp'
                  })
                    .then(async (result) => {
                      logger.info('whatsapp_message_processed', {
                        from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                        messageId: message.id,
                        conversationId: result.conversationId
                      })

                      // Las respuestas ya están encoladas en outbox por simulateIncoming
                      // El worker de outbox las procesará automáticamente
                    })
                    .catch((error) => {
                      logger.error('whatsapp_message_process_error', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                        messageId: message.id,
                        stack: error instanceof Error ? error.stack : undefined
                      })
                    })

                  processedMessages++
                }
              }

            // Log de status updates (entregas, lecturas, etc.)
            if (change.value?.statuses && Array.isArray(change.value.statuses)) {
              for (const status of change.value.statuses) {
                logger.debug('whatsapp_status_update', {
                  messageId: status.id,
                  status: status.status,
                  recipientId: status.recipient_id.replace(/\d(?=\d{4})/g, '*')
                })
              }
            }
          }
        }
      }
    }

    logger.info('whatsapp_webhook_processed', {
      object: payload.object,
      processedMessages
    })
  } catch (error) {
    logger.error('whatsapp_webhook_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    // Ya respondimos 200, solo loguear el error
  }
}

// Rutas
router.get('/', handleWebhookVerify)
router.post('/', handleWebhookMessage)

export default router

