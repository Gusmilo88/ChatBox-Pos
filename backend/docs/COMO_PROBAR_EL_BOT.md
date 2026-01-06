# 🧪 CÓMO PROBAR EL BOT - GUÍA COMPLETA

## ⚠️ ACLARACIÓN IMPORTANTE: DOS APLICACIONES DIFERENTES

### 1️⃣ **app.posyasociados.com** - App para CLIENTES
- **Qué es:** La aplicación donde los **clientes** ingresan con su CUIT
- **Para qué:** Ver sus datos contables, facturación, saldos, etc.
- **NO es:** El panel del chatbot

### 2️⃣ **Panel del Chatbot** - Dashboard para IVÁN
- **Qué es:** El dashboard donde **Iván** gestiona las conversaciones del bot
- **Para qué:** Ver conversaciones, responder manualmente, configurar auto-respuestas
- **Dónde está:** Probablemente en otra URL o puerto (verificar con el desarrollador)

---

## 🎯 CÓMO PROBAR EL BOT (PASO A PASO)

### ❌ **NO HACER:**
- ❌ NO agregar el número como contacto en WhatsApp
- ❌ NO buscar el número en WhatsApp
- ❌ NO instalar WhatsApp Business en el celular

### ✅ **SÍ HACER:**

#### **PASO 1: Enviar mensaje directamente**

1. Abrir **WhatsApp** en tu celular personal
2. **NO buscar el número**, simplemente escribir el número completo en el campo de búsqueda o en "Nuevo chat"
3. Escribir: **+5491137623550** (sin espacios, sin guiones)
4. Click en "Enviar mensaje" o escribir directamente
5. Escribir un mensaje de prueba: **"Hola"**
6. Enviar

#### **PASO 2: Verificar que el bot responda**

**El bot debería responder automáticamente** con un mensaje del chatbot.

Si **NO responde**, verificar:

1. **Logs del servidor:**
   ```bash
   pm2 logs chatbot-pos --lines 50
   ```
   
   Deberías ver:
   - `whatsapp_webhook_received` - Mensaje recibido ✅
   - `whatsapp_message_processed` - Mensaje procesado ✅
   - `auto_reply_generated` - Respuesta generada ✅

2. **Si NO ves logs:**
   - El webhook no está configurado correctamente
   - O el número no está conectado a la API

---

## 🔍 VERIFICAR CONFIGURACIÓN

### 1. Verificar Webhook en Meta

1. Ir a: https://developers.facebook.com/apps/839926155344611/whatsapp-business/configuration/
2. Buscar sección **"Webhook"**
3. Verificar:
   - **URL:** `https://api.posyasociados.com/api/webhook/whatsapp`
   - **Token:** El mismo que está en tu `.env` como `WHATSAPP_VERIFY_TOKEN`
   - **Suscrito a:** `messages`, `message_status`

### 2. Verificar Phone Number ID

1. Ir a: https://developers.facebook.com/tools/explorer/
2. Seleccionar app: **"Automatizacion Pos"**
3. Query:
   ```
   /819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}
   ```
4. Buscar el número **+5491137623550**
5. Copiar el **`id`** (ese es el Phone Number ID)
6. Verificar que esté en tu `.env` como `WHATSAPP_PHONE_NUMBER_ID`

### 3. Verificar que el servidor esté corriendo

```bash
pm2 status
```

Deberías ver `chatbot-pos` con status `online`.

---

## 📱 POR QUÉ NO APARECE EN WHATSAPP PERSONAL

**Es NORMAL que el número NO aparezca como contacto disponible.**

Los números de **WhatsApp Cloud API** funcionan diferente:
- ✅ Funcionan a través de la API (el bot envía mensajes)
- ❌ NO aparecen en búsquedas de WhatsApp
- ❌ NO se pueden agregar como contacto normal
- ✅ Solo podés enviarles mensajes escribiendo el número completo

**Esto es ESPERADO y CORRECTO.** No es un error.

---

## 🎯 RESUMEN: QUÉ HACER AHORA

1. **Abrir WhatsApp** en tu celular
2. **Escribir el número:** `+5491137623550` (sin espacios)
3. **Enviar mensaje:** "Hola"
4. **Esperar respuesta** del bot
5. **Verificar logs** si no responde

**NO necesitás:**
- ❌ Agregar como contacto
- ❌ Instalar WhatsApp Business
- ❌ Buscar el número en WhatsApp

---

## 📞 SI EL BOT NO RESPONDE

**Verificar en este orden:**

1. ✅ Servidor corriendo (`pm2 status`)
2. ✅ Webhook configurado en Meta
3. ✅ Phone Number ID correcto en `.env`
4. ✅ Token de acceso válido
5. ✅ Logs del servidor (ver si llegan los mensajes)

**Si todo está bien pero no responde:**
- El número puede estar en período de prueba (solo responde, no inicia conversaciones)
- Esperar 24-48 horas para que se active completamente
- Contactar soporte de Meta si persiste

