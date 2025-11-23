import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import logger from '../libs/logger'
import { collections } from '../firebase'
import type { AuthUser } from '../services/auth'
import { config } from '../config/env'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY || ''

// CORS estricto
export function buildCors() {
  const allowedOrigins = [config.corsOrigin, config.dashboardOrigin]
    .filter(Boolean)
    .map(s => s.trim())

  return cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true)
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      
      logger.warn('cors_blocked', { origin, allowedOrigins })
      return callback(new Error('Origin not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
  })
}

// Helmet con configuración completa
export function secureHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 15552000, // 6 meses
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true
  })
}

// Rate limiting global
export function globalRateLimit() {
  const windowMs = Number(process.env.RATE_WINDOW_MS || 60000) // 1 minuto
  const max = Number(process.env.RATE_MAX || 60) // 60 requests por minuto

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Usar keyGenerator por defecto que maneja IPv6 correctamente
    handler: (req, res) => {
      logger.warn('rate_limit_exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      })
      res.status(429).json({ error: 'Too many requests' })
    }
  })
}

// Rate limiting específico para mensajes
export function messageRateLimit() {
  return rateLimit({
    windowMs: 60000, // 1 minuto
    max: 10, // 10 mensajes por minuto por IP
    standardHeaders: true,
    legacyHeaders: false,
    // Usar keyGenerator por defecto que maneja IPv6 correctamente
    handler: (req, res) => {
      logger.warn('message_rate_limit_exceeded', {
        ip: req.ip,
        phone: req.body?.phone || req.params?.id
      })
      res.status(429).json({ error: 'Too many messages' })
    }
  })
}

// Middleware de autenticación JWT
export function requireAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de acceso requerido' })
      }

      const token = authHeader.substring(7)
      const decoded = jwt.verify(token, JWT_SECRET) as any

      // Verificar que el usuario aún existe
      const adminDoc = await collections.admins().doc(decoded.userId).get()
      if (!adminDoc.exists) {
        return res.status(401).json({ error: 'Usuario no encontrado' })
      }

      const adminData = adminDoc.data()
      ;(req as any).user = {
        adminId: adminDoc.id,
        email: adminData?.email ?? 'unknown@local',
        role: (adminData?.role as 'owner' | 'operador') ?? 'operador'
      } as AuthUser

      next()
    } catch (error) {
      const msg = (error instanceof Error) ? error.message : String(error);
      logger.error('auth_middleware_failed', { error: msg })
      return res.status(401).json({ error: 'Token inválido' })
    }
  }
}

// Middleware para API Key adicional
export function requireApiKey() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!DASHBOARD_API_KEY) {
      return next() // Si no hay API key configurada, permitir
    }

    const apiKey = req.header('x-api-key')
    
    if (!apiKey || apiKey !== DASHBOARD_API_KEY) {
      logger.warn('invalid_api_key', {
        ip: req.ip,
        path: req.path,
        providedKey: apiKey ? '***' + apiKey.slice(-4) : 'none'
      })
      return res.status(401).json({ error: 'API key inválida' })
    }

    next()
  }
}

// Middleware para roles
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' })
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('insufficient_role', {
        userId: req.user.adminId,
        userRole: req.user.role,
        requiredRoles: roles
      })
      return res.status(403).json({ error: 'Permisos insuficientes' })
    }

    next()
  }
}

// Middleware de validación de entrada
export function validateInput(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body)
      
      if (!result.success) {
        logger.warn('validation_failed', {
          path: req.path,
          errors: result.error.errors
        })
        return res.status(400).json({ 
          error: 'Datos inválidos',
          details: result.error.errors
        })
      }

      req.body = result.data
      next()
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      logger.error('validation_middleware_error', { error: msg });
      return res.status(500).json({ error: 'Error de validación' });
    }
  }
}

// Middleware de validación de query parameters
export function validateQuery(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query)
      
      if (!result.success) {
        logger.warn('validation_failed', {
          path: req.path,
          errors: result.error.errors
        })
        return res.status(400).json({ 
          error: 'Datos inválidos',
          details: result.error.errors
        })
      }

      req.query = result.data
      next()
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      logger.error('validation_middleware_error', { error: msg });
      return res.status(500).json({ error: 'Error de validación' });
    }
  }
}

// Middleware de logging de auditoría
export function auditLog(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send
    
    res.send = function(data) {
      // Log después de que se envía la respuesta
      if (req.user) {
        collections.audit().add({
          action,
          userId: req.user.adminId,
          email: req.user.email,
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          statusCode: res.statusCode
        }).catch(err => {
          const msg = (err instanceof Error) ? err.message : String(err);
          logger.error('audit_log_failed', { error: msg })
        })
      }
      
      return originalSend.call(this, data)
    }
    
    next()
  }
}
