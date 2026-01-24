"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listConversations = listConversations;
exports.getConversationById = getConversationById;
exports.simulateIncoming = simulateIncoming;
exports.enqueueReply = enqueueReply;
exports.appendOperatorMessage = appendOperatorMessage;
exports.enqueueOutbox = enqueueOutbox;
exports.enqueueInteractiveOutbox = enqueueInteractiveOutbox;
exports.markMessageDelivery = markMessageDelivery;
exports.assignConversation = assignConversation;
exports.sendInternalToBelen = sendInternalToBelen;
const firebase_1 = require("../firebase");
const uuid_1 = require("uuid");
const logger_1 = __importDefault(require("../libs/logger"));
const botReply_1 = require("./botReply");
// Normalizar phone a E.164
function normalizePhone(phone) {
    // Remover espacios y caracteres especiales
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Si ya empieza con +, devolverlo
    if (cleaned.startsWith('+')) {
        return cleaned;
    }
    // Si empieza con 54, agregar +
    if (cleaned.startsWith('54')) {
        return '+' + cleaned;
    }
    // Si empieza con 9, agregar +54
    if (cleaned.startsWith('9')) {
        return '+54' + cleaned;
    }
    // Si es solo números, asumir que es argentino
    if (/^\d+$/.test(cleaned)) {
        return '+549' + cleaned;
    }
    throw new Error('Formato de teléfono inválido');
}
// Enmascarar PII en logs
function maskPII(text) {
    if (!text)
        return text;
    return text.replace(/\b(\d{2}-\d{6,}-\d|\+?\d{1,3}\s?\d{1,4}\s?\d{4,}-\d{4})\b/g, (match) => {
        if (match.length > 8) {
            return match.slice(0, 3) + '***' + match.slice(-4);
        }
        return match;
    });
}
// Sanitizar texto
function sanitizeText(text) {
    return text.trim().slice(0, 2000);
}
async function listConversations(params) {
    const { query = '', from, to, page = 1, pageSize = 25, isClient, needsReply } = params;
    try {
        logger_1.default.info('listConversations called', {
            query: maskPII(query),
            from,
            to,
            isClient,
            needsReply,
            page,
            pageSize
        });
        // ESTRATEGIA: Obtener todos los documentos y filtrar en memoria
        // Esto evita problemas con índices compuestos de Firestore
        const allDocsSnapshot = await firebase_1.collections.conversations()
            .orderBy('lastMessageAt', 'desc')
            .get();
        logger_1.default.info('Firestore query result (all docs)', {
            totalDocs: allDocsSnapshot.size
        });
        // Aplicar TODOS los filtros en memoria
        let filteredDocs = allDocsSnapshot.docs;
        // Filtro por texto (teléfono o nombre)
        if (query && query.trim()) {
            const queryLower = query.trim().toLowerCase();
            filteredDocs = filteredDocs.filter(doc => {
                const data = doc.data();
                const searchText = `${data.phone || ''} ${data.name || ''}`.toLowerCase();
                return searchText.includes(queryLower);
            });
            logger_1.default.info('After text filter', {
                originalCount: allDocsSnapshot.size,
                filteredCount: filteredDocs.length,
                query: maskPII(query)
            });
        }
        // Filtro por fecha "desde"
        if (from) {
            try {
                const fromDate = new Date(from);
                fromDate.setHours(0, 0, 0, 0); // Inicio del día
                if (!isNaN(fromDate.getTime())) {
                    const beforeCount = filteredDocs.length;
                    filteredDocs = filteredDocs.filter(doc => {
                        const data = doc.data();
                        const lastMessageAt = data.lastMessageAt;
                        if (!lastMessageAt)
                            return false;
                        // Convertir Timestamp a Date
                        const docDate = lastMessageAt.toDate ? lastMessageAt.toDate() : new Date(lastMessageAt);
                        return docDate >= fromDate;
                    });
                    logger_1.default.info('Applied from filter', {
                        from,
                        beforeCount,
                        afterCount: filteredDocs.length
                    });
                }
                else {
                    logger_1.default.warn('Invalid from date', { from });
                }
            }
            catch (error) {
                logger_1.default.error('Error parsing from date', { from, error: error?.message });
            }
        }
        // Filtro por fecha "hasta"
        if (to) {
            try {
                const toDate = new Date(to);
                toDate.setHours(23, 59, 59, 999); // Final del día
                if (!isNaN(toDate.getTime())) {
                    const beforeCount = filteredDocs.length;
                    filteredDocs = filteredDocs.filter(doc => {
                        const data = doc.data();
                        const lastMessageAt = data.lastMessageAt;
                        if (!lastMessageAt)
                            return false;
                        // Convertir Timestamp a Date
                        const docDate = lastMessageAt.toDate ? lastMessageAt.toDate() : new Date(lastMessageAt);
                        return docDate <= toDate;
                    });
                    logger_1.default.info('Applied to filter', {
                        to,
                        beforeCount,
                        afterCount: filteredDocs.length
                    });
                }
                else {
                    logger_1.default.warn('Invalid to date', { to });
                }
            }
            catch (error) {
                logger_1.default.error('Error parsing to date', { to, error: error?.message });
            }
        }
        // Filtro por isClient
        if (isClient !== undefined) {
            const beforeCount = filteredDocs.length;
            filteredDocs = filteredDocs.filter(doc => {
                const data = doc.data();
                return (data.isClient || false) === isClient;
            });
            logger_1.default.info('Applied isClient filter', {
                isClient,
                beforeCount,
                afterCount: filteredDocs.length
            });
        }
        // Filtro por needsReply
        if (needsReply !== undefined) {
            const beforeCount = filteredDocs.length;
            filteredDocs = filteredDocs.filter(doc => {
                const data = doc.data();
                return (data.needsReply || false) === needsReply;
            });
            logger_1.default.info('Applied needsReply filter', {
                needsReply,
                beforeCount,
                afterCount: filteredDocs.length
            });
        }
        // Filtro por assignedTo según rol del usuario
        // Si es operador, solo ver sus conversaciones asignadas
        // Si es owner, ver todas (pero puede filtrar por assignedTo si quiere)
        if (params.userRole === 'operador' && params.userEmail) {
            const beforeCount = filteredDocs.length;
            filteredDocs = filteredDocs.filter(doc => {
                const data = doc.data();
                // Operador solo ve conversaciones asignadas a él
                return data.assignedTo === params.userEmail;
            });
            logger_1.default.info('Applied assignedTo filter for operador', {
                userEmail: params.userEmail,
                beforeCount,
                afterCount: filteredDocs.length
            });
        }
        // Calcular total después de todos los filtros
        const total = filteredDocs.length;
        // Aplicar paginación
        const offset = (page - 1) * pageSize;
        const paginatedDocs = filteredDocs.slice(offset, offset + pageSize);
        logger_1.default.info('Pagination applied', {
            total,
            offset,
            pageSize,
            paginatedCount: paginatedDocs.length
        });
        // Obtener últimos mensajes en paralelo para las conversaciones paginadas
        const lastMessagesPromises = paginatedDocs.map(async (doc) => {
            let lastMessage;
            try {
                const messagesRef = firebase_1.collections.messages(doc.id);
                // Intentar con orderBy primero
                try {
                    const messagesSnapshot = await messagesRef
                        .orderBy('ts', 'desc')
                        .limit(1)
                        .get();
                    if (!messagesSnapshot.empty) {
                        const messageData = messagesSnapshot.docs[0].data();
                        lastMessage = messageData.text || messageData.message || undefined;
                    }
                }
                catch (orderError) {
                    // Si falla por falta de índice, obtener todos y ordenar en memoria
                    const allMessages = await messagesRef.get();
                    if (!allMessages.empty) {
                        const sortedMessages = allMessages.docs
                            .map(d => ({ data: d.data(), id: d.id }))
                            .sort((a, b) => {
                            const aTs = a.data.ts?.toMillis?.() || a.data.ts?.getTime?.() || new Date(a.data.ts || 0).getTime();
                            const bTs = b.data.ts?.toMillis?.() || b.data.ts?.getTime?.() || new Date(b.data.ts || 0).getTime();
                            return bTs - aTs;
                        });
                        if (sortedMessages.length > 0) {
                            lastMessage = sortedMessages[0].data.text || sortedMessages[0].data.message || undefined;
                        }
                    }
                }
                // Limitar longitud del mensaje para la vista previa
                if (lastMessage && lastMessage.length > 50) {
                    lastMessage = lastMessage.substring(0, 50) + '...';
                }
            }
            catch (error) {
                // Si falla completamente, continuar sin último mensaje
                const msg = (error instanceof Error) ? error.message : String(error);
                logger_1.default.debug('Could not fetch last message', { conversationId: doc.id, error: msg });
            }
            return { doc, lastMessage };
        });
        // Esperar todas las consultas de mensajes en paralelo
        const results = await Promise.all(lastMessagesPromises);
        // Construir items
        const items = [];
        for (const { doc, lastMessage } of results) {
            const data = doc.data();
            const item = {
                id: doc.id,
                phone: data.phone,
                name: data.name,
                isClient: data.isClient || false,
                lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                unreadCount: data.unreadCount || 0,
                needsReply: data.needsReply || false,
                lastMessage,
                assignedTo: data.assignedTo || undefined
            };
            items.push(item);
        }
        logger_1.default.info('Conversations processed', {
            totalItems: items.length,
            sampleItems: items.slice(0, 3).map(i => ({
                id: i.id,
                phone: i.phone,
                hasLastMessage: !!i.lastMessage
            }))
        });
        logger_1.default.info('conversations_listed', {
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
        });
        return {
            conversations: items,
            page,
            pageSize,
            total // Total después de aplicar todos los filtros
        };
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_listing_conversations', { error: msg });
        throw new Error('Error al listar conversaciones');
    }
}
async function getConversationById(id) {
    try {
        const conversationDoc = await firebase_1.collections.conversations().doc(id).get();
        if (!conversationDoc.exists) {
            throw new Error('Conversación no encontrada');
        }
        const conversationData = conversationDoc.data();
        // Obtener mensajes
        let messagesSnapshot;
        try {
            // Intentar con 'ts' primero (campo real en Firestore)
            messagesSnapshot = await conversationDoc.ref.collection('messages')
                .orderBy('ts', 'asc')
                .get();
        }
        catch (error) {
            // Si falla, intentar sin ordenar y ordenar en memoria
            logger_1.default.debug('orderBy ts failed, fetching all messages', { conversationId: id });
            messagesSnapshot = await conversationDoc.ref.collection('messages').get();
        }
        const messages = messagesSnapshot.docs
            .map(doc => {
            const data = doc.data();
            // Obtener timestamp de 'ts' o 'timestamp'
            let timestamp;
            if (data.ts) {
                timestamp = data.ts?.toDate?.()?.toISOString() || data.ts?.toMillis?.() ? new Date(data.ts.toMillis()).toISOString() : new Date(data.ts).toISOString();
            }
            else if (data.timestamp) {
                timestamp = typeof data.timestamp === 'string' ? data.timestamp : data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString();
            }
            else {
                timestamp = new Date().toISOString();
            }
            return {
                id: doc.id,
                timestamp,
                from: data.from || 'usuario',
                text: data.text || data.message || '',
                via: data.via,
                aiSuggested: data.aiSuggested || false,
                deliveryStatus: data.deliveryStatus
            };
        })
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); // Ordenar por timestamp
        logger_1.default.info('Messages retrieved', {
            conversationId: id,
            messageCount: messages.length,
            sampleMessages: messages.slice(0, 2).map(m => ({ id: m.id, from: m.from, textPreview: m.text.substring(0, 30) }))
        });
        const conversation = {
            id: conversationDoc.id,
            phone: conversationData?.phone ?? '',
            name: conversationData?.name,
            isClient: conversationData?.isClient ?? false,
            needsReply: conversationData?.needsReply ?? false,
            messages,
            assignedTo: conversationData?.assignedTo || undefined
        };
        logger_1.default.info('conversation_retrieved', {
            conversationId: id,
            phone: maskPII(conversationData?.phone ?? ''),
            messageCount: messages.length
        });
        return conversation;
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_getting_conversation', {
            conversationId: id,
            error: msg
        });
        throw new Error('Error al obtener conversación');
    }
}
async function simulateIncoming(request) {
    const { phone, text, via = 'manual', messageType } = request;
    try {
        const normalizedPhone = normalizePhone(phone);
        const sanitizedText = sanitizeText(text);
        const now = new Date();
        // Buscar conversación existente por teléfono
        const existingConversation = await firebase_1.collections.conversations()
            .where('phone', '==', normalizedPhone)
            .limit(1)
            .get();
        let conversationId;
        let conversationData;
        if (existingConversation.empty) {
            // Crear nueva conversación
            conversationId = (0, uuid_1.v4)();
            conversationData = {
                phone: normalizedPhone,
                name: null,
                isClient: false, // Se determinará después
                lastMessageAt: now,
                unreadCount: 1,
                needsReply: false,
                createdAt: now,
                updatedAt: now
            };
            await firebase_1.collections.conversations().doc(conversationId).set(conversationData);
            logger_1.default.info('conversation_created', {
                conversationId,
                phone: maskPII(normalizedPhone)
            });
        }
        else {
            // Usar conversación existente
            const doc = existingConversation.docs[0];
            conversationId = doc.id;
            conversationData = doc.data();
            // Actualizar contadores
            await firebase_1.collections.conversations().doc(conversationId).update({
                lastMessageAt: now,
                unreadCount: (conversationData.unreadCount || 0) + 1,
                updatedAt: now
            });
        }
        // Crear mensaje
        const messageId = (0, uuid_1.v4)();
        const messageData = {
            ts: now,
            from: 'usuario',
            text: sanitizedText,
            via,
            aiSuggested: false
        };
        await firebase_1.collections.messages(conversationId).doc(messageId).set(messageData);
        logger_1.default.info('message_created', {
            conversationId,
            messageId,
            phone: maskPII(normalizedPhone),
            textLength: sanitizedText.length,
            via
        });
        // FSM MÍNIMA: Procesar directamente con FSM sin lógica adicional
        try {
            const botResponse = await (0, botReply_1.generateBotReply)(normalizedPhone, sanitizedText, conversationId, messageType);
            // VALIDACIÓN: Verificar que hay respuestas antes de encolar
            // PERO: Si se manejó con interactive menu (handledByInteractive=true), NO disparar fallback
            if (!botResponse || !botResponse.replies || botResponse.replies.length === 0) {
                // Si se encoló un interactive menu, considerar como "handled" y no enviar fallback
                if (botResponse?.handledByInteractive) {
                    logger_1.default.info('fsm_handled_by_interactive_skip_fallback', {
                        conversationId,
                        phone: maskPII(normalizedPhone),
                        text: sanitizedText.substring(0, 50)
                    });
                    return { conversationId };
                }
                // Si realmente no hay respuesta ni interactive, no enviar fallback (silencioso)
                logger_1.default.warn('bot_response_empty_no_fallback', {
                    conversationId,
                    phone: maskPII(normalizedPhone),
                    text: sanitizedText.substring(0, 50)
                });
                return { conversationId };
            }
            // Encolar respuestas del bot
            for (const reply of botResponse.replies) {
                // Validar que el reply no esté vacío
                if (!reply || reply.trim().length === 0) {
                    logger_1.default.warn('empty_reply_skipped', {
                        conversationId,
                        phone: maskPII(normalizedPhone),
                        replyIndex: botResponse.replies.indexOf(reply)
                    });
                    continue;
                }
                const replyIdempotencyKey = `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                await enqueueOutbox(conversationId, normalizedPhone, reply, replyIdempotencyKey);
                // Guardar mensaje del sistema en la conversación
                const systemMessageId = (0, uuid_1.v4)();
                const systemMessageData = {
                    ts: new Date(),
                    from: 'system',
                    text: reply,
                    via: 'fsm',
                    aiSuggested: false
                };
                await firebase_1.collections.messages(conversationId).doc(systemMessageId).set(systemMessageData);
                logger_1.default.info('auto_reply_generated', {
                    conversationId,
                    phone: maskPII(normalizedPhone),
                    via: botResponse.via,
                    replyLength: reply.length
                });
            }
            // Actualizar conversación con último mensaje del sistema
            await firebase_1.collections.conversations().doc(conversationId).update({
                lastMessageAt: new Date(),
                lastMessage: botResponse.replies[0],
                updatedAt: new Date()
            });
        }
        catch (error) {
            const msg = (error instanceof Error) ? error.message : String(error);
            logger_1.default.error('error_generating_auto_reply', {
                conversationId,
                phone: maskPII(normalizedPhone),
                error: msg
            });
            // No fallar la simulación si la respuesta automática falla
        }
        return { conversationId };
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_simulating_incoming', {
            phone: maskPII(phone),
            error: msg
        });
        throw new Error('Error al simular mensaje entrante');
    }
}
async function enqueueReply(conversationId, request) {
    try {
        const { text, idempotencyKey } = request;
        const sanitizedText = sanitizeText(text);
        if (sanitizedText.length < 1 || sanitizedText.length > 2000) {
            throw new Error('El texto debe tener entre 1 y 2000 caracteres');
        }
        // Obtener conversación
        const conversationDoc = await firebase_1.collections.conversations().doc(conversationId).get();
        if (!conversationDoc.exists) {
            throw new Error('Conversación no encontrada');
        }
        const conversationData = conversationDoc.data();
        const now = new Date();
        // 1. Agregar mensaje del operador a la conversación (optimista)
        await appendOperatorMessage(conversationId, sanitizedText);
        // 2. Encolar en outbox para envío
        await enqueueOutbox(conversationId, conversationData?.phone ?? '', sanitizedText, idempotencyKey);
        logger_1.default.info('reply_enqueued_successfully', {
            conversationId,
            phone: maskPII(conversationData?.phone ?? ''),
            textLength: sanitizedText.length,
            idempotencyKey
        });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_enqueuing_reply', {
            conversationId,
            error: msg
        });
        throw new Error('Error al encolar respuesta');
    }
}
/**
 * Helper para agregar mensaje del operador a una conversación
 */
async function appendOperatorMessage(conversationId, text) {
    try {
        const conversationRef = firebase_1.collections.conversations().doc(conversationId);
        // Verificar que la conversación existe
        const conversationDoc = await conversationRef.get();
        if (!conversationDoc.exists) {
            throw new Error('Conversación no encontrada');
        }
        const now = new Date();
        const messageId = (0, uuid_1.v4)();
        // Crear mensaje
        const message = {
            id: messageId,
            text: sanitizeText(text),
            from: 'operador',
            timestamp: now.toISOString(),
            deliveryStatus: 'pending'
        };
        // Guardar mensaje en subcolección
        await conversationRef.collection('messages').doc(messageId).set(message);
        // Actualizar conversación
        await conversationRef.update({
            lastMessageAt: now.toISOString(),
            lastMessage: sanitizeText(text),
            unreadCount: 0, // Para el operador
            updatedAt: now.toISOString()
        });
        logger_1.default.info('operator_message_added', {
            conversationId,
            messageId,
            textLength: text.length
        });
        return messageId;
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_adding_operator_message', {
            conversationId,
            error: msg
        });
        throw error;
    }
}
/**
 * Helper para encolar mensaje en outbox (texto)
 */
async function enqueueOutbox(conversationId, phone, text, idempotencyKey) {
    try {
        // IDEMPOTENCIA: Si ya existe un doc con este idempotencyKey y está sent/pending, no duplicar
        if (idempotencyKey) {
            const existing = await firebase_1.collections.outbox()
                .where('idempotencyKey', '==', idempotencyKey)
                .where('status', 'in', ['pending', 'sending', 'sent'])
                .limit(1)
                .get();
            if (!existing.empty) {
                logger_1.default.debug('outbox_idempotency_skip', {
                    conversationId,
                    idempotencyKey,
                    existingStatus: existing.docs[0].data().status
                });
                return existing.docs[0].id;
            }
        }
        const outboxId = idempotencyKey || (0, uuid_1.v4)(); // Usar idempotencyKey como docId si existe
        const now = firebase_1.Timestamp.now();
        // CONTRATO UNIFICADO: Siempre usar phone, status:'pending', tries:0
        // IMPORTANTE: Usar Timestamp de Firestore para compatibilidad con worker
        const outboxData = {
            id: outboxId,
            conversationId,
            phone: normalizePhone(phone), // SIEMPRE 'phone' (NO 'to')
            messageType: 'text',
            text: sanitizeText(text),
            createdAt: now, // Timestamp de Firestore
            status: 'pending', // SIEMPRE 'pending' al crear
            tries: 0, // SIEMPRE 0 al crear
            idempotencyKey: idempotencyKey || undefined,
            error: null,
            nextAttemptAt: null,
            sentAt: null
        };
        await firebase_1.collections.outbox().doc(outboxId).set(outboxData);
        logger_1.default.info('message_enqueued', {
            conversationId,
            outboxId,
            phone: maskPII(phone),
            textLength: text.length,
            messageType: 'text',
            idempotencyKey
        });
        // Log adicional para debugging
        logger_1.default.info('outbox_enqueue_target', {
            target: 'outbox',
            collection: 'outbox',
            driver: 'whatsapp',
            messageType: 'text',
            idempotencyKey: idempotencyKey || outboxId,
            status: 'pending',
            phone: maskPII(phone)
        });
        return outboxId;
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_enqueuing_message', {
            conversationId,
            error: msg
        });
        throw error;
    }
}
/**
 * Helper para encolar mensaje INTERACTIVE (List Message) en outbox
 */
async function enqueueInteractiveOutbox(conversationId, phone, interactivePayload, // InteractivePayload completo (con to, messaging_product, etc.)
idempotencyKey) {
    try {
        // IDEMPOTENCIA: Si ya existe un doc con este idempotencyKey y está sent/pending, no duplicar
        if (idempotencyKey) {
            const existing = await firebase_1.collections.outbox()
                .where('idempotencyKey', '==', idempotencyKey)
                .where('status', 'in', ['pending', 'sending', 'sent'])
                .limit(1)
                .get();
            if (!existing.empty) {
                logger_1.default.debug('outbox_interactive_idempotency_skip', {
                    conversationId,
                    idempotencyKey,
                    existingStatus: existing.docs[0].data().status
                });
                return existing.docs[0].id;
            }
        }
        const outboxId = idempotencyKey || (0, uuid_1.v4)(); // Usar idempotencyKey como docId si existe
        const now = firebase_1.Timestamp.now();
        // Extraer 'to' del payload para normalizar
        const normalizedPhone = normalizePhone(interactivePayload.to || phone);
        const outboxData = {
            id: outboxId,
            conversationId,
            phone: normalizedPhone,
            messageType: 'interactive',
            interactive: interactivePayload, // Payload completo para Cloud API
            createdAt: now, // Timestamp de Firestore
            status: 'pending',
            tries: 0,
            idempotencyKey: idempotencyKey || undefined,
            error: null,
            nextAttemptAt: null,
            sentAt: null
        };
        await firebase_1.collections.outbox().doc(outboxId).set(outboxData);
        logger_1.default.info('interactive_message_enqueued', {
            conversationId,
            outboxId,
            phone: maskPII(phone),
            messageType: 'interactive',
            idempotencyKey,
            buttonText: interactivePayload.interactive?.action?.button || 'N/A'
        });
        // Log adicional para debugging
        logger_1.default.info('outbox_enqueue_target', {
            target: 'outbox',
            collection: 'outbox',
            driver: 'whatsapp',
            messageType: 'interactive',
            idempotencyKey: idempotencyKey || outboxId,
            status: 'pending',
            phone: maskPII(phone)
        });
        return outboxId;
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_enqueuing_interactive_message', {
            conversationId,
            error: msg
        });
        throw error;
    }
}
/**
 * Helper para marcar estado de entrega de un mensaje
 */
async function markMessageDelivery(conversationId, messageId, status) {
    try {
        const conversationRef = firebase_1.collections.conversations().doc(conversationId);
        const messageRef = conversationRef.collection('messages').doc(messageId);
        // Verificar que el mensaje existe
        const messageDoc = await messageRef.get();
        if (!messageDoc.exists) {
            throw new Error('Mensaje no encontrado');
        }
        // Actualizar estado de entrega
        await messageRef.update({
            deliveryStatus: status,
            deliveryUpdatedAt: new Date().toISOString()
        });
        logger_1.default.info('message_delivery_updated', {
            conversationId,
            messageId,
            status
        });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_updating_delivery_status', {
            conversationId,
            messageId,
            error: msg
        });
        throw error;
    }
}
/**
 * Asignar una conversación a un operador (secretaria)
 * @param conversationId ID de la conversación
 * @param assignedTo Email del operador a asignar (null para desasignar)
 * @param notifyClient Si enviar mensaje automático al cliente
 * @returns Nombre del operador asignado (para el mensaje)
 */
async function assignConversation(conversationId, assignedTo, notifyClient = true) {
    try {
        const conversationRef = firebase_1.collections.conversations().doc(conversationId);
        const conversationDoc = await conversationRef.get();
        if (!conversationDoc.exists) {
            throw new Error('Conversación no encontrada');
        }
        const conversationData = conversationDoc.data();
        const phone = conversationData?.phone;
        if (!phone) {
            throw new Error('La conversación no tiene teléfono asociado');
        }
        // Obtener nombre del operador si se asigna
        let operatorName = null;
        if (assignedTo) {
            try {
                // Buscar admin por email para obtener nombre (si existe campo name)
                const adminSnapshot = await firebase_1.collections.admins()
                    .where('email', '==', assignedTo.toLowerCase().trim())
                    .limit(1)
                    .get();
                if (!adminSnapshot.empty) {
                    const adminData = adminSnapshot.docs[0].data();
                    // Si hay campo name, usarlo; sino usar email sin dominio
                    operatorName = adminData.name || assignedTo.split('@')[0];
                }
                else {
                    // Si no existe en admins, usar email sin dominio
                    operatorName = assignedTo.split('@')[0];
                }
            }
            catch (error) {
                // Si falla, usar email sin dominio
                operatorName = assignedTo.split('@')[0];
            }
        }
        // Actualizar conversación
        await conversationRef.update({
            assignedTo: assignedTo || null,
            updatedAt: new Date()
        });
        logger_1.default.info('conversation_assigned', {
            conversationId,
            assignedTo: assignedTo || 'null',
            operatorName,
            notifyClient
        });
        // Enviar mensaje automático al cliente si se solicita
        if (notifyClient && assignedTo && operatorName) {
            const notificationMessage = `Te derivamos con ${operatorName}. En breve te contactará para ayudarte. ¡Gracias! 🙌`;
            // Agregar mensaje del sistema
            const messageId = (0, uuid_1.v4)();
            const now = new Date();
            await conversationRef.collection('messages').doc(messageId).set({
                ts: now,
                from: 'sistema',
                text: notificationMessage,
                via: 'manual',
                aiSuggested: false
            });
            // Encolar mensaje para envío
            await enqueueOutbox(conversationId, phone, notificationMessage);
            logger_1.default.info('assignment_notification_sent', {
                conversationId,
                phone: maskPII(phone),
                operatorName
            });
        }
        return { operatorName };
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_assigning_conversation', {
            conversationId,
            assignedTo,
            error: msg
        });
        throw error;
    }
}
/**
 * Envía un mensaje interno a Belén (si está configurado BELEN_PHONE)
 * Si no está configurado, solo loguea y no rompe el flujo
 */
async function sendInternalToBelen(text) {
    const belenPhone = process.env.BELEN_PHONE;
    if (!belenPhone || !belenPhone.trim()) {
        logger_1.default.info('internal_to_belen_skipped', {
            reason: 'BELEN_PHONE not configured'
        });
        return;
    }
    try {
        const normalizedBelenPhone = normalizePhone(belenPhone.trim());
        // Buscar o crear conversación para Belén
        const existingConversation = await firebase_1.collections.conversations()
            .where('phone', '==', normalizedBelenPhone)
            .limit(1)
            .get();
        let conversationId;
        if (existingConversation.empty) {
            // Crear nueva conversación para Belén
            conversationId = (0, uuid_1.v4)();
            const now = new Date();
            await firebase_1.collections.conversations().doc(conversationId).set({
                phone: normalizedBelenPhone,
                name: 'Belén Maidana',
                isClient: false,
                lastMessageAt: now,
                unreadCount: 1,
                needsReply: false,
                createdAt: now,
                updatedAt: now
            });
            logger_1.default.info('belen_conversation_created', {
                conversationId,
                phone: maskPII(normalizedBelenPhone)
            });
        }
        else {
            conversationId = existingConversation.docs[0].id;
            // Actualizar contadores
            await firebase_1.collections.conversations().doc(conversationId).update({
                lastMessageAt: new Date(),
                unreadCount: (existingConversation.docs[0].data().unreadCount || 0) + 1,
                updatedAt: new Date()
            });
        }
        // Encolar mensaje
        await enqueueOutbox(conversationId, normalizedBelenPhone, text);
        logger_1.default.info('internal_to_belen_sent', {
            conversationId,
            phone: maskPII(normalizedBelenPhone),
            textLength: text.length
        });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_sending_internal_to_belen', {
            error: msg
        });
        // NO lanzar error: no debe romper el flujo principal
    }
}
