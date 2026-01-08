import { collections } from '../firebase'
import { v4 as uuidv4 } from 'uuid'
import { Timestamp } from 'firebase-admin/firestore'
import logger from '../libs/logger'
import { generateBotReply } from './botReply'
import { detectDerivation } from './autoDerivation'
import { forwardToOperator, forwardClientUpdateToOperator } from './operatorForwarding'
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

/**
 * Detecta si un mensaje contiene palabras clave de urgencia
 * Retorna true si el mensaje indica urgencia
 */
function detectUrgency(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false
  }

  const textLower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Normalizar acentos
  
  // Palabras clave de urgencia (sin acentos para detectar variantes)
  const urgencyKeywords = [
    'urgente',
    'urgent',
    'asap',
    'inmediato',
    'inmediata',
    'emergencia',
    'emergency',
    'importante',
    'important',
    'prioritario',
    'priority',
    'rapido',
    'rapida',
    'rapid',
    'ya',
    'ahora',
    'now',
    'necesito ya',
    'necesito ahora',
    'necesito urgente'
  ]

  // Verificar si alguna palabra clave está presente
  return urgencyKeywords.some(keyword => {
    // Buscar palabra completa (no solo substring para evitar falsos positivos)
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    return regex.test(textLower)
  })
}

export async function listConversations(params: {
  query?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  isClient?: boolean
  needsReply?: boolean
  userEmail?: string // Email del usuario actual (para filtrar por assignedTo)
  userRole?: 'owner' | 'operador' // Rol del usuario (owner ve todo, operador solo sus asignados)
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
    logger.info('listConversations called', { 
      query: maskPII(query), 
      from, 
      to, 
      isClient, 
      needsReply, 
      page, 
      pageSize 
    })

    // ESTRATEGIA: Obtener todos los documentos y filtrar en memoria
    // Esto evita problemas con índices compuestos de Firestore
    const allDocsSnapshot = await collections.conversations()
      .orderBy('lastMessageAt', 'desc')
      .get()
    
    logger.info('Firestore query result (all docs)', { 
      totalDocs: allDocsSnapshot.size
    })
    
    // Aplicar TODOS los filtros en memoria
    let filteredDocs = allDocsSnapshot.docs
    
    // Filtro por texto (teléfono o nombre)
    if (query && query.trim()) {
      const queryLower = query.trim().toLowerCase()
      filteredDocs = filteredDocs.filter(doc => {
        const data = doc.data()
        const searchText = `${data.phone || ''} ${data.name || ''}`.toLowerCase()
        return searchText.includes(queryLower)
      })
      logger.info('After text filter', { 
        originalCount: allDocsSnapshot.size, 
        filteredCount: filteredDocs.length,
        query: maskPII(query)
      })
    }
    
    // Filtro por fecha "desde"
    if (from) {
      try {
        const fromDate = new Date(from)
        fromDate.setHours(0, 0, 0, 0) // Inicio del día
        if (!isNaN(fromDate.getTime())) {
          const beforeCount = filteredDocs.length
          filteredDocs = filteredDocs.filter(doc => {
            const data = doc.data()
            const lastMessageAt = data.lastMessageAt
            if (!lastMessageAt) return false
            
            // Convertir Timestamp a Date
            const docDate = lastMessageAt.toDate ? lastMessageAt.toDate() : new Date(lastMessageAt)
            return docDate >= fromDate
          })
          logger.info('Applied from filter', { 
            from, 
            beforeCount, 
            afterCount: filteredDocs.length 
          })
        } else {
          logger.warn('Invalid from date', { from })
        }
      } catch (error) {
        logger.error('Error parsing from date', { from, error: (error as Error)?.message })
      }
    }
    
    // Filtro por fecha "hasta"
    if (to) {
      try {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999) // Final del día
        if (!isNaN(toDate.getTime())) {
          const beforeCount = filteredDocs.length
          filteredDocs = filteredDocs.filter(doc => {
            const data = doc.data()
            const lastMessageAt = data.lastMessageAt
            if (!lastMessageAt) return false
            
            // Convertir Timestamp a Date
            const docDate = lastMessageAt.toDate ? lastMessageAt.toDate() : new Date(lastMessageAt)
            return docDate <= toDate
          })
          logger.info('Applied to filter', { 
            to, 
            beforeCount, 
            afterCount: filteredDocs.length 
          })
        } else {
          logger.warn('Invalid to date', { to })
        }
      } catch (error) {
        logger.error('Error parsing to date', { to, error: (error as Error)?.message })
      }
    }
    
    // Filtro por isClient
    if (isClient !== undefined) {
      const beforeCount = filteredDocs.length
      filteredDocs = filteredDocs.filter(doc => {
        const data = doc.data()
        return (data.isClient || false) === isClient
      })
      logger.info('Applied isClient filter', { 
        isClient, 
        beforeCount, 
        afterCount: filteredDocs.length 
      })
    }
    
    // Filtro por needsReply
    if (needsReply !== undefined) {
      const beforeCount = filteredDocs.length
      filteredDocs = filteredDocs.filter(doc => {
        const data = doc.data()
        return (data.needsReply || false) === needsReply
      })
      logger.info('Applied needsReply filter', { 
        needsReply, 
        beforeCount, 
        afterCount: filteredDocs.length 
      })
    }

    // Filtro por assignedTo según rol del usuario
    // Si es operador, solo ver sus conversaciones asignadas
    // Si es owner, ver todas (pero puede filtrar por assignedTo si quiere)
    if (params.userRole === 'operador' && params.userEmail) {
      const beforeCount = filteredDocs.length
      filteredDocs = filteredDocs.filter(doc => {
        const data = doc.data()
        // Operador solo ve conversaciones asignadas a él
        return data.assignedTo === params.userEmail
      })
      logger.info('Applied assignedTo filter for operador', { 
        userEmail: params.userEmail,
        beforeCount, 
        afterCount: filteredDocs.length 
      })
    }

    // Calcular total después de todos los filtros
    const total = filteredDocs.length

    // Aplicar paginación
    const offset = (page - 1) * pageSize
    const paginatedDocs = filteredDocs.slice(offset, offset + pageSize)
    
    logger.info('Pagination applied', { 
      total, 
      offset, 
      pageSize, 
      paginatedCount: paginatedDocs.length 
    })

    // Obtener últimos mensajes en paralelo para las conversaciones paginadas
    const lastMessagesPromises = paginatedDocs.map(async (doc) => {
      let lastMessage: string | undefined
      try {
        const messagesRef = collections.messages(doc.id)
        
        // Intentar con orderBy primero
        try {
          const messagesSnapshot = await messagesRef
            .orderBy('ts', 'desc')
            .limit(1)
            .get()
          
          if (!messagesSnapshot.empty) {
            const messageData = messagesSnapshot.docs[0].data()
            lastMessage = messageData.text || messageData.message || undefined
          }
        } catch (orderError) {
          // Si falla por falta de índice, obtener todos y ordenar en memoria
          const allMessages = await messagesRef.get()
          if (!allMessages.empty) {
            const sortedMessages = allMessages.docs
              .map(d => ({ data: d.data(), id: d.id }))
              .sort((a, b) => {
                const aTs = a.data.ts?.toMillis?.() || a.data.ts?.getTime?.() || new Date(a.data.ts || 0).getTime()
                const bTs = b.data.ts?.toMillis?.() || b.data.ts?.getTime?.() || new Date(b.data.ts || 0).getTime()
                return bTs - aTs
              })
            
            if (sortedMessages.length > 0) {
              lastMessage = sortedMessages[0].data.text || sortedMessages[0].data.message || undefined
            }
          }
        }
        
        // Limitar longitud del mensaje para la vista previa
        if (lastMessage && lastMessage.length > 50) {
          lastMessage = lastMessage.substring(0, 50) + '...'
        }
      } catch (error) {
        // Si falla completamente, continuar sin último mensaje
        const msg = (error instanceof Error) ? error.message : String(error)
        logger.debug('Could not fetch last message', { conversationId: doc.id, error: msg })
      }
      return { doc, lastMessage }
    })

    // Esperar todas las consultas de mensajes en paralelo
    const results = await Promise.all(lastMessagesPromises)
    
    // Construir items
    const items: ConversationListItem[] = []
    for (const { doc, lastMessage } of results) {
      const data = doc.data()
      
      const item: ConversationListItem = {
        id: doc.id,
        phone: data.phone,
        name: data.name,
        isClient: data.isClient || false,
        lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        unreadCount: data.unreadCount || 0,
        needsReply: data.needsReply || false,
        lastMessage,
        assignedTo: data.assignedTo || undefined
      }
      
      items.push(item)
    }
    
    logger.info('Conversations processed', { 
      totalItems: items.length,
      sampleItems: items.slice(0, 3).map(i => ({ 
        id: i.id, 
        phone: i.phone, 
        hasLastMessage: !!i.lastMessage 
      }))
    })

    logger.info('conversations_listed', {
      page,
      pageSize,
      itemsReturned: items.length,
      totalAfterFilters: total,
      filters: { 
        query: maskPII(query), 
        from, 
        to, 
        isClient, 
        needsReply 
      }
    })

    return {
      conversations: items,
      page,
      pageSize,
      total // Total después de aplicar todos los filtros
    }
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('error_listing_conversations', { error: msg })
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
    let messagesSnapshot
    try {
      // Intentar con 'ts' primero (campo real en Firestore)
      messagesSnapshot = await conversationDoc.ref.collection('messages')
        .orderBy('ts', 'asc')
        .get()
    } catch (error) {
      // Si falla, intentar sin ordenar y ordenar en memoria
      logger.debug('orderBy ts failed, fetching all messages', { conversationId: id })
      messagesSnapshot = await conversationDoc.ref.collection('messages').get()
    }

    const messages: Message[] = messagesSnapshot.docs
      .map(doc => {
        const data = doc.data()
        // Obtener timestamp de 'ts' o 'timestamp'
        let timestamp: string
        if (data.ts) {
          timestamp = data.ts?.toDate?.()?.toISOString() || data.ts?.toMillis?.() ? new Date(data.ts.toMillis()).toISOString() : new Date(data.ts).toISOString()
        } else if (data.timestamp) {
          timestamp = typeof data.timestamp === 'string' ? data.timestamp : data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
        } else {
          timestamp = new Date().toISOString()
        }
        
        return {
          id: doc.id,
          timestamp,
          from: data.from || 'usuario',
          text: data.text || data.message || '',
          via: data.via,
          aiSuggested: data.aiSuggested || false,
          deliveryStatus: data.deliveryStatus
        }
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) // Ordenar por timestamp

    logger.info('Messages retrieved', {
      conversationId: id,
      messageCount: messages.length,
      sampleMessages: messages.slice(0, 2).map(m => ({ id: m.id, from: m.from, textPreview: m.text.substring(0, 30) }))
    })

    const conversation: ConversationDetail = {
      id: conversationDoc.id,
      phone: conversationData?.phone ?? '',
      name: conversationData?.name,
      isClient: conversationData?.isClient ?? false,
      needsReply: conversationData?.needsReply ?? false,
      messages,
      assignedTo: conversationData?.assignedTo || undefined
    }

    logger.info('conversation_retrieved', {
      conversationId: id,
      phone: maskPII(conversationData?.phone ?? ''),
      messageCount: messages.length
    })

    return conversation
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('error_getting_conversation', { 
      conversationId: id, 
      error: msg 
    })
    throw new Error('Error al obtener conversación')
  }
}

export async function simulateIncoming(request: IncomingMessageRequest): Promise<{ conversationId: string }> {
  const { phone, text, via = 'manual' } = request
  
  try {
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

    // Detectar urgencia en el mensaje del usuario ANTES de generar respuesta
    const isUrgentMessage = detectUrgency(sanitizedText);
    
    if (isUrgentMessage) {
      logger.info('urgent_message_detected', {
        conversationId,
        phone: maskPII(normalizedPhone),
        messagePreview: sanitizedText.substring(0, 50)
      });
    }

    // Generar respuesta automática usando IA (principal) o FSM (fallback)
    try {
      const botResponse = await generateBotReply(normalizedPhone, sanitizedText, conversationId);
      
      // Verificar si la respuesta indica derivación a humano
      const isHumanTransfer = botResponse.replies.some(reply => 
        reply.includes('derivamos con el equipo') || 
        reply.includes('te contactará un profesional') ||
        reply.includes('te derivamos')
      );
      
      // DETECCIÓN AUTOMÁTICA DE DERIVACIÓN
      // Analizar el mensaje del cliente para determinar a qué operador derivar
      const derivationResult = detectDerivation(sanitizedText);
      let shouldAutoDerive = false;
      let derivedOperator = null;
      
      if (isHumanTransfer && derivationResult.shouldDerive && derivationResult.operator) {
        shouldAutoDerive = true;
        derivedOperator = derivationResult.operator;
        
        logger.info('auto_derivation_detected', {
          conversationId,
          operator: derivedOperator.name,
          reason: derivationResult.reason,
          phone: maskPII(normalizedPhone)
        });
      }
      
      // Marcar como needsReply si: mensaje es urgente O se deriva a humano
      const shouldMarkAsNeedsReply = isUrgentMessage || isHumanTransfer;
      
      if (botResponse.replies && botResponse.replies.length > 0) {
        // Encolar respuestas automáticas
        for (const reply of botResponse.replies) {
          const replyIdempotencyKey = `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          await enqueueOutbox(conversationId, normalizedPhone, reply, replyIdempotencyKey);
          
          // Guardar mensaje del sistema en la conversación
          const systemMessageId = uuidv4();
          const systemMessageData = {
            ts: new Date(),
            from: 'system' as const,
            text: reply,
            via: botResponse.via === 'ai' ? 'ia' as const : 'whatsapp' as const,
            aiSuggested: botResponse.via === 'ai'
          };
          
          await collections.messages(conversationId).doc(systemMessageId).set(systemMessageData);
          
          logger.info('auto_reply_generated', {
            conversationId,
            phone: maskPII(normalizedPhone),
            via: botResponse.via,
            replyLength: reply.length,
            isHumanTransfer,
            isUrgentMessage
          });
        }
        
        // Si se detectó derivación automática, enviar mensaje específico al cliente
        if (shouldAutoDerive && derivedOperator) {
          const derivationMessage = `Te derivamos con ${derivedOperator.name}. En breve te responderá. ¡Gracias! 🙌`;
          
          const derivationIdempotencyKey = `derive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          await enqueueOutbox(conversationId, normalizedPhone, derivationMessage, derivationIdempotencyKey);
          
          // Guardar mensaje de derivación
          const derivationMessageId = uuidv4();
          await collections.messages(conversationId).doc(derivationMessageId).set({
            ts: new Date(),
            from: 'system' as const,
            text: derivationMessage,
            via: 'whatsapp' as const,
            aiSuggested: false
          });
          
          // Obtener historial de mensajes para el operador
          const messagesSnapshot = await collections.messages(conversationId)
            .orderBy('ts', 'desc')
            .limit(10)
            .get();
          
          const messageHistory = messagesSnapshot.docs
            .reverse()
            .map(doc => {
              const data = doc.data();
              return {
                from: data.from === 'usuario' ? 'user' as const : 'bot' as const,
                text: data.text || '',
                timestamp: data.ts?.toDate?.()?.toISOString() || new Date().toISOString()
              };
            });
          
          // Reenviar al operador
          try {
            await forwardToOperator(
              conversationId,
              normalizedPhone,
              conversationData?.name || null,
              sanitizedText,
              derivedOperator,
              messageHistory
            );
            
            logger.info('auto_derivation_completed', {
              conversationId,
              operator: derivedOperator.name,
              operatorPhone: derivedOperator.phone.replace(/\d(?=\d{4})/g, '*')
            });
          } catch (error) {
            const msg = (error instanceof Error) ? error.message : String(error);
            logger.error('error_forwarding_to_operator', {
              conversationId,
              operator: derivedOperator.name,
              error: msg
            });
            // No fallar la conversación si falla el reenvío
          }
        }
        
        // Actualizar conversación con último mensaje del sistema
        // Marcar como needsReply si: mensaje es urgente O se deriva a humano
        await collections.conversations().doc(conversationId).update({
          lastMessageAt: new Date(),
          lastMessage: botResponse.replies[0],
          needsReply: shouldMarkAsNeedsReply,
          updatedAt: new Date()
        });
        
        if (shouldMarkAsNeedsReply) {
          logger.info('conversation_marked_as_needs_reply', {
            conversationId,
            phone: maskPII(normalizedPhone),
            reason: isUrgentMessage ? 'urgent_keywords' : 'human_transfer'
          });
        }
      } else {
        // Si no hay respuesta del bot pero el mensaje es urgente, marcar igual
        if (isUrgentMessage) {
          await collections.conversations().doc(conversationId).update({
            needsReply: true,
            updatedAt: new Date()
          });
          
          logger.info('conversation_marked_as_needs_reply', {
            conversationId,
            phone: maskPII(normalizedPhone),
            reason: 'urgent_keywords_no_bot_reply'
          });
        }
      }
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error);
      logger.error('error_generating_auto_reply', {
        conversationId,
        phone: maskPII(normalizedPhone),
        error: msg
      });
      // No fallar la simulación si la respuesta automática falla
    }

    return { conversationId }
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('error_simulating_incoming', { 
      phone: maskPII(phone), 
      error: msg 
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
    await enqueueOutbox(conversationId, conversationData?.phone ?? '', sanitizedText, idempotencyKey)

    logger.info('reply_enqueued_successfully', {
      conversationId,
      phone: maskPII(conversationData?.phone ?? ''),
      textLength: sanitizedText.length,
      idempotencyKey
    })
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('error_enqueuing_reply', { 
      conversationId, 
      error: msg 
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
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('error_adding_operator_message', {
      conversationId,
      error: msg
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

    // CONTRATO UNIFICADO: Siempre usar phone, status:'pending', tries:0
    const outboxData = {
      id: outboxId,
      conversationId,
      phone: normalizePhone(phone), // SIEMPRE 'phone' (NO 'to')
      text: sanitizeText(text),
      createdAt: now,
      status: 'pending' as const, // SIEMPRE 'pending' al crear
      tries: 0, // SIEMPRE 0 al crear
      idempotencyKey: idempotencyKey || undefined,
      error: null,
      nextAttemptAt: null,
      sentAt: null
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
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('error_enqueuing_message', {
      conversationId,
      error: msg
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
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('error_updating_delivery_status', {
      conversationId,
      messageId,
      error: msg
    })
    throw error
  }
}

/**
 * Asignar una conversación a un operador (secretaria)
 * @param conversationId ID de la conversación
 * @param assignedTo Email del operador a asignar (null para desasignar)
 * @param notifyClient Si enviar mensaje automático al cliente
 * @returns Nombre del operador asignado (para el mensaje)
 */
export async function assignConversation(
  conversationId: string,
  assignedTo: string | null,
  notifyClient: boolean = true
): Promise<{ operatorName: string | null }> {
  try {
    const conversationRef = collections.conversations().doc(conversationId)
    const conversationDoc = await conversationRef.get()
    
    if (!conversationDoc.exists) {
      throw new Error('Conversación no encontrada')
    }

    const conversationData = conversationDoc.data()
    const phone = conversationData?.phone

    if (!phone) {
      throw new Error('La conversación no tiene teléfono asociado')
    }

    // Obtener nombre del operador si se asigna
    let operatorName: string | null = null
    if (assignedTo) {
      try {
        // Buscar admin por email para obtener nombre (si existe campo name)
        const adminSnapshot = await collections.admins()
          .where('email', '==', assignedTo.toLowerCase().trim())
          .limit(1)
          .get()
        
        if (!adminSnapshot.empty) {
          const adminData = adminSnapshot.docs[0].data()
          // Si hay campo name, usarlo; sino usar email sin dominio
          operatorName = adminData.name || assignedTo.split('@')[0]
        } else {
          // Si no existe en admins, usar email sin dominio
          operatorName = assignedTo.split('@')[0]
        }
      } catch (error) {
        // Si falla, usar email sin dominio
        operatorName = assignedTo.split('@')[0]
      }
    }

    // Actualizar conversación
    await conversationRef.update({
      assignedTo: assignedTo || null,
      updatedAt: new Date()
    })

    logger.info('conversation_assigned', {
      conversationId,
      assignedTo: assignedTo || 'null',
      operatorName,
      notifyClient
    })

    // Enviar mensaje automático al cliente si se solicita
    if (notifyClient && assignedTo && operatorName) {
      const notificationMessage = `Te derivamos con ${operatorName}. En breve te contactará para ayudarte. ¡Gracias! 🙌`
      
      // Agregar mensaje del sistema
      const messageId = uuidv4()
      const now = new Date()
      await conversationRef.collection('messages').doc(messageId).set({
        ts: now,
        from: 'sistema',
        text: notificationMessage,
        via: 'manual',
        aiSuggested: false
      })

      // Encolar mensaje para envío
      await enqueueOutbox(conversationId, phone, notificationMessage)

      logger.info('assignment_notification_sent', {
        conversationId,
        phone: maskPII(phone),
        operatorName
      })
    }

    return { operatorName }
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('error_assigning_conversation', {
      conversationId,
      assignedTo,
      error: msg
    })
    throw error
  }
}

