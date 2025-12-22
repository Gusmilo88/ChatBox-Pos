"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handle360WebhookVerify = handle360WebhookVerify;
exports.handle360WebhookMessage = handle360WebhookMessage;
const express_1 = require("express");
const logger_1 = require("../utils/logger");
const conversations_1 = require("../services/conversations");
/**
 * Rutas webhook para 360dialog WhatsApp Business API
 *
 * TODO: Si todo funciona correctamente con 360dialog:
 * - Reemplazar referencia en src/index.ts línea 35:
 *   app.use('/api/webhook/whatsapp', express.raw({ type: 'application/json' }), webhook360Router);
 * - Eliminar o deprecar src/routes/whatsapp.ts si ya no se usa Meta Cloud API
 *
 * Variables de entorno requeridas:
 * - WHATSAPP_VERIFY_TOKEN: Token para verificación del webhook
 */
const router = (0, express_1.Router)();
/**
 * GET /api/webhook/whatsapp
 * Verificación del webhook (handshake inicial de 360dialog/Meta)
 *
 * Query params esperados:
 * - hub.mode: debe ser 'subscribe'
 * - hub.verify_token: debe coincidir con WHATSAPP_VERIFY_TOKEN
 * - hub.challenge: string aleatorio que debemos retornar
 */
function handle360WebhookVerify(req, res) {
    const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query;
    logger_1.logger.info('whatsapp360_webhook_verify_request', {
        mode,
        hasVerifyToken: !!verifyToken,
        hasChallenge: !!challenge
    });
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;
    if (!expectedToken) {
        logger_1.logger.error('whatsapp360_verify_token_not_configured', {
            message: 'WHATSAPP_VERIFY_TOKEN no está configurado en .env'
        });
        res.status(500).json({ error: 'verify_token_not_configured' });
        return;
    }
    // Validar modo y token
    if (mode === 'subscribe' && verifyToken === expectedToken) {
        logger_1.logger.info('whatsapp360_webhook_verified', {
            mode,
            challenge: challenge?.toString().substring(0, 10) + '...'
        });
        // Retornar el challenge para completar la verificación
        res.status(200).send(challenge);
        return;
    }
    logger_1.logger.warn('whatsapp360_webhook_verification_failed', {
        mode,
        verifyToken: verifyToken ? '***' + String(verifyToken).slice(-4) : 'none',
        expectedToken: '***' + expectedToken.slice(-4)
    });
    res.status(403).json({ error: 'verification_failed' });
}
/**
 * POST /api/webhook/whatsapp
 * Recibe eventos de mensajes entrantes de 360dialog
 *
 * IMPORTANTE: Responde rápidamente (200 OK) y procesa de forma asíncrona
 * para no bloquear el ciclo de eventos y cumplir con el timeout de 360dialog.
 */
async function handle360WebhookMessage(req, res) {
    try {
        // Responder inmediatamente para no bloquear
        res.status(200).json({ ok: true });
        // Parsear el body (viene como Buffer por express.raw())
        let payload;
        try {
            const rawBody = req.body;
            payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
        }
        catch (parseError) {
            logger_1.logger.error('whatsapp360_webhook_parse_error', {
                error: parseError instanceof Error ? parseError.message : 'Unknown parse error'
            });
            return;
        }
        logger_1.logger.info('whatsapp360_webhook_received', {
            object: payload.object,
            entryCount: payload.entry?.length || 0
        });
        // Procesar mensajes de forma asíncrona
        let processedMessages = 0;
        if (payload.entry && Array.isArray(payload.entry)) {
            for (const entry of payload.entry) {
                if (entry.changes && Array.isArray(entry.changes)) {
                    for (const change of entry.changes) {
                        // Procesar mensajes de texto entrantes
                        if (change.value?.messages && Array.isArray(change.value.messages)) {
                            for (const message of change.value.messages) {
                                if (message.type === 'text' && message.text?.body) {
                                    const from = message.from;
                                    const text = message.text.body;
                                    // Normalizar número de teléfono (agregar + si no lo tiene)
                                    const normalizedFrom = from.startsWith('+') ? from : `+${from}`;
                                    // Procesar mensaje entrante (crea conversación, genera respuesta, encola en outbox)
                                    (0, conversations_1.simulateIncoming)({
                                        phone: normalizedFrom,
                                        text: text,
                                        via: 'whatsapp'
                                    })
                                        .then(async (result) => {
                                        logger_1.logger.info('whatsapp360_message_processed', {
                                            from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                                            messageId: message.id,
                                            conversationId: result.conversationId
                                        });
                                        // Las respuestas ya están encoladas en outbox por simulateIncoming
                                        // El worker de outbox las procesará automáticamente
                                        // Pero también podemos enviarlas directamente aquí para respuesta inmediata
                                        // (opcional: comentar si prefieres solo usar outbox)
                                        // NOTA: Por ahora dejamos que el outbox worker envíe los mensajes
                                        // para tener mejor control de errores y reintentos
                                    })
                                        .catch((error) => {
                                        logger_1.logger.error('whatsapp360_message_process_error', {
                                            error: error instanceof Error ? error.message : 'Unknown error',
                                            from: normalizedFrom.replace(/\d(?=\d{4})/g, '*'),
                                            messageId: message.id,
                                            stack: error instanceof Error ? error.stack : undefined
                                        });
                                    });
                                    processedMessages++;
                                }
                            }
                        }
                        // Log de status updates (entregas, lecturas, etc.)
                        if (change.value?.statuses && Array.isArray(change.value.statuses)) {
                            for (const status of change.value.statuses) {
                                logger_1.logger.debug('whatsapp360_status_update', {
                                    messageId: status.id,
                                    status: status.status,
                                    recipientId: status.recipient_id.replace(/\d(?=\d{4})/g, '*')
                                });
                            }
                        }
                    }
                }
            }
        }
        logger_1.logger.info('whatsapp360_webhook_processed', {
            object: payload.object,
            processedMessages
        });
    }
    catch (error) {
        logger_1.logger.error('whatsapp360_webhook_error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        // Ya respondimos 200, solo loguear el error
    }
}
// Rutas
router.get('/', handle360WebhookVerify);
router.post('/', handle360WebhookMessage);
exports.default = router;
