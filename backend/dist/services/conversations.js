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
exports.markMessageDelivery = markMessageDelivery;
const firebase_1 = require("../firebase");
const uuid_1 = require("uuid");
const logger_1 = __importDefault(require("../libs/logger"));
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
        let queryRef = firebase_1.collections.conversations().orderBy('lastMessageAt', 'desc');
        // Filtros
        if (isClient !== undefined) {
            queryRef = queryRef.where('isClient', '==', isClient);
        }
        if (needsReply !== undefined) {
            queryRef = queryRef.where('needsReply', '==', needsReply);
        }
        if (from) {
            queryRef = queryRef.where('lastMessageAt', '>=', from);
        }
        if (to) {
            queryRef = queryRef.where('lastMessageAt', '<=', to);
        }
        // Paginación
        const offset = (page - 1) * pageSize;
        queryRef = queryRef.offset(offset).limit(pageSize);
        const snapshot = await queryRef.get();
        logger_1.default.info('Firestore query result', {
            totalDocs: snapshot.size,
            page,
            pageSize,
            hasQuery: !!query
        });
        const items = [];
        // Primero filtrar por búsqueda de texto si existe
        let filteredDocs = snapshot.docs;
        if (query) {
            const queryLower = query.toLowerCase();
            filteredDocs = snapshot.docs.filter(doc => {
                const data = doc.data();
                const searchText = `${data.phone || ''} ${data.name || ''}`.toLowerCase();
                return searchText.includes(queryLower);
            });
            logger_1.default.info('After text filter', {
                originalCount: snapshot.size,
                filteredCount: filteredDocs.length
            });
        }
        // Obtener últimos mensajes en paralelo para todas las conversaciones
        const lastMessagesPromises = filteredDocs.map(async (doc) => {
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
                lastMessage
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
        // Contar total (aproximado)
        const totalSnapshot = await firebase_1.collections.conversations().get();
        const total = totalSnapshot.size;
        logger_1.default.info('conversations_listed', {
            page,
            pageSize,
            total: items.length,
            filters: { query: maskPII(query), isClient, needsReply }
        });
        return {
            conversations: items,
            page,
            pageSize,
            total
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
        const messagesSnapshot = await conversationDoc.ref.collection('messages')
            .orderBy('timestamp', 'asc')
            .get();
        const messages = messagesSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                timestamp: data.timestamp || data.ts?.toDate?.()?.toISOString() || new Date().toISOString(),
                from: data.from,
                text: data.text,
                via: data.via,
                aiSuggested: data.aiSuggested || false
            };
        });
        const conversation = {
            id: conversationDoc.id,
            phone: conversationData?.phone ?? '',
            name: conversationData?.name,
            isClient: conversationData?.isClient ?? false,
            needsReply: conversationData?.needsReply ?? false,
            messages
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
    const { phone, text, via = 'manual' } = request;
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
 * Helper para encolar mensaje en outbox
 */
async function enqueueOutbox(conversationId, phone, text, idempotencyKey) {
    try {
        const outboxId = (0, uuid_1.v4)();
        const now = new Date();
        const outboxData = {
            id: outboxId,
            conversationId,
            phone: normalizePhone(phone),
            text: sanitizeText(text),
            createdAt: now,
            status: 'pending',
            tries: 0,
            idempotencyKey
        };
        await firebase_1.collections.outbox().doc(outboxId).set(outboxData);
        logger_1.default.info('message_enqueued', {
            conversationId,
            outboxId,
            phone: maskPII(phone),
            textLength: text.length,
            idempotencyKey
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
