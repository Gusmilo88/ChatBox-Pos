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
import webhookRouter from './routes/webhook';
import aiStatsRouter from './routes/aiStats';
import statsRouter from './routes/stats';
import autoRepliesRouter from './routes/autoReplies';
import simulatorRouter from './routes/simulator';

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
app.use('/api/simulator', simulatorRouter);

// Meta WhatsApp: webhook (raw body)
app.use('/api/webhook/whatsapp', express.raw({ type: 'application/json' }), webhookRouter);

// Rutas protegidas por sesión
app.use('/api/conversations', requireSession, conversationsRouter);
app.use('/api/whatsapp', requireSession, whatsappRouter);
app.use('/api/ai', aiStatsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/auto-replies', requireSession, autoRepliesRouter);


// 404 catch-all (SIN '*')
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err: any, req: any, res: any, _next: any) => {
  const msg = (err as Error)?.message ?? String(err);
  logger?.error?.('Unhandled error', { message: msg, stack: err?.stack });
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, async () => {
  logger?.info?.(`Server listening on http://localhost:${PORT}`);
  logger?.info?.('Meta WhatsApp webhook mounted at /api/webhook/whatsapp');
  
  // Iniciar outbox worker automáticamente
  if (process.env.START_OUTBOX_WORKER !== 'false') {
    try {
      const { OutboxWorker } = await import('./worker/outbox');
      const { config } = await import('./config/env');
      
      const worker = new OutboxWorker();
      setInterval(async () => {
        try {
          await worker.runBatchOnce();
        } catch (error) {
          logger?.error?.('Outbox worker error', { error: (error as Error)?.message });
        }
      }, config.outboxPollIntervalMs);
      
      logger?.info?.('Outbox worker iniciado automáticamente', {
        pollInterval: config.outboxPollIntervalMs,
        driver: config.whatsappDriver
      });
    } catch (error) {
      logger?.warn?.('No se pudo iniciar outbox worker automáticamente', { 
        error: (error as Error)?.message 
      });
    }
  }
});
