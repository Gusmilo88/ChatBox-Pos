#!/usr/bin/env node

import { migratePasswords } from '../services/auth'
import logger from '../libs/logger'

async function main() {
  try {
    console.log('🔄 Iniciando migración de contraseñas...')
    console.log('📝 Buscando administradores con contraseñas en texto plano...')
    
    const result = await migratePasswords()
    
    console.log('✅ Migración completada!')
    console.log(`📊 Administradores migrados: ${result.migrated}`)
    
    if (result.errors.length > 0) {
      console.log(`⚠️  Errores encontrados: ${result.errors.length}`)
      console.log('📋 Detalles de errores:')
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`)
      })
    }
    
    if (result.migrated === 0) {
      console.log('💡 No se encontraron contraseñas para migrar')
      console.log('   Esto puede significar que:')
      console.log('   - Ya están migradas (tienen passwordHash)')
      console.log('   - No hay administradores en la base de datos')
      console.log('   - Los administradores no tienen el campo "pass"')
    }
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error.message)
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Error inesperado:', error)
  process.exit(1)
})
