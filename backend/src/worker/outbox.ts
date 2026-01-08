import 'dotenv/config';
import { Timestamp } from 'firebase-admin/firestore';
import { collections } from '../firebase';
import { createWhatsAppDriver, WhatsAppDriver } from '../drivers';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { maskPhone } from '../services/replies';

/**
 * Contrato FINAL del outbox (unificado)
 */
type OutboxData = {
  id: string;
  conversationId: string;
  phone: string;            // destino (NO "to")
  text: string;             // mensaje a enviar
  status: 'pending' | 'sending' | 'sent' | 'failed';
  tries: number;             // intentos (NO "retries")
  idempotencyKey?: string;
  error?: string | null;
  createdAt: Date | Timestamp;
  nextAttemptAt?: Timestamp | null;
  sentAt?: Timestamp | null;
  remoteId?: string;
};

export class OutboxWorker {
  private driver: WhatsAppDriver;

  constructor() {
    this.driver = createWhatsAppDriver(config.whatsappDriver);
  }

  /**
   * Procesa un batch de mensajes pendientes
   */
  async runBatchOnce() {
    try {
      // Consultar SOLO por status='pending' (contrato unificado)
      const snap = await collections.outbox()
        .where('status', '==', 'pending')
        .limit(20)
        .get();

      logger.info('outbox_batch_found', {
        count: snap.size
      });

      // Procesar en paralelo (cada uno tiene su propio lock)
      await Promise.all(snap.docs.map(doc => this.processMessage(doc)));
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      logger.error('outbox_worker_batch_error', { error: msg });
    }
  }

  /**
   * Verifica si un mensaje aún no debe procesarse (backoff)
   */
  private isNotYetDue(data: OutboxData): boolean {
    try {
      if (!data.nextAttemptAt) return false;
      const v: any = data.nextAttemptAt;
      if (typeof v?.toDate === 'function') {
        return v.toDate() > new Date();
      }
      const d = new Date(v);
      return d.toString() !== 'Invalid Date' && d > new Date();
    } catch {
      return false;
    }
  }

  /**
   * Procesa un mensaje individual con lock transaccional
   */
  private async processMessage(doc: FirebaseFirestore.QueryDocumentSnapshot) {
    const data = doc.data() as OutboxData;

    // Verificar backoff
    if (this.isNotYetDue(data)) {
      return;
    }

    // LOCK TRANSACCIONAL: Solo procesar si status == 'pending'
    // Usar transacción para evitar race conditions
    try {
      await doc.ref.firestore.runTransaction(async (transaction) => {
        const freshDoc = await transaction.get(doc.ref);
        const freshData = freshDoc.data() as OutboxData | undefined;

        if (!freshData) {
          // Documento eliminado, skip
          return;
        }

        // Verificar que sigue siendo 'pending' (lock)
        if (freshData.status !== 'pending') {
          // Ya está siendo procesado o procesado, skip
          return;
        }

        // LOCK: Cambiar a 'sending'
        transaction.update(doc.ref, {
          status: 'sending',
          lockedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      });

      // Si llegamos aquí, el lock fue exitoso
      // Ahora procesar el envío
      logger.info('outbox_attempt_send', {
        id: doc.id,
        phone: maskPhone(data.phone),
        tries: data.tries || 0
      });

      const result = await this.driver.sendText({
        phone: data.phone, // Usar 'phone' (NO 'to')
        text: data.text,
        idempotencyKey: data.idempotencyKey ?? doc.id
      });

      if (result.ok) {
        // ÉXITO: Marcar como enviado
        await doc.ref.update({
          status: 'sent',
          sentAt: Timestamp.now(),
          remoteId: result.remoteId,
          error: null,
          nextAttemptAt: null,
          updatedAt: Timestamp.now()
        });

        logger.info('outbox_send_success', {
          id: doc.id,
          remoteId: result.remoteId,
          phone: maskPhone(data.phone),
          tries: data.tries || 0
        });
      } else {
        // ERROR: Programar reintento con backoff
        const errorMsg = result.error || 'Error desconocido';
        const tries = (data.tries || 0) + 1;
        const delayMs = Math.min(60000 * tries, 10 * 60 * 1000); // min(60s * tries, 10min)
        const nextAttempt = Timestamp.fromDate(new Date(Date.now() + delayMs));

        await doc.ref.update({
          status: 'pending', // Volver a pending para reintento
          tries,
          error: errorMsg,
          nextAttemptAt: nextAttempt,
          updatedAt: Timestamp.now()
        });

        logger.error('outbox_send_failed', {
          id: doc.id,
          error: errorMsg,
          tries,
          phone: maskPhone(data.phone),
          nextAttemptAt: nextAttempt.toDate().toISOString()
        });
      }
    } catch (error) {
      // EXCEPCIÓN: Programar reintento
      const errorMsg = (error as Error)?.message ?? String(error);
      const tries = (data.tries || 0) + 1;
      const delayMs = Math.min(60000 * tries, 10 * 60 * 1000);
      const nextAttempt = Timestamp.fromDate(new Date(Date.now() + delayMs));

      // Volver a pending para reintento
      await doc.ref.update({
        status: 'pending',
        tries,
        error: errorMsg,
        nextAttemptAt: nextAttempt,
        updatedAt: Timestamp.now()
      });

      logger.error('outbox_send_exception', {
        id: doc.id,
        error: errorMsg,
        tries,
        phone: maskPhone(data.phone),
        nextAttemptAt: nextAttempt.toDate().toISOString()
      });
    }
  }
}

/**
 * Función principal para el worker (PM2 entrypoint)
 * Ejecutar como: node dist/worker/outbox.js
 */
async function main() {
  const worker = new OutboxWorker();

  // Manejo de señales para shutdown graceful
  process.on('SIGINT', async () => {
    console.log('\n🛑 Recibida señal SIGINT, cerrando worker...');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Recibida señal SIGTERM, cerrando worker...');
    process.exit(0);
  });

  // Loop principal: procesar batch cada X ms
  const interval = setInterval(async () => {
    try {
      await worker.runBatchOnce();
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      logger.error('outbox_worker_interval_error', { error: msg });
    }
  }, config.outboxPollIntervalMs);

  console.log(`✅ Worker de outbox iniciado (poll interval: ${config.outboxPollIntervalMs}ms)`);
  logger.info('outbox_worker_started', {
    pollInterval: config.outboxPollIntervalMs,
    driver: config.whatsappDriver
  });
}

// Ejecutar solo si es el entrypoint principal (PM2)
if (require.main === module) {
  main().catch(error => {
    const msg = (error as Error)?.message ?? String(error);
    console.error('❌ Error iniciando worker:', msg);
    logger.error('outbox_worker_startup_error', { error: msg });
    process.exit(1);
  });
}
