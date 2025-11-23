"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxWorker = void 0;
require("dotenv/config");
const firestore_1 = require("firebase-admin/firestore");
const firebase_1 = require("../firebase");
const drivers_1 = require("../drivers");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
class OutboxWorker {
    constructor() {
        this.driver = (0, drivers_1.createWhatsAppDriver)(env_1.config.whatsappDriver);
    }
    async runBatchOnce() {
        try {
            const db = (0, firebase_1.getDb)();
            const snap = await firebase_1.collections.outbox(db).where('sentAt', '==', null).limit(20).get();
            await Promise.all(snap.docs.map(doc => this.processMessage(doc)));
        }
        catch (error) {
            const msg = error?.message ?? String(error);
            logger_1.logger.error('outbox_worker_batch_error', { error: msg });
        }
    }
    isNotYetDue(data) {
        try {
            if (!data.nextAttemptAt)
                return false;
            const v = data.nextAttemptAt;
            if (typeof v?.toDate === 'function')
                return v.toDate() > new Date();
            const d = new Date(v);
            return d.toString() !== 'Invalid Date' && d > new Date();
        }
        catch {
            return false;
        }
    }
    async processMessage(doc) {
        const data = doc.data();
        if (this.isNotYetDue(data))
            return;
        try {
            await this.driver.sendText({ phone: data.to, text: data.text });
            await doc.ref.update({
                sentAt: firestore_1.Timestamp.now(),
                error: null,
                nextAttemptAt: null
            });
        }
        catch (error) {
            const msg = error?.message ?? String(error);
            const retries = (data.retries ?? 0) + 1;
            const delayMs = Math.min(60000 * retries, 10 * 60 * 1000);
            await doc.ref.update({
                retries,
                error: msg,
                nextAttemptAt: firestore_1.Timestamp.fromDate(new Date(Date.now() + delayMs))
            });
            logger_1.logger.error('outbox_send_failed', { id: doc.id, error: msg });
        }
    }
    async enqueue(conversationId, to, text) {
        const db = (0, firebase_1.getDb)();
        await firebase_1.collections.outbox(db).add({
            conversationId,
            to,
            text,
            retries: 0,
            error: null,
            sentAt: null,
            nextAttemptAt: null,
            createdAt: firestore_1.Timestamp.now(),
            status: 'pending'
        });
    }
}
exports.OutboxWorker = OutboxWorker;
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
    }, env_1.config.outboxPollIntervalMs);
    console.log('✅ Worker de outbox iniciado');
}
if (require.main === module) {
    main().catch(error => {
        const msg = error?.message ?? String(error);
        console.error('❌ Error iniciando worker:', msg);
        process.exit(1);
    });
}
