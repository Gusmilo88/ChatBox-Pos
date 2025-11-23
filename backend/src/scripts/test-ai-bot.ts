import 'dotenv/config'
import { simulateIncoming } from '../services/conversations'
import { getConversationById } from '../services/conversations'
import logger from '../libs/logger'

async function testAiBot() {
  try {
    console.log('🧪 Probando bot con IA como principal...\n')
    
    // Test 1: Mensaje de un cliente (con CUIT)
    console.log('📱 Test 1: Mensaje de cliente')
    const phone1 = '+5491151093439' // Teléfono de prueba
    const text1 = 'Hola, necesito consultar sobre mi facturación'
    
    console.log(`   Enviando: "${text1}"`)
    const result1 = await simulateIncoming({
      phone: phone1,
      text: text1,
      via: 'manual'
    })
    
    console.log(`   ✅ Conversación creada: ${result1.conversationId}`)
    
    // Esperar un poco para que se genere la respuesta automática
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Obtener la conversación para ver las respuestas
    const conversation1 = await getConversationById(result1.conversationId)
    const systemMessages = conversation1.messages.filter(m => m.from === 'system' || m.from === 'operador')
    
    if (systemMessages.length > 0) {
      const lastReply = systemMessages[systemMessages.length - 1]
      console.log(`   🤖 Respuesta generada: "${lastReply.text.substring(0, 100)}..."`)
      console.log(`   📊 Via: ${lastReply.via || 'unknown'}, AI Suggested: ${lastReply.aiSuggested || false}`)
    } else {
      console.log('   ⚠️  No se generó respuesta automática')
    }
    
    console.log('\n')
    
    // Test 2: Mensaje de un lead (sin CUIT)
    console.log('📱 Test 2: Mensaje de lead')
    const phone2 = '+5491123456789'
    const text2 = 'Hola, quiero información sobre los servicios contables'
    
    console.log(`   Enviando: "${text2}"`)
    const result2 = await simulateIncoming({
      phone: phone2,
      text: text2,
      via: 'manual'
    })
    
    console.log(`   ✅ Conversación creada: ${result2.conversationId}`)
    
    // Esperar un poco para que se genere la respuesta automática
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Obtener la conversación para ver las respuestas
    const conversation2 = await getConversationById(result2.conversationId)
    const systemMessages2 = conversation2.messages.filter(m => m.from === 'system' || m.from === 'operador')
    
    if (systemMessages2.length > 0) {
      const lastReply2 = systemMessages2[systemMessages2.length - 1]
      console.log(`   🤖 Respuesta generada: "${lastReply2.text.substring(0, 100)}..."`)
      console.log(`   📊 Via: ${lastReply2.via || 'unknown'}, AI Suggested: ${lastReply2.aiSuggested || false}`)
    } else {
      console.log('   ⚠️  No se generó respuesta automática')
    }
    
    console.log('\n✅ Tests completados!')
    console.log('\n💡 Verifica en los logs del servidor si se usó IA o FSM')
    console.log('   Busca: "Respuesta generada por IA" o "Respuesta generada por FSM"')
    
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('Test failed', { error: msg })
    console.error('❌ Error en test:', msg)
    process.exit(1)
  }
}

if (require.main === module) {
  testAiBot()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error:', error)
      process.exit(1)
    })
}

