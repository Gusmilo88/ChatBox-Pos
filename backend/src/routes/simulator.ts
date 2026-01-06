/**
 * RUTAS DEL SIMULADOR
 * 
 * Permite probar TODO el bot sin depender de Meta WhatsApp API.
 * 
 * Endpoints:
 * - POST /api/simulator/client - Simular mensaje de cliente
 * - POST /api/simulator/operator - Simular respuesta de operador
 * - GET /api/simulator/status - Ver estado del simulador
 */

import { Router, Request, Response } from 'express'
import {
  simulateClientMessage,
  simulateOperatorResponse,
  getSimulatorStatus
} from '../services/simulator'
import logger from '../libs/logger'

const router = Router()

/**
 * POST /api/simulator/client
 * Simular mensaje entrante de un cliente
 * 
 * Body:
 * {
 *   "phone": "+5491125522465",
 *   "text": "Hola, necesito ayuda con facturación"
 * }
 */
router.post('/client', async (req: Request, res: Response) => {
  try {
    const { phone, text } = req.body

    if (!phone || !text) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren "phone" y "text" en el body'
      })
    }

    const result = await simulateClientMessage(phone, text)

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Mensaje simulado exitosamente',
        conversationId: result.conversationId,
        botReplies: result.botReplies || [],
        derivedTo: result.derivedTo,
        info: {
          note: 'Este mensaje fue procesado con la lógica REAL del bot',
          nextStep: result.derivedTo 
            ? `El cliente fue derivado a ${result.derivedTo}. Usá POST /api/simulator/operator para simular su respuesta.`
            : 'El bot respondió automáticamente. Podés enviar otro mensaje del cliente.'
        }
      })
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      })
    }
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('simulator_client_route_error', { error: msg })
    res.status(500).json({
      success: false,
      error: msg
    })
  }
})

/**
 * POST /api/simulator/operator
 * Simular respuesta de un operador
 * 
 * Body:
 * {
 *   "operatorPhone": "+54911XXXX-XXXX", // Número del operador
 *   "messageText": "Hola, te ayudo con la facturación",
 *   "clientPhone": "+5491125522465" // Opcional: si no se especifica, usa la conversación más reciente
 * }
 */
router.post('/operator', async (req: Request, res: Response) => {
  try {
    const { operatorPhone, messageText, clientPhone } = req.body

    if (!operatorPhone || !messageText) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren "operatorPhone" y "messageText" en el body'
      })
    }

    const result = await simulateOperatorResponse(operatorPhone, messageText, clientPhone)

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Respuesta del operador simulada exitosamente',
        conversationId: result.conversationId,
        clientPhone: result.clientPhone?.replace(/\d(?=\d{4})/g, '*'),
        operatorName: result.operatorName,
        info: {
          note: 'Esta respuesta fue procesada con la lógica REAL del bot',
          nextStep: 'El cliente recibió la respuesta. Podés simular otro mensaje del cliente con POST /api/simulator/client'
        }
      })
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        operatorName: result.operatorName,
        help: result.error?.includes('No se encontró conversación')
          ? 'Primero simulá un mensaje del cliente que active la derivación automática (POST /api/simulator/client)'
          : undefined
      })
    }
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('simulator_operator_route_error', { error: msg })
    res.status(500).json({
      success: false,
      error: msg
    })
  }
})

/**
 * GET /api/simulator/status
 * Ver estado del simulador (operadores configurados, conversaciones recientes)
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await getSimulatorStatus()

    res.status(200).json({
      success: true,
      status,
      info: {
        note: 'Este simulador usa la lógica REAL del bot',
        endpoints: {
          simulateClient: 'POST /api/simulator/client',
          simulateOperator: 'POST /api/simulator/operator',
          status: 'GET /api/simulator/status'
        }
      }
    })
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('simulator_status_route_error', { error: msg })
    res.status(500).json({
      success: false,
      error: msg
    })
  }
})

/**
 * GET /api/simulator/messages/:conversationId
 * Obtener mensajes de una conversación específica
 */
router.get('/messages/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params
    const { collections } = await import('../firebase')

    const messagesSnapshot = await collections.messages(conversationId)
      .orderBy('ts', 'asc')
      .get()

    const messages = messagesSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        from: data.from,
        text: data.text,
        timestamp: data.ts?.toDate?.() || data.ts,
        via: data.via || 'unknown'
      }
    })

    res.status(200).json({
      success: true,
      conversationId,
      messages
    })
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('simulator_messages_route_error', { error: msg })
    res.status(500).json({
      success: false,
      error: msg
    })
  }
})

export default router

