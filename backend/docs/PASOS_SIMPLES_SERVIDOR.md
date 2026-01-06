# 🎯 PASOS SIMPLES - SIN COMPLICACIONES

## ✅ PASO 1: Ver qué Phone Number ID está configurado AHORA

**Ejecutá este comando (copiá y pegá todo):**

```bash
grep WHATSAPP_PHONE_NUMBER_ID /var/www/automatizacion-ivan-pos-backend/.env
```

**Esto te va a mostrar algo como:**
```
WHATSAPP_PHONE_NUMBER_ID=867302179797652
```

**Anotá ese número que aparece.**

---

## ✅ PASO 2: Obtener el Phone Number ID del número nuevo

**Ejecutá este comando (copiá y pegá todo):**

```bash
cd /var/www/automatizacion-ivan-pos-backend && node -e "
require('dotenv').config();
const token = process.env.WHATSAPP_TOKEN;
if (!token) {
  console.log('❌ ERROR: WHATSAPP_TOKEN no está configurado');
  process.exit(1);
}
const wabaId = '819576794391923';
const apiUrl = \`https://graph.facebook.com/v19.0/\${wabaId}?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}&access_token=\${token}\`;
fetch(apiUrl)
  .then(r => r.json())
  .then(data => {
    if (data.error) {
      console.log('❌ ERROR:', JSON.stringify(data, null, 2));
      process.exit(1);
    }
    console.log('📱 NÚMEROS ENCONTRADOS:\n');
    if (data.phone_numbers && data.phone_numbers.data) {
      data.phone_numbers.data.forEach((p, i) => {
        console.log(\`\${i+1}. Número: \${p.display_phone_number}\`);
        console.log(\`   Phone Number ID: \${p.id}\`);
        console.log(\`   Estado: \${p.code_verification_status || 'N/A'}\`);
        if (p.display_phone_number.includes('22913122')) {
          console.log(\`   ✅ ESTE ES EL NÚMERO NUEVO (+5491122913122)\`);
          console.log(\`   📋 COPIÁ ESTE ID: \${p.id}\`);
        }
        console.log('');
      });
    } else {
      console.log('⚠️  No se encontraron números');
    }
  })
  .catch(err => {
    console.log('❌ ERROR:', err.message);
    process.exit(1);
  });
"
```

**Este comando te va a mostrar todos los números y te va a decir cuál es el Phone Number ID del número nuevo.**

**COPIÁ el Phone Number ID que te muestra (es un número largo).**

---

## ✅ PASO 3: Actualizar el .env

**Si el Phone Number ID que obtuviste es diferente al que está en el .env, actualizalo:**

```bash
nano /var/www/automatizacion-ivan-pos-backend/.env
```

**Buscar la línea que dice:**
```
WHATSAPP_PHONE_NUMBER_ID=867302179797652
```

**Reemplazar el número con el nuevo Phone Number ID que copiaste.**

**Guardar:**
- Presionar `Ctrl + O`
- Presionar `Enter`
- Presionar `Ctrl + X`

---

## ✅ PASO 4: Reiniciar el servidor

```bash
pm2 restart chatbot-pos --update-env
```

**Esperar unos segundos y verificar que está corriendo:**
```bash
pm2 status
```

**Deberías ver "chatbot-pos" en verde con "online".**

---

## ✅ PASO 5: Probar

**Desde tu WhatsApp personal:**
1. Escribir al número: **+5491122913122**
2. Enviar: "Hola"
3. El bot debería responder ✅

---

## 🆘 SI ALGO FALLA

**Compartir el error que te aparece y te ayudo a solucionarlo.**

**NO te preocupes, vamos a resolverlo juntos paso a paso.**

