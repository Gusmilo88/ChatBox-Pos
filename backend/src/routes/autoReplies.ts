import { Router } from 'express'
import { z } from 'zod'
import { collections } from '../firebase'
import logger from '../libs/logger'
import { requireSession } from '../middleware/session'

const router = Router()

// Esquema para crear/actualizar regla
const autoReplyRuleSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  enabled: z.boolean().default(true),
  type: z.enum(['keyword', 'schedule']),
  priority: z.number().int().min(0).max(100).default(0),
  // Campos para tipo 'keyword'
  keywords: z.array(z.string().min(1)).optional(),
  matchType: z.enum(['any', 'all']).optional(),
  response: z.string().min(1).max(1000).optional(),
  // Campos para tipo 'schedule'
  schedule: z.object({
    days: z.array(z.number().int().min(0).max(6)), // 0 = domingo, 6 = sábado
    startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/), // Formato HH:mm
    endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/), // Formato HH:mm
    timezone: z.string().optional()
  }).optional(),
  scheduleResponse: z.string().min(1).max(1000).optional(),
  // Filtros
  isClientOnly: z.boolean().optional(),
  isLeadOnly: z.boolean().optional()
}).refine((data) => {
  // Validar que si es tipo 'keyword', tenga keywords y response
  if (data.type === 'keyword') {
    return !!(data.keywords && data.keywords.length > 0 && data.response)
  }
  // Validar que si es tipo 'schedule', tenga schedule y scheduleResponse
  if (data.type === 'schedule') {
    return !!(data.schedule && data.scheduleResponse)
  }
  return true
}, {
  message: 'Los campos requeridos para el tipo de regla no están completos'
})

// GET /api/auto-replies - Listar todas las reglas
router.get('/',
  requireSession,
  async (req, res) => {
    try {
      // Intentar obtener reglas ordenadas por prioridad
      let snapshot
      try {
        snapshot = await collections.autoReplyRules()
          .orderBy('priority', 'desc')
          .orderBy('name', 'asc')
          .get()
      } catch (orderError) {
        // Si falla el ordenamiento (puede ser que no haya índice), obtener sin ordenar
        logger.warn('error_ordering_auto_reply_rules', { error: (orderError as Error).message })
        snapshot = await collections.autoReplyRules().get()
      }

      const rules = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data
        } as any
      })

      // Ordenar manualmente si no se pudo ordenar en la query
      rules.sort((a: any, b: any) => {
        const priorityDiff = (b.priority || 0) - (a.priority || 0)
        if (priorityDiff !== 0) return priorityDiff
        return (a.name || '').localeCompare(b.name || '')
      })

      res.json({ rules })
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error)
      logger.error('error_listing_auto_reply_rules', { error: msg })
      // Si es un error de colección no existente, retornar array vacío
      if (msg.includes('collection') || msg.includes('not found')) {
        return res.json({ rules: [] })
      }
      res.status(500).json({ error: 'Error al listar reglas' })
    }
  }
)

// GET /api/auto-replies/:id - Obtener una regla específica
router.get('/:id',
  requireSession,
  async (req, res) => {
    try {
      const { id } = req.params
      const doc = await collections.autoReplyRules().doc(id).get()

      if (!doc.exists) {
        return res.status(404).json({ error: 'Regla no encontrada' })
      }

      res.json({
        id: doc.id,
        ...doc.data()
      })
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error)
      logger.error('error_getting_auto_reply_rule', { id: req.params.id, error: msg })
      res.status(500).json({ error: 'Error al obtener regla' })
    }
  }
)

// POST /api/auto-replies - Crear una nueva regla
router.post('/',
  requireSession,
  async (req, res) => {
    try {
      // Validar datos
      const validationResult = autoReplyRuleSchema.safeParse(req.body)
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Datos inválidos',
          details: validationResult.error.issues
        })
      }

      const ruleData = validationResult.data

      const docRef = await collections.autoReplyRules().add({
        ...ruleData,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      logger.info('auto_reply_rule_created', {
        id: docRef.id,
        name: ruleData.name,
        type: ruleData.type
      })

      res.status(201).json({
        id: docRef.id,
        ...ruleData
      })
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error)
      logger.error('error_creating_auto_reply_rule', { error: msg })
      res.status(500).json({ error: 'Error al crear regla' })
    }
  }
)

// PATCH /api/auto-replies/:id - Actualizar una regla
router.patch('/:id',
  requireSession,
  async (req, res) => {
    try {
      const { id } = req.params
      
      // Validar datos (parcial para actualización)
      // Crear esquema parcial manualmente
      const partialSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        enabled: z.boolean().optional(),
        type: z.enum(['keyword', 'schedule']).optional(),
        priority: z.number().int().min(0).max(100).optional(),
        keywords: z.array(z.string().min(1)).optional(),
        matchType: z.enum(['any', 'all']).optional(),
        response: z.string().min(1).max(1000).optional(),
        schedule: z.object({
          days: z.array(z.number().int().min(0).max(6)),
          startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
          endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
          timezone: z.string().optional()
        }).optional(),
        scheduleResponse: z.string().min(1).max(1000).optional(),
        isClientOnly: z.boolean().optional(),
        isLeadOnly: z.boolean().optional()
      })
      const validationResult = partialSchema.safeParse(req.body)
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Datos inválidos',
          details: validationResult.error.issues
        })
      }

      const ruleData = validationResult.data

      const docRef = collections.autoReplyRules().doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        return res.status(404).json({ error: 'Regla no encontrada' })
      }

      await docRef.update({
        ...ruleData,
        updatedAt: new Date()
      })

      logger.info('auto_reply_rule_updated', {
        id,
        changes: Object.keys(ruleData)
      })

      const updatedDoc = await docRef.get()
      res.json({
        id: updatedDoc.id,
        ...updatedDoc.data()
      })
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error)
      logger.error('error_updating_auto_reply_rule', { id: req.params.id, error: msg })
      res.status(500).json({ error: 'Error al actualizar regla' })
    }
  }
)

// DELETE /api/auto-replies/:id - Eliminar una regla
router.delete('/:id',
  requireSession,
  async (req, res) => {
    try {
      const { id } = req.params

      const docRef = collections.autoReplyRules().doc(id)
      const doc = await docRef.get()

      if (!doc.exists) {
        return res.status(404).json({ error: 'Regla no encontrada' })
      }

      await docRef.delete()

      logger.info('auto_reply_rule_deleted', { id })

      res.json({ message: 'Regla eliminada correctamente' })
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error)
      logger.error('error_deleting_auto_reply_rule', { id: req.params.id, error: msg })
      res.status(500).json({ error: 'Error al eliminar regla' })
    }
  }
)

export default router

