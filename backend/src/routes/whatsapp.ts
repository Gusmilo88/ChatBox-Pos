import { Router } from 'express'
import { z } from 'zod'
import { logger } from '../utils/logger'
import { requireSession } from '../middleware/session'
import { sendWhatsAppMessage, isWhatsAppConfigured } from '../services/whatsappSender'

const router = Router()

// Schema de validación para el envío de mensajes
const sendMessageSchema = z.object({
  to: z.string()
    .min(1, 'El número de teléfono es requerido')
    .regex(/^\+[1-9]\d{1,14}$/, 'Formato de número inválido. Use formato internacional (ej: +541151093439)'),
  text: z.string()
    .min(1, 'El texto del mensaje es requerido')
    .max(4096, 'El mensaje no puede exceder 4096 caracteres')
})

/**
 * POST /api/whatsapp/send
 * Envía un mensaje de WhatsApp a través de la Cloud API de Meta
 * 
 * Body:
 * {
 *   "to": "+541151093439",
 *   "text": "Mensaje de prueba"
 * }
 * 
 * Respuesta exitosa:
 * {
 *   "success": true,
 *   "messageId": "wamid.HBgM...",
 *   "status": "sent",
 *   "mock": false
 * }
 * 
 * Respuesta mock (si no hay configuración):
 * {
 *   "success": true,
 *   "messageId": "mock_1234567890_abc123",
 *   "status": "sent",
 *   "mock": true,
 *   "message": "Simulación de envío"
 * }
 */
router.post('/send',
  requireSession, // Requiere autenticación
  async (req, res) => {
    try {
      // Validar el cuerpo de la petición
      const validation = sendMessageSchema.safeParse(req.body)
      
      if (!validation.success) {
        logger.warn('whatsapp_validation_error', {
          errors: validation.error.errors,
          user: req.user?.email
        })
        
        return res.status(400).json({
          error: 'Datos de entrada inválidos',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        })
      }

      const { to, text } = validation.data

      logger.info('whatsapp_send_request', {
        to: to.replace(/\d(?=\d{4})/g, '*'), // Enmascarar número
        textLength: text.length,
        user: req.user?.email,
        isConfigured: isWhatsAppConfigured()
      })

      // Enviar mensaje a través de WhatsApp Cloud API
      const result = await sendWhatsAppMessage(to, text)

      if (result.success) {
        logger.info('whatsapp_send_success', {
          messageId: result.messageId,
          to: to.replace(/\d(?=\d{4})/g, '*'),
          user: req.user?.email,
          mock: result.mock || false
        })

        // Respuesta exitosa
        const response: any = {
          success: true,
          messageId: result.messageId,
          status: result.status
        }

        // Si es mock, agregar información adicional
        if (result.mock) {
          response.mock = true
          response.message = 'Simulación de envío - WhatsApp no configurado'
        }

        return res.status(200).json(response)
      } else {
        logger.error('whatsapp_send_failed', {
          error: result.error,
          to: to.replace(/\d(?=\d{4})/g, '*'),
          user: req.user?.email
        })

        return res.status(500).json({
          success: false,
          error: result.error || 'Error al enviar mensaje',
          status: result.status
        })
      }

    } catch (error) {
      logger.error('whatsapp_route_error', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        user: req.user?.email
      })

      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        status: 'failed'
      })
    }
  }
)

/**
 * GET /api/whatsapp/status
 * Verifica el estado de configuración del servicio WhatsApp
 * 
 * Respuesta:
 * {
 *   "configured": true/false,
 *   "message": "WhatsApp configurado correctamente" | "WhatsApp en modo simulación"
 * }
 */
router.get('/status',
  requireSession,
  async (req, res) => {
    try {
      const configured = isWhatsAppConfigured()
      
      logger.info('whatsapp_status_check', {
        configured,
        user: req.user?.email
      })

      return res.status(200).json({
        configured,
        message: configured 
          ? 'WhatsApp configurado correctamente' 
          : 'WhatsApp en modo simulación - Configure WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID'
      })

    } catch (error) {
      logger.error('whatsapp_status_error', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        user: req.user?.email
      })

      return res.status(500).json({
        error: 'Error al verificar estado de WhatsApp'
      })
    }
  }
)

export default router