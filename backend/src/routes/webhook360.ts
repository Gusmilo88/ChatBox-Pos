import { Router, Request, Response } from 'express'
import { logger } from '../utils/logger'
import { processInbound } from '../services/processMessage'

/**
 * Rutas webhook para 360dialog WhatsApp Business API
 * 
 * TODO: Si todo funciona correctamente con 360dialog:
 * - Reemplazar referencia en src/index.ts línea 35:
 *   app.use('/api/webhook/whatsapp', express.raw({ type: 'application/json' }), webhook360Router);
 * - Eliminar o deprecar src/routes/whatsapp.ts si ya no se usa Meta Cloud API
 * 
 * Variables de entorno requeridas:
 * - WHATSAPP_VERIFY_TOKEN: Token para verificación del webhook
 */

const router = Router()

/**
 * Estructura esperada del webhook POST de 360dialog
 * Adaptado de la documentación: https://docs.360dialog.com/whatsapp-api/whatsapp-api/webhooks
 * 
 * Nota: El formato de 360dialog es similar al de Meta Cloud API,
 * pero puede tener diferencias menores en la estructura.
 */
interface D360WebhookEntry {
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

interface D360WebhookPayload {
  object: string
  entry: D360WebhookEntry[]
}

/**
 * GET /api/webhook/whatsapp
 * Verificación del webhook (handshake inicial de 360dialog/Meta)
 * 
 * Query params esperados:
 * - hub.mode: debe ser 'subscribe'
 * - hub.verify_token: debe coincidir con WHATSAPP_VERIFY_TOKEN
 * - hub.challenge: string aleatorio que debemos retornar
 */
export function handle360WebhookVerify(req: Request, res: Response): void {
  const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query

  logger.info('whatsapp360_webhook_verify_request', {
    mode,
    hasVerifyToken: !!verifyToken,
    hasChallenge: !!challenge
  })

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (!expectedToken) {
    logger.error('whatsapp360_verify_token_not_configured', {
      message: 'WHATSAPP_VERIFY_TOKEN no está configurado en .env'
    })
    res.status(500).json({ error: 'verify_token_not_configured' })
    return
  }

  // Validar modo y token
  if (mode === 'subscribe' && verifyToken === expectedToken) {
    logger.info('whatsapp360_webhook_verified', {
      mode,
      challenge: challenge?.toString().substring(0, 10) + '...'
    })

    // Retornar el challenge para completar la verificación
    res.status(200).send(challenge)
    return
  }

  logger.warn('whatsapp360_webhook_verification_failed', {
    mode,
    verifyToken: verifyToken ? '***' + String(verifyToken).slice(-4) : 'none',
    expectedToken: '***' + expectedToken.slice(-4)
  })

  res.status(403).json({ error: 'verification_failed' })
}

/**
 * POST /api/webhook/whatsapp
 * Recibe eventos de mensajes entrantes de 360dialog
 * 
 * IMPORTANTE: Responde rápidamente (200 OK) y procesa de forma asíncrona
 * para no bloquear el ciclo de eventos y cumplir con el timeout de 360dialog.
 */
export async function handle360WebhookMessage(req: Request, res: Response): Promise<void> {
  try {
    // Responder inmediatamente para no bloquear
    res.status(200).json({ ok: true })

    // Parsear el body (viene como Buffer por express.raw())
    let payload: D360WebhookPayload
    try {
      const rawBody = req.body
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
    } catch (parseError) {
      logger.error('whatsapp360_webhook_parse_error', {
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      })
      return
    }

    logger.info('whatsapp360_webhook_received', {
      object: payload.object,
      entryCount: payload.entry?.length || 0
    })

    // Procesar mensajes de forma asíncrona
    let processedMessages = 0

    if (payload.entry && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            // Procesar mensajes de texto entrantes
            if (change.value?.messages && Array.isArray(change.value.messages)) {
              for (const message of change.value.messages) {
                if (message.type === 'text' && message.text?.body) {
                  const from = message.from
                  const text = message.text.body

                  // Procesar de forma asíncrona (no bloquea)
                  processInbound(from, text)
                    .then((replies) => {
                      logger.info('whatsapp360_message_processed', {
                        from: from.replace(/\d(?=\d{4})/g, '*'),
                        messageId: message.id,
                        repliesCount: replies.length
                      })

                      // TODO: Enviar respuestas usando send360Text si es necesario
                      // Ejemplo:
                      // for (const reply of replies) {
                      //   await send360Text(from, reply)
                      // }
                    })
                    .catch((error) => {
                      logger.error('whatsapp360_message_process_error', {
                        error: error instanceof Error ? error.message : 'Unknown error',
                        from: from.replace(/\d(?=\d{4})/g, '*'),
                        messageId: message.id
                      })
                    })

                  processedMessages++
                }
              }
            }

            // Log de status updates (entregas, lecturas, etc.)
            if (change.value?.statuses && Array.isArray(change.value.statuses)) {
              for (const status of change.value.statuses) {
                logger.debug('whatsapp360_status_update', {
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

    logger.info('whatsapp360_webhook_processed', {
      object: payload.object,
      processedMessages
    })

  } catch (error) {
    logger.error('whatsapp360_webhook_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    // Ya respondimos 200, solo loguear el error
  }
}

// Rutas
router.get('/', handle360WebhookVerify)
router.post('/', handle360WebhookMessage)

export default router

