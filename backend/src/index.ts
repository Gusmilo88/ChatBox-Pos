import './config/env';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';

import logger from './libs/logger';
import { 
  secureHeaders, 
  buildCors, 
  globalRateLimit, 
  requireApiKey 
} from './middleware/security';
import { requireSession } from './middleware/session';
import healthRouter from './routes/health';
import simulateRouter from './routes/simulate';
import whatsappRouter from './routes/whatsapp';
import conversationsRouter from './routes/conversations';
import authRouter from './routes/auth';

const app = express();

const PORT = Number(process.env.PORT || 4000);

// Middlewares de seguridad (SOLO UNA VEZ y antes de las rutas)
app.use(secureHeaders());
app.use(buildCors());
app.use(cookieParser());
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(globalRateLimit());

// Rutas públicas
app.use('/health', healthRouter);              // GET /health → { ok: true }
app.use('/auth', authRouter);                  // POST /auth/login, POST /auth/logout, GET /auth/me
app.use('/webhook/whatsapp', express.raw({ type: 'application/json' }), whatsappRouter); // WhatsApp webhook (raw body)

// Rutas protegidas por sesión
app.use('/api/conversations', requireSession, conversationsRouter); // GET/POST /api/conversations/*
app.use('/api/whatsapp', requireSession, whatsappRouter); // POST /api/whatsapp/send (protegido por sesión)
app.use('/api', requireApiKey(), simulateRouter); // POST /api/simulate/message (protegido por API key)

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
