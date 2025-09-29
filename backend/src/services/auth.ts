import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { collections } from '../firebase'
import { config } from '../config/env'
import logger from '../libs/logger'

export interface AuthUser {
  adminId: string
  email: string
  role: 'owner' | 'operador'
}

export interface AdminDoc {
  email: string
  passwordHash: string
  role: 'owner' | 'operador'
  createdAt: Date
  lastLoginAt?: Date
  isActive: boolean
}

// Login con validación contra Firestore
export async function login(email: string, password: string): Promise<AuthUser> {
  try {
    const normalizedEmail = email.toLowerCase().trim()
    
    // Buscar admin por email
    const adminSnapshot = await collections.admins()
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get()

    if (adminSnapshot.empty) {
      logger.warn('login_failed_user_not_found', { email: normalizedEmail })
      throw new Error('Credenciales inválidas')
    }

    const adminDoc = adminSnapshot.docs[0]
    const adminData = adminDoc.data() as AdminDoc

    // Verificar que esté activo
    if (!adminData.isActive) {
      logger.warn('login_failed_inactive_user', { adminId: adminDoc.id, email: normalizedEmail })
      throw new Error('Usuario inactivo')
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, adminData.passwordHash)
    if (!isValidPassword) {
      logger.warn('login_failed_invalid_password', { adminId: adminDoc.id, email: normalizedEmail })
      throw new Error('Credenciales inválidas')
    }

    // Actualizar lastLoginAt
    await adminDoc.ref.update({
      lastLoginAt: new Date()
    }).catch(err => {
      logger.warn('failed_to_update_last_login', { adminId: adminDoc.id, error: err.message })
    })

    const user: AuthUser = {
      adminId: adminDoc.id,
      email: adminData.email,
      role: adminData.role
    }

    logger.info('user_logged_in', {
      adminId: user.adminId,
      email: user.email,
      role: user.role
    })

    return user
  } catch (error) {
    logger.error('login_error', { 
      email: email.toLowerCase(), 
      error: error.message 
    })
    throw error
  }
}

// Crear token de sesión
export function createSessionToken(user: AuthUser): string {
  return jwt.sign(
    {
      adminId: user.adminId,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (config.sessionTTLMinutes * 60)
    },
    config.sessionSecret
  )
}

// Verificar token de sesión
export function verifySessionToken(token: string): AuthUser {
  try {
    const decoded = jwt.verify(token, config.sessionSecret) as any
    
    // Verificar expiración
    if (Date.now() >= decoded.exp * 1000) {
      throw new Error('Token expirado')
    }

    return {
      adminId: decoded.adminId,
      email: decoded.email,
      role: decoded.role
    }
  } catch (error) {
    logger.warn('session_token_verification_failed', { error: error.message })
    throw new Error('Token de sesión inválido')
  }
}

// Crear admin
export async function createAdmin(email: string, password: string, role: 'owner' | 'operador' = 'operador'): Promise<string> {
  try {
    const normalizedEmail = email.toLowerCase().trim()
    
    // Verificar que no exista
    const existingSnapshot = await collections.admins()
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get()

    if (!existingSnapshot.empty) {
      throw new Error('El email ya está registrado')
    }

    const passwordHash = await bcrypt.hash(password, 12)
    
    const adminRef = await collections.admins().add({
      email: normalizedEmail,
      passwordHash,
      role,
      createdAt: new Date(),
      isActive: true
    })

    logger.info('admin_created', {
      adminId: adminRef.id,
      email: normalizedEmail,
      role
    })

    return adminRef.id
  } catch (error) {
    logger.error('error_creating_admin', { 
      email: email.toLowerCase(), 
      error: error.message 
    })
    throw error
  }
}

// Migrar contraseñas en texto plano a bcrypt
export async function migratePasswords(): Promise<{ migrated: number, errors: string[] }> {
  const errors: string[] = []
  let migrated = 0

  try {
    const snapshot = await collections.admins().get()
    
    for (const doc of snapshot.docs) {
      const data = doc.data()
      
      // Si tiene 'pass' (texto plano) y no tiene 'passwordHash'
      if (data.pass && !data.passwordHash) {
        try {
          const passwordHash = await bcrypt.hash(data.pass, 12)
          
          await doc.ref.update({
            email: data.user?.toLowerCase() || data.email?.toLowerCase(),
            passwordHash,
            role: data.role || 'operador',
            createdAt: data.createdAt || new Date(),
            isActive: data.isActive !== false,
            lastLoginAt: data.lastLoginAt || null
          })

          // Eliminar campos antiguos
          await doc.ref.update({
            pass: null,
            user: null
          })

          migrated++
          logger.info('password_migrated', { adminId: doc.id })
        } catch (error) {
          const errorMsg = `Error migrando admin ${doc.id}: ${error.message}`
          errors.push(errorMsg)
          logger.error('password_migration_error', { adminId: doc.id, error: error.message })
        }
      }
    }

    logger.info('password_migration_completed', { migrated, errors: errors.length })
    return { migrated, errors }
  } catch (error) {
    logger.error('password_migration_failed', { error: error.message })
    throw error
  }
}