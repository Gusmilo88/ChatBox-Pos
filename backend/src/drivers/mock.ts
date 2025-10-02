import { v4 as uuidv4 } from 'uuid'
import { WhatsAppDriver, WhatsAppSendResult } from './whatsappDriver'
import logger from '../libs/logger'

/**
 * Driver mock para WhatsApp
 * Simula el envío de mensajes con latencia y logging
 */
export class MockWhatsAppDriver implements WhatsAppDriver {
  async sendText(args: {
    phone: string
    text: string
    idempotencyKey?: string
  }): Promise<WhatsAppSendResult> {
    const { phone, text, idempotencyKey } = args
    
    // Simular latencia de red (200-600ms)
    const latency = Math.random() * 400 + 200
    await new Promise(resolve => setTimeout(resolve, latency))
    
    // Simular ocasional fallo (5% de probabilidad)
    if (Math.random() < 0.05) {
      const errorMsg = 'Simulated network error'
      logger.warn('mock_whatsapp_send_failed', {
        phone: phone.slice(0, 3) + '***', // Mask phone
        textLength: text.length,
        idempotencyKey,
        error: errorMsg
      })
      
      return {
        ok: false,
        error: errorMsg
      }
    }
    
    // Simular éxito
    const remoteId = `mock-${uuidv4()}`
    
    logger.info('mock_whatsapp_send_success', {
      phone: phone.slice(0, 3) + '***', // Mask phone
      textLength: text.length,
      remoteId,
      idempotencyKey
    })
    
    return {
      ok: true,
      remoteId
    }
  }
}
