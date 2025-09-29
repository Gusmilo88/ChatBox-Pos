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
} from '../../shared/types/conversations'

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
    const messagesSnapshot = await collections.messages(id)
      .orderBy('ts', 'asc')
      .get()

    const messages: Message[] = messagesSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ts: data.ts?.toDate?.()?.toISOString() || new Date().toISOString(),
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

    // Crear mensaje en outbox
    const outboxId = uuidv4()
    const outboxData: OutboxMessage = {
      id: outboxId,
      conversationId,
      phone: conversationData.phone,
      text: sanitizedText,
      createdAt: now.toISOString(),
      status: 'pending',
      tries: 0,
      idempotencyKey
    }

    await collections.outbox().doc(outboxId).set(outboxData)

    // Actualizar conversación
    await collections.conversations().doc(conversationId).update({
      lastMessageAt: now,
      needsReply: false,
      updatedAt: now
    })

    logger.info('reply_enqueued', {
      conversationId,
      outboxId,
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
