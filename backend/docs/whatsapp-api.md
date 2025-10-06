# WhatsApp Cloud API Integration

## Descripción

Este módulo permite enviar mensajes reales a través de la WhatsApp Cloud API de Meta. Incluye modo mock para desarrollo y testing.

## Configuración

### Variables de entorno requeridas

Agregar al archivo `.env`:

```bash
# WhatsApp Cloud API
WHATSAPP_TOKEN=your-whatsapp-cloud-api-token-here
WHATSAPP_PHONE_NUMBER_ID=your-whatsapp-phone-number-id-here
WHATSAPP_DRIVER=cloud
```

### Obtener credenciales de Meta

1. Crear una aplicación en [Meta for Developers](https://developers.facebook.com/)
2. Configurar WhatsApp Business API
3. Obtener el token de acceso y el Phone Number ID
4. Configurar webhooks (opcional, para recibir mensajes)

## API Endpoints

### POST /api/whatsapp/send

Envía un mensaje de WhatsApp a través de la Cloud API.

**Autenticación:** Requiere sesión válida (cookie HttpOnly)

**Request Body:**
```json
{
  "to": "+541151093439",
  "text": "Mensaje de prueba"
}
```

**Respuesta exitosa (real):**
```json
{
  "success": true,
  "messageId": "wamid.HBgM...",
  "status": "sent"
}
```

**Respuesta exitosa (mock):**
```json
{
  "success": true,
  "messageId": "mock_1234567890_abc123",
  "status": "sent",
  "mock": true,
  "message": "Simulación de envío - WhatsApp no configurado"
}
```

**Respuesta de error:**
```json
{
  "success": false,
  "error": "Error al enviar mensaje",
  "status": "failed"
}
```

### GET /api/whatsapp/status

Verifica el estado de configuración del servicio WhatsApp.

**Autenticación:** Requiere sesión válida

**Respuesta:**
```json
{
  "configured": true,
  "message": "WhatsApp configurado correctamente"
}
```

## Modo Mock

Si las variables `WHATSAPP_TOKEN` o `WHATSAPP_PHONE_NUMBER_ID` no están definidas o están vacías, el servicio funciona en modo mock:

- Simula envíos exitosos
- Genera IDs de mensaje ficticios
- Registra logs de simulación
- No realiza llamadas reales a la API de Meta

## Seguridad

- **Autenticación:** Todas las rutas requieren sesión válida
- **Rate Limiting:** Aplicado por el middleware global
- **Validación:** Números de teléfono y contenido validados
- **Logging:** Números enmascarados en logs, tokens parcialmente ocultos
- **PII Protection:** No se almacenan datos sensibles en logs

## Validaciones

- **Número de teléfono:** Formato internacional requerido (+541151093439)
- **Texto:** Mínimo 1 carácter, máximo 4096 caracteres
- **Token:** Validación de presencia y formato
- **Phone Number ID:** Validación de presencia

## Logging

El servicio registra eventos importantes:

- `whatsapp_sending_message`: Inicio de envío
- `whatsapp_message_sent`: Envío exitoso
- `whatsapp_api_error`: Error de API de Meta
- `whatsapp_send_error`: Error interno
- `whatsapp_mock_mode`: Modo mock activado

## Testing

### Probar con curl

```bash
# 1. Hacer login para obtener cookie de sesión
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}' \
  -c cookies.txt

# 2. Enviar mensaje WhatsApp
curl -X POST http://localhost:4000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"to":"+541151093439","text":"Mensaje de prueba"}'

# 3. Verificar estado
curl -X GET http://localhost:4000/api/whatsapp/status \
  -b cookies.txt
```

### Probar desde frontend

```javascript
// Enviar mensaje desde el dashboard
const response = await fetch('/api/whatsapp/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    to: '+541151093439',
    text: 'Mensaje desde dashboard'
  })
});

const result = await response.json();
console.log('Resultado:', result);
```

## Integración con conversaciones

El servicio está preparado para integrarse con el sistema de conversaciones existente:

```typescript
import { sendWhatsAppMessage } from '../services/whatsappSender';

// En el servicio de conversaciones
const result = await sendWhatsAppMessage(
  conversation.phone, 
  message.text
);

if (result.success) {
  // Actualizar estado del mensaje
  await markMessageDelivery(messageId, 'sent');
} else {
  // Manejar error
  await markMessageDelivery(messageId, 'failed');
}
```

## Monitoreo

Para monitorear el funcionamiento:

1. **Logs del servidor:** Verificar eventos de WhatsApp
2. **Estado de configuración:** Usar `/api/whatsapp/status`
3. **Rate limiting:** Monitorear límites de envío
4. **Errores de API:** Revisar logs de Meta API

## Próximos pasos

1. **Webhook de entrega:** Configurar para recibir confirmaciones
2. **Plantillas de mensaje:** Implementar mensajes pre-aprobados
3. **Múltiples números:** Soporte para varios Phone Number IDs
4. **Métricas:** Dashboard de estadísticas de envío
