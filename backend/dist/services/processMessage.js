"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processInbound = processInbound;
const botReply_1 = require("./botReply");
const logger_1 = __importDefault(require("../libs/logger"));
async function processInbound(from, text, conversationId) {
    const result = await (0, botReply_1.generateBotReply)(from, text, conversationId);
    logger_1.default.info('whatsapp_inbound_processed', {
        fromMasked: from?.slice(0, 3) + '***' + from?.slice(-2),
        repliesCount: result.replies?.length ?? 0,
        via: result.via
    });
    return result.replies;
}
