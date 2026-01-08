"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxWorker = void 0;
require("dotenv/config");
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../firebase");
const drivers_1 = require("../drivers");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
const replies_1 = require("../services/replies");
class OutboxWorker {
    constructor() {
        this.driver = (0, drivers_1.createWhatsAppDriver)(env_1.config.whatsappDriver);
    }
    /**
     * Procesa un batch de mensajes pendientes
     */
    async runBatchOnce() {
        try {
            // Consultar SOLO por status='pending' (contrato unificado)
            const snap = await firebase_1.collections.outbox()
                .where('status', '==', 'pending')
                .limit(20)
                .get();
            logger_1.logger.info('outbox_batch_found', {
                count: snap.size
            });
            // Procesar en paralelo (cada uno tiene su propio lock)
            await Promise.all(snap.docs.map(doc => this.processMessage(doc)));
        }
        catch (error) {
            const msg = error?.message ?? String(error);
            logger_1.logger.error('outbox_worker_batch_error', { error: msg });
        }
    }
    /**
     * Verifica si un mensaje aún no debe procesarse (backoff)
     */
    isNotYetDue(data) {
        try {
            if (!data.nextAttemptAt)
                return false;
            const v = data.nextAttemptAt;
            if (typeof v?.toDate === 'function') {
                return v.toDate() > new Date();
            }
            const d = new Date(v);
            return d.toString() !== 'Invalid Date' && d > new Date();
        }
        catch {
            return false;
        }
    }
    /**
     * Procesa un mensaje individual con lock transaccional
     */
    async processMessage(doc) {
        const data = doc.data();
        // Verificar backoff
        if (this.isNotYetDue(data)) {
            return;
        }
        // LOCK TRANSACCIONAL: Solo procesar si status == 'pending'
        // Usar transacción para evitar race conditions
        try {
            await doc.ref.firestore.runTransaction(async (transaction) => {
                const freshDoc = await transaction.get(doc.ref);
                const freshData = freshDoc.data();
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
                    lockedAt: firestore_1.Timestamp.now(),
                    updatedAt: firestore_1.Timestamp.now()
                });
            });
            // Si llegamos aquí, el lock fue exitoso
            // Ahora procesar el envío
            logger_1.logger.info('outbox_attempt_send', {
                id: doc.id,
                phone: (0, replies_1.maskPhone)(data.phone),
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
                    sentAt: firestore_1.Timestamp.now(),
                    remoteId: result.remoteId,
                    error: null,
                    nextAttemptAt: null,
                    updatedAt: firestore_1.Timestamp.now()
                });
                logger_1.logger.info('outbox_send_success', {
                    id: doc.id,
                    remoteId: result.remoteId,
                    phone: (0, replies_1.maskPhone)(data.phone),
                    tries: data.tries || 0
                });
            }
            else {
                // ERROR: Programar reintento con backoff
                const errorMsg = result.error || 'Error desconocido';
                const tries = (data.tries || 0) + 1;
                const delayMs = Math.min(60000 * tries, 10 * 60 * 1000); // min(60s * tries, 10min)
                const nextAttempt = firestore_1.Timestamp.fromDate(new Date(Date.now() + delayMs));
                await doc.ref.update({
                    status: 'pending', // Volver a pending para reintento
                    tries,
                    error: errorMsg,
                    nextAttemptAt: nextAttempt,
                    updatedAt: firestore_1.Timestamp.now()
                });
                logger_1.logger.error('outbox_send_failed', {
                    id: doc.id,
                    error: errorMsg,
                    tries,
                    phone: (0, replies_1.maskPhone)(data.phone),
                    nextAttemptAt: nextAttempt.toDate().toISOString()
                });
            }
        }
        catch (error) {
            // EXCEPCIÓN: Programar reintento
            const errorMsg = error?.message ?? String(error);
            const tries = (data.tries || 0) + 1;
            const delayMs = Math.min(60000 * tries, 10 * 60 * 1000);
            const nextAttempt = firestore_1.Timestamp.fromDate(new Date(Date.now() + delayMs));
            // Volver a pending para reintento
            await doc.ref.update({
                status: 'pending',
                tries,
                error: errorMsg,
                nextAttemptAt: nextAttempt,
                updatedAt: firestore_1.Timestamp.now()
            });
            logger_1.logger.error('outbox_send_exception', {
                id: doc.id,
                error: errorMsg,
                tries,
                phone: (0, replies_1.maskPhone)(data.phone),
                nextAttemptAt: nextAttempt.toDate().toISOString()
            });
        }
    }
}
exports.OutboxWorker = OutboxWorker;
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
        }
        catch (error) {
            const msg = error?.message ?? String(error);
            logger_1.logger.error('outbox_worker_interval_error', { error: msg });
        }
    }, env_1.config.outboxPollIntervalMs);
    console.log(`✅ Worker de outbox iniciado (poll interval: ${env_1.config.outboxPollIntervalMs}ms)`);
    logger_1.logger.info('outbox_worker_started', {
        pollInterval: env_1.config.outboxPollIntervalMs,
        driver: env_1.config.whatsappDriver
    });
}
// Ejecutar solo si es el entrypoint principal (PM2)
if (require.main === module) {
    main().catch(error => {
        const msg = error?.message ?? String(error);
        console.error('❌ Error iniciando worker:', msg);
        logger_1.logger.error('outbox_worker_startup_error', { error: msg });
        process.exit(1);
    });
}
