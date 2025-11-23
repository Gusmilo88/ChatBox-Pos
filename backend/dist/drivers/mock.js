"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockWhatsAppDriver = void 0;
const uuid_1 = require("uuid");
const logger_1 = __importDefault(require("../libs/logger"));
/**
 * Driver mock para WhatsApp
 * Simula el envío de mensajes con latencia y logging
 */
class MockWhatsAppDriver {
    async sendText(args) {
        const { phone, text, idempotencyKey } = args;
        // Simular latencia de red (200-600ms)
        const latency = Math.random() * 400 + 200;
        await new Promise(resolve => setTimeout(resolve, latency));
        // Simular ocasional fallo (5% de probabilidad)
        if (Math.random() < 0.05) {
            const errorMsg = 'Simulated network error';
            logger_1.default.warn('mock_whatsapp_send_failed', {
                phone: phone.slice(0, 3) + '***', // Mask phone
                textLength: text.length,
                idempotencyKey,
                error: errorMsg
            });
            return {
                ok: false,
                error: errorMsg
            };
        }
        // Simular éxito
        const remoteId = `mock-${(0, uuid_1.v4)()}`;
        logger_1.default.info('mock_whatsapp_send_success', {
            phone: phone.slice(0, 3) + '***', // Mask phone
            textLength: text.length,
            remoteId,
            idempotencyKey
        });
        return {
            ok: true,
            remoteId
        };
    }
}
exports.MockWhatsAppDriver = MockWhatsAppDriver;
