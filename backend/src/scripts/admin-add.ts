#!/usr/bin/env node

import { createAdmin } from '../services/auth'
import logger from '../libs/logger'

async function main() {
  const args = process.argv.slice(2)
  
  // Parsear argumentos (soporta formato posicional y con flags)
  let email = ''
  let password = ''
  let role: 'owner' | 'operador' = 'operador'
  
  // Formato posicional: email password role
  if (args.length >= 2 && !args[0].startsWith('--')) {
    email = args[0]
    password = args[1]
    if (args[2] && (args[2] === 'owner' || args[2] === 'operador')) {
      role = args[2]
    }
  } else {
    // Formato con flags
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      
      if (arg === '--email' && args[i + 1]) {
        email = args[i + 1]
        i++
      } else if (arg === '--password' && args[i + 1]) {
        password = args[i + 1]
        i++
      } else if (arg === '--role' && args[i + 1]) {
        if (args[i + 1] === 'owner' || args[i + 1] === 'operador') {
          role = args[i + 1]
        } else {
          console.error('❌ Rol inválido. Debe ser "owner" o "operador"')
          process.exit(1)
        }
        i++
      } else if (arg.startsWith('--email=')) {
        email = arg.split('=')[1]
      } else if (arg.startsWith('--password=')) {
        password = arg.split('=')[1]
      } else if (arg.startsWith('--role=')) {
        const roleValue = arg.split('=')[1]
        if (roleValue === 'owner' || roleValue === 'operador') {
          role = roleValue
        } else {
          console.error('❌ Rol inválido. Debe ser "owner" o "operador"')
          process.exit(1)
        }
      } else if (arg === '--help' || arg === '-h') {
        console.log(`
📝 Uso: npm run admin:add -- email password [role]

O también:
  npm run admin:add -- --email=admin@ejemplo.com --password=contraseña123 --role=owner

Opciones:
  email       Email del administrador (requerido)
  password    Contraseña del administrador (requerido, mínimo 8 caracteres)
  role        Rol del administrador: owner | operador (opcional, default: operador)

Ejemplos:
  npm run admin:add -- admin@empresa.com miPassword123 owner
  npm run admin:add -- operador@empresa.com otraPassword123
        `)
        process.exit(0)
      }
    }
  }
  
  // Validar argumentos requeridos
  if (!email || !password) {
    console.error('❌ Email y password son requeridos')
    console.log('💡 Usa --help para ver la ayuda')
    process.exit(1)
  }
  
  if (password.length < 8) {
    console.error('❌ La contraseña debe tener al menos 8 caracteres')
    process.exit(1)
  }
  
  try {
    console.log('🔄 Creando administrador...')
    console.log(`📧 Email: ${email}`)
    console.log(`🔑 Rol: ${role}`)
    
    const adminId = await createAdmin(email, password, role)
    
    console.log('✅ Administrador creado exitosamente!')
    console.log(`🆔 ID: ${adminId}`)
    console.log(`📧 Email: ${email}`)
    console.log(`🔑 Rol: ${role}`)
    
  } catch (error) {
    console.error('❌ Error creando administrador:', error.message)
    
    if (error.message.includes('ya está registrado')) {
      console.log('💡 El email ya existe en la base de datos')
    }
    
    process.exit(1)
  }
}

main().catch(error => {
  console.error('❌ Error inesperado:', error)
  process.exit(1)
})