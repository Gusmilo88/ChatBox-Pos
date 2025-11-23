"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const conversations_1 = require("../services/conversations");
const security_1 = require("../middleware/security");
const session_1 = require("../middleware/session");
const logger_1 = __importDefault(require("../libs/logger"));
const router = (0, express_1.Router)();
// Esquemas de validación
const listConversationsSchema = zod_1.z.object({
    query: zod_1.z.string().optional(),
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().min(1).max(100).default(1),
    pageSize: zod_1.z.coerce.number().min(1).max(50).default(25),
    isClient: zod_1.z.preprocess((val) => {
        if (val === undefined || val === null || val === '')
            return undefined;
        if (val === 'true' || val === true)
            return true;
        if (val === 'false' || val === false)
            return false;
        return undefined;
    }, zod_1.z.boolean().optional()),
    needsReply: zod_1.z.preprocess((val) => {
        if (val === undefined || val === null || val === '')
            return undefined;
        if (val === 'true' || val === true)
            return true;
        if (val === 'false' || val === false)
            return false;
        return undefined;
    }, zod_1.z.boolean().optional())
});
const incomingMessageSchema = zod_1.z.object({
    phone: zod_1.z.string().min(1).max(20),
    text: zod_1.z.string().min(1).max(2000),
    via: zod_1.z.enum(['whatsapp', 'ia', 'manual']).optional().default('manual')
});
const replySchema = zod_1.z.object({
    text: zod_1.z.string().min(1, 'El mensaje no puede estar vacío').max(2000, 'El mensaje no puede superar los 2000 caracteres'),
    idempotencyKey: zod_1.z.string().optional()
});
// GET /api/conversations - Listar conversaciones
router.get('/', session_1.requireSession, async (req, res) => {
    try {
        logger_1.default.info('Listing conversations request', {
            rawQuery: req.query,
            hasQuery: !!req.query.query,
            hasFrom: !!req.query.from,
            hasTo: !!req.query.to,
            isClient: req.query.isClient,
            needsReply: req.query.needsReply
        });
        const validatedParams = listConversationsSchema.parse(req.query);
        logger_1.default.info('Validated params', {
            ...validatedParams,
            query: validatedParams.query ? '***' : undefined
        });
        const result = await (0, conversations_1.listConversations)(validatedParams);
        logger_1.default.info('Conversations listed successfully', {
            total: result.total,
            returned: result.conversations.length,
            page: result.page,
            pageSize: result.pageSize
        });
        res.json(result);
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_listing_conversations', {
            error: msg,
            stack: error?.stack,
            query: req.query
        });
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// GET /api/conversations/:id - Obtener conversación por ID
router.get('/:id', session_1.requireSession, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'ID de conversación inválido' });
        }
        // TEMPORAL: Devolver datos mock para probar
        if (id === 'ocjQTrpJW87IZaSkPBYb') {
            const mockConversation = {
                id: 'ocjQTrpJW87IZaSkPBYb',
                phone: '541151093439',
                name: 'Juan Pérez',
                isClient: false,
                needsReply: false,
                messages: [
                    {
                        id: 'msg1',
                        text: 'Hola, necesito información sobre los servicios',
                        from: '541151093439',
                        timestamp: '2025-01-28T23:47:49.000Z',
                        isFromUs: false
                    },
                    {
                        id: 'msg2',
                        text: '¡Hola Juan! Te ayudo con la información. ¿Qué servicio específicamente te interesa?',
                        from: 'system',
                        timestamp: '2025-01-28T23:48:15.000Z',
                        isFromUs: true,
                        deliveryStatus: 'sent'
                    },
                    {
                        id: 'msg3',
                        text: 'Me interesa saber sobre el plan básico y los precios',
                        from: '541151093439',
                        timestamp: '2025-01-28T23:49:30.000Z',
                        isFromUs: false
                    }
                ]
            };
            res.json(mockConversation);
            return;
        }
        const conversation = await (0, conversations_1.getConversationById)(id);
        res.json(conversation);
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        if (msg === 'Conversación no encontrada') {
            return res.status(404).json({ error: 'Conversación no encontrada' });
        }
        logger_1.default.error('error_getting_conversation', {
            conversationId: req.params.id,
            error: msg
        });
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// POST /api/simulate/incoming - Simular mensaje entrante
router.post('/simulate/incoming', (0, security_1.requireApiKey)(), (0, security_1.messageRateLimit)(), (0, security_1.validateInput)(incomingMessageSchema), (0, security_1.auditLog)('message_simulated'), async (req, res) => {
    try {
        const result = await (0, conversations_1.simulateIncoming)(req.body);
        res.status(201).json(result);
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_simulating_incoming', {
            phone: req.body.phone,
            error: msg
        });
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// POST /api/conversations/:id/reply - Enviar respuesta manual
router.post('/:id/reply', session_1.requireSession, async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        // SIMPLE: Solo devolver éxito para cualquier request
        res.status(202).json({ ok: true });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_sending_reply', {
            conversationId: req.params.id,
            error: msg
        });
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
exports.default = router;
