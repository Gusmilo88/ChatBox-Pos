import { collections } from '../firebase'
import { v4 as uuidv4 } from 'uuid'
import logger from '../libs/logger'
import type {
  ConversationListItem,
  ConversationListResponse,
  ConversationDetail,
  Message,
  IncomingMessageRequest,
  ReplyRequest,
  OutboxMessage
} from '../types/conversations'

// Normalizar phone a E.164
function normalizePhone(phone: string): string {
  // Remover espacios y caracteres especiales
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  // Si ya empieza con +, devolverlo
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  
  // Si empieza con 54, agregar +
  if (cleaned.startsWith('54')) {
    return '+' + cleaned
  }
  
  // Si empieza con 9, agregar +54
  if (cleaned.startsWith('9')) {
    return '+54' + cleaned
  }
  
  // Si es solo números, asumir que es argentino
  if (/^\d+$/.test(cleaned)) {
    return '+549' + cleaned
  }
  
  throw new Error('Formato de teléfono inválido')
}

// Enmascarar PII en logs
function maskPII(text: string): string {
  if (!text) return text
  return text.replace(/\b(\d{2}-\d{6,}-\d|\+?\d{1,3}\s?\d{1,4}\s?\d{4,}-\d{4})\b/g, (match) => {
    if (match.length > 8) {
      return match.slice(0, 3) + '***' + match.slice(-4)
    }
    return match
  })
}

// Sanitizar texto
function sanitizeText(text: string): string {
  return text.trim().slice(0, 2000)
}

export async function listConversations(params: {
  query?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  isClient?: boolean
  needsReply?: boolean
}): Promise<ConversationListResponse> {
  const {
    query = '',
    from,
    to,
    page = 1,
    pageSize = 25,
    isClient,
    needsReply
  } = params

  try {
    let queryRef = collections.conversations().orderBy('lastMessageAt', 'desc')

    // Filtros
    if (isClient !== undefined) {
      queryRef = queryRef.where('isClient', '==', isClient)
    }
    if (needsReply !== undefined) {
      queryRef = queryRef.where('needsReply', '==', needsReply)
    }
    if (from) {
      queryRef = queryRef.where('lastMessageAt', '>=', from)
    }
    if (to) {
      queryRef = queryRef.where('lastMessageAt', '<=', to)
    }

    // Paginación
    const offset = (page - 1) * pageSize
    queryRef = queryRef.offset(offset).limit(pageSize)

    const snapshot = await queryRef.get()
    const items: ConversationListItem[] = []

    for (const doc of snapshot.docs) {
      const data = doc.data()
      
      // Filtro de búsqueda por texto
      if (query) {
        const searchText = `${data.phone || ''} ${data.name || ''}`.toLowerCase()
        if (!searchText.includes(query.toLowerCase())) {
          continue
        }
      }

      items.push({
        id: doc.id,
        phone: data.phone,
        name: data.name,
        isClient: data.isClient || false,
        lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        unreadCount: data.unreadCount || 0,
        needsReply: data.needsReply || false
      })
    }

    // Contar total (aproximado)
    const totalSnapshot = await collections.conversations().get()
    const total = totalSnapshot.size

    logger.info('conversations_listed', {
      page,
      pageSize,
      total: items.length,
      filters: { query: maskPII(query), isClient, needsReply }
    })

    return {
      items,
      page,
      pageSize,
      total
    }
  } catch (error) {
    logger.error('error_listing_conversations', { error: error.message })
    throw new Error('Error al listar conversaciones')
  }
}

export async function getConversationById(id: string): Promise<ConversationDetail> {
  try {
    const conversationDoc = await collections.conversations().doc(id).get()
    
    if (!conversationDoc.exists) {
      throw new Error('Conversación no encontrada')
    }

    const conversationData = conversationDoc.data()
    
    // Obtener mensajes
    const messagesSnapshot = await conversationDoc.ref.collection('messages')
      .orderBy('timestamp', 'asc')
      .get()

    const messages: Message[] = messagesSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        timestamp: data.timestamp || data.ts?.toDate?.()?.toISOString() || new Date().toISOString(),
        from: data.from,
        text: data.text,
        via: data.via,
        aiSuggested: data.aiSuggested || false
      }
    })

    const conversation: ConversationDetail = {
      id: conversationDoc.id,
      phone: conversationData.phone,
      name: conversationData.name,
      isClient: conversationData.isClient || false,
      needsReply: conversationData.needsReply || false,
      messages
    }

    logger.info('conversation_retrieved', {
      conversationId: id,
      phone: maskPII(conversationData.phone),
      messageCount: messages.length
    })

    return conversation
  } catch (error) {
    logger.error('error_getting_conversation', { 
      conversationId: id, 
      error: error.message 
    })
    throw new Error('Error al obtener conversación')
  }
}

export async function simulateIncoming(request: IncomingMessageRequest): Promise<{ conversationId: string }> {
  try {
    const { phone, text, via = 'manual' } = request
    const normalizedPhone = normalizePhone(phone)
    const sanitizedText = sanitizeText(text)
    const now = new Date()

    // Buscar conversación existente por teléfono
    const existingConversation = await collections.conversations()
      .where('phone', '==', normalizedPhone)
      .limit(1)
      .get()

    let conversationId: string
    let conversationData: any

    if (existingConversation.empty) {
      // Crear nueva conversación
      conversationId = uuidv4()
      conversationData = {
        phone: normalizedPhone,
        name: null,
        isClient: false, // Se determinará después
        lastMessageAt: now,
        unreadCount: 1,
        needsReply: false,
        createdAt: now,
        updatedAt: now
      }
      
      await collections.conversations().doc(conversationId).set(conversationData)
      
      logger.info('conversation_created', {
        conversationId,
        phone: maskPII(normalizedPhone)
      })
    } else {
      // Usar conversación existente
      const doc = existingConversation.docs[0]
      conversationId = doc.id
      conversationData = doc.data()
      
      // Actualizar contadores
      await collections.conversations().doc(conversationId).update({
        lastMessageAt: now,
        unreadCount: (conversationData.unreadCount || 0) + 1,
        updatedAt: now
      })
    }

    // Crear mensaje
    const messageId = uuidv4()
    const messageData = {
      ts: now,
      from: 'usuario' as const,
      text: sanitizedText,
      via,
      aiSuggested: false
    }

    await collections.messages(conversationId).doc(messageId).set(messageData)

    logger.info('message_created', {
      conversationId,
      messageId,
      phone: maskPII(normalizedPhone),
      textLength: sanitizedText.length,
      via
    })

    return { conversationId }
  } catch (error) {
    logger.error('error_simulating_incoming', { 
      phone: maskPII(phone), 
      error: error.message 
    })
    throw new Error('Error al simular mensaje entrante')
  }
}

export async function enqueueReply(conversationId: string, request: ReplyRequest): Promise<void> {
  try {
    const { text, idempotencyKey } = request
    const sanitizedText = sanitizeText(text)

    if (sanitizedText.length < 1 || sanitizedText.length > 2000) {
      throw new Error('El texto debe tener entre 1 y 2000 caracteres')
    }

    // Obtener conversación
    const conversationDoc = await collections.conversations().doc(conversationId).get()
    
    if (!conversationDoc.exists) {
      throw new Error('Conversación no encontrada')
    }

    const conversationData = conversationDoc.data()
    const now = new Date()

    // 1. Agregar mensaje del operador a la conversación (optimista)
    await appendOperatorMessage(conversationId, sanitizedText)

    // 2. Encolar en outbox para envío
    await enqueueOutbox(conversationId, conversationData.phone, sanitizedText, idempotencyKey)

    logger.info('reply_enqueued_successfully', {
      conversationId,
      phone: maskPII(conversationData.phone),
      textLength: sanitizedText.length,
      idempotencyKey
    })
  } catch (error) {
    logger.error('error_enqueuing_reply', { 
      conversationId, 
      error: error.message 
    })
    throw new Error('Error al encolar respuesta')
  }
}

/**
 * Helper para agregar mensaje del operador a una conversación
 */
export async function appendOperatorMessage(
  conversationId: string, 
  text: string
): Promise<string> {
  try {
    const conversationRef = collections.conversations().doc(conversationId)
    
    // Verificar que la conversación existe
    const conversationDoc = await conversationRef.get()
    if (!conversationDoc.exists) {
      throw new Error('Conversación no encontrada')
    }

    const now = new Date()
    const messageId = uuidv4()
    
    // Crear mensaje
    const message: Message = {
      id: messageId,
      text: sanitizeText(text),
      from: 'operador',
      timestamp: now.toISOString(),
      isFromUs: true,
      deliveryStatus: 'pending'
    }

    // Guardar mensaje en subcolección
    await conversationRef.collection('messages').doc(messageId).set(message)

    // Actualizar conversación
    await conversationRef.update({
      lastMessageAt: now.toISOString(),
      lastMessage: sanitizeText(text),
      unreadCount: 0, // Para el operador
      updatedAt: now.toISOString()
    })

    logger.info('operator_message_added', {
      conversationId,
      messageId,
      textLength: text.length
    })

    return messageId
  } catch (error) {
    logger.error('error_adding_operator_message', {
      conversationId,
      error: error.message
    })
    throw error
  }
}

/**
 * Helper para encolar mensaje en outbox
 */
export async function enqueueOutbox(
  conversationId: string,
  phone: string,
  text: string,
  idempotencyKey?: string
): Promise<string> {
  try {
    const outboxId = uuidv4()
    const now = new Date()

    const outboxData = {
      id: outboxId,
      conversationId,
      phone: normalizePhone(phone),
      text: sanitizeText(text),
      createdAt: now,
      status: 'pending',
      tries: 0,
      idempotencyKey
    }

    await collections.outbox().doc(outboxId).set(outboxData)

    logger.info('message_enqueued', {
      conversationId,
      outboxId,
      phone: maskPII(phone),
      textLength: text.length,
      idempotencyKey
    })

    return outboxId
  } catch (error) {
    logger.error('error_enqueuing_message', {
      conversationId,
      error: error.message
    })
    throw error
  }
}

/**
 * Helper para marcar estado de entrega de un mensaje
 */
export async function markMessageDelivery(
  conversationId: string,
  messageId: string,
  status: 'sent' | 'failed'
): Promise<void> {
  try {
    const conversationRef = collections.conversations().doc(conversationId)
    const messageRef = conversationRef.collection('messages').doc(messageId)

    // Verificar que el mensaje existe
    const messageDoc = await messageRef.get()
    if (!messageDoc.exists) {
      throw new Error('Mensaje no encontrado')
    }

    // Actualizar estado de entrega
    await messageRef.update({
      deliveryStatus: status,
      deliveryUpdatedAt: new Date().toISOString()
    })

    logger.info('message_delivery_updated', {
      conversationId,
      messageId,
      status
    })
  } catch (error) {
    logger.error('error_updating_delivery_status', {
      conversationId,
      messageId,
      error: error.message
    })
    throw error
  }
}
