# Guía de Desarrollo - Backend

Documentación para desarrolladores del backend del sistema de automatización POS.

## 📦 Dependencias

- Node.js 18+
- TypeScript 5+
- Express
- Firebase Admin SDK
- Winston (logging)
- Zod (validación)
- Axios (HTTP client)

## 🔧 Variables de Entorno

Ver `.env.example` para todas las variables de entorno necesarias.

## 🏗️ Estructura del Proyecto

```
backend/
├── src/
│   ├── index.ts              # Servidor Express principal
│   ├── config/
│   │   └── env.ts            # Configuración de variables de entorno
│   ├── middleware/
│   │   ├── security.ts       # CORS, rate limiting, API key
│   │   └── session.ts        # Gestión de sesiones (cookies)
│   ├── routes/
│   │   ├── auth.ts           # Autenticación (login/logout)
│   │   ├── conversations.ts  # Gestión de conversaciones
│   │   ├── whatsapp.ts       # API WhatsApp (Meta Cloud API)
│   │   ├── webhook360.ts     # Webhook 360dialog (nuevo)
│   │   ├── wa360_test.ts     # Tests 360dialog (nuevo)
│   │   ├── simulate.ts       # Simulación de mensajes
│   │   └── health.ts         # Health check
│   ├── services/
│   │   ├── whatsappSender.ts # Servicio Meta Cloud API
│   │   ├── whatsapp360.ts    # Servicio 360dialog (nuevo)
│   │   ├── processMessage.ts # Procesamiento de mensajes entrantes
│   │   └── conversations.ts  # Lógica de negocio conversaciones
│   ├── firebase/
│   │   └── index.ts          # Configuración Firebase
│   └── ...
```

## 🔄 Migración 360dialog

### Resumen

Se ha implementado una integración paralela de 360dialog que coexiste con la implementación actual de Meta Cloud API. Esto permite probar y migrar sin romper funcionalidad existente.

### Archivos Nuevos

1. **`src/services/whatsapp360.ts`**
   - Servicio para enviar mensajes vía 360dialog API
   - Usa `D360_API_KEY` y `WHATSAPP_API_URL` del `.env`
   - Cliente axios configurado con interceptores de logging

2. **`src/routes/webhook360.ts`**
   - Rutas GET y POST para `/api/webhook/whatsapp`
   - GET: Verificación del webhook (hub.verify_token)
   - POST: Recepción de mensajes entrantes (asíncrono)

3. **`src/routes/wa360_test.ts`**
   - Endpoint de prueba protegido por `x-api-key`
   - `POST /api/wa360/test/send` - Enviar mensaje de prueba
   - `GET /api/wa360/test/status` - Verificar configuración

### Variables de Entorno Necesarias

Agregar al `.env`:

```bash
# 360dialog WhatsApp API
D360_API_KEY=tu_api_key_de_360dialog
WHATSAPP_API_URL=https://waba-v2.360dialog.io

# Token para verificación de webhook (ya existe)
WHATSAPP_VERIFY_TOKEN=pos-verify-2025-supernova
```

### Integración Temporal (Para Testing)

**IMPORTANTE:** Las rutas nuevas NO están integradas en `src/index.ts` para no romper la implementación actual. Para probarlas, agregar temporalmente:

```typescript
// En src/index.ts, después de la línea 35:
import webhook360Router from './routes/webhook360';
import wa360TestRouter from './routes/wa360_test';

// Agregar después de las rutas públicas (línea ~35):
app.use('/api/webhook/whatsapp', express.raw({ type: 'application/json' }), webhook360Router); // TODO: reemplazar whatsappRouter si funciona

// Agregar después de las rutas protegidas (línea ~40):
app.use('/api/wa360', requireApiKey(), wa360TestRouter); // Rutas de prueba 360dialog
```

**NOTA:** Esto creará un conflicto con `whatsappRouter` en `/api/webhook/whatsapp`. Para testing, comentar temporalmente la línea 35 o cambiar el orden de las rutas.

### Pasos de Testing

#### 1. Configurar Variables de Entorno

```bash
# Editar backend/.env
D360_API_KEY=tu_api_key_real_aqui
WHATSAPP_API_URL=https://waba-v2.360dialog.io
```

#### 2. Verificar Configuración

```bash
# Verificar que el servicio detecta la configuración
curl -X GET http://localhost:4000/api/wa360/test/status \
  -H "x-api-key: tu_dashboard_api_key"
```

Respuesta esperada:
```json
{
  "configured": true,
  "message": "360dialog configurado correctamente"
}
```

#### 3. Probar Envío de Mensaje

```bash
# Enviar mensaje de prueba
curl -X POST http://localhost:4000/api/wa360/test/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: tu_dashboard_api_key" \
  -d '{
    "to": "+541151093439",
    "text": "Mensaje de prueba desde 360dialog"
  }'
```

Respuesta exitosa:
```json
{
  "success": true,
  "messageId": "wamid.HBgM...",
  "status": "sent"
}
```

#### 4. Configurar Webhook en 360dialog

1. En el dashboard de 360dialog, ir a configuración de webhooks
2. URL del webhook: `https://supernovawebs.com.ar/api/webhook/whatsapp`
3. Verify token: `pos-verify-2025-supernova` (el mismo que está en `.env`)
4. Guardar configuración

#### 5. Probar Webhook GET (Verificación)

360dialog realizará una petición GET automática al configurar el webhook:

```bash
# Simular verificación manual
curl -X GET "http://localhost:4000/api/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=pos-verify-2025-supernova&hub.challenge=12345"
```

Respuesta esperada: `12345` (el challenge)

#### 6. Probar Webhook POST (Mensaje Entrante)

Simular un mensaje entrante:

```bash
curl -X POST http://localhost:4000/api/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "123456",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "phone_number_id": "123456789",
            "display_phone_number": "+5491112345678"
          },
          "messages": [{
            "from": "+541151093439",
            "id": "wamid.test123",
            "timestamp": "1234567890",
            "type": "text",
            "text": {
              "body": "Hola, este es un mensaje de prueba"
            }
          }]
        },
        "field": "messages"
      }]
    }]
  }'
```

Respuesta esperada: `{"ok":true}` inmediatamente, luego procesamiento asíncrono.

#### 7. Verificar Logs

```bash
# Ver logs del backend
tail -f backend/logs/combined.log | grep whatsapp360
```

Buscar eventos:
- `whatsapp360_sending_message` - Envío iniciado
- `whatsapp360_message_sent` - Envío exitoso
- `whatsapp360_webhook_received` - Webhook recibido
- `whatsapp360_message_processed` - Mensaje procesado

### Migración Completa (Cuando Todo Funcione)

Una vez verificado que 360dialog funciona correctamente:

#### Opción A: Reemplazar Implementación Actual

1. **Actualizar `src/index.ts`:**
   ```typescript
   // Cambiar línea 35:
   // ANTES:
   app.use('/api/webhook/whatsapp', express.raw({ type: 'application/json' }), whatsappRouter);
   
   // DESPUÉS:
   import webhook360Router from './routes/webhook360';
   app.use('/api/webhook/whatsapp', express.raw({ type: 'application/json' }), webhook360Router);
   ```

2. **Actualizar servicio de conversaciones:**
   ```typescript
   // En src/services/conversations.ts o donde se envíen mensajes:
   // Cambiar de:
   import { sendWhatsAppMessage } from './whatsappSender';
   
   // A:
   import { send360Text } from './whatsapp360';
   ```

3. **Eliminar o deprecar archivos antiguos:**
   - `src/services/whatsappSender.ts` (opcional: mantener como backup)
   - `src/routes/whatsapp.ts` (opcional: mantener como backup)

#### Opción B: Mantener Ambas (Dual Mode)

Usar una variable de entorno para elegir el proveedor:

```typescript
// En src/config/env.ts
whatsappProvider: (process.env.WHATSAPP_PROVIDER || 'meta') as 'meta' | '360dialog'

// En src/services/conversations.ts
if (config.whatsappProvider === '360dialog') {
  await send360Text(to, text);
} else {
  await sendWhatsAppMessage(to, text);
}
```

### Diferencias entre Meta Cloud API y 360dialog

| Aspecto | Meta Cloud API | 360dialog |
|---------|----------------|-----------|
| **URL Base** | `https://graph.facebook.com/v19.0/{phoneNumberId}` | `https://waba-v2.360dialog.io/v1` |
| **Autenticación** | `Authorization: Bearer {token}` | `D360-API-KEY: {api_key}` |
| **Payload Envío** | `{ messaging_product, to, type, text: { body } }` | `{ to, type, text: { body } }` |
| **Webhook Payload** | Similar estructura, campos específicos pueden diferir | Similar a Meta, ajustar según docs |

### Troubleshooting

#### Error: "D360_API_KEY no configurado"

- Verificar que `D360_API_KEY` esté en `.env`
- Reiniciar el servidor después de agregar variables
- Verificar que no haya espacios extras en la variable

#### Error: "401 Unauthorized" al enviar mensaje

- Verificar que `D360_API_KEY` sea válido
- Verificar formato del header (debe ser `D360-API-KEY`, no `Authorization`)
- Revisar logs del servidor para detalles

#### Webhook no recibe mensajes

- Verificar URL pública: `https://supernovawebs.com.ar/api/webhook/whatsapp`
- Verificar `WHATSAPP_VERIFY_TOKEN` coincide con el configurado en 360dialog
- Revisar logs del servidor para ver si llegan requests
- Verificar que el webhook esté activo en el dashboard de 360dialog

#### Mensaje se envía pero no aparece en WhatsApp

- Verificar que el número esté en formato internacional: `+541151093439`
- Verificar que el número esté verificado/registrado en 360dialog
- Revisar respuesta de la API en los logs (`whatsapp360_message_sent`)

### Recursos

- [Documentación 360dialog API](https://docs.360dialog.com/whatsapp-api/whatsapp-api/messages)
- [Documentación Webhooks 360dialog](https://docs.360dialog.com/whatsapp-api/whatsapp-api/webhooks)
- [Meta Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api) (para comparación)

