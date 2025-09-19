"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../libs/logger"));
const processMessage_1 = require("../services/processMessage");
const router = (0, express_1.Router)();
// Esquema de validación para el webhook de WhatsApp
const WhatsAppWebhookSchema = zod_1.z.object({
    object: zod_1.z.string(),
    entry: zod_1.z.array(zod_1.z.object({
        changes: zod_1.z.array(zod_1.z.object({
            value: zod_1.z.object({
                messages: zod_1.z.array(zod_1.z.object({
                    from: zod_1.z.string(),
                    id: zod_1.z.string(),
                    timestamp: zod_1.z.string(),
                    type: zod_1.z.string(),
                    text: zod_1.z.object({
                        body: zod_1.z.string()
                    }).optional()
                })).optional()
            }).optional()
        })).optional()
    })).optional()
});
// Función para verificar firma de Meta
function verifySignature(appSecret, raw, header) {
    const expected = 'sha256=' + crypto_1.default.createHmac('sha256', appSecret).update(raw).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(header || '');
    return a.length === b.length && crypto_1.default.timingSafeEqual(a, b);
}
// GET /webhook/whatsapp - Verificación inicial
router.get('/', (req, res) => {
    const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query;
    if (mode === 'subscribe' && verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) {
        logger_1.default.info('WhatsApp webhook verified', { mode, challenge });
        return res.status(200).send(challenge);
    }
    logger_1.default.warn('WhatsApp webhook verification failed', { mode, verifyToken });
    return res.status(403).json({ error: 'verification_failed' });
});
// POST /webhook/whatsapp - Mensajes entrantes
router.post('/', (req, res) => {
    try {
        // Verificar firma si APP_SECRET está configurado
        const appSecret = process.env.APP_SECRET;
        if (appSecret) {
            const signature = req.header('x-hub-signature-256');
            const rawBody = req.body;
            if (!signature || !verifySignature(appSecret, rawBody, signature)) {
                logger_1.default.warn('Invalid WhatsApp signature', { signature: signature?.slice(0, 10) + '...' });
                return res.status(401).json({ error: 'invalid_signature' });
            }
        }
        // Validar estructura del webhook
        const validationResult = WhatsAppWebhookSchema.safeParse(req.body);
        if (!validationResult.success) {
            logger_1.default.warn('Invalid WhatsApp webhook structure', { errors: validationResult.error.errors });
            return res.status(400).json({ error: 'invalid_webhook_structure' });
        }
        const data = validationResult.data;
        let processedMessages = 0;
        // Procesar mensajes de texto
        if (data.entry) {
            for (const entry of data.entry) {
                if (entry.changes) {
                    for (const change of entry.changes) {
                        if (change.value?.messages) {
                            for (const message of change.value.messages) {
                                if (message.type === 'text' && message.text?.body) {
                                    // Procesar mensaje con FSM
                                    (0, processMessage_1.processInbound)(message.from, message.text.body)
                                        .then(replies => {
                                        logger_1.default.info('WhatsApp message processed', {
                                            from: message.from.slice(0, 3) + '***' + message.from.slice(-2),
                                            messageId: message.id,
                                            repliesCount: replies.length
                                        });
                                    })
                                        .catch(error => {
                                        logger_1.default.error('Error processing WhatsApp message', { error, messageId: message.id });
                                    });
                                    processedMessages++;
                                }
                            }
                        }
                    }
                }
            }
        }
        logger_1.default.info('WhatsApp webhook received', {
            object: data.object,
            processedMessages
        });
        // Responder rápidamente a Meta
        res.status(200).json({ received: true, n_messages: processedMessages });
    }
    catch (error) {
        logger_1.default.error('WhatsApp webhook error', { error });
        res.status(500).json({ error: 'internal_server_error' });
    }
});
exports.default = router;
//# sourceMappingURL=whatsapp.js.map