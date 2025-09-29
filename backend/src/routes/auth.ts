import { Router } from 'express'
import { z } from 'zod'
import { login, refreshToken, createAdmin } from '../services/auth'
import { requireAuth, requireRole, validateInput, auditLog } from '../middleware/security'
import logger from '../libs/logger'

const router = Router()

// Esquemas de validación
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
})

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token requerido')
})

const createAdminSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['owner', 'operador']).optional().default('operador')
})

// POST /auth/login - Iniciar sesión
router.post('/login',
  validateInput(loginSchema),
  async (req, res) => {
    try {
      const result = await login(req.body)
      res.json(result)
    } catch (error) {
      if (error.message === 'Credenciales inválidas') {
        return res.status(401).json({ error: 'Credenciales inválidas' })
      }
      
      logger.error('login_failed', { 
        email: req.body.email,
        error: error.message 
      })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// POST /auth/refresh - Renovar token
router.post('/refresh',
  validateInput(refreshTokenSchema),
  async (req, res) => {
    try {
      const result = await refreshToken(req.body.refreshToken)
      res.json(result)
    } catch (error) {
      if (error.message === 'Token de refresh inválido') {
        return res.status(401).json({ error: 'Token de refresh inválido' })
      }
      
      logger.error('refresh_failed', { error: error.message })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// POST /auth/create-admin - Crear administrador (solo owners)
router.post('/create-admin',
  requireAuth(),
  requireRole(['owner']),
  validateInput(createAdminSchema),
  auditLog('admin_created'),
  async (req, res) => {
    try {
      await createAdmin(req.body.email, req.body.password, req.body.role)
      res.status(201).json({ message: 'Administrador creado exitosamente' })
    } catch (error) {
      logger.error('error_creating_admin', { 
        email: req.body.email,
        error: error.message 
      })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// GET /auth/me - Obtener información del usuario actual
router.get('/me',
  requireAuth(),
  async (req, res) => {
    try {
      res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role
        }
      })
    } catch (error) {
      logger.error('error_getting_user_info', { error: error.message })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// POST /auth/logout - Cerrar sesión
router.post('/logout',
  requireAuth(),
  auditLog('user_logged_out'),
  async (req, res) => {
    try {
      // En un sistema más complejo, aquí se invalidaría el token
      // Por ahora solo logueamos el evento
      res.json({ message: 'Sesión cerrada exitosamente' })
    } catch (error) {
      logger.error('logout_failed', { error: error.message })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

export default router
