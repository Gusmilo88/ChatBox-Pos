import 'dotenv/config'
import { collections } from '../firebase'
import { config } from '../config/env'
import { getWhatsAppDriver } from '../drivers'
import logger from '../libs/logger'
import type { OutboxMessage } from '../types/conversations'

class OutboxWorker {
  private driver = getWhatsAppDriver()
  private isRunning = false
  private intervalId?: NodeJS.Timeout

  async start() {
    if (this.isRunning) {
      logger.warn('outbox_worker_already_running')
      return
    }

    this.isRunning = true
    logger.info('outbox_worker_started', {
      pollInterval: config.outboxPollIntervalMs,
      batchSize: config.outboxBatchSize,
      driver: config.whatsappDriver
    })

    // Procesar inmediatamente al inicio
    await this.processBatch()

    // Luego procesar en intervalos
    this.intervalId = setInterval(() => {
      this.processBatch().catch(error => {
        logger.error('outbox_worker_interval_error', { error: error.message })
      })
    }, config.outboxPollIntervalMs)
  }

  async stop() {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false
    
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    logger.info('outbox_worker_stopped')
  }

  private async processBatch() {
    try {
      const db = getDb()
      const outboxRef = db.collection(collections.outbox)

      // Buscar mensajes pendientes para procesar
      const query = outboxRef
        .where('status', '==', 'pending')
        .where('tries', '<', 5)
        .orderBy('createdAt', 'asc')
        .limit(config.outboxBatchSize)

      const snapshot = await query.get()

      if (snapshot.empty) {
        // No hay mensajes para procesar
        return
      }

      logger.info('outbox_worker_processing_batch', {
        count: snapshot.size
      })

      // Procesar cada mensaje
      const promises = snapshot.docs.map(doc => this.processMessage(doc))
      await Promise.allSettled(promises)

    } catch (error) {
      logger.error('outbox_worker_batch_error', { error: error.message })
    }
  }

  private async processMessage(doc: any) {
    const data = doc.data() as OutboxMessage
    const messageId = doc.id

    try {
      // Verificar si ya fue enviado (idempotencia)
      if (data.idempotencyKey) {
        const existingSent = await this.findExistingSentMessage(
          data.conversationId,
          data.idempotencyKey
        )
        
        if (existingSent) {
          logger.info('outbox_worker_idempotency_skip', {
            messageId,
            idempotencyKey: data.idempotencyKey
          })
          
          // Marcar como enviado
          await doc.ref.update({
            status: 'sent',
            sentAt: Timestamp.now(),
            remoteId: existingSent.remoteId,
            error: 'Skipped due to idempotency'
          })
          return
        }
      }

      // Verificar si es hora de intentar (backoff exponencial)
      if (data.nextAttemptAt && data.nextAttemptAt.toDate() > new Date()) {
        return // Aún no es hora de reintentar
      }

      // Enviar mensaje
      const result = await this.driver.sendText({
        phone: data.phone,
        text: data.text,
        idempotencyKey: data.idempotencyKey
      })

      if (result.ok) {
        // Éxito
        await doc.ref.update({
          status: 'sent',
          sentAt: Timestamp.now(),
          remoteId: result.remoteId,
          error: undefined
        })

        logger.info('outbox_worker_message_sent', {
          messageId,
          remoteId: result.remoteId,
          tries: data.tries + 1
        })

        // Opcional: Actualizar delivery status en la conversación
        await this.updateConversationMessageStatus(
          data.conversationId,
          messageId,
          'sent'
        )

      } else {
        // Fallo - programar reintento
        const newTries = data.tries + 1
        const backoffMs = this.getBackoffDelay(newTries)
        const nextAttemptAt = new Date(Date.now() + backoffMs)

        const updateData: any = {
          tries: newTries,
          nextAttemptAt: Timestamp.fromDate(nextAttemptAt),
          error: result.error
        }

        if (newTries >= 5) {
          updateData.status = 'failed'
        }

        await doc.ref.update(updateData)

        logger.warn('outbox_worker_message_failed', {
          messageId,
          tries: newTries,
          error: result.error,
          nextAttemptAt: nextAttemptAt.toISOString()
        })
      }

    } catch (error) {
      logger.error('outbox_worker_message_error', {
        messageId,
        error: error.message
      })

      // Incrementar intentos
      const newTries = data.tries + 1
      const backoffMs = this.getBackoffDelay(newTries)
      const nextAttemptAt = new Date(Date.now() + backoffMs)

      await doc.ref.update({
        tries: newTries,
        nextAttemptAt: Timestamp.fromDate(nextAttemptAt),
        error: error.message
      })
    }
  }

  private async findExistingSentMessage(
    conversationId: string,
    idempotencyKey: string
  ): Promise<{ remoteId?: string } | null> {
    const db = getDb()
    const outboxRef = db.collection(collections.outbox)

    const query = outboxRef
      .where('conversationId', '==', conversationId)
      .where('idempotencyKey', '==', idempotencyKey)
      .where('status', '==', 'sent')
      .limit(1)

    const snapshot = await query.get()
    
    if (snapshot.empty) {
      return null
    }

    const doc = snapshot.docs[0]
    return {
      remoteId: doc.data().remoteId
    }
  }

  private async updateConversationMessageStatus(
    conversationId: string,
    messageId: string,
    status: 'sent' | 'failed'
  ) {
    try {
      const db = getDb()
      const conversationRef = db.collection(collections.conversations).doc(conversationId)
      const messagesRef = conversationRef.collection('messages').doc(messageId)

      await messagesRef.update({
        deliveryStatus: status
      })

      logger.info('outbox_worker_updated_message_status', {
        conversationId,
        messageId,
        status
      })
    } catch (error) {
      logger.error('outbox_worker_update_status_error', {
        conversationId,
        messageId,
        error: error.message
      })
    }
  }

  private getBackoffDelay(tries: number): number {
    // Backoff exponencial: 30s, 60s, 120s, 300s, 600s
    const delays = [30000, 60000, 120000, 300000, 600000]
    return delays[Math.min(tries - 1, delays.length - 1)]
  }
}

// Función principal
async function main() {
  const worker = new OutboxWorker()

  // Manejar señales de terminación
  process.on('SIGINT', async () => {
    console.log('\n🛑 Recibida señal SIGINT, deteniendo worker...')
    await worker.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Recibida señal SIGTERM, deteniendo worker...')
    await worker.stop()
    process.exit(0)
  })

  // Iniciar worker
  await worker.start()
  console.log('✅ Worker de outbox iniciado')
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error iniciando worker:', error)
    process.exit(1)
  })
}

export { OutboxWorker }
