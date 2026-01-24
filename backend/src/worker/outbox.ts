import 'dotenv/config';
import { Timestamp } from 'firebase-admin/firestore';
import { collections } from '../firebase';
import { createWhatsAppDriver, WhatsAppDriver } from '../drivers';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { maskPhone } from '../services/replies';
import { sendWhatsAppInteractiveList } from '../services/whatsappSender';

/**
 * Contrato FINAL del outbox (unificado)
 * Soporta texto e interactive (List Messages)
 */
type OutboxData = {
  id: string;
  conversationId: string;
  phone: string;            // destino (NO "to")
  messageType?: 'text' | 'interactive'; // Por defecto 'text' para compatibilidad
  text?: string;            // mensaje a enviar (obligatorio si messageType='text' o no definido)
  interactive?: any;        // payload interactive (obligatorio si messageType='interactive')
  status: 'pending' | 'sending' | 'sent' | 'failed';
  tries: number;             // intentos (NO "retries")
  idempotencyKey?: string;
  error?: string | null;
  lastError?: string | null;  // Último error registrado
  createdAt: Date | Timestamp;
  nextAttemptAt?: Timestamp | null;
  sentAt?: Timestamp | null;
  remoteId?: string;
};

export class OutboxWorker {
  private driver: WhatsAppDriver;
  private currentPollInterval: number;
  private lastMessageFoundAt: number | null = null;
  private readonly MAX_TRIES = 3;
  private readonly BACKOFF_INTERVALS = [3000, 10000, 30000, 60000]; // 3s → 10s → 30s → 60s

  constructor() {
    this.driver = createWhatsAppDriver(config.whatsappDriver);
    this.currentPollInterval = config.outboxPollIntervalMs;
  }

  /**
   * Procesa un batch de mensajes pendientes
   */
  async runBatchOnce() {
    try {
      // Consultar SOLO por status='pending' (contrato unificado)
      // EXCLUIR mensajes 'failed' explícitamente
      const snap = await collections.outbox()
        .where('status', '==', 'pending')
        .limit(20)
        .get();

      const messageCount = snap.size;
      
      if (messageCount > 0) {
        // Hay mensajes: resetear intervalo y timestamp
        this.currentPollInterval = config.outboxPollIntervalMs;
        this.lastMessageFoundAt = Date.now();
        
        logger.info('outbox_batch_found', {
          count: messageCount,
          pollInterval: this.currentPollInterval
        });

        // Procesar en paralelo (cada uno tiene su propio lock)
        await Promise.all(snap.docs.map(doc => this.processMessage(doc)));
      } else {
        // No hay mensajes: aplicar backoff progresivo
        const timeSinceLastMessage = this.lastMessageFoundAt 
          ? Date.now() - this.lastMessageFoundAt 
          : Infinity;
        
        // Si pasaron más de 5 minutos sin mensajes, usar backoff máximo
        if (timeSinceLastMessage > 5 * 60 * 1000) {
          const backoffIndex = Math.min(
            Math.floor(timeSinceLastMessage / (5 * 60 * 1000)) - 1,
            this.BACKOFF_INTERVALS.length - 1
          );
          this.currentPollInterval = this.BACKOFF_INTERVALS[backoffIndex];
        }
        
        // Log solo cada 10 ciclos para evitar spam
        if (Math.random() < 0.1) {
          logger.debug('outbox_no_messages_backoff', {
            pollInterval: this.currentPollInterval,
            timeSinceLastMessage: timeSinceLastMessage < Infinity ? Math.floor(timeSinceLastMessage / 1000) : null
          });
        }
      }
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      logger.error('outbox_worker_batch_error', { error: msg });
    }
  }

  /**
   * Obtiene el intervalo de polling actual (para el loop principal)
   */
  getPollInterval(): number {
    return this.currentPollInterval;
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
      // Detectar tipo de mensaje: text (default) o interactive
      // Compatibilidad: si no hay messageType, asumir 'text' si hay text, o 'interactive' si hay interactive
      const messageType = data.messageType || (data.text ? 'text' : (data.interactive ? 'interactive' : 'text'));
      const isInteractive = messageType === 'interactive' && !!data.interactive;
      
      logger.info('outbox_attempt_send', {
        id: doc.id,
        phone: maskPhone(data.phone),
        messageType,
        tries: data.tries || 0
      });

      let result: { ok: boolean; remoteId?: string; error?: string };

      if (isInteractive) {
        // PROCESAR MENSAJE INTERACTIVE (List Message) - enviar directamente a Cloud API
        try {
          const interactivePayload = data.interactive;
          const token = process.env.WHATSAPP_TOKEN;
          const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

          if (!token || !phoneNumberId) {
            throw new Error('WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurado');
          }

          // Usar el payload tal cual (ya viene con formato Cloud API)
          const apiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(interactivePayload)
          });

          const responseData = await response.json();

          if (response.ok && response.status >= 200 && response.status < 300) {
            const messageId = responseData.messages?.[0]?.id;
            result = {
              ok: true,
              remoteId: messageId
            };
            logger.info('whatsapp_send_interactive_ok', {
              id: doc.id,
              messageId,
              phone: maskPhone(data.phone),
              buttonText: interactivePayload.interactive?.action?.button
            });
          } else {
            // Error al enviar interactive - loguear completo
            const errorMsg = `Meta API Error ${response.status}: ${response.statusText}`;
            logger.error('interactive_send_failed', {
              id: doc.id,
              status: response.status,
              statusText: response.statusText,
              responseBody: JSON.stringify(responseData),
              phone: maskPhone(data.phone),
              tries: data.tries || 0,
              errorType: 'api_error'
            });
            result = {
              ok: false,
              error: errorMsg
            };
          }
        } catch (error) {
          const errorMsg = (error as Error)?.message ?? String(error);
          logger.error('interactive_send_failed', {
            id: doc.id,
            errorType: 'exception',
            error: errorMsg,
            phone: maskPhone(data.phone),
            stack: error instanceof Error ? error.stack : undefined
          });
          result = {
            ok: false,
            error: errorMsg
          };
        }
      } else {
        // PROCESAR MENSAJE TEXTO (comportamiento actual)
        result = await this.driver.sendText({
          phone: data.phone,
          text: data.text || '',
          idempotencyKey: data.idempotencyKey ?? doc.id
        });

        if (result.ok) {
          logger.info('whatsapp_send_text_ok', {
            id: doc.id,
            remoteId: result.remoteId,
            phone: maskPhone(data.phone)
          });
        } else {
          logger.error('whatsapp_send_text_failed', {
            id: doc.id,
            error: result.error,
            phone: maskPhone(data.phone)
          });
        }
      }

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
          messageType,
          tries: data.tries || 0
        });
      } else {
        // ERROR: Verificar límite de reintentos
        const errorMsg = result.error || 'Error desconocido';
        const tries = (data.tries || 0) + 1;
        
        if (tries >= this.MAX_TRIES) {
          // Límite alcanzado: marcar como failed y NO reintentar
          await doc.ref.update({
            status: 'failed',
            tries,
            error: errorMsg,
            lastError: errorMsg,
            updatedAt: Timestamp.now()
          });

          logger.error('outbox_send_failed_max_tries', {
            id: doc.id,
            error: errorMsg,
            messageType,
            tries,
            phone: maskPhone(data.phone),
            status: 'failed'
          });
        } else {
          // Reintentar con backoff
          const delayMs = Math.min(60000 * tries, 10 * 60 * 1000); // min(60s * tries, 10min)
          const nextAttempt = Timestamp.fromDate(new Date(Date.now() + delayMs));

          await doc.ref.update({
            status: 'pending', // Volver a pending para reintento
            tries,
            error: errorMsg,
            lastError: errorMsg,
            nextAttemptAt: nextAttempt,
            updatedAt: Timestamp.now()
          });

          logger.error('outbox_send_failed_retry', {
            id: doc.id,
            error: errorMsg,
            messageType,
            tries,
            maxTries: this.MAX_TRIES,
            phone: maskPhone(data.phone),
            nextAttemptAt: nextAttempt.toDate().toISOString()
          });
        }
      }
    } catch (error) {
      // EXCEPCIÓN: Verificar límite de reintentos
      const errorMsg = (error as Error)?.message ?? String(error);
      const tries = (data.tries || 0) + 1;
      
      if (tries >= this.MAX_TRIES) {
        // Límite alcanzado: marcar como failed
        await doc.ref.update({
          status: 'failed',
          tries,
          error: errorMsg,
          lastError: errorMsg,
          updatedAt: Timestamp.now()
        });

        logger.error('outbox_send_exception_max_tries', {
          id: doc.id,
          error: errorMsg,
          tries,
          phone: maskPhone(data.phone),
          status: 'failed'
        });
      } else {
        // Reintentar con backoff
        const delayMs = Math.min(60000 * tries, 10 * 60 * 1000);
        const nextAttempt = Timestamp.fromDate(new Date(Date.now() + delayMs));

        await doc.ref.update({
          status: 'pending',
          tries,
          error: errorMsg,
          lastError: errorMsg,
          nextAttemptAt: nextAttempt,
          updatedAt: Timestamp.now()
        });

        logger.error('outbox_send_exception_retry', {
          id: doc.id,
          error: errorMsg,
          tries,
          maxTries: this.MAX_TRIES,
          phone: maskPhone(data.phone),
          nextAttemptAt: nextAttempt.toDate().toISOString()
        });
      }
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

  // Loop principal: procesar batch con polling inteligente (intervalo dinámico)
  let currentInterval = config.outboxPollIntervalMs;
  
  const runWithDynamicInterval = async () => {
    try {
      await worker.runBatchOnce();
      // Actualizar intervalo según el estado del worker
      const newInterval = worker.getPollInterval();
      if (newInterval !== currentInterval) {
        logger.info('outbox_poll_interval_changed', {
          oldInterval: currentInterval,
          newInterval: newInterval
        });
        currentInterval = newInterval;
      }
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      logger.error('outbox_worker_interval_error', { error: msg });
    }
    
    // Programar siguiente ejecución con intervalo dinámico
    setTimeout(runWithDynamicInterval, currentInterval);
  };
  
  // Iniciar loop
  runWithDynamicInterval();

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
