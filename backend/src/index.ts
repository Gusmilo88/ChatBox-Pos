import './config/env';
import express from 'express';
import path from 'path';

// Si tu logger es default export:
import logger from './libs/logger';
// Si no, usá console como fallback:
// const logger = console as any;

import { secureHeaders, buildCors, limiter, requireApiKey } from './security';
import healthRouter from './routes/health';
import simulateRouter from './routes/simulate';
import whatsappRouter from './routes/whatsapp';

const app = express();

const PORT = Number(process.env.PORT || 3001);

// Middlewares de seguridad (SOLO UNA VEZ y antes de las rutas)
app.use(secureHeaders());
app.use(buildCors());
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(limiter());

// Rutas
app.use('/health', healthRouter);              // GET /health → { ok: true }
app.use('/webhook/whatsapp', express.raw({ type: 'application/json' }), whatsappRouter); // WhatsApp webhook (raw body)
app.use('/api', requireApiKey(), simulateRouter); // POST /api/simulate/message (protegido)

// 404 catch-all (SIN '*')
app.use((req, res) => {
  return res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger?.error?.('Unhandled error', { message: err?.message, stack: err?.stack });
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  logger?.info?.(`Server listening on http://localhost:${PORT}`);
});
