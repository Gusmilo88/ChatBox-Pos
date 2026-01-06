#!/usr/bin/env ts-node

/**
 * Script para probar WhatsApp directamente desde el servidor
 * NO requiere WhatsApp personal, prueba la API directamente
 */

import { sendWhatsAppMessage } from '../src/services/whatsappSender'

async function testWhatsApp() {
  console.log('🧪 Probando WhatsApp Cloud API...\n')

  // Tu número personal para recibir el mensaje
  const tuNumero = '+5491125522465' // Tu número personal
  const mensaje = 'Hola, este es un mensaje de prueba del chatbot de Pos & Asociados. Si recibiste esto, el bot está funcionando correctamente.'

  console.log(`📤 Enviando mensaje a: ${tuNumero}`)
  console.log(`💬 Mensaje: "${mensaje}"\n`)

  try {
    const result = await sendWhatsAppMessage(tuNumero, mensaje)

    if (result.success) {
      console.log('✅ MENSAJE ENVIADO EXITOSAMENTE!\n')
      console.log(`📨 Message ID: ${result.messageId}`)
      console.log(`📊 Status: ${result.status}`)
      
      if (result.mock) {
        console.log('⚠️  MODO MOCK: El mensaje no se envió realmente (falta configuración)')
      } else {
        console.log('✅ Mensaje enviado REALMENTE a través de Meta API')
        console.log('📱 Revisá tu WhatsApp personal, deberías recibir el mensaje')
      }
    } else {
      console.log('❌ ERROR AL ENVIAR MENSAJE\n')
      console.log(`Error: ${result.error}`)
      console.log(`Status: ${result.status}`)
    }
  } catch (error) {
    console.log('❌ ERROR CRÍTICO\n')
    console.error(error)
  }
}

// Ejecutar
testWhatsApp()
  .then(() => {
    console.log('\n✅ Prueba completada')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error)
    process.exit(1)
  })

