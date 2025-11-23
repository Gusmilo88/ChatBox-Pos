import './config/env';
import express from 'express';
import cookieParser from 'cookie-parser';
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
import webhook360Router from './routes/webhook360';
import wa360TestRouter from './routes/wa360_test';
import aiStatsRouter from './routes/aiStats';

const app = express();

app.set('trust proxy', 1);

const PORT = Number(process.env.PORT || 4000);

app.use(secureHeaders());
app.use(buildCors());
app.use(cookieParser());
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));
app.use(globalRateLimit());

// Rutas públicas
app.use('/health', healthRouter);
app.use('/api/health', healthRouter);

// Autenticación (pública)
app.use('/auth', authRouter);

// Simulación (pública, para testing)
app.use('/api/simulate', simulateRouter);

// 360dialog: webhook (raw body)
app.use('/api/webhook/whatsapp', express.raw({ type: 'application/json' }), webhook360Router);

// Rutas protegidas por sesión
app.use('/api/conversations', requireSession, conversationsRouter);
app.use('/api/whatsapp', requireSession, whatsappRouter);
app.use('/api/ai', aiStatsRouter);

// Rutas protegidas por API key
app.use('/api/wa360/test', requireApiKey(), wa360TestRouter);

// 404 catch-all (SIN '*')
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err: any, req: any, res: any, _next: any) => {
  const msg = (err as Error)?.message ?? String(err);
  logger?.error?.('Unhandled error', { message: msg, stack: err?.stack });
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  logger?.info?.(`Server listening on http://localhost:${PORT}`);
  logger?.info?.('360dialog webhook mounted at /api/webhook/whatsapp');
  logger?.info?.('360dialog test mounted at /api/wa360/test');
});
