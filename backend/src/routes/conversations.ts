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
import logger from '../libs/logger'

const router = Router()

// Esquemas de validación
const listConversationsSchema = z.object({
  query: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().min(1).max(100).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(25),
  isClient: z.coerce.boolean().optional(),
  needsReply: z.coerce.boolean().optional()
})

const incomingMessageSchema = z.object({
  phone: z.string().min(1).max(20),
  text: z.string().min(1).max(2000),
  via: z.enum(['whatsapp', 'ia', 'manual']).optional().default('manual')
})

const replySchema = z.object({
  text: z.string().min(1).max(2000),
  idempotencyKey: z.string().optional()
})

// GET /api/conversations - Listar conversaciones
router.get('/', 
  async (req, res) => {
    try {
      // TEMPORAL: Devolver datos mock para probar
      const mockResult = {
        conversations: [
          {
            id: 'ocjQTrpJW87IZaSkPBYb',
            phone: '541151093439',
            isClient: false,
            needsReply: false,
            unreadCount: 0,
            lastMessageAt: '2025-09-28T23:47:49.000Z',
            lastMessage: 'Hola, necesito información sobre los servicios'
          }
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false
      }
      res.json(mockResult)
      
      // TODO: Descomentar cuando Firebase esté funcionando
      // const result = await listConversations(req.query)
      // res.json(result)
    } catch (error) {
      logger.error('error_listing_conversations', { error: error.message })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// GET /api/conversations/:id - Obtener conversación por ID
router.get('/:id',
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
              isFromUs: true
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
      if (error.message === 'Conversación no encontrada') {
        return res.status(404).json({ error: 'Conversación no encontrada' })
      }
      
      logger.error('error_getting_conversation', { 
        conversationId: req.params.id,
        error: error.message 
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
      logger.error('error_simulating_incoming', { 
        phone: req.body.phone,
        error: error.message 
      })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// POST /api/conversations/:id/reply - Enviar respuesta
router.post('/:id/reply',
  messageRateLimit(),
  validateInput(replySchema),
  async (req, res) => {
    try {
      const { id } = req.params
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'ID de conversación inválido' })
      }

      await enqueueReply(id, req.body)
      res.status(202).json({ message: 'Respuesta encolada' })
    } catch (error) {
      if (error.message === 'Conversación no encontrada') {
        return res.status(404).json({ error: 'Conversación no encontrada' })
      }
      
      if (error.message.includes('caracteres')) {
        return res.status(400).json({ error: error.message })
      }
      
      logger.error('error_sending_reply', { 
        conversationId: req.params.id,
        error: error.message 
      })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

export default router
