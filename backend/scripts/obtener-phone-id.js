#!/usr/bin/env node

/**
 * Script simple para obtener el Phone Number ID del número nuevo
 * Se ejecuta directamente con: node scripts/obtener-phone-id.js
 */

require('dotenv').config();

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

console.log('🔍 VERIFICANDO CONFIGURACIÓN...\n');

if (!token) {
  console.log('❌ ERROR: WHATSAPP_TOKEN no está configurado en .env');
  process.exit(1);
}

console.log('✅ WHATSAPP_TOKEN: Configurado');
console.log(`📋 Phone Number ID actual: ${phoneNumberId || 'NO configurado'}\n`);

const wabaId = '819576794391923';
const apiUrl = `https://graph.facebook.com/v19.0/${wabaId}?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}&access_token=${token}`;

console.log('🔍 Obteniendo números desde Meta API...\n');

// Usar https en lugar de fetch para compatibilidad
const https = require('https');

https.get(apiUrl, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const json = JSON.parse(data);

      if (json.error) {
        console.log('❌ ERROR de Meta API:');
        console.log(JSON.stringify(json, null, 2));
        process.exit(1);
      }

      console.log('📱 NÚMEROS ENCONTRADOS EN TU WABA:\n');

      if (json.phone_numbers && json.phone_numbers.data) {
        json.phone_numbers.data.forEach((phone, index) => {
          console.log(`${index + 1}. Número: ${phone.display_phone_number}`);
          console.log(`   Phone Number ID: ${phone.id}`);
          console.log(`   Display Name: ${phone.verified_name || 'Sin nombre'}`);
          console.log(`   Estado: ${phone.code_verification_status || 'N/A'}`);

          if (phone.id === phoneNumberId) {
            console.log(`   ✅ ESTE ES EL ID CONFIGURADO ACTUALMENTE`);
          }

          if (phone.display_phone_number.includes('22913122')) {
            console.log(`   🎯 ESTE ES EL NÚMERO NUEVO (+5491122913122)`);
            console.log(`   📋 COPIÁ ESTE ID PARA ACTUALIZAR EL .env:`);
            console.log(`   WHATSAPP_PHONE_NUMBER_ID=${phone.id}`);
          }

          console.log('');
        });

        // Verificar si el número nuevo está configurado
        const numeroNuevo = json.phone_numbers.data.find(
          (p) => p.display_phone_number.includes('22913122')
        );

        if (numeroNuevo) {
          if (numeroNuevo.id === phoneNumberId) {
            console.log('✅ El número nuevo YA está configurado correctamente!');
            console.log('   El bot debería funcionar. Probá enviando un mensaje a +5491122913122');
          } else {
            console.log('⚠️  El número nuevo NO está configurado.');
            console.log(`   Actualizá el .env con: WHATSAPP_PHONE_NUMBER_ID=${numeroNuevo.id}`);
            console.log(`   Luego reiniciá: pm2 restart chatbot-pos --update-env`);
          }
        } else {
          console.log('⚠️  No se encontró el número +5491122913122');
          console.log('   Verificar que el número esté agregado en Meta');
        }
      } else {
        console.log('⚠️  No se encontraron números en tu WABA');
      }
    } catch (error) {
      console.log('❌ ERROR al procesar respuesta:');
      console.error(error);
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.log('❌ ERROR de conexión:');
  console.error(error);
  process.exit(1);
});

