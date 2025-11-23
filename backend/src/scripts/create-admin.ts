import { collections } from '../firebase'
import bcrypt from 'bcrypt'
import logger from '../libs/logger'

async function createAdmin() {
  try {
    logger.info('Creating admin user...')
    
    // Verificar si ya existe un admin
    const existingAdmin = await collections.admins()
      .where('email', '==', 'admin@pos.com')
      .limit(1)
      .get()

    if (!existingAdmin.empty) {
      logger.info('Admin user already exists')
      return
    }

    // Crear admin por defecto
    const passwordHash = await bcrypt.hash('admin123', 12)
    
    await collections.admins().add({
      email: 'admin@pos.com',
      passwordHash,
      role: 'owner',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    logger.info('✅ Admin user created successfully!')
    logger.info('📧 Email: admin@pos.com')
    logger.info('🔑 Password: admin123')
    
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error);
    logger.error('❌ Error creating admin user', { error: msg })
    process.exit(1)
  }
}

if (require.main === module) {
  createAdmin()
}
