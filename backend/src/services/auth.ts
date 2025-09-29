import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { collections } from '../firebase'
import logger from '../libs/logger'
import type { LoginRequest, LoginResponse } from '../../shared/types/conversations'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30m'
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'

export interface AuthUser {
  id: string
  email: string
  role: 'owner' | 'operador'
}

export async function login(request: LoginRequest): Promise<LoginResponse> {
  try {
    const { email, password } = request

    // Buscar admin por email
    const adminSnapshot = await collections.admins()
      .where('user', '==', email.toLowerCase())
      .limit(1)
      .get()

    if (adminSnapshot.empty) {
      throw new Error('Credenciales inválidas')
    }

    const adminDoc = adminSnapshot.docs[0]
    const adminData = adminDoc.data()

    // Verificar contraseña (comparar directamente con el campo 'pass')
    const isValidPassword = password === adminData.pass
    if (!isValidPassword) {
      throw new Error('Credenciales inválidas')
    }

    // Generar tokens
    const user: AuthUser = {
      id: adminDoc.id,
      email: adminData.user, // Usar el campo 'user' como email
      role: adminData.role || 'owner' // Asumir owner para el admin existente
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    )

    // Log de auditoría
    await collections.audit().add({
      action: 'login',
      userId: user.id,
      email: user.email,
      timestamp: new Date(),
      ip: null, // Se puede agregar si se pasa en el request
      userAgent: null
    }).catch(err => {
      // Si falla la auditoría, no interrumpir el login
      logger.warn('audit_log_failed', { error: err.message })
    })

    logger.info('user_logged_in', {
      userId: user.id,
      email: user.email,
      role: user.role
    })

    return {
      accessToken,
      refreshToken,
      user: {
        email: user.email,
        role: user.role
      }
    }
  } catch (error) {
    logger.error('login_failed', { 
      email: request.email, 
      error: error.message 
    })
    throw new Error('Error al iniciar sesión')
  }
}

export async function verifyToken(token: string): Promise<AuthUser> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // Verificar que el usuario aún existe
    const adminDoc = await collections.admins().doc(decoded.userId).get()
    if (!adminDoc.exists) {
      throw new Error('Usuario no encontrado')
    }

    const adminData = adminDoc.data()
    
    return {
      id: adminDoc.id,
      email: adminData.email,
      role: adminData.role || 'operador'
    }
  } catch (error) {
    logger.error('token_verification_failed', { error: error.message })
    throw new Error('Token inválido')
  }
}

export async function refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any
    
    if (decoded.type !== 'refresh') {
      throw new Error('Token de refresh inválido')
    }

    // Verificar que el usuario aún existe
    const adminDoc = await collections.admins().doc(decoded.userId).get()
    if (!adminDoc.exists) {
      throw new Error('Usuario no encontrado')
    }

    const adminData = adminDoc.data()
    
    const accessToken = jwt.sign(
      { 
        userId: adminDoc.id, 
        email: adminData.email, 
        role: adminData.role || 'operador' 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    logger.info('token_refreshed', {
      userId: adminDoc.id,
      email: adminData.email
    })

    return { accessToken }
  } catch (error) {
    logger.error('refresh_token_failed', { error: error.message })
    throw new Error('Token de refresh inválido')
  }
}

export async function createAdmin(email: string, password: string, role: 'owner' | 'operador' = 'operador'): Promise<void> {
  try {
    const passwordHash = await bcrypt.hash(password, 12)
    
    await collections.admins().add({
      email: email.toLowerCase(),
      passwordHash,
      role,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    logger.info('admin_created', {
      email,
      role
    })
  } catch (error) {
    logger.error('error_creating_admin', { 
      email, 
      error: error.message 
    })
    throw new Error('Error al crear administrador')
  }
}
