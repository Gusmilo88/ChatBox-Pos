"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxWorker = void 0;
require("dotenv/config");
const firebase_1 = require("../firebase");
const env_1 = require("../config/env");
const drivers_1 = require("../drivers");
const logger_1 = __importDefault(require("../libs/logger"));
class OutboxWorker {
    constructor() {
        this.driver = (0, drivers_1.getWhatsAppDriver)();
        this.isRunning = false;
    }
    async start() {
        if (this.isRunning) {
            logger_1.default.warn('outbox_worker_already_running');
            return;
        }
        this.isRunning = true;
        logger_1.default.info('outbox_worker_started', {
            pollInterval: env_1.config.outboxPollIntervalMs,
            batchSize: env_1.config.outboxBatchSize,
            driver: env_1.config.whatsappDriver
        });
        // Procesar inmediatamente al inicio
        await this.processBatch();
        // Luego procesar en intervalos
        this.intervalId = setInterval(() => {
            this.processBatch().catch(error => {
                logger_1.default.error('outbox_worker_interval_error', { error: error.message });
            });
        }, env_1.config.outboxPollIntervalMs);
    }
    async stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
        logger_1.default.info('outbox_worker_stopped');
    }
    async processBatch() {
        try {
            const db = getDb();
            const outboxRef = db.collection(firebase_1.collections.outbox);
            // Buscar mensajes pendientes para procesar
            const query = outboxRef
                .where('status', '==', 'pending')
                .where('tries', '<', 5)
                .orderBy('createdAt', 'asc')
                .limit(env_1.config.outboxBatchSize);
            const snapshot = await query.get();
            if (snapshot.empty) {
                // No hay mensajes para procesar
                return;
            }
            logger_1.default.info('outbox_worker_processing_batch', {
                count: snapshot.size
            });
            // Procesar cada mensaje
            const promises = snapshot.docs.map(doc => this.processMessage(doc));
            await Promise.allSettled(promises);
        }
        catch (error) {
            logger_1.default.error('outbox_worker_batch_error', { error: error.message });
        }
    }
    async processMessage(doc) {
        const data = doc.data();
        const messageId = doc.id;
        try {
            // Verificar si ya fue enviado (idempotencia)
            if (data.idempotencyKey) {
                const existingSent = await this.findExistingSentMessage(data.conversationId, data.idempotencyKey);
                if (existingSent) {
                    logger_1.default.info('outbox_worker_idempotency_skip', {
                        messageId,
                        idempotencyKey: data.idempotencyKey
                    });
                    // Marcar como enviado
                    await doc.ref.update({
                        status: 'sent',
                        sentAt: Timestamp.now(),
                        remoteId: existingSent.remoteId,
                        error: 'Skipped due to idempotency'
                    });
                    return;
                }
            }
            // Verificar si es hora de intentar (backoff exponencial)
            if (data.nextAttemptAt && data.nextAttemptAt.toDate() > new Date()) {
                return; // Aún no es hora de reintentar
            }
            // Enviar mensaje
            const result = await this.driver.sendText({
                phone: data.phone,
                text: data.text,
                idempotencyKey: data.idempotencyKey
            });
            if (result.ok) {
                // Éxito
                await doc.ref.update({
                    status: 'sent',
                    sentAt: Timestamp.now(),
                    remoteId: result.remoteId,
                    error: undefined
                });
                logger_1.default.info('outbox_worker_message_sent', {
                    messageId,
                    remoteId: result.remoteId,
                    tries: data.tries + 1
                });
                // Opcional: Actualizar delivery status en la conversación
                await this.updateConversationMessageStatus(data.conversationId, messageId, 'sent');
            }
            else {
                // Fallo - programar reintento
                const newTries = data.tries + 1;
                const backoffMs = this.getBackoffDelay(newTries);
                const nextAttemptAt = new Date(Date.now() + backoffMs);
                const updateData = {
                    tries: newTries,
                    nextAttemptAt: Timestamp.fromDate(nextAttemptAt),
                    error: result.error
                };
                if (newTries >= 5) {
                    updateData.status = 'failed';
                }
                await doc.ref.update(updateData);
                logger_1.default.warn('outbox_worker_message_failed', {
                    messageId,
                    tries: newTries,
                    error: result.error,
                    nextAttemptAt: nextAttemptAt.toISOString()
                });
            }
        }
        catch (error) {
            logger_1.default.error('outbox_worker_message_error', {
                messageId,
                error: error.message
            });
            // Incrementar intentos
            const newTries = data.tries + 1;
            const backoffMs = this.getBackoffDelay(newTries);
            const nextAttemptAt = new Date(Date.now() + backoffMs);
            await doc.ref.update({
                tries: newTries,
                nextAttemptAt: Timestamp.fromDate(nextAttemptAt),
                error: error.message
            });
        }
    }
    async findExistingSentMessage(conversationId, idempotencyKey) {
        const db = getDb();
        const outboxRef = db.collection(firebase_1.collections.outbox);
        const query = outboxRef
            .where('conversationId', '==', conversationId)
            .where('idempotencyKey', '==', idempotencyKey)
            .where('status', '==', 'sent')
            .limit(1);
        const snapshot = await query.get();
        if (snapshot.empty) {
            return null;
        }
        const doc = snapshot.docs[0];
        return {
            remoteId: doc.data().remoteId
        };
    }
    async updateConversationMessageStatus(conversationId, messageId, status) {
        try {
            const db = getDb();
            const conversationRef = db.collection(firebase_1.collections.conversations).doc(conversationId);
            const messagesRef = conversationRef.collection('messages').doc(messageId);
            await messagesRef.update({
                deliveryStatus: status
            });
            logger_1.default.info('outbox_worker_updated_message_status', {
                conversationId,
                messageId,
                status
            });
        }
        catch (error) {
            logger_1.default.error('outbox_worker_update_status_error', {
                conversationId,
                messageId,
                error: error.message
            });
        }
    }
    getBackoffDelay(tries) {
        // Backoff exponencial: 30s, 60s, 120s, 300s, 600s
        const delays = [30000, 60000, 120000, 300000, 600000];
        return delays[Math.min(tries - 1, delays.length - 1)];
    }
}
exports.OutboxWorker = OutboxWorker;
// Función principal
async function main() {
    const worker = new OutboxWorker();
    // Manejar señales de terminación
    process.on('SIGINT', async () => {
        console.log('\n🛑 Recibida señal SIGINT, deteniendo worker...');
        await worker.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('\n🛑 Recibida señal SIGTERM, deteniendo worker...');
        await worker.stop();
        process.exit(0);
    });
    // Iniciar worker
    await worker.start();
    console.log('✅ Worker de outbox iniciado');
}
// Ejecutar si es llamado directamente
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error iniciando worker:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=outbox.js.map