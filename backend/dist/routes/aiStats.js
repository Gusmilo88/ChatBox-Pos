"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const session_1 = require("../middleware/session");
const aiCostTracker_1 = require("../services/aiCostTracker");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// Todas las rutas requieren sesión
router.use(session_1.requireSession);
/**
 * GET /api/ai/stats
 * Obtiene estadísticas del mes actual
 */
router.get('/stats', async (req, res) => {
    try {
        const usage = await (0, aiCostTracker_1.getCurrentMonthUsage)();
        return res.json({
            ok: true,
            data: usage
        });
    }
    catch (error) {
        const msg = error?.message ?? String(error);
        logger_1.default.error('Error getting AI stats:', msg);
        return res.status(500).json({
            ok: false,
            error: 'Error obteniendo estadísticas de IA'
        });
    }
});
/**
 * GET /api/ai/stats/:month
 * Obtiene estadísticas de un mes específico (formato: YYYY-MM)
 */
router.get('/stats/:month', async (req, res) => {
    try {
        const { month } = req.params;
        // Validar formato YYYY-MM
        if (!/^\d{4}-\d{2}$/.test(month)) {
            return res.status(400).json({
                ok: false,
                error: 'Formato de mes inválido. Use YYYY-MM'
            });
        }
        const usage = await (0, aiCostTracker_1.getMonthlyStats)(month);
        return res.json({
            ok: true,
            data: usage
        });
    }
    catch (error) {
        const msg = error?.message ?? String(error);
        logger_1.default.error('Error getting AI stats for month:', msg);
        return res.status(500).json({
            ok: false,
            error: 'Error obteniendo estadísticas de IA'
        });
    }
});
/**
 * GET /api/ai/limit
 * Obtiene el límite mensual configurado
 */
router.get('/limit', async (req, res) => {
    try {
        const limit = await (0, aiCostTracker_1.getMonthlyLimit)();
        return res.json({
            ok: true,
            data: { monthlyLimitUsd: limit }
        });
    }
    catch (error) {
        const msg = error?.message ?? String(error);
        logger_1.default.error('Error getting AI limit:', msg);
        return res.status(500).json({
            ok: false,
            error: 'Error obteniendo límite de IA'
        });
    }
});
/**
 * POST /api/ai/limit
 * Actualiza el límite mensual
 * Body: { monthlyLimitUsd: number }
 */
router.post('/limit', async (req, res) => {
    try {
        const { monthlyLimitUsd } = req.body;
        if (typeof monthlyLimitUsd !== 'number' || monthlyLimitUsd < 0) {
            return res.status(400).json({
                ok: false,
                error: 'monthlyLimitUsd debe ser un número positivo'
            });
        }
        await (0, aiCostTracker_1.setMonthlyLimit)(monthlyLimitUsd);
        return res.json({
            ok: true,
            data: { monthlyLimitUsd }
        });
    }
    catch (error) {
        const msg = error?.message ?? String(error);
        logger_1.default.error('Error setting AI limit:', msg);
        return res.status(500).json({
            ok: false,
            error: msg
        });
    }
});
exports.default = router;
