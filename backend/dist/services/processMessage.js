"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processInbound = processInbound;
const engine_1 = require("../fsm/engine");
const logger_1 = __importDefault(require("../libs/logger"));
// Instancia global del session manager
let sessionManager = null;
function getSessionManager() {
    if (!sessionManager) {
        sessionManager = new engine_1.FSMSessionManager();
    }
    return sessionManager;
}
async function processInbound(from, text) {
    const sm = getSessionManager();
    const result = await sm.processMessage(from, text);
    logger_1.default.info('whatsapp_inbound_processed', {
        fromMasked: from?.slice(0, 3) + '***' + from?.slice(-2),
        repliesCount: result.replies?.length ?? 0
    });
    return result.replies;
}
