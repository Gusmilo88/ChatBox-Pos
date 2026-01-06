# 📱 CONFIGURAR NÚMERO PARA WHATSAPP CLOUD API

## ⚠️ ACLARACIÓN IMPORTANTE

**NO necesitás instalar WhatsApp Business en el celular.** 

Para **WhatsApp Cloud API**, el número funciona completamente desde la nube. No necesitás:
- ❌ Instalar WhatsApp Business en el celular
- ❌ Borrar tu WhatsApp Business personal
- ❌ Tener el número en un celular físico

**El número funciona a través de la API de Meta, no necesita WhatsApp instalado.**

---

## ✅ SOLUCIÓN: Completar Configuración de la API

Estás en la pestaña **"Certificado"** en WhatsApp Manager. Esto es correcto, pero necesitás completar la configuración:

### PASO 1: Verificar que el número esté conectado a la API

1. En WhatsApp Manager, estás viendo el número **+54 9 11 3762-3550**
2. En la pestaña **"Certificado"**, hay un código largo (ese es el certificado)
3. **NO necesitás hacer nada con ese certificado** (es para otros tipos de integración)

### PASO 2: Verificar que el webhook esté configurado

1. Ir a: https://developers.facebook.com/apps/839926155344611/whatsapp-business/configuration/
2. Buscar sección **"Webhook"**
3. Verificar que esté configurado:
   - **URL:** `https://api.posyasociados.com/api/webhook/whatsapp`
   - **Token:** El mismo que está en tu `.env` como `WHATSAPP_VERIFY_TOKEN`
   - **Suscrito a:** `messages`, `message_status`

### PASO 3: Verificar Phone Number ID

1. Ir a: https://developers.facebook.com/tools/explorer/
2. Seleccionar tu app "Automatizacion Pos"
3. Query:
   ```
   /819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}
   ```
4. Buscar el número **+5491137623550**
5. Copiar el **`id`** (ese es el Phone Number ID)
6. Verificar que esté en tu `.env` como `WHATSAPP_PHONE_NUMBER_ID`

---

## 🔍 VERIFICAR ESTADO DEL NÚMERO

**Desde Graph API Explorer:**

1. Ir a: https://developers.facebook.com/tools/explorer/
2. Query:
   ```
   /819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status,quality_rating}
   ```
3. Buscar el número **+5491137623550**
4. Verificar el campo `code_verification_status`:
   - `"VERIFIED"` → ✅ Está verificado
   - Pero puede que no tenga WhatsApp Business activo

---

## ⚠️ IMPORTANTE: Por qué no aparece en WhatsApp personal

**El número NO aparece en WhatsApp personal porque:**

1. ✅ Está verificado en Meta (estado: VERIFIED)
2. ✅ Está configurado para la API (no para WhatsApp normal)
3. ⚠️ **Los números de WhatsApp Cloud API NO aparecen en WhatsApp personal**

**Esto es NORMAL y ESPERADO.** Los números de la API funcionan diferente:
- No aparecen en búsquedas de WhatsApp
- No podés agregarlos como contacto normal
- Solo funcionan a través de la API (enviando mensajes desde el bot)

---

## 🎯 CÓMO PROBAR QUE FUNCIONA

**NO intentes agregarlo como contacto.** En su lugar:

### Test 1: Enviar mensaje desde el bot (desde el panel)

1. Ir a: https://app.posyasociados.com/login
2. Iniciar sesión
3. Ir a "Conversaciones"
4. Crear una conversación de prueba
5. Enviar un mensaje desde el panel
6. El mensaje debería llegar a tu WhatsApp personal

### Test 2: Verificar que el webhook recibe mensajes

1. Enviar un mensaje al número **+54 9 11 3762-3550** desde tu WhatsApp personal
2. Verificar los logs del servidor:
   ```bash
   pm2 logs chatbot-pos --lines 50
   ```
3. Deberías ver:
   - `whatsapp_webhook_received` - Mensaje recibido
   - `whatsapp_message_processed` - Mensaje procesado

---

## 📞 SI EL BOT NO RESPONDE

**Verificar:**
1. ✅ Webhook configurado correctamente
2. ✅ Phone Number ID correcto en `.env`
3. ✅ Token de acceso válido
4. ✅ Servidor corriendo y recibiendo webhooks

**Si todo está bien pero no responde:**
- El número puede estar en período de prueba (solo responde a mensajes, no inicia conversaciones)
- Esperar 24-48 horas para que se active completamente


