import { Router } from 'express';
import { requireSession } from '../middleware/session';
import { 
  getCurrentMonthUsage, 
  getMonthlyStats,
  getMonthlyLimit,
  setMonthlyLimit
} from '../services/aiCostTracker';
import logger from '../utils/logger';

const router = Router();

// Todas las rutas requieren sesión
router.use(requireSession);

/**
 * GET /api/ai/stats
 * Obtiene estadísticas del mes actual
 */
router.get('/stats', async (req, res) => {
  try {
    const usage = await getCurrentMonthUsage();
    return res.json({
      ok: true,
      data: usage
    });
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error getting AI stats:', msg);
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
    
    const usage = await getMonthlyStats(month);
    return res.json({
      ok: true,
      data: usage
    });
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error getting AI stats for month:', msg);
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
    const limit = await getMonthlyLimit();
    return res.json({
      ok: true,
      data: { monthlyLimitUsd: limit }
    });
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error getting AI limit:', msg);
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
    
    await setMonthlyLimit(monthlyLimitUsd);
    return res.json({
      ok: true,
      data: { monthlyLimitUsd }
    });
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error setting AI limit:', msg);
    return res.status(500).json({ 
      ok: false, 
      error: msg 
    });
  }
});

export default router;

