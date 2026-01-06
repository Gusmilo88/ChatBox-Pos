/**
 * SIMULADOR COMPLETO DEL BOT
 * 
 * Permite probar TODO el flujo del bot sin depender de Meta WhatsApp API.
 * Usa la lógica REAL del bot (simulateIncoming, derivación automática, etc.)
 * pero simula los envíos de WhatsApp.
 * 
 * USO:
 * - Simular mensaje de cliente: POST /api/simulator/client
 * - Simular respuesta de operador: POST /api/simulator/operator
 * - Ver estado: GET /api/simulator/status
 */

import { simulateIncoming } from './conversations'
import { detectOperatorResponse, forwardOperatorResponseToClient } from './operatorForwarding'
import { getOperatorByPhone, getAllOperators } from './autoDerivation'
import { collections } from '../firebase'
import logger from '../libs/logger'
import { v4 as uuidv4 } from 'uuid'

/**
 * Simular mensaje entrante de un cliente
 * Usa la lógica REAL del bot (simulateIncoming)
 */
export async function simulateClientMessage(
  phone: string,
  text: string
): Promise<{
  success: boolean
  conversationId?: string
  botReplies?: string[]
  derivedTo?: string
  error?: string
}> {
  try {
    logger.info('simulator_client_message', {
      phone: phone.replace(/\d(?=\d{4})/g, '*'),
      textLength: text.length
    })

    // Usar la lógica REAL del bot
    const result = await simulateIncoming({
      phone,
      text,
      via: 'simulator' // Marcar como simulación
    })

    // Obtener la conversación para ver si fue derivada
    const conversationDoc = await collections.conversations().doc(result.conversationId).get()
    const conversationData = conversationDoc.data()

    // Obtener respuestas del bot (mensajes del sistema)
    const messagesSnapshot = await collections.messages(result.conversationId)
      .where('from', '==', 'system')
      .orderBy('ts', 'desc')
      .limit(5)
      .get()

    const botReplies = messagesSnapshot.docs
      .map(doc => doc.data().text)
      .filter(text => text)
      .reverse() // Ordenar cronológicamente

    const response = {
      success: true,
      conversationId: result.conversationId,
      botReplies,
      derivedTo: conversationData?.assignedTo ? getOperatorName(conversationData.assignedTo) : undefined
    }

    logger.info('simulator_client_message_success', {
      conversationId: result.conversationId,
      botRepliesCount: botReplies.length,
      derivedTo: response.derivedTo
    })

    return response
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('simulator_client_message_error', { error: msg })
    return {
      success: false,
      error: msg
    }
  }
}

/**
 * Simular respuesta de un operador
 * Usa la lógica REAL de reenvío (forwardOperatorResponseToClient)
 */
export async function simulateOperatorResponse(
  operatorPhone: string,
  messageText: string,
  clientPhone?: string // Opcional: si no se especifica, usa la conversación más reciente
): Promise<{
  success: boolean
  conversationId?: string
  clientPhone?: string
  operatorName?: string
  error?: string
}> {
  try {
    logger.info('simulator_operator_response', {
      operatorPhone: operatorPhone.replace(/\d(?=\d{4})/g, '*'),
      messageLength: messageText.length,
      hasClientPhone: !!clientPhone
    })

    // Verificar que el operador existe
    const operator = getOperatorByPhone(operatorPhone)
    if (!operator) {
      return {
        success: false,
        error: `Operador no encontrado para el número ${operatorPhone}`
      }
    }

    // Buscar conversación
    let targetConversationId: string | null = null
    let targetClientPhone: string | null = null

    if (clientPhone) {
      // Buscar conversación específica por cliente
      const normalizedClientPhone = normalizePhone(clientPhone)
      const conversationSnapshot = await collections.conversations()
        .where('phone', '==', normalizedClientPhone)
        .where('assignedTo', '==', operatorPhone)
        .limit(1)
        .get()

      if (!conversationSnapshot.empty) {
        targetConversationId = conversationSnapshot.docs[0].id
        targetClientPhone = normalizedClientPhone
      }
    } else {
      // Buscar conversación más reciente asignada a este operador
      const conversationSnapshot = await collections.conversations()
        .where('assignedTo', '==', operatorPhone)
        .orderBy('lastMessageAt', 'desc')
        .limit(1)
        .get()

      if (!conversationSnapshot.empty) {
        const doc = conversationSnapshot.docs[0]
        targetConversationId = doc.id
        targetClientPhone = doc.data().phone
      }
    }

    if (!targetConversationId || !targetClientPhone) {
      return {
        success: false,
        error: 'No se encontró conversación asignada a este operador. Asegurate de que haya una conversación derivada primero.',
        operatorName: operator.name
      }
    }

    // Usar la lógica REAL de reenvío
    await forwardOperatorResponseToClient(
      targetConversationId,
      targetClientPhone,
      messageText,
      operator
    )

    // Guardar mensaje del operador en la conversación
    const messageId = uuidv4()
    await collections.messages(targetConversationId).doc(messageId).set({
      ts: new Date(),
      from: 'operador',
      text: messageText,
      via: 'simulator',
      aiSuggested: false
    })

    // Actualizar conversación
    await collections.conversations().doc(targetConversationId).update({
      lastMessageAt: new Date(),
      lastMessage: messageText,
      needsReply: false,
      updatedAt: new Date()
    })

    logger.info('simulator_operator_response_success', {
      conversationId: targetConversationId,
      operator: operator.name,
      clientPhone: targetClientPhone.replace(/\d(?=\d{4})/g, '*')
    })

    return {
      success: true,
      conversationId: targetConversationId,
      clientPhone: targetClientPhone,
      operatorName: operator.name
    }
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('simulator_operator_response_error', { error: msg })
    return {
      success: false,
      error: msg
    }
  }
}

/**
 * Obtener estado del simulador
 */
export async function getSimulatorStatus(): Promise<{
  operators: Array<{ name: string; phone: string; keywords: string[] }>
  recentConversations: Array<{
    id: string
    phone: string
    lastMessage: string
    assignedTo?: string
    needsReply: boolean
  }>
}> {
  try {
    // Obtener operadores configurados
    const operators = getAllOperators().map(op => ({
      name: op.name,
      phone: op.phone.replace(/\d(?=\d{4})/g, '*'), // Enmascarar
      keywords: op.keywords
    }))

    // Obtener conversaciones recientes (últimas 10)
    const conversationsSnapshot = await collections.conversations()
      .orderBy('lastMessageAt', 'desc')
      .limit(10)
      .get()

    const recentConversations = conversationsSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        phone: data.phone?.replace(/\d(?=\d{4})/g, '*') || 'N/A',
        lastMessage: data.lastMessage || 'Sin mensajes',
        assignedTo: data.assignedTo ? getOperatorName(data.assignedTo) : undefined,
        needsReply: data.needsReply || false
      }
    })

    return {
      operators,
      recentConversations
    }
  } catch (error) {
    logger.error('simulator_status_error', { error: (error as Error)?.message })
    throw error
  }
}

/**
 * Helper: Normalizar número de teléfono
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
 * Helper: Obtener nombre del operador por teléfono
 */
function getOperatorName(phone: string): string {
  const operator = getOperatorByPhone(phone)
  return operator?.name || phone.replace(/\d(?=\d{4})/g, '*')
}

