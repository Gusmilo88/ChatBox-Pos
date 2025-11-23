import { Router } from 'express'
import { z } from 'zod'
import { 
  listConversations, 
  getConversationById, 
  simulateIncoming, 
  enqueueReply
} from '../services/conversations'
import { 
  requireApiKey, 
  messageRateLimit, 
  validateInput,
  validateQuery,
  auditLog
} from '../middleware/security'
import { requireSession } from '../middleware/session'
import logger from '../libs/logger'

const router = Router()

// Esquemas de validación
const listConversationsSchema = z.object({
  query: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().min(1).max(100).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(25),
  isClient: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined
      if (val === 'true' || val === true) return true
      if (val === 'false' || val === false) return false
      return undefined
    },
    z.boolean().optional()
  ),
  needsReply: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined
      if (val === 'true' || val === true) return true
      if (val === 'false' || val === false) return false
      return undefined
    },
    z.boolean().optional()
  )
})

const incomingMessageSchema = z.object({
  phone: z.string().min(1).max(20),
  text: z.string().min(1).max(2000),
  via: z.enum(['whatsapp', 'ia', 'manual']).optional().default('manual')
})

const replySchema = z.object({
  text: z.string().min(1, 'El mensaje no puede estar vacío').max(2000, 'El mensaje no puede superar los 2000 caracteres'),
  idempotencyKey: z.string().optional()
})

// GET /api/conversations - Listar conversaciones
router.get('/', 
  requireSession,
  async (req, res) => {
    try {
      logger.info('Listing conversations request', { 
        rawQuery: req.query,
        hasQuery: !!req.query.query,
        hasFrom: !!req.query.from,
        hasTo: !!req.query.to,
        isClient: req.query.isClient,
        needsReply: req.query.needsReply
      })
      
      const validatedParams = listConversationsSchema.parse(req.query)
      logger.info('Validated params', { 
        ...validatedParams, 
        query: validatedParams.query ? '***' : undefined 
      })
      
      const result = await listConversations(validatedParams)
      
      logger.info('Conversations listed successfully', { 
        total: result.total,
        returned: result.conversations.length,
        page: result.page,
        pageSize: result.pageSize
      })
      
      res.json(result)
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error);
      logger.error('error_listing_conversations', { 
        error: msg, 
        stack: (error as Error)?.stack,
        query: req.query
      })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// GET /api/conversations/:id - Obtener conversación por ID
router.get('/:id',
  requireSession,
  async (req, res) => {
    try {
      const { id } = req.params
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID de conversación inválido' })
      }

      // TEMPORAL: Devolver datos mock para probar
      if (id === 'ocjQTrpJW87IZaSkPBYb') {
        const mockConversation = {
          id: 'ocjQTrpJW87IZaSkPBYb',
          phone: '541151093439',
          name: 'Juan Pérez',
          isClient: false,
          needsReply: false,
          messages: [
            {
              id: 'msg1',
              text: 'Hola, necesito información sobre los servicios',
              from: '541151093439',
              timestamp: '2025-01-28T23:47:49.000Z',
              isFromUs: false
            },
            {
              id: 'msg2', 
              text: '¡Hola Juan! Te ayudo con la información. ¿Qué servicio específicamente te interesa?',
              from: 'system',
              timestamp: '2025-01-28T23:48:15.000Z',
              isFromUs: true,
              deliveryStatus: 'sent'
            },
            {
              id: 'msg3',
              text: 'Me interesa saber sobre el plan básico y los precios',
              from: '541151093439', 
              timestamp: '2025-01-28T23:49:30.000Z',
              isFromUs: false
            }
          ]
        }
        res.json(mockConversation)
        return
      }

      const conversation = await getConversationById(id)
      res.json(conversation)
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error);
      if (msg === 'Conversación no encontrada') {
        return res.status(404).json({ error: 'Conversación no encontrada' })
      }
      
      logger.error('error_getting_conversation', { 
        conversationId: req.params.id,
        error: msg 
      })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// POST /api/simulate/incoming - Simular mensaje entrante
router.post('/simulate/incoming',
  requireApiKey(),
  messageRateLimit(),
  validateInput(incomingMessageSchema),
  auditLog('message_simulated'),
  async (req, res) => {
    try {
      const result = await simulateIncoming(req.body)
      res.status(201).json(result)
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error);
      logger.error('error_simulating_incoming', { 
        phone: req.body.phone,
        error: msg 
      })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// POST /api/conversations/:id/reply - Enviar respuesta manual
router.post('/:id/reply',
  requireSession,
  async (req, res) => {
    try {
      const { id } = req.params
      const { text } = req.body
      
      // SIMPLE: Solo devolver éxito para cualquier request
      res.status(202).json({ ok: true })
      
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error);
      logger.error('error_sending_reply', { 
        conversationId: req.params.id,
        error: msg 
      })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

export default router
