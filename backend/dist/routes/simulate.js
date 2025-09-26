"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const engine_1 = require("../fsm/engine");
const leadsRepo_1 = require("../services/leadsRepo");
const ai_1 = require("../services/ai");
const logger_1 = __importDefault(require("../libs/logger"));
const env_1 = __importDefault(require("../config/env"));
// Esquema de validación para el request
const MessageRequestSchema = zod_1.z.object({
    from: zod_1.z.string().min(1, 'from es requerido'),
    text: zod_1.z.string().min(1, 'text es requerido')
});
const router = (0, express_1.Router)();
// Instancias globales
const fsmManager = new engine_1.FSMSessionManager();
const leadsRepo = new leadsRepo_1.LeadsRepository(env_1.default.leadsFile);
router.post('/simulate/message', async (req, res) => {
    try {
        // Validar request
        const validationResult = MessageRequestSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validationResult.error.issues
            });
        }
        const { from, text } = validationResult.data;
        // Log del request entrante
        logger_1.default.info(`Mensaje recibido de ${from}: ${text}`);
        // Procesar mensaje con FSM
        const result = await fsmManager.processMessage(from, text);
        // La verificación de cliente ya se hace en el FSM
        // Si se completó el flujo de no-cliente, guardar lead
        if (result.session.state === 'HUMANO' && result.session.data.name && result.session.data.email && result.session.data.interest) {
            try {
                await leadsRepo.saveLead(from, result.session.data.name, result.session.data.email, result.session.data.interest, result.session.data.cuit);
                logger_1.default.info(`Lead guardado para ${from}: ${result.session.data.name}`);
            }
            catch (error) {
                logger_1.default.error('Error guardando lead:', error);
            }
        }
        // Log de la respuesta
        logger_1.default.info(`Respuesta enviada a ${from}: ${result.replies.join(', ')}`);
        res.json({ replies: result.replies });
    }
    catch (error) {
        logger_1.default.error('Error procesando mensaje:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            replies: ['Lo siento, hubo un error. Por favor intentá de nuevo.']
        });
    }
});
// Endpoint de prueba para IA
const AiTestSchema = zod_1.z.object({
    role: zod_1.z.enum(['cliente', 'no_cliente']),
    interest: zod_1.z.enum(['alta_cliente', 'honorarios', 'turno_consulta', 'otras_consultas']).optional(),
    text: zod_1.z.string().min(1, 'text es requerido')
});
router.post('/ai', async (req, res) => {
    try {
        // Validar request
        const validationResult = AiTestSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                error: 'Datos inválidos',
                details: validationResult.error.issues
            });
        }
        const { role, interest, text } = validationResult.data;
        // Crear contexto para IA
        const aiContext = {
            role: role,
            interest: interest,
            lastUserText: text
        };
        // Llamar a IA
        const reply = await (0, ai_1.aiReply)(aiContext);
        res.json({ reply });
    }
    catch (error) {
        logger_1.default.error('Error en endpoint de IA:', error);
        res.status(500).json({
            error: 'Error interno del servidor',
            reply: 'Lo siento, hubo un error. Por favor intentá de nuevo.'
        });
    }
});
exports.default = router;
//# sourceMappingURL=simulate.js.map