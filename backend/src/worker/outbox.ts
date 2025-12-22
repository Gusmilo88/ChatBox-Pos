import 'dotenv/config';
import { Timestamp } from 'firebase-admin/firestore';
import { getDb, collections } from '../firebase';
import { createWhatsAppDriver, WhatsAppDriver } from '../drivers';
import { logger } from '../utils/logger';
import { config } from '../config/env';

type OutboxData = {
  to: string;
  text: string;
  retries?: number;
  nextAttemptAt?: any; // string | Timestamp | null
  error?: string | null;
  sentAt?: any | null;
  conversationId?: string;
};

export class OutboxWorker {
  private driver: WhatsAppDriver;

  constructor() {
    this.driver = createWhatsAppDriver(config.whatsappDriver);
  }

  async runBatchOnce() {
    try {
      const db = getDb();
      const snap = await collections.outbox(db).where('sentAt', '==', null).limit(20).get();
      await Promise.all(snap.docs.map(doc => this.processMessage(doc)));
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      logger.error('outbox_worker_batch_error', { error: msg });
    }
  }

  private isNotYetDue(data: OutboxData) {
    try {
      if (!data.nextAttemptAt) return false;
      const v: any = data.nextAttemptAt;
      if (typeof v?.toDate === 'function') return v.toDate() > new Date();
      const d = new Date(v);
      return d.toString() !== 'Invalid Date' && d > new Date();
    } catch { return false; }
  }

  private async processMessage(doc: FirebaseFirestore.QueryDocumentSnapshot) {
    const data = doc.data() as OutboxData;

    if (this.isNotYetDue(data)) return;

    try {
      const result = await this.driver.sendText({ 
        phone: data.to, 
        text: data.text,
        idempotencyKey: doc.id // Usar ID del documento como idempotency key
      });
      
      if (result.ok) {
        // Éxito: marcar como enviado
        await doc.ref.update({ 
          sentAt: Timestamp.now(), 
          error: null, 
          nextAttemptAt: null,
          remoteId: result.remoteId
        });
        logger.info('outbox_send_success', { 
          id: doc.id, 
          remoteId: result.remoteId,
          phone: data.to.replace(/\d(?=\d{4})/g, '*')
        });
      } else {
        // Error: programar reintento
        const msg = result.error || 'Error desconocido';
        const retries = (data.retries ?? 0) + 1;
        const delayMs = Math.min(60000 * retries, 10 * 60 * 1000);
        await doc.ref.update({
          retries,
          error: msg,
          nextAttemptAt: Timestamp.fromDate(new Date(Date.now() + delayMs))
        });
        logger.error('outbox_send_failed', { id: doc.id, error: msg, retries });
      }
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      const retries = (data.retries ?? 0) + 1;
      const delayMs = Math.min(60000 * retries, 10 * 60 * 1000);
      await doc.ref.update({
        retries,
        error: msg,
        nextAttemptAt: Timestamp.fromDate(new Date(Date.now() + delayMs))
      });
      logger.error('outbox_send_exception', { id: doc.id, error: msg, retries });
    }
  }

  async enqueue(conversationId: string, to: string, text: string) {
    const db = getDb();
    await collections.outbox(db).add({
      conversationId,
      to,
      text,
      retries: 0,
      error: null,
      sentAt: null,
      nextAttemptAt: null,
      createdAt: Timestamp.now(),
      status: 'pending'
    });
  }
}

// Función principal para el worker
async function main() {
  const worker = new OutboxWorker();

  process.on('SIGINT', async () => {
    console.log('\n🛑 Recibida señal SIGINT');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Recibida señal SIGTERM');
    process.exit(0);
  });

  const interval = setInterval(async () => {
    await worker.runBatchOnce();
  }, config.outboxPollIntervalMs);

  console.log('✅ Worker de outbox iniciado');
}

if (require.main === module) {
  main().catch(error => {
    const msg = (error as Error)?.message ?? String(error);
    console.error('❌ Error iniciando worker:', msg);
    process.exit(1);
  });
}
