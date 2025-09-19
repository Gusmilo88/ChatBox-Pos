import './config/env';
import express from 'express';
import cors from 'cors';
import path from 'path';

// Si tu logger es default export:
import logger from './libs/logger';
// Si no, usá console como fallback:
// const logger = console as any;

import healthRouter from './routes/health';
import simulateRouter from './routes/simulate';

const app = express();

const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN || true;

// Middlewares globales (SIN '*')
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/health', healthRouter);              // GET /health → { ok: true }
app.use('/api', simulateRouter);               // POST /api/simulate/message

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
