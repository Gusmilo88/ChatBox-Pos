import { Request, Response, NextFunction } from 'express'
import { config } from '../config/env'
import { verifySessionToken } from '../services/auth'
import logger from '../libs/logger'

// Extender Request para incluir usuario
declare global {
  namespace Express {
    interface Request {
      user?: {
        adminId: string
        email: string
        role: 'owner' | 'operador'
      }
    }
  }
}

// Middleware para validar sesión desde cookie
export function requireSession(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[config.sessionCookieName]
    
    if (!token) {
      logger.warn('session_missing', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      })
      return res.status(401).json({ error: 'No autenticado' })
    }

    // Verificar token de sesión
    const user = verifySessionToken(token)
    
    // Establecer usuario en request
    req.user = user

    next()
  } catch (error) {
    logger.warn('session_invalid', {
      ip: req.ip,
      path: req.path,
      error: error.message
    })
    return res.status(401).json({ error: 'Sesión inválida' })
  }
}

// Middleware para roles específicos
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' })
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('insufficient_role', {
        adminId: req.user.adminId,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path
      })
      return res.status(403).json({ error: 'Permisos insuficientes' })
    }

    next()
  }
}

// Crear cookie de sesión
export function createSessionCookie(token: string): string {
  const maxAge = config.sessionTTLMinutes * 60 // convertir a segundos
  
  return `${config.sessionCookieName}=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`
}

// Limpiar cookie de sesión
export function clearSessionCookie(): string {
  return `${config.sessionCookieName}=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`
}
