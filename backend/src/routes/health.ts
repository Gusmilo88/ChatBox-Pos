import { Router } from 'express';
const r = Router();
r.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'chatbot-backend', time: new Date().toISOString() });
});
export default r;
