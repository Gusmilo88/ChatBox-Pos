import { Router } from 'express';
import { requireSession } from '../middleware/session';
import { getConversationStats } from '../services/stats';
import logger from '../utils/logger';

const router = Router();

// Todas las rutas requieren sesión
router.use(requireSession);

/**
 * GET /api/stats/conversations
 * Obtiene estadísticas de conversaciones
 */
router.get('/conversations', async (req, res) => {
  try {
    const stats = await getConversationStats();
    return res.json({
      ok: true,
      data: stats
    });
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error getting conversation stats:', msg);
    return res.status(500).json({ 
      ok: false, 
      error: 'Error obteniendo estadísticas' 
    });
  }
});

export default router;

