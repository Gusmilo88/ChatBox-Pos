# 📍 DÓNDE ESTÁ LA CONFIGURACIÓN DEL WEBHOOK

## 🎯 PASOS EXACTOS

### PASO 1: Ir a la sección de WhatsApp

**Desde donde estás ahora (Dashboard):**

1. En el menú lateral izquierdo, buscá **"WhatsApp"**
2. Click en **"WhatsApp"**
3. Se abrirá un submenú con opciones

### PASO 2: Ir a Configuración

**En el submenú de WhatsApp:**

1. Buscá **"Configuración"** o **"API Setup"** o **"Configuración de API"**
2. Click ahí

### PASO 3: Buscar Webhook

**En la página de Configuración:**

1. Buscá una sección que diga:
   - **"Webhook"** o **"Configuración de webhook"**
   - **"Webhooks"** o **"Webhook Configuration"**
   - **"Callback URL"** o **"URL de devolución de llamada"**

2. Si NO ves esa sección, buscá:
   - **"Configuración de webhook"** en el menú lateral (dentro de WhatsApp)
   - O un botón que diga **"Configurar webhook"** o **"Add webhook"**

---

## 🔄 ALTERNATIVA: URL Directa

**Si no encontrás el menú, ir directo:**

1. Click en la barra de direcciones del navegador
2. Borrar todo
3. Pegar esto:
   ```
   https://developers.facebook.com/apps/839926155344611/whatsapp-business/configuration/
   ```
4. Presionar Enter

**Esto te lleva directo a la configuración de WhatsApp donde está el webhook.**

---

## 📋 QUÉ DEBERÍAS VER

Cuando estés en la página correcta, deberías ver:

- **"Webhook"** o **"Configuración de webhook"**
- Un campo para **"URL del webhook"** o **"Callback URL"**
- Un campo para **"Token de verificación"** o **"Verify Token"**
- Una lista de **"Eventos suscritos"** o **"Subscribed events"**

---

## ✅ CONFIGURAR EL WEBHOOK

**Si el webhook NO está configurado:**

1. Click en **"Configurar webhook"** o **"Edit"** o **"Add webhook"**
2. **URL del webhook:** `https://api.posyasociados.com/api/webhook/whatsapp`
3. **Token de verificación:** El mismo que está en tu `.env` como `WHATSAPP_VERIFY_TOKEN`
4. **Eventos a suscribir:**
   - ✅ `messages` (mensajes)
   - ✅ `message_status` (estado de mensajes)
5. Click en **"Verificar y guardar"** o **"Verify and Save"**

---

## 🔍 SI SIGUE SIN APARECER

**Verificar que estés en la app correcta:**

1. En el menú lateral, verificar que diga **"Automatizacion Pos"**
2. Si no, seleccionar la app correcta desde el dropdown

**O probar desde WhatsApp Manager:**

1. Ir a: https://business.facebook.com/wa/manage/
2. En el menú lateral, **"Configuración"** → **"Webhooks"**
3. Ahí deberías ver la configuración del webhook


