import 'dotenv/config'
import { collections } from '../firebase'
import { v4 as uuidv4 } from 'uuid'
import logger from '../libs/logger'

// Datos de ejemplo
const samplePhones = [
  '+5491151093439',
  '+5491123456789',
  '+5491187654321',
  '+5491198765432',
  '+5491112345678',
  '+5491123456780',
  '+5491134567890',
  '+5491145678901',
  '+5491156789012',
  '+5491167890123'
]

const sampleNames = [
  'Juan Pérez',
  'María González',
  'Carlos Rodríguez',
  'Ana Martínez',
  'Luis Fernández',
  'Carmen López',
  'Pedro García',
  'Isabel Sánchez',
  'Miguel Torres',
  'Laura Díaz'
]

const sampleMessages = [
  'Hola, necesito ayuda con mi cuenta',
  '¿Cuál es mi saldo actual?',
  'Quiero enviar mis ventas del mes',
  'Necesito hablar con Iván',
  '¿Cómo puedo obtener una factura?',
  'Tengo problemas con mi clave fiscal',
  '¿Cuándo es mi próxima liquidación?',
  'Quiero agendar una reunión',
  '¿Pueden ayudarme con monotributo?',
  'Necesito actualizar mis datos',
  '¿Cómo funciona el plan mensual?',
  'Quiero ser cliente',
  '¿Qué necesito para el alta?',
  'Tengo una consulta sobre ingresos brutos',
  '¿Pueden enviarme un comprobante?'
]

const systemMessages = [
  '¡Hola! 👋 Soy el asistente de POS & Asociados. Elegí una opción:\n\n1 Soy cliente\n2 Quiero ser cliente / Consultar servicios',
  'Perfecto! Para continuar, necesito tu CUIT (solo números).',
  '¡Hola Juan! 👋 Soy el asistente 🤖 de POS & Asociados. Elegí una opción:\n\n1. Consultar mi estado general en ARCA e Ingresos Brutos\n2. Solicitar una factura electrónica\n3. Enviar las ventas del mes\n4. Agendar una reunión\n5. Hablar con Iván por otras consultas',
  'Tu saldo actual es de $15,000. ¿Necesitás algo más?',
  'Perfecto, te derivamos con Belén para que te ayude con la facturación. Te contactará a la brevedad. 📞',
  'Te derivamos con Iván Pos para revisar tu consulta. Te contactará a la brevedad. ¡Gracias!'
]

async function createConversation(phone: string, name: string, isClient: boolean): Promise<string> {
  const conversationId = uuidv4()
  const now = new Date()
  
  // Crear conversación
  await collections.conversations().doc(conversationId).set({
    phone,
    name,
    isClient,
    lastMessageAt: now,
    unreadCount: 0,
    needsReply: Math.random() < 0.3, // 30% necesita respuesta
    createdAt: now,
    updatedAt: now
  })

  // Crear mensajes (entre 5 y 15 mensajes por conversación)
  const messageCount = Math.floor(Math.random() * 11) + 5
  
  for (let i = 0; i < messageCount; i++) {
    const messageId = uuidv4()
    const isUserMessage = Math.random() < 0.6 // 60% mensajes del usuario
    const messageTime = new Date(now.getTime() - (messageCount - i) * 60000) // 1 minuto entre mensajes
    
    let messageText: string
    let from: 'usuario' | 'operador' | 'sistema'
    let via: 'whatsapp' | 'ia' | 'manual'
    let aiSuggested = false

    if (isUserMessage) {
      messageText = sampleMessages[Math.floor(Math.random() * sampleMessages.length)]
      from = 'usuario'
      via = Math.random() < 0.8 ? 'whatsapp' : 'manual'
    } else {
      messageText = systemMessages[Math.floor(Math.random() * systemMessages.length)]
      from = 'sistema'
      via = 'ia'
      aiSuggested = Math.random() < 0.4 // 40% sugeridos por IA
    }

    await collections.messages(conversationId).doc(messageId).set({
      ts: messageTime,
      from,
      text: messageText,
      via,
      aiSuggested
    })
  }

  // Actualizar lastMessageAt con el último mensaje
  const lastMessageTime = new Date(now.getTime() - Math.random() * 3600000) // Última hora
  await collections.conversations().doc(conversationId).update({
    lastMessageAt: lastMessageTime,
    unreadCount: Math.floor(Math.random() * 5) // 0-4 mensajes no leídos
  })

  return conversationId
}

async function createAdminUser() {
  try {
    // Verificar si ya existe un admin
    const existingAdmin = await collections.admins()
      .where('user', '==', 'posyasociados@hotmail.com')
      .limit(1)
      .get()

    if (!existingAdmin.empty) {
      logger.info('Admin user already exists')
      return
    }

    // Crear admin por defecto (usando la estructura de tu Firestore)
    await collections.admins().add({
      user: 'posyasociados@hotmail.com',
      pass: 'EstudioPos2025',
      role: 'owner',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    logger.info('Admin user created: posyasociados@hotmail.com / EstudioPos2025')
  } catch (error) {
    logger.error('Error creating admin user', { error: error.message })
  }
}

async function main() {
  try {
    logger.info('Starting conversation seed...')
    
    // Crear admin
    await createAdminUser()
    
    // Crear conversaciones
    const conversationCount = 50
    const conversations = []
    
    for (let i = 0; i < conversationCount; i++) {
      const phone = samplePhones[Math.floor(Math.random() * samplePhones.length)]
      const name = sampleNames[Math.floor(Math.random() * sampleNames.length)]
      const isClient = Math.random() < 0.6 // 60% clientes, 40% no clientes
      
      const conversationId = await createConversation(phone, name, isClient)
      conversations.push(conversationId)
      
      if ((i + 1) % 10 === 0) {
        logger.info(`Created ${i + 1}/${conversationCount} conversations`)
      }
    }
    
    logger.info(`Seed completed! Created ${conversations.length} conversations`)
    logger.info('Admin credentials: posyasociados@hotmail.com / EstudioPos2025')
    
  } catch (error) {
    logger.error('Seed failed', { error: error.message })
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
