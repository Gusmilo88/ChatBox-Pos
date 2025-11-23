"use strict";
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
 * Genera una respuesta del bot usando IA como principal y FSM como fallback
 */
async function generateBotReply(phone, text, conversationId) {
    const normalizedPhone = normalizePhone(phone);
    try {
        // 1. Verificar si es cliente
        let isClient = false;
        let cuit;
        let nombre;
        // Intentar obtener información del cliente desde la conversación
        if (conversationId) {
            try {
                const conversationDoc = await firebase_1.collections.conversations().doc(conversationId).get();
                if (conversationDoc.exists) {
                    const data = conversationDoc.data();
                    isClient = data?.isClient || false;
                    // Si hay CUIT en la conversación, intentar obtener nombre
                    if (data?.cuit) {
                        cuit = data.cuit;
                        if (cuit) {
                            const cliente = await (0, clientsRepo_1.getDoc)(cuit);
                            if (cliente) {
                                nombre = cliente.nombre;
                            }
                        }
                    }
                }
            }
            catch (error) {
                logger_1.default.debug('Error obteniendo datos de conversación para IA', { error: error?.message });
            }
        }
        // Si no hay conversación, intentar buscar por CUIT en el texto
        if (!isClient && !cuit) {
            // Buscar CUIT en el texto (formato XX-XXXXXXXX-X o solo números)
            const cuitMatch = text.match(/\b\d{2}[-]?\d{8}[-]?\d{1}\b/);
            if (cuitMatch) {
                const foundCuit = cuitMatch[0].replace(/\D/g, '');
                if (await (0, clientsRepo_1.existsByCuit)(foundCuit)) {
                    isClient = true;
                    cuit = foundCuit;
                    const cliente = await (0, clientsRepo_1.getDoc)(foundCuit);
                    if (cliente) {
                        nombre = cliente.nombre;
                    }
                }
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
        // 3. Intentar usar IA primero (si está disponible y no se superó el límite)
        const aiAvailable = await (0, aiCostTracker_1.canUseAi)();
        if (aiAvailable && env_1.default.openaiApiKey) {
            try {
                const aiContext = {
                    role: isClient ? 'cliente' : 'no_cliente',
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
            logger_1.default.info('IA no disponible, usando FSM', {
                phone: normalizedPhone,
                aiAvailable,
                hasApiKey: !!env_1.default.openaiApiKey
            });
        }
        // 4. Fallback a FSM
        const fsm = getFSMManager();
        const fsmResult = await fsm.processMessage(normalizedPhone, text);
        logger_1.default.info('Respuesta generada por FSM', {
            phone: normalizedPhone,
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
            phone: normalizedPhone,
            error: msg
        });
        // Fallback de emergencia
        return {
            replies: ['Lo siento, hubo un error. Por favor intentá de nuevo.'],
            via: 'fsm'
        };
    }
}
