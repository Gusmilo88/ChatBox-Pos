import { WhatsAppDriver, WhatsAppSendResult } from './whatsappDriver'
import { sendWhatsAppMessage } from '../services/whatsappSender'
import logger from '../libs/logger'

/**
 * Driver de WhatsApp usando Meta WhatsApp Cloud API
 * Implementa la interfaz WhatsAppDriver para usar con el outbox worker
 */
export class CloudWhatsAppDriver implements WhatsAppDriver {
  async sendText(args: {
    phone: string
    text: string
    idempotencyKey?: string
  }): Promise<WhatsAppSendResult> {
    const { phone, text, idempotencyKey } = args
    
    try {
      // Normalizar número (debe empezar con +)
      const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`
      
      logger.info('cloud_whatsapp_driver_sending', {
        phone: normalizedPhone.replace(/\d(?=\d{4})/g, '*'),
        textLength: text.length,
        idempotencyKey
      })

      // Enviar usando el servicio de Meta WhatsApp Cloud API
      const result = await sendWhatsAppMessage(normalizedPhone, text)
      
      if (result.success && result.messageId) {
        logger.info('cloud_whatsapp_driver_sent', {
          phone: normalizedPhone.replace(/\d(?=\d{4})/g, '*'),
          messageId: result.messageId,
          idempotencyKey,
          mock: result.mock || false
        })
        
        return {
          ok: true,
          remoteId: result.messageId
        }
      } else {
        const errorMsg = result.error || 'Error desconocido al enviar mensaje'
        logger.error('cloud_whatsapp_driver_failed', {
          phone: normalizedPhone.replace(/\d(?=\d{4})/g, '*'),
          error: errorMsg,
          idempotencyKey
        })
        
        return {
          ok: false,
          error: errorMsg
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      logger.error('cloud_whatsapp_driver_exception', {
        phone: phone.replace(/\d(?=\d{4})/g, '*'),
        error: errorMsg,
        idempotencyKey,
        stack: error instanceof Error ? error.stack : undefined
      })
      
      return {
        ok: false,
        error: errorMsg
      }
    }
  }
}

