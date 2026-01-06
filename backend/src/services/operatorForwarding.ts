import { collections } from '../firebase'
import { v4 as uuidv4 } from 'uuid'
import logger from '../libs/logger'
import { config } from '../config/env'
import { getOperatorByPhone, type Operator } from './autoDerivation'
import { enqueueOutbox } from './conversations'
import { sendWhatsAppMessage } from '../services/whatsappSender'

/**
 * Reenviar mensaje del cliente a un operador (secretaria)
 * Crea una notificación estructurada en el chat del operador
 */
export async function forwardToOperator(
  conversationId: string,
  clientPhone: string,
  clientName: string | null,
  messageText: string,
  operator: Operator,
  messageHistory?: Array<{ from: 'user' | 'bot'; text: string; timestamp: string }>
): Promise<void> {
  try {
    // Construir mensaje de notificación estructurado
    const notificationMessage = buildNotificationMessage(
      conversationId,
      clientPhone,
      clientName,
      messageText,
      messageHistory
    )

    // Enviar mensaje al operador usando WhatsApp API
    await sendWhatsAppMessage(operator.phone, notificationMessage)

    // Guardar en base de datos que esta conversación está asignada a este operador
    await collections.conversations().doc(conversationId).update({
      assignedTo: operator.phone,
      assignedToName: operator.name,
      assignedAt: new Date(),
      updatedAt: new Date()
    })

    logger.info('Mensaje reenviado a operador', {
      conversationId,
      operator: operator.name,
      operatorPhone: maskPhone(operator.phone),
      clientPhone: maskPhone(clientPhone)
    })
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('Error reenviando mensaje a operador', {
      conversationId,
      operator: operator.name,
      error: msg
    })
    throw error
  }
}

/**
 * Construir mensaje de notificación estructurado para el operador
 * Formato premium con contexto claro
 */
function buildNotificationMessage(
  conversationId: string,
  clientPhone: string,
  clientName: string | null,
  messageText: string,
  messageHistory?: Array<{ from: 'user' | 'bot'; text: string; timestamp: string }>
): string {
  const clientDisplay = clientName || clientPhone
  const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  
  let message = `🔔 Nueva conversación asignada\n\n`
  message += `${separator}\n`
  message += `📋 Cliente: ${clientDisplay}\n`
  message += `📞 Teléfono: ${clientPhone}\n`
  message += `🆔 ID: ${conversationId}\n`
  message += `${separator}\n\n`
  
  // Agregar historial si existe (últimos 3 mensajes)
  if (messageHistory && messageHistory.length > 0) {
    message += `📜 Historial reciente:\n\n`
    const recentHistory = messageHistory.slice(-3) // Últimos 3 mensajes
    for (const msg of recentHistory) {
      const prefix = msg.from === 'user' ? '👤 Cliente' : '🤖 Bot'
      message += `${prefix}: ${msg.text}\n`
    }
    message += `\n`
  }
  
  // Mensaje actual del cliente
  message += `💬 Mensaje actual:\n`
  message += `"${messageText}"\n\n`
  message += `${separator}\n\n`
  message += `✅ Responde aquí normalmente.\n`
  message += `💡 Tip: Incluí el número del cliente si hay múltiples conversaciones.\n`
  message += `📝 Ejemplo: "+54 9 11 XXXX-XXXX Tu respuesta aquí"`

  return message
}

/**
 * Reenviar mensaje del cliente a operador cuando hay múltiples conversaciones
 * Formato especial para manejar contexto
 */
export async function forwardToOperatorWithContext(
  conversationId: string,
  clientPhone: string,
  clientName: string | null,
  messageText: string,
  operator: Operator,
  conversationNumber: number, // Número de conversación en la lista del operador
  totalConversations: number // Total de conversaciones pendientes
): Promise<void> {
  try {
    const notificationMessage = buildMultiConversationMessage(
      conversationId,
      clientPhone,
      clientName,
      messageText,
      conversationNumber,
      totalConversations
    )

    await sendWhatsAppMessage(operator.phone, notificationMessage)

    logger.info('Mensaje reenviado a operador (múltiples conversaciones)', {
      conversationId,
      operator: operator.name,
      conversationNumber,
      totalConversations
    })
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('Error reenviando mensaje con contexto', {
      conversationId,
      operator: operator.name,
      error: msg
    })
    throw error
  }
}

/**
 * Construir mensaje para múltiples conversaciones simultáneas
 */
function buildMultiConversationMessage(
  conversationId: string,
  clientPhone: string,
  clientName: string | null,
  messageText: string,
  conversationNumber: number,
  totalConversations: number
): string {
  const clientDisplay = clientName || clientPhone
  const separator = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  
  let message = `🔔 Conversación #${conversationNumber} de ${totalConversations}\n\n`
  message += `${separator}\n`
  message += `📋 Cliente: ${clientDisplay}\n`
  message += `📞 Teléfono: ${clientPhone}\n`
  message += `🆔 ID: ${conversationId}\n`
  message += `${separator}\n\n`
  message += `💬 Mensaje:\n`
  message += `"${messageText}"\n\n`
  message += `${separator}\n\n`
  message += `✅ Responde normalmente o incluí el número del cliente.\n`
  message += `💡 Ejemplo: "${clientPhone} Tu respuesta aquí"`

  return message
}

/**
 * Detectar si un mensaje entrante es una respuesta de un operador
 * Analiza el mensaje para determinar si viene de un operador y a qué cliente reenviar
 */
export async function detectOperatorResponse(
  fromPhone: string,
  messageText: string
): Promise<{
  isOperatorResponse: boolean
  operator?: Operator
  targetClientPhone?: string
  cleanMessage?: string
} | null> {
  try {
    // Verificar si el número pertenece a un operador
    const operator = getOperatorByPhone(fromPhone)
    
    if (!operator) {
      return { isOperatorResponse: false }
    }

    // Buscar número de cliente en el mensaje (formato: +54 9 11 XXXX-XXXX o variantes)
    const phonePattern = /(\+?54\s?9?\s?11\s?\d{4}[-]?\d{4}|\+?54\s?9?\s?11\s?\d{8})/g
    const phoneMatches = messageText.match(phonePattern)
    
    let targetClientPhone: string | undefined
    let cleanMessage = messageText

    if (phoneMatches && phoneMatches.length > 0) {
      // Extraer el primer número encontrado
      targetClientPhone = normalizePhone(phoneMatches[0])
      
      // Remover el número del mensaje para limpiarlo
      cleanMessage = messageText
        .replace(phonePattern, '')
        .replace(/^\s*[-:]\s*/, '') // Remover guiones o dos puntos después del número
        .trim()
    } else {
      // Si no hay número explícito, buscar la conversación más reciente asignada a este operador
      const recentConversation = await findMostRecentAssignedConversation(operator.phone)
      
      if (recentConversation) {
        targetClientPhone = recentConversation.clientPhone
        logger.info('Conversación detectada automáticamente', {
          operator: operator.name,
          conversationId: recentConversation.conversationId,
          clientPhone: maskPhone(targetClientPhone)
        })
      } else {
        // Si no hay conversación reciente, buscar todas las asignadas y usar la primera sin respuesta
        const pendingConversation = await findPendingAssignedConversation(operator.phone)
        
        if (pendingConversation) {
          targetClientPhone = pendingConversation.clientPhone
          logger.info('Conversación pendiente detectada', {
            operator: operator.name,
            conversationId: pendingConversation.conversationId,
            clientPhone: maskPhone(targetClientPhone)
          })
        }
      }
    }

    if (!targetClientPhone) {
      logger.warn('No se pudo determinar cliente destino para respuesta de operador', {
        operator: operator.name,
        operatorPhone: maskPhone(fromPhone),
        messagePreview: messageText.substring(0, 50)
      })
      
      return {
        isOperatorResponse: true,
        operator,
        targetClientPhone: undefined,
        cleanMessage
      }
    }

    return {
      isOperatorResponse: true,
      operator,
      targetClientPhone,
      cleanMessage
    }
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('Error detectando respuesta de operador', {
      fromPhone: maskPhone(fromPhone),
      error: msg
    })
    return null
  }
}

/**
 * Reenviar respuesta del operador al cliente
 */
export async function forwardOperatorResponseToClient(
  conversationId: string,
  clientPhone: string,
  messageText: string,
  operator: Operator
): Promise<void> {
  try {
    // Enviar mensaje al cliente desde el número del chatbot
    await enqueueOutbox(conversationId, clientPhone, messageText)

    // Actualizar última respuesta del operador en la conversación
    await collections.conversations().doc(conversationId).update({
      lastOperatorResponse: {
        operatorName: operator.name,
        operatorPhone: operator.phone,
        timestamp: new Date(),
        message: messageText
      },
      updatedAt: new Date()
    })

    logger.info('Respuesta de operador reenviada al cliente', {
      conversationId,
      operator: operator.name,
      clientPhone: maskPhone(clientPhone),
      messageLength: messageText.length
    })
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('Error reenviando respuesta de operador', {
      conversationId,
      operator: operator.name,
      error: msg
    })
    throw error
  }
}

/**
 * Reenviar mensaje del cliente al operador (actualización de conversación existente)
 */
export async function forwardClientUpdateToOperator(
  conversationId: string,
  clientPhone: string,
  clientName: string | null,
  messageText: string,
  operator: Operator
): Promise<void> {
  try {
    const updateMessage = `📨 Actualización de conversación\n\n`
      + `Cliente: ${clientName || clientPhone}\n`
      + `Teléfono: ${clientPhone}\n`
      + `ID: ${conversationId}\n\n`
      + `💬 Nuevo mensaje:\n`
      + `"${messageText}"\n\n`
      + `✅ Responde normalmente.`

    await sendWhatsAppMessage(operator.phone, updateMessage)

    logger.info('Actualización reenviada a operador', {
      conversationId,
      operator: operator.name,
      clientPhone: maskPhone(clientPhone)
    })
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('Error reenviando actualización a operador', {
      conversationId,
      operator: operator.name,
      error: msg
    })
    throw error
  }
}

/**
 * Buscar la conversación más reciente asignada a un operador
 */
async function findMostRecentAssignedConversation(
  operatorPhone: string
): Promise<{ conversationId: string; clientPhone: string } | null> {
  try {
    const snapshot = await collections.conversations()
      .where('assignedTo', '==', operatorPhone)
      .orderBy('lastMessageAt', 'desc')
      .limit(1)
      .get()

    if (snapshot.empty) {
      return null
    }

    const doc = snapshot.docs[0]
    const data = doc.data()

    return {
      conversationId: doc.id,
      clientPhone: data.phone
    }
  } catch (error) {
    logger.error('Error buscando conversación reciente', { error: (error as Error)?.message })
    return null
  }
}

/**
 * Buscar conversación pendiente asignada a un operador (sin respuesta del operador)
 */
async function findPendingAssignedConversation(
  operatorPhone: string
): Promise<{ conversationId: string; clientPhone: string } | null> {
  try {
    const snapshot = await collections.conversations()
      .where('assignedTo', '==', operatorPhone)
      .where('needsReply', '==', true)
      .orderBy('lastMessageAt', 'desc')
      .limit(1)
      .get()

    if (snapshot.empty) {
      return null
    }

    const doc = snapshot.docs[0]
    const data = doc.data()

    return {
      conversationId: doc.id,
      clientPhone: data.phone
    }
  } catch (error) {
    logger.error('Error buscando conversación pendiente', { error: (error as Error)?.message })
    return null
  }
}

/**
 * Normalizar número de teléfono
 */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  
  if (cleaned.startsWith('54')) {
    return '+' + cleaned
  }
  
  if (cleaned.startsWith('9')) {
    return '+54' + cleaned
  }
  
  if (/^\d+$/.test(cleaned)) {
    return '+549' + cleaned
  }
  
  return phone
}

/**
 * Enmascarar número de teléfono para logs
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return phone
  return phone.slice(0, 4) + '***' + phone.slice(-4)
}

