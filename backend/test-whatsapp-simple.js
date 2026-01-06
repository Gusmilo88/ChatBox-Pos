require('dotenv').config();

const token = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const tuNumero = '+5491125522465';
const mensaje = 'Hola, este es un mensaje de prueba del chatbot de Pos & Asociados. Si recibiste esto, el bot está funcionando correctamente.';

console.log('🧪 Probando WhatsApp Cloud API...\n');
console.log('Token:', token ? '✅ Configurado' : '❌ NO configurado');
console.log('Phone Number ID:', phoneNumberId || '❌ NO configurado');
console.log(`📤 Enviando mensaje a: ${tuNumero}\n`);

if (!token || !phoneNumberId) {
  console.log('❌ ERROR: Faltan credenciales de WhatsApp');
  process.exit(1);
}

const payload = {
  messaging_product: 'whatsapp',
  to: tuNumero,
  type: 'text',
  text: { body: mensaje }
};

const apiUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
.then(response => response.json())
.then(data => {
  if (data.messages && data.messages[0]) {
    console.log('✅ MENSAJE ENVIADO EXITOSAMENTE!\n');
    console.log('📨 Message ID:', data.messages[0].id);
    console.log('📱 Revisá tu WhatsApp personal, deberías recibir el mensaje');
  } else {
    console.log('❌ ERROR AL ENVIAR MENSAJE\n');
    console.log('Error:', JSON.stringify(data, null, 2));
  }
})
.catch(error => {
  console.log('❌ ERROR CRÍTICO\n');
  console.error(error);
});

