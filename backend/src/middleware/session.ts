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
    
    logger.debug('session_check', {
      path: req.path,
      hasCookies: !!req.cookies,
      cookieName: config.sessionCookieName,
      hasToken: !!token,
      tokenLength: token?.length || 0
    })
    
    if (!token) {
      logger.warn('session_missing', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent'),
        cookies: Object.keys(req.cookies || {})
      })
      return res.status(401).json({ error: 'No autenticado' })
    }

    // Verificar token de sesión
    const user = verifySessionToken(token)
    
    // Establecer usuario en request
    req.user = user

    next()
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.warn('session_invalid', {
      ip: req.ip,
      path: req.path,
      error: msg
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
  
  // En desarrollo local, no usar Secure ni SameSite=Strict
  const isProduction = process.env.NODE_ENV === 'production'
  const secureFlag = isProduction ? 'Secure' : ''
  const sameSiteFlag = isProduction ? 'SameSite=Strict' : 'SameSite=Lax'
  
  return `${config.sessionCookieName}=${token}; HttpOnly; ${secureFlag}; ${sameSiteFlag}; Max-Age=${maxAge}; Path=/`
}

// Limpiar cookie de sesión
export function clearSessionCookie(): string {
  const isProduction = process.env.NODE_ENV === 'production'
  const secureFlag = isProduction ? 'Secure' : ''
  const sameSiteFlag = isProduction ? 'SameSite=Strict' : 'SameSite=Lax'
  
  return `${config.sessionCookieName}=; HttpOnly; ${secureFlag}; ${sameSiteFlag}; Max-Age=0; Path=/`
}
