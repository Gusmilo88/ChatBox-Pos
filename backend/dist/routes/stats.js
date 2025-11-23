"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_1 = require("../middleware/session");
const stats_1 = require("../services/stats");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// Todas las rutas requieren sesión
router.use(session_1.requireSession);
/**
 * GET /api/stats/conversations
 * Obtiene estadísticas de conversaciones
 */
router.get('/conversations', async (req, res) => {
    try {
        const stats = await (0, stats_1.getConversationStats)();
        return res.json({
            ok: true,
            data: stats
        });
    }
    catch (error) {
        const msg = error?.message ?? String(error);
        logger_1.default.error('Error getting conversation stats:', msg);
        return res.status(500).json({
            ok: false,
            error: 'Error obteniendo estadísticas'
        });
    }
});
exports.default = router;
