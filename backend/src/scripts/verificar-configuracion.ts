#!/usr/bin/env tsx

/**
 * Script para verificar la configuración actual de WhatsApp
 * y obtener el Phone Number ID del nuevo número
 */

import 'dotenv/config'

async function verificarConfiguracion() {
  console.log('🔍 VERIFICANDO CONFIGURACIÓN ACTUAL\n')
  
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  
  console.log('📋 Variables de entorno:')
  console.log(`   WHATSAPP_TOKEN: ${token ? '✅ Configurado' : '❌ NO configurado'}`)
  console.log(`   WHATSAPP_PHONE_NUMBER_ID: ${phoneNumberId || '❌ NO configurado'}`)
  
  if (!token || !phoneNumberId) {
    console.log('\n❌ ERROR: Faltan variables de entorno')
    console.log('   Verificar el archivo .env')
    process.exit(1)
  }
  
  console.log('\n🔍 Obteniendo información del número desde Meta API...\n')
  
  try {
    // Obtener información del WABA
    const wabaId = '819576794391923'
    const apiUrl = `https://graph.facebook.com/v19.0/${wabaId}?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status,quality_rating}&access_token=${token}`
    
    const response = await fetch(apiUrl)
    const data = await response.json()
    
    if (!response.ok) {
      console.log('❌ ERROR al obtener información de Meta API:')
      console.log(JSON.stringify(data, null, 2))
      process.exit(1)
    }
    
    console.log('📱 Números asociados a tu WABA:\n')
    
    if (data.phone_numbers && data.phone_numbers.data) {
      data.phone_numbers.data.forEach((phone: any, index: number) => {
        console.log(`   ${index + 1}. Número: ${phone.display_phone_number}`)
        console.log(`      Phone Number ID: ${phone.id}`)
        console.log(`      Display Name: ${phone.verified_name || 'Sin nombre'}`)
        console.log(`      Estado: ${phone.code_verification_status || 'N/A'}`)
        console.log(`      Calificación: ${phone.quality_rating || 'N/A'}`)
        
        if (phone.id === phoneNumberId) {
          console.log(`      ✅ ESTE ES EL ID CONFIGURADO ACTUALMENTE`)
        }
        
        console.log('')
      })
    } else {
      console.log('   ⚠️  No se encontraron números')
    }
    
    console.log('\n📋 CONFIGURACIÓN ACTUAL:')
    console.log(`   Phone Number ID en .env: ${phoneNumberId}`)
    
    // Verificar si el ID configurado coincide con algún número
    const numeroConfigurado = data.phone_numbers?.data?.find(
      (p: any) => p.id === phoneNumberId
    )
    
    if (numeroConfigurado) {
      console.log(`   ✅ Coincide con: ${numeroConfigurado.display_phone_number}`)
      console.log(`   Estado: ${numeroConfigurado.code_verification_status || 'N/A'}`)
    } else {
      console.log(`   ⚠️  El Phone Number ID configurado NO coincide con ningún número actual`)
      console.log(`   Necesitás actualizar el .env con el Phone Number ID correcto`)
    }
    
    // Buscar el número nuevo (+5491122913122)
    const numeroNuevo = data.phone_numbers?.data?.find(
      (p: any) => p.display_phone_number.includes('22913122')
    )
    
    if (numeroNuevo) {
      console.log('\n🎯 NÚMERO NUEVO ENCONTRADO:')
      console.log(`   Número: ${numeroNuevo.display_phone_number}`)
      console.log(`   Phone Number ID: ${numeroNuevo.id}`)
      console.log(`   Estado: ${numeroNuevo.code_verification_status || 'N/A'}`)
      console.log(`\n   ⚠️  Si el bot no funciona, actualizá el .env con:`)
      console.log(`   WHATSAPP_PHONE_NUMBER_ID=${numeroNuevo.id}`)
    } else {
      console.log('\n⚠️  No se encontró el número +5491122913122')
      console.log('   Verificar que el número esté agregado en Meta')
    }
    
  } catch (error) {
    console.log('❌ ERROR:')
    console.error(error)
    process.exit(1)
  }
}

verificarConfiguracion()
  .then(() => {
    console.log('\n✅ Verificación completada')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error fatal:', error)
    process.exit(1)
  })

