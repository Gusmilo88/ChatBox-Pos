import { logger } from '../utils/logger'

interface WhatsAppMessageResponse {
  success: boolean
  messageId?: string
  status?: 'sent' | 'failed' | 'mock'
  error?: string
  mock?: boolean
}

interface MetaApiResponse {
  messaging_product: string
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string }>
}

/**
 * Envía un mensaje de texto a través de WhatsApp Cloud API
 * @param to Número de teléfono del destinatario (formato internacional: +541151093439)
 * @param text Texto del mensaje a enviar
 * @returns Promise con resultado del envío
 */
export async function sendWhatsAppMessage(
  to: string, 
  text: string
): Promise<WhatsAppMessageResponse> {
  try {
    // Validar parámetros de entrada
    if (!to || !text) {
      throw new Error('Número de teléfono y texto son requeridos')
    }

    // Validar formato del número (debe empezar con +)
    if (!to.startsWith('+')) {
      throw new Error('El número debe incluir código de país (ej: +541151093439)')
    }

    // Obtener variables de entorno
    const token = process.env.WHATSAPP_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

    // Si no hay token o phone number ID, usar modo mock
    if (!token || !phoneNumberId) {
      logger.warn('whatsapp_mock_mode', {
        reason: !token ? 'WHATSAPP_TOKEN no definido' : 'WHATSAPP_PHONE_NUMBER_ID no definido',
        to: to.replace(/\d(?=\d{4})/g, '*'), // Enmascarar número
        textLength: text.length
      })

      return {
        success: true,
        mock: true,
        status: 'sent',
        messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    }

    // Validar que el token no sea vacío
    if (token.trim() === '' || phoneNumberId.trim() === '') {
      logger.warn('whatsapp_empty_config', {
        hasToken: !!token,
        hasPhoneId: !!phoneNumberId
      })
      
      return {
        success: true,
        mock: true,
        status: 'sent',
        messageId: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }
    }

    // Preparar payload para Meta API
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: {
        body: text
      }
    }

    // URL de la API de Meta
    const apiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`

    logger.info('whatsapp_sending_message', {
      to: to.replace(/\d(?=\d{4})/g, '*'), // Enmascarar número
      textLength: text.length,
      phoneNumberId: phoneNumberId,
      tokenPreview: token.slice(-4) // Solo últimos 4 caracteres del token
    })

    // Realizar llamada a Meta API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()

    // Verificar si la respuesta es exitosa
    if (response.ok && response.status >= 200 && response.status < 300) {
      const metaResponse = responseData as MetaApiResponse
      
      logger.info('whatsapp_message_sent', {
        messageId: metaResponse.messages[0]?.id,
        to: to.replace(/\d(?=\d{4})/g, '*'),
        status: response.status
      })

      return {
        success: true,
        messageId: metaResponse.messages[0]?.id,
        status: 'sent'
      }
    } else {
      // Error en la respuesta de Meta
      logger.error('whatsapp_api_error', {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseData,
        to: to.replace(/\d(?=\d{4})/g, '*'),
        phoneNumberId: phoneNumberId
      })

      return {
        success: false,
        status: 'failed',
        error: `Meta API Error ${response.status}: ${response.statusText}`,
        messageId: undefined
      }
    }

  } catch (error) {
    logger.error('whatsapp_send_error', {
      error: error instanceof Error ? error.message : 'Error desconocido',
      to: to.replace(/\d(?=\d{4})/g, '*'),
      textLength: text.length
    })

    return {
      success: false,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Error interno',
      messageId: undefined
    }
  }
}

/**
 * Valida si el servicio WhatsApp está configurado correctamente
 * @returns true si está configurado, false si está en modo mock
 */
export function isWhatsAppConfigured(): boolean {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  
  return !!(token && phoneNumberId && token.trim() !== '' && phoneNumberId.trim() !== '')
}
