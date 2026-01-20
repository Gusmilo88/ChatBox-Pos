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
 * Marca un mensaje entrante como "read" (tilde azul) en WhatsApp Cloud API
 * @param messageId ID del mensaje entrante (wamid del usuario)
 * @returns Promise con resultado de la operación
 */
export async function markWhatsAppMessageAsRead(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validar parámetros
    if (!messageId) {
      throw new Error('messageId es requerido para marcar como leído')
    }

    // Obtener variables de entorno
    const token = process.env.WHATSAPP_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

    // Si no hay token o phone number ID, usar modo mock
    if (!token || !phoneNumberId) {
      logger.debug('whatsapp_mark_read_mock_mode', {
        reason: !token ? 'WHATSAPP_TOKEN no definido' : 'WHATSAPP_PHONE_NUMBER_ID no definido',
        messageId
      })
      return { success: true } // Mock: siempre exitoso
    }

    // Preparar payload para marcar como leído
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    }

    // URL de la API de Meta
    const apiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`

    logger.debug('whatsapp_marking_as_read', {
      messageId,
      phoneNumberId
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
      logger.info('whatsapp_mark_read_ok', {
        messageId,
        status: response.status
      })

      return {
        success: true
      }
    } else {
      // Error en la respuesta de Meta
      logger.error('whatsapp_mark_read_failed', {
        status: response.status,
        statusText: response.statusText,
        responseBody: responseData,
        messageId
      })

      return {
        success: false,
        error: `Meta API Error ${response.status}: ${response.statusText}`
      }
    }
  } catch (error) {
    logger.error('whatsapp_mark_read_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId,
      stack: error instanceof Error ? error.stack : undefined
    })

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
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
 * Envía un mensaje interactivo tipo List (Interactive List Message)
 * Formato según WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#interactive-messages
 */
export async function sendWhatsAppInteractiveList(
  to: string,
  options: {
    headerText: string;
    bodyText: string;
    footerText?: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description: string;
      }>;
    }>;
  }
): Promise<WhatsAppMessageResponse> {
  try {
    // Validar parámetros
    if (!to || !options.headerText || !options.bodyText || !options.buttonText) {
      throw new Error('Parámetros requeridos faltantes para mensaje interactivo');
    }

    // Validar formato del número
    if (!to.startsWith('+')) {
      throw new Error('El número debe incluir código de país (ej: +541151093439)');
    }

    // Obtener variables de entorno
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    // Si no hay token o phone number ID, usar modo mock
    if (!token || !phoneNumberId) {
      logger.warn('whatsapp_interactive_mock_mode', {
        reason: !token ? 'WHATSAPP_TOKEN no definido' : 'WHATSAPP_PHONE_NUMBER_ID no definido',
        to: to.replace(/\d(?=\d{4})/g, '*')
      });

      return {
        success: true,
        mock: true,
        status: 'sent',
        messageId: `mock_interactive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    }

    // Preparar payload para Interactive List Message
    const payload: any = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: {
          text: options.bodyText
        },
        action: {
          button: options.buttonText,
          sections: options.sections.map(section => ({
            title: section.title || undefined,
            rows: section.rows.map(row => ({
              id: row.id,
              title: row.title,
              description: row.description
            }))
          }))
        }
      }
    };

    // Agregar header solo si está definido
    if (options.headerText) {
      payload.interactive.header = {
        type: 'text',
        text: options.headerText
      };
    }

    // Agregar footer solo si está definido
    if (options.footerText) {
      payload.interactive.footer = {
        text: options.footerText
      };
    }

    // URL de la API de Meta
    const apiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

    logger.info('whatsapp_sending_interactive_list', {
      to: to.replace(/\d(?=\d{4})/g, '*'),
      sectionsCount: options.sections.length,
      totalRows: options.sections.reduce((sum, s) => sum + s.rows.length, 0),
      phoneNumberId: phoneNumberId
    });

    // Realizar llamada a Meta API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();

    // Verificar si la respuesta es exitosa
    if (response.ok && response.status >= 200 && response.status < 300) {
      const metaResponse = responseData as MetaApiResponse;

      logger.info('whatsapp_interactive_list_sent', {
        messageId: metaResponse.messages[0]?.id,
        to: to.replace(/\d(?=\d{4})/g, '*'),
        status: response.status
      });

      return {
        success: true,
        messageId: metaResponse.messages[0]?.id,
        status: 'sent'
      };
    } else {
      // Error en la respuesta de Meta - Logging mejorado para debugging
      logger.error('interactive_send_failed', {
        status: response.status,
        statusText: response.statusText,
        responseBody: JSON.stringify(responseData),
        to: to.replace(/\d(?=\d{4})/g, '*'),
        phoneNumberId: phoneNumberId,
        errorType: 'api_error'
      });

      return {
        success: false,
        status: 'failed',
        error: `Meta API Error ${response.status}: ${response.statusText}`,
        messageId: undefined
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
    logger.error('interactive_send_failed', {
      error: errorMsg,
      errorType: 'exception',
      to: to.replace(/\d(?=\d{4})/g, '*'),
      stack: error instanceof Error ? error.stack : undefined
    });

    return {
      success: false,
      status: 'failed',
      error: errorMsg,
      messageId: undefined
    };
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
