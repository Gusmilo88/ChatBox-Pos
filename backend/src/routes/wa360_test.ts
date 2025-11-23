import { Router } from 'express';
import { z } from 'zod';
import { send360Text } from '../services/whatsapp360';
import { logger } from '../utils/logger';

export const sendTestMessageSchema = z.object({
  to: z.string().min(5),
  text: z.string().min(1),
});

export async function handleTestSend(req: any, res: any) {
  try {
    const body = sendTestMessageSchema.parse(req.body);
    const result = await send360Text(body.to, body.text);
    
    if (result.success) {
      return res.json({ ok: true, result });
    } else {
      const msg = result.error || 'Error al enviar mensaje';
      logger.error('wa360_test_send_failed', { error: msg });
      return res.status(400).json({ error: msg });
    }
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('wa360_test_send_failed', { error: msg });
    return res.status(400).json({ error: msg });
  }
}

const router = Router();
router.post('/send', handleTestSend);
router.get('/status', (_req, res) => res.json({ ok: true, provider: '360dialog' }));
export default router;
