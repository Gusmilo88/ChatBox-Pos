"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBotReply = generateBotReply;
const engine_1 = require("../fsm/engine");
const ai_1 = require("./ai");
const aiCostTracker_1 = require("./aiCostTracker");
const clientsRepo_1 = require("./clientsRepo");
const firebase_1 = require("../firebase");
const autoReplies_1 = require("./autoReplies");
const intentRouter_1 = require("./intentRouter");
const paymentHandler_1 = require("./paymentHandler");
const handoffManager_1 = require("./handoffManager");
const topicGuard_1 = require("./topicGuard");
const replies_1 = require("./replies");
const logger_1 = __importDefault(require("../libs/logger"));
const env_1 = __importDefault(require("../config/env"));
// Instancia global del FSM manager
let fsmManager = null;
function getFSMManager() {
    if (!fsmManager) {
        fsmManager = new engine_1.FSMSessionManager();
    }
    return fsmManager;
}
// Función para normalizar teléfono a E.164
function normalizePhone(phone) {
    // Remover espacios, guiones, paréntesis
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Si no empieza con +, asumir que es argentino
    if (!cleaned.startsWith('+')) {
        // Si empieza con 0, removerlo
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }
        // Si no empieza con 54, agregarlo
        if (!cleaned.startsWith('54')) {
            cleaned = '54' + cleaned;
        }
        cleaned = '+' + cleaned;
    }
    return cleaned;
}
/**
 * Genera una respuesta del bot usando routing inteligente, pagos, handoff, IA y FSM
 */
async function generateBotReply(phone, text, conversationId) {
    const normalizedPhone = normalizePhone(phone);
    try {
        // 0. Verificar si hay handoff activo (si hay, silenciar IA hasta HANDOFF_CLOSED)
        if (conversationId) {
            const handoffActive = await (0, handoffManager_1.isHandoffActive)(conversationId);
            if (handoffActive) {
                // Verificar si handoffTo está seteado pero no hay operatorPhone válido
                try {
                    const conversationDoc = await firebase_1.collections.conversations().doc(conversationId).get();
                    if (conversationDoc.exists) {
                        const data = conversationDoc.data();
                        const assignedToPhone = data?.assignedTo;
                        const handoffTo = data?.handoffTo;
                        // Si hay handoffTo pero no hay assignedTo (operatorPhone), limpiar
                        if (handoffTo && (!assignedToPhone || assignedToPhone.trim() === '')) {
                            logger_1.default.warn('handoff_to_without_phone_cleaning', {
                                conversationId,
                                handoffTo,
                                phone: (0, replies_1.maskPhone)(normalizedPhone)
                            });
                            await firebase_1.collections.conversations().doc(conversationId).update({
                                handoffTo: null,
                                handoffStatus: 'IA_ACTIVE',
                                updatedAt: new Date()
                            });
                            // Continuar con flujo normal (IA)
                        }
                        else {
                            // Verificar si el usuario escribe "menu" o "inicio" para resetear
                            const textLower = text.toLowerCase().trim();
                            if (textLower === 'menu' || textLower === 'inicio' || textLower === 'volver') {
                                // Resetear handoff
                                await firebase_1.collections.conversations().doc(conversationId).update({
                                    handoffTo: null,
                                    handoffStatus: 'IA_ACTIVE',
                                    updatedAt: new Date()
                                });
                                // Continuar con flujo normal
                            }
                            else {
                                // Si hay handoff activo válido, no responder automáticamente
                                // El operador responderá manualmente
                                logger_1.default.info('handoff_active_silencing_ia', {
                                    conversationId,
                                    phone: (0, replies_1.maskPhone)(normalizedPhone)
                                });
                                return {
                                    replies: [],
                                    via: 'handoff'
                                };
                            }
                        }
                    }
                }
                catch (error) {
                    logger_1.default.error('error_checking_handoff_state', {
                        conversationId,
                        error: error?.message
                    });
                    // Continuar con flujo normal si falla
                }
            }
        }
        // 1. Obtener estado de conversación y CUIT
        let isClient = false;
        let cuit;
        let nombre;
        let role = null;
        let offTopicStrikes = 0;
        let handoffTo = null;
        let initialGreetingShown = false;
        let isFirstMessage = false;
        // Intentar obtener información del cliente desde la conversación
        if (conversationId) {
            try {
                const conversationDoc = await firebase_1.collections.conversations().doc(conversationId).get();
                if (conversationDoc.exists) {
                    const data = conversationDoc.data();
                    isClient = data?.isClient || false;
                    role = data?.role || (isClient ? 'cliente' : 'no_cliente');
                    cuit = data?.cuit || undefined;
                    nombre = data?.displayName || undefined;
                    offTopicStrikes = data?.offTopicStrikes || 0;
                    handoffTo = data?.handoffTo || null;
                    initialGreetingShown = data?.initialGreetingShown || false;
                    // Verificar si es el primer mensaje (no hay mensajes del bot aún)
                    try {
                        const botMessagesSnapshot = await firebase_1.collections.messages(conversationId)
                            .where('from', 'in', ['bot', 'system', 'sistema'])
                            .limit(1)
                            .get();
                        isFirstMessage = botMessagesSnapshot.empty;
                    }
                    catch (error) {
                        // Si falla, asumir que no es el primero
                        logger_1.default.debug('Error verificando primer mensaje', { error: error?.message });
                    }
                    // Si hay CUIT pero no nombre, obtenerlo
                    if (cuit && !nombre) {
                        const cliente = await (0, clientsRepo_1.getDoc)(cuit);
                        if (cliente) {
                            nombre = cliente.nombre;
                        }
                    }
                }
                else {
                    // Si no existe conversación, es el primer mensaje
                    isFirstMessage = true;
                }
            }
            catch (error) {
                logger_1.default.debug('Error obteniendo datos de conversación', { error: error?.message });
                // Si falla, asumir que es el primer mensaje
                isFirstMessage = true;
            }
        }
        else {
            // Si no hay conversationId, es el primer mensaje
            isFirstMessage = true;
        }
        // 1.0. GUARD: Mostrar saludo inicial PREMIUM solo una vez
        if (isFirstMessage && !initialGreetingShown && !(0, topicGuard_1.isOffTopic)(text)) {
            const hasRoleOrCuit = !!(role || cuit);
            const greetingMessage = replies_1.REPLIES.greetingInitial(hasRoleOrCuit);
            // Guardar flag en conversación
            if (conversationId) {
                await firebase_1.collections.conversations().doc(conversationId).update({
                    initialGreetingShown: true,
                    updatedAt: new Date()
                });
            }
            logger_1.default.info('initial_greeting_shown', {
                conversationId,
                phone: (0, replies_1.maskPhone)(normalizedPhone),
                hasRoleOrCuit
            });
            return {
                replies: [greetingMessage],
                via: 'fsm'
            };
        }
        // 1.1. Extraer CUIT del texto si no está en conversación
        if (!cuit) {
            const extractedCuit = (0, topicGuard_1.extractCUIT)(text);
            if (extractedCuit) {
                cuit = extractedCuit;
                // Validar y buscar cliente
                const clienteResult = await (0, clientsRepo_1.getClienteByCuit)(extractedCuit);
                if (clienteResult.exists && clienteResult.data) {
                    isClient = true;
                    role = 'cliente';
                    nombre = clienteResult.data.nombre;
                    // Guardar en conversación
                    if (conversationId) {
                        await firebase_1.collections.conversations().doc(conversationId).update({
                            cuit: extractedCuit,
                            role: 'cliente',
                            displayName: nombre,
                            isClient: true,
                            updatedAt: new Date()
                        });
                        logger_1.default.info('cuit_extracted_and_client_identified', {
                            conversationId,
                            cuit: (0, replies_1.maskCuit)(extractedCuit),
                            phone: (0, replies_1.maskPhone)(normalizedPhone),
                            hasName: !!nombre
                        });
                    }
                }
                else {
                    role = 'no_cliente';
                    // Guardar en conversación
                    if (conversationId) {
                        await firebase_1.collections.conversations().doc(conversationId).update({
                            cuit: extractedCuit,
                            role: 'no_cliente',
                            isClient: false,
                            updatedAt: new Date()
                        });
                        logger_1.default.info('cuit_extracted_not_client', {
                            conversationId,
                            cuit: (0, replies_1.maskCuit)(extractedCuit),
                            phone: (0, replies_1.maskPhone)(normalizedPhone)
                        });
                    }
                }
            }
        }
        // 1.2. GUARD: Verificar off-topic ANTES de procesar
        const isOffTopicMessage = (0, topicGuard_1.isOffTopic)(text);
        if (isOffTopicMessage) {
            // Verificar si está muted (después de 2 strikes)
            if (conversationId) {
                const conversationDoc = await firebase_1.collections.conversations().doc(conversationId).get();
                if (conversationDoc.exists) {
                    const data = conversationDoc.data();
                    const mutedUntil = data?.mutedUntil;
                    if (mutedUntil) {
                        const mutedDate = mutedUntil.toDate ? mutedUntil.toDate() : new Date(mutedUntil);
                        if (mutedDate > new Date()) {
                            // Está muted, no responder
                            logger_1.default.info('off_topic_muted', {
                                conversationId,
                                mutedUntil: mutedDate.toISOString(),
                                textPreview: text.substring(0, 50)
                            });
                            return {
                                replies: [],
                                via: 'fsm'
                            };
                        }
                    }
                }
            }
            offTopicStrikes += 1;
            // Calcular mutedUntil si es 2da vez o más (mute por 30 minutos)
            const mutedUntil = offTopicStrikes >= 2
                ? new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
                : null;
            // Guardar strikes y mutedUntil en conversación
            if (conversationId) {
                const updateData = {
                    offTopicStrikes,
                    updatedAt: new Date()
                };
                if (mutedUntil) {
                    updateData.mutedUntil = mutedUntil;
                }
                await firebase_1.collections.conversations().doc(conversationId).update(updateData);
            }
            // 1ra vez: respuesta amable
            if (offTopicStrikes === 1) {
                logger_1.default.info('off_topic_first_strike', {
                    conversationId,
                    phone: (0, replies_1.maskPhone)(normalizedPhone),
                    textPreview: text.substring(0, 50)
                });
                return {
                    replies: [replies_1.REPLIES.offTopicFirst],
                    via: 'fsm'
                };
            }
            // 2da vez o más: cierre amable, NO llamar IA
            logger_1.default.info('off_topic_second_strike_closing', {
                conversationId,
                strikes: offTopicStrikes,
                phone: (0, replies_1.maskPhone)(normalizedPhone),
                mutedUntil: mutedUntil?.toISOString()
            });
            return {
                replies: [replies_1.REPLIES.offTopicSecond],
                via: 'fsm'
            };
        }
        // 1.3. GUARD: Verificar si debe pedir CUIT
        if (!cuit && !role) {
            // Contar mensajes del usuario en la conversación
            let messageCount = 0;
            if (conversationId) {
                try {
                    const messagesSnapshot = await firebase_1.collections.messages(conversationId)
                        .where('from', '==', 'usuario')
                        .get();
                    messageCount = messagesSnapshot.size;
                }
                catch (error) {
                    logger_1.default.debug('Error contando mensajes para CUIT', { error: error?.message });
                }
            }
            const shouldAsk = (0, topicGuard_1.shouldAskForCUIT)({ role, cuit }, text, messageCount);
            if (shouldAsk) {
                logger_1.default.info('should_ask_for_cuit', {
                    conversationId,
                    messageCount,
                    phone: (0, replies_1.maskPhone)(normalizedPhone),
                    textPreview: text.substring(0, 50)
                });
                return {
                    replies: [replies_1.REPLIES.askCuit],
                    via: 'fsm'
                };
            }
        }
        // 1.4. GUARD: Routing por keywords (derivación a staff)
        // Solo hacer handoff si hay match claro (menciona nombre o keywords fuertes)
        const staffRouting = (0, topicGuard_1.routeToStaff)(text);
        if (staffRouting.staff && conversationId) {
            // Validar que el motivo sea válido (no default_ivan ni no_match)
            const validReasons = ['mentioned_directly', 'keyword_match'];
            if (!validReasons.includes(staffRouting.reason)) {
                // No hacer handoff si no hay match claro
                logger_1.default.debug('staff_routing_skipped_invalid_reason', {
                    conversationId,
                    reason: staffRouting.reason,
                    phone: (0, replies_1.maskPhone)(normalizedPhone)
                });
            }
            else {
                const staffName = (0, topicGuard_1.getStaffName)(staffRouting.staff);
                logger_1.default.info('staff_routing_detected', {
                    conversationId,
                    staff: staffRouting.staff,
                    reason: staffRouting.reason,
                    phone: (0, replies_1.maskPhone)(normalizedPhone),
                    textPreview: text.substring(0, 50)
                });
                // Realizar handoff (validará operatorPhone internamente)
                try {
                    const conversationDoc = await firebase_1.collections.conversations().doc(conversationId).get();
                    const conversationData = conversationDoc.exists ? conversationDoc.data() : null;
                    await (0, handoffManager_1.performHandoff)(conversationId, normalizedPhone, conversationData?.name || nombre || null, text, staffRouting.staff);
                    // Solo guardar handoffTo si performHandoff fue exitoso
                    await firebase_1.collections.conversations().doc(conversationId).update({
                        handoffTo: staffRouting.staff,
                        updatedAt: new Date()
                    });
                    return {
                        replies: [replies_1.REPLIES.handoffTo(staffName)],
                        via: 'handoff'
                    };
                }
                catch (error) {
                    // Si falla por falta de operatorPhone, continuar con flujo normal (IA)
                    logger_1.default.warn('error_performing_staff_handoff_continuing', {
                        error: error?.message,
                        phone: (0, replies_1.maskPhone)(normalizedPhone),
                        staff: staffRouting.staff
                    });
                    // NO setear handoffTo, continuar con flujo normal
                }
            }
        }
        // 2. Routing por intención
        const routing = (0, intentRouter_1.routeIntent)(text, !!cuit);
        // 3. Si es un pago, manejar con paymentHandler
        if (routing.paymentType && routing.action === 'AUTO_RESOLVE') {
            let paymentResult;
            // Si es deuda_generica, preguntar aclaratoria una vez
            if (routing.paymentType === 'deuda_generica') {
                // TODO: Verificar si ya se preguntó (usar session/conversation state)
                // Por ahora, preguntar siempre
                paymentResult = (0, paymentHandler_1.askPaymentTypeClarification)();
            }
            else {
                paymentResult = await (0, paymentHandler_1.handlePayment)(text, cuit || undefined, routing.paymentType);
            }
            if (paymentResult.success) {
                logger_1.default.info('payment_handler_success', {
                    phone: (0, replies_1.maskPhone)(normalizedPhone),
                    conversationId,
                    cuit: cuit ? (0, replies_1.maskCuit)(cuit) : undefined,
                    paymentType: routing.paymentType
                });
                return {
                    replies: [paymentResult.message],
                    via: 'payment'
                };
            }
            else {
                // Si necesita CUIT o no encontró cliente, devolver mensaje
                if (paymentResult.needsCuit || !paymentResult.cliente) {
                    return {
                        replies: [paymentResult.message],
                        via: 'payment'
                    };
                }
                // Si no encontró cliente, derivar a Iván
                if (!paymentResult.cliente && conversationId) {
                    try {
                        const conversationDoc = await firebase_1.collections.conversations().doc(conversationId).get();
                        const conversationData = conversationDoc.exists ? conversationDoc.data() : null;
                        await (0, handoffManager_1.performHandoff)(conversationId, normalizedPhone, conversationData?.name || null, text, 'ivan');
                        return {
                            replies: [paymentResult.message],
                            via: 'handoff'
                        };
                    }
                    catch (error) {
                        logger_1.default.error('error_performing_handoff_after_payment', { error: error?.message });
                    }
                }
            }
        }
        // 4. Si es handoff, realizar derivación
        if (routing.action === 'HANDOFF' && conversationId) {
            try {
                const conversationDoc = await firebase_1.collections.conversations().doc(conversationId).get();
                const conversationData = conversationDoc.exists ? conversationDoc.data() : null;
                await (0, handoffManager_1.performHandoff)(conversationId, normalizedPhone, conversationData?.name || nombre || null, text, routing.assignedTo);
                return {
                    replies: [], // El mensaje ya se envió en performHandoff
                    via: 'handoff'
                };
            }
            catch (error) {
                logger_1.default.error('error_performing_handoff', { error: error?.message });
                // Continuar con flujo normal si falla handoff
            }
        }
        // 2. Obtener historial de conversación si existe
        let history = [];
        if (conversationId) {
            try {
                const messagesSnapshot = await firebase_1.collections.messages(conversationId)
                    .orderBy('ts', 'desc')
                    .limit(6) // Obtener últimos 6 mensajes (3 pares user-bot)
                    .get();
                if (!messagesSnapshot.empty) {
                    const messages = messagesSnapshot.docs
                        .map(doc => {
                        const data = doc.data();
                        return {
                            from: (data.from === 'usuario' || data.from === 'user') ? 'user' : 'bot',
                            text: data.text || data.message || ''
                        };
                    })
                        .reverse(); // Invertir para tener orden cronológico
                    history = messages;
                }
            }
            catch (error) {
                logger_1.default.debug('Error obteniendo historial para IA', { error: error?.message });
            }
        }
        // 2.5. Verificar respuestas automáticas (horario/palabras clave)
        // Esto tiene prioridad sobre IA y FSM
        const autoReply = await (0, autoReplies_1.findAutoReply)(text, isClient);
        if (autoReply) {
            logger_1.default.info('Respuesta automática aplicada', {
                phone: normalizedPhone,
                conversationId,
                isClient,
                responseLength: autoReply.length
            });
            return {
                replies: [autoReply],
                via: 'fsm' // Marcar como FSM para consistencia
            };
        }
        // 2.6. Fallback mínimo: si intentRouter devolvió HANDOFF pero no hay conversationId
        // (handoff no se ejecutó) y la IA está desactivada, usar saludo inicial o mensaje default
        const aiAvailable = await (0, aiCostTracker_1.canUseAi)();
        const handoffRequestedButNoConversation = routing.action === 'HANDOFF' && !conversationId;
        if (handoffRequestedButNoConversation && (!aiAvailable || !env_1.default.openaiApiKey)) {
            // Si no se mostró el saludo inicial, mostrarlo
            if (!initialGreetingShown) {
                const hasRoleOrCuit = !!(role || cuit);
                const greetingMessage = replies_1.REPLIES.greetingInitial(hasRoleOrCuit);
                if (conversationId) {
                    await firebase_1.collections.conversations().doc(conversationId).update({
                        initialGreetingShown: true,
                        updatedAt: new Date()
                    });
                }
                logger_1.default.info('fallback_initial_greeting', {
                    phone: (0, replies_1.maskPhone)(normalizedPhone),
                    conversationId,
                    hasRoleOrCuit
                });
                return {
                    replies: [greetingMessage],
                    via: 'fsm'
                };
            }
            // Si ya se mostró, usar mensaje default del FSM
            const { FSMState, STATE_TEXTS } = await Promise.resolve().then(() => __importStar(require('../fsm/states')));
            logger_1.default.info('fallback_default_message_no_ia', {
                phone: (0, replies_1.maskPhone)(normalizedPhone),
                conversationId,
                routingAction: routing.action,
                textPreview: text.substring(0, 50)
            });
            return {
                replies: [STATE_TEXTS[FSMState.START]],
                via: 'fsm'
            };
        }
        // 3. Intentar usar IA SOLO si es contable-related (ya pasó el guard de off-topic)
        // La IA solo se llama si el mensaje es contable-related (no off-topic)
        if (aiAvailable && env_1.default.openaiApiKey && !isOffTopicMessage) {
            try {
                const aiContext = {
                    role: role || (isClient ? 'cliente' : 'no_cliente'),
                    cuit,
                    nombre,
                    lastUserText: text,
                    history: history.length > 0 ? history : undefined,
                    conversationId
                };
                const aiResponse = await (0, ai_1.aiReply)(aiContext);
                logger_1.default.info('Respuesta generada por IA', {
                    phone: normalizedPhone,
                    conversationId,
                    isClient,
                    role,
                    responseLength: aiResponse.length
                });
                return {
                    replies: [aiResponse],
                    via: 'ai'
                };
            }
            catch (error) {
                const msg = error?.message ?? String(error);
                logger_1.default.warn('Error en IA, usando FSM como fallback', {
                    phone: normalizedPhone,
                    error: msg
                });
                // Continuar con FSM como fallback
            }
        }
        else {
            if (isOffTopicMessage) {
                logger_1.default.info('IA bloqueada: mensaje off-topic', {
                    phone: normalizedPhone,
                    strikes: offTopicStrikes
                });
            }
            else {
                logger_1.default.info('IA no disponible, usando FSM', {
                    phone: normalizedPhone,
                    aiAvailable,
                    hasApiKey: !!env_1.default.openaiApiKey
                });
            }
        }
        // 4. Fallback a FSM
        const fsm = getFSMManager();
        const fsmResult = await fsm.processMessage(normalizedPhone, text);
        logger_1.default.info('Respuesta generada por FSM', {
            phone: (0, replies_1.maskPhone)(normalizedPhone),
            conversationId,
            repliesCount: fsmResult.replies.length
        });
        return {
            replies: fsmResult.replies,
            via: 'fsm'
        };
    }
    catch (error) {
        const msg = error?.message ?? String(error);
        logger_1.default.error('Error generando respuesta del bot', {
            phone: (0, replies_1.maskPhone)(normalizedPhone),
            conversationId,
            error: msg
        });
        // Fallback de emergencia
        return {
            replies: ['Lo siento, hubo un error. Por favor intentá de nuevo.'],
            via: 'fsm'
        };
    }
}
