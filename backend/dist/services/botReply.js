"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBotReply = generateBotReply;
const engine_1 = require("../fsm/engine");
const logger_1 = __importDefault(require("../libs/logger"));
const replies_1 = require("./replies");
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
 * Genera una respuesta del bot usando FSM mínima
 */
async function generateBotReply(phone, text, conversationId, messageType) {
    const normalizedPhone = normalizePhone(phone);
    try {
        // MANEJO DE AUDIOS (OBLIGATORIO) - ANTES DE CUALQUIER PROCESAMIENTO
        if (messageType === 'audio' || messageType === 'voice') {
            logger_1.default.info('audio_received', {
                conversationId,
                phone: (0, replies_1.maskPhone)(normalizedPhone)
            });
            return {
                replies: [replies_1.REPLIES.audioNotSupported],
                via: 'fsm'
            };
        }
        // FSM: Procesar con FSM (pasar conversationId si está disponible)
        const fsm = getFSMManager();
        const fsmResult = await fsm.processMessage(normalizedPhone, text, undefined, conversationId);
        logger_1.default.info('bot_reply_generated', {
            conversationId,
            phone: (0, replies_1.maskPhone)(normalizedPhone),
            repliesCount: fsmResult.replies.length,
            via: 'fsm',
            state: fsmResult.session.state,
            handledByInteractive: fsmResult.handledByInteractive || false
        });
        // Si se manejó con interactive menu, log específico
        if (fsmResult.handledByInteractive) {
            logger_1.default.info('fsm_handled_by_interactive', {
                conversationId,
                phone: (0, replies_1.maskPhone)(normalizedPhone),
                state: fsmResult.session.state
            });
        }
        return {
            replies: fsmResult.replies,
            via: 'fsm',
            handledByInteractive: fsmResult.handledByInteractive
        };
    }
    catch (error) {
        logger_1.default.error('error_generating_bot_reply', {
            conversationId,
            phone: (0, replies_1.maskPhone)(normalizedPhone),
            error: error?.message
        });
        // Fallback silencioso: no enviar nada en caso de error
        return {
            replies: [],
            via: 'fsm'
        };
    }
}
