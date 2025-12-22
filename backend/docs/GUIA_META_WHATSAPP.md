# Guía Completa: Configurar Meta WhatsApp Cloud API

## 📋 Paso 1: Acceder a Meta for Developers

1. Ve a: https://developers.facebook.com/
2. Inicia sesión con tu cuenta de Facebook (la misma que usaste para verificar la empresa)
3. Si no tienes cuenta de desarrollador, créala (es gratis)

---

## 📋 Paso 2: Crear o Acceder a tu App de WhatsApp

### Si ya tienes una app:
1. Ve a "Mis Apps" → Selecciona tu app de WhatsApp Business
2. Si no la tienes, continúa con el paso siguiente

### Si necesitas crear una app:
1. Click en "Crear App" (arriba a la derecha)
2. Selecciona "Negocio" como tipo de app
3. Completa:
   - Nombre de la app: "POS & Asociados WhatsApp" (o el que prefieras)
   - Email de contacto: tu email
   - Propósito: "Administrar mi negocio"
4. Click en "Crear App"

---

## 📋 Paso 3: Agregar Producto WhatsApp

**IMPORTANTE:** Si no ves "WhatsApp" en el menú lateral, necesitás agregarlo como producto.

### Opción A: Desde el menú lateral (si ya está)
1. En el menú lateral izquierdo, busca "WhatsApp" o "WhatsApp Business API"
2. Si lo ves, click ahí directamente

### Opción B: Agregar WhatsApp como producto (si NO lo ves)
1. En el menú lateral izquierdo, busca **"Configuración de la aplicación"** o **"App configuration"**
2. Click ahí
3. En la página que se abre, busca la sección **"Productos"** o **"Products"**
4. Verás una lista de productos disponibles (Facebook Login, Marketing API, etc.)
5. Busca **"WhatsApp"** en esa lista
6. Click en el botón **"Configurar"** o **"Set Up"** que está al lado de WhatsApp
7. Si te pide seleccionar un tipo de negocio, elige **"Negocio pequeño"** o **"Empresa"**

### Opción C: Desde el botón "Añadir casos de uso"
1. En el Panel, arriba a la derecha, hay un botón **"Añadir casos de uso"**
2. Click ahí
3. Busca **"WhatsApp"** en la lista de casos de uso
4. Seleccionalo y click en **"Configurar"**

**💡 TIP:** Si después de agregar WhatsApp no aparece en el menú lateral, recarga la página (F5)

---

## 📋 Paso 4: Obtener Access Token (Token de Acceso) - PRIMERO

**En la pantalla de "Configuración" que estás viendo:**

1. Buscá la sección **"Crea un token de acceso permanente"** (Create a permanent access token)
2. Hacé clic en el botón **"Configuración de..."** que está a la derecha
3. Se abrirá una nueva página o modal
4. Ahí vas a poder:
   - Crear un "System User" (Usuario del sistema)
   - Generar un token permanente con permisos de WhatsApp
5. **Permisos necesarios:**
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
6. **Copia el token generado** → Es tu `WHATSAPP_TOKEN`
   - ⚠️ **GUARDALO BIEN** - Solo se muestra una vez

---

## 📋 Paso 5: Crear Cuenta de WhatsApp Business

**En la misma pantalla de "Configuración":**

1. Buscá la sección **"Crea una cuenta de WhatsApp Business"**
2. Hacé clic en el botón **"Crear cuenta"**
3. Te va a pedir:
   - Agregar tu número de teléfono (el 1122913122 o el que quieras usar)
   - Verificar el número (te llegará un código por WhatsApp)
4. Una vez creada la cuenta, vas a poder ver tu **Phone Number ID**

---

## 📋 Paso 6: Obtener Phone Number ID

**Después de crear la cuenta de WhatsApp Business:**

1. En el menú lateral, buscá **"WhatsApp Manager"** o volvé a **"Configuración"**
2. Buscá la sección **"Phone number"** o **"Número de teléfono"**
3. Verás tu número de teléfono (ej: +54 11 2291-3122)
4. Justo debajo o al lado, verás el **"Phone number ID"** (es un número largo, ej: `123456789012345`)
5. **Copia ese Phone Number ID** → Es tu `WHATSAPP_PHONE_NUMBER_ID`

---

## 📋 Paso 7: Crear Verify Token (Token de Verificación)

**Este token lo creas TÚ, no Meta. Es un secreto que solo vos y Meta conocen.**

1. Inventá un token secreto (puede ser cualquier string aleatorio)
   - Ejemplo: `mi_token_secreto_pos_2024_xyz123`
   - Mínimo 10 caracteres, recomendado 20+
2. **Ese token** → Es tu `WHATSAPP_VERIFY_TOKEN`
3. **Lo vas a usar en el Paso 8** para configurar el webhook

---

## 📋 Paso 8: Configurar Webhook en Meta

**En la pantalla de "Configuración" que estás viendo:**

1. Buscá la sección **"Suscribirse a webhooks"** (Subscribe to webhooks)
2. Completá los campos:
   - **URL de devolución de llamada (Callback URL):**
     - Si tu servidor ya está en producción: `https://tu-dominio.com/api/webhook/whatsapp`
     - Si estás en desarrollo local: Usá ngrok o similar
     - Ejemplo con ngrok: `https://abc123.ngrok.io/api/webhook/whatsapp`
   - **Identificador de verificación (Verify Token):**
     - Poné el token que creaste en el Paso 7
     - Ejemplo: `mi_token_secreto_pos_2024_xyz123`
3. Dejá el toggle de certificado de cliente **DESACTIVADO** (por ahora)
4. Hacé clic en **"Verificar y guardar"**
5. Meta enviará un GET a tu webhook para verificar
6. Si todo está bien, verás un check verde ✅ y el webhook quedará configurado

---

## 📋 Paso 8: Suscribirse a Eventos

1. En la misma sección de Webhook, busca **"Suscribirse a campos"** o **"Subscribe to fields"**
2. Marca la casilla: **"messages"** (mensajes entrantes)
3. Opcional: También puedes marcar **"message_status"** (estados de entrega)
4. Click en **"Guardar"**

---

## 📋 Paso 9: Configurar Variables de Entorno

Agrega estas variables a tu archivo `.env` en el backend:

```env
# Meta WhatsApp Cloud API
WHATSAPP_TOKEN=tu_access_token_del_paso_5
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id_del_paso_4
WHATSAPP_VERIFY_TOKEN=tu_token_secreto_del_paso_6
WHATSAPP_DRIVER=cloud
```

---

## 📋 Paso 10: Probar la Configuración

1. Inicia el servidor:
   ```bash
   cd backend
   npm run dev
   ```

2. Verifica que el webhook esté funcionando:
   - Meta debería haber verificado automáticamente cuando configuraste el webhook
   - Revisa los logs del servidor para ver si llegó la verificación

3. Envía un mensaje de prueba:
   - Desde otro número de WhatsApp, envía un mensaje al número configurado
   - Deberías recibir una respuesta automática del bot

---

## 🔧 Solución de Problemas

### El webhook no se verifica:
- Verifica que tu servidor esté accesible desde internet (usa ngrok si estás en local)
- Verifica que el `WHATSAPP_VERIFY_TOKEN` sea exactamente el mismo en `.env` y en Meta
- Revisa los logs del servidor para ver qué error aparece

### No llegan mensajes:
- Verifica que estés suscrito al campo "messages" en el webhook
- Verifica que el número de teléfono esté activo en Meta
- Revisa los logs del servidor

### Error 401 (No autorizado):
- El token de acceso expiró (si es temporal)
- Genera un nuevo token permanente

### Error 403 (Prohibido):
- El token no tiene los permisos necesarios
- Regenera el token con los permisos correctos

---

## 📞 Recursos Útiles

- Documentación oficial: https://developers.facebook.com/docs/whatsapp/cloud-api
- Dashboard de Meta: https://developers.facebook.com/apps/
- Soporte de Meta: https://developers.facebook.com/support/

---

## ⚠️ Notas Importantes

1. **Token temporal vs permanente:**
   - Los tokens temporales expiran en 24 horas
   - Para producción, usa tokens permanentes
   - Los tokens permanentes no expiran (pero puedes revocarlos)

2. **Límites de la API:**
   - Meta tiene límites de mensajes por día según tu plan
   - Revisa tu límite en: WhatsApp → Configuración → Límites

3. **Costo:**
   - Meta cobra por mensaje enviado (no por recibido)
   - Precio en Argentina: ~$0.005-0.01 USD por mensaje
   - Hay una ventana de 24 horas gratis después del último mensaje del usuario

