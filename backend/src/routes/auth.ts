import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { login, createSessionToken } from '../services/auth'
import { createSessionCookie, clearSessionCookie, requireSession } from '../middleware/session'
import { validateInput } from '../middleware/security'
import logger from '../libs/logger'

const router = Router()

// Rate limiting para login
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('login_rate_limit_exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })
    res.status(429).json({ error: 'Demasiados intentos de login. Intenta nuevamente en 15 minutos.' })
  }
})

// Esquemas de validación
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
})

// POST /auth/login - Iniciar sesión
router.post('/login',
  loginRateLimit,
  validateInput(loginSchema),
  async (req, res) => {
    try {
      const { email, password } = req.body

      // TEMPORAL: Login hardcodeado para testing
      if (email === 'admin@test.com' && password === 'password123') {
        const user = {
          adminId: 'temp-admin-id',
          email: 'admin@test.com',
          role: 'owner' as const
        }

        // Crear token de sesión
        const sessionToken = createSessionToken(user)

        // Establecer cookie
        res.setHeader('Set-Cookie', createSessionCookie(sessionToken))

        logger.info('login_success', {
          adminId: user.adminId,
          email: user.email,
          role: user.role,
          ip: req.ip
        })

        res.json({
          ok: true,
          user: {
            email: user.email,
            role: user.role
          }
        })
        return
      }

      // Autenticar usuario (Firebase - deshabilitado temporalmente)
      // const user = await login(email, password)

      logger.warn('login_failed_invalid_credentials', {
        email: req.body.email,
        ip: req.ip
      })
      
      res.status(401).json({ error: 'Credenciales inválidas' })
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error);
      logger.warn('login_failed', {
        email: req.body.email,
        ip: req.ip,
        error: msg
      })
      
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// POST /auth/logout - Cerrar sesión
router.post('/logout',
  requireSession,
  async (req, res) => {
    try {
      logger.info('user_logged_out', {
        adminId: req.user!.adminId,
        email: req.user!.email,
        ip: req.ip
      })

      // Limpiar cookie
      res.setHeader('Set-Cookie', clearSessionCookie())
      res.json({ ok: true })
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error);
      logger.error('logout_failed', { error: msg })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// GET /auth/me - Obtener información del usuario actual
router.get('/me',
  requireSession,
  async (req, res) => {
    try {
      res.json({
        email: req.user!.email,
        role: req.user!.role
      })
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error);
      logger.error('error_getting_user_info', { error: msg })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

// GET /auth/operators - Listar operadores disponibles (solo para owners)
router.get('/operators',
  requireSession,
  async (req, res) => {
    try {
      // Solo owners pueden ver la lista de operadores
      if (req.user?.role !== 'owner') {
        return res.status(403).json({ error: 'No autorizado' })
      }

      const { collections } = await import('../firebase')
      const operatorsSnapshot = await collections.admins()
        .where('role', '==', 'operador')
        .where('isActive', '==', true)
        .get()

      const operators = operatorsSnapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          email: data.email,
          name: data.name || data.email.split('@')[0],
          role: data.role
        }
      })

      res.json({ operators })
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error);
      logger.error('error_listing_operators', { error: msg })
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

export default router