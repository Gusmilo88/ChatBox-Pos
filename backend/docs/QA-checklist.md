# QA Checklist - Backend Chatbot

## 📋 Checklist Manual de Verificación

### 🔧 Entorno
- [ ] `npm run dev` levanta servidor en puerto 3001
- [ ] Logs se crean en directorios `data/` y `logs/`
- [ ] Modo de datos configurado correctamente:
  - [ ] Excel: `USE_FIREBASE=0` o no definido
  - [ ] Firestore: `USE_FIREBASE=prod` con credenciales válidas
- [ ] Seguridad activa:
  - [ ] Helmet: Headers de seguridad presentes
  - [ ] Rate limit: 60 req/min por IP
  - [ ] CORS: Solo orígenes en `ALLOWED_ORIGINS`
  - [ ] API key: `PROTECT_API=1` exige `x-api-key` en `/api/*`

### 🌐 Endpoints Básicos

#### GET /health
- [ ] Responde `200` con `{"ok": true}`
- [ ] Tiempo de respuesta < 1s

#### POST /api/simulate/message

**Flujo START:**
- [ ] "hola" → Saludo del bot
- [ ] "menu" → Reset a START
- [ ] "inicio" → Reset a START
- [ ] "volver" → Reset a START
- [ ] "start" → Reset a START

**Flujo CLIENTE:**
- [ ] CUIT válido (`20123456786` o real) → `CLIENTE_MENU`
- [ ] Opción "1" o "saldo" → Muestra saldo formateado
- [ ] Opción "2" o "comprobantes" → Lista últimos comprobantes
- [ ] Opción "3" o "humano" → Transición a `HUMANO`
- [ ] Opción "4" o "inicio" → Vuelve a `START`
- [ ] Texto libre → Respuesta de IA (si configurada)

**Flujo NO CLIENTE:**
- [ ] "quiero info" → Solicita nombre
- [ ] Nombre válido → Solicita email
- [ ] Email válido → Solicita interés
- [ ] Interés válido → Transición a `HUMANO`
- [ ] "otras_consultas" → Respuesta de IA (si configurada)

### 🔒 Seguridad

#### API Key Protection
- [ ] Con `PROTECT_API=1` y sin `x-api-key` → `401 Unauthorized`
- [ ] Con `PROTECT_API=1` y `x-api-key` válida → `200 OK`
- [ ] Con `PROTECT_API=0` → Funciona sin API key

#### CORS
- [ ] Origen permitido → Request exitoso
- [ ] Origen no permitido → Bloqueado
- [ ] Sin origen (curl) → Funciona

#### Rate Limiting
- [ ] < 60 req/min → Funciona normal
- [ ] > 60 req/min → `429 Too Many Requests`

#### PII Masking
- [ ] Logs no muestran CUIT completo
- [ ] Logs no muestran teléfono completo
- [ ] Formato: `201***86`, `+549***02`

### 💾 Datos

#### Excel Mode (`USE_FIREBASE=0`)
- [ ] Archivo `data/base_noclientes.xlsx` existe
- [ ] Hoja `leads` se actualiza con nuevos registros
- [ ] Hoja `clientes_mock` contiene CUITs de prueba
- [ ] Campos: `assigned_to`, `source`, `stage` se asignan correctamente

#### Firestore Mode (`USE_FIREBASE=prod`)
- [ ] Conexión a Firestore exitosa
- [ ] Colección `clientes` accesible
- [ ] Documento con `id = CUIT` se lee correctamente
- [ ] Campos `saldo`, `comprobantes` se obtienen

### 📱 WhatsApp Webhook (Stub)

#### Verificación GET
- [ ] `GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=12345`
- [ ] Responde `200` con `12345` (challenge)
- [ ] Token incorrecto → `403 Forbidden`

#### Mensajes POST
- [ ] Payload válido con `type: "text"` → `200 {"received": true}`
- [ ] FSM procesa mensaje correctamente
- [ ] Logs muestran procesamiento enmascarado
- [ ] Sin firma HMAC → Funciona (modo desarrollo)
- [ ] Con firma HMAC incorrecta → `401 Unauthorized`

#### Estructura de Payload
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "+5491100000002",
          "id": "wamid.X",
          "timestamp": "0",
          "type": "text",
          "text": { "body": "hola" }
        }]
      }
    }]
  }]
}
```

### 🤖 IA (Opcional)

#### Con OpenAI API Key
- [ ] Respuestas de IA en español rioplatense
- [ ] Máximo 600 caracteres
- [ ] Fallback a humano cuando corresponde
- [ ] Logs de llamadas a IA

#### Sin OpenAI API Key
- [ ] Mensajes fallback apropiados
- [ ] No errores en el sistema
- [ ] Flujo continúa normalmente

### 📊 Logs y Monitoreo

#### Winston Logger
- [ ] Logs en `logs/` con rotación
- [ ] Niveles: error, warn, info, debug
- [ ] PII enmascarado en todos los logs
- [ ] Transiciones de estado registradas

#### Performance
- [ ] Respuestas < 2s para endpoints normales
- [ ] Webhook WhatsApp < 1s
- [ ] Sin memory leaks en sesiones
- [ ] Cleanup automático de sesiones expiradas

### 🧪 Smoke Tests Automáticos

#### Comando Completo
```bash
npm run smoke
```
- [ ] Todos los tests pasan
- [ ] Código de salida 0
- [ ] Reporte detallado en consola

#### Comando Rápido
```bash
npm run smoke:quick
```
- [ ] Solo tests críticos
- [ ] /health + "hola" + CUIT + "1/2"
- [ ] Tiempo < 30s

#### Comando WhatsApp
```bash
npm run smoke:wa
```
- [ ] Solo webhook de WhatsApp
- [ ] GET verificación + POST mensaje
- [ ] Validación de estructura

### 🚨 Problemas Conocidos

#### Pendientes
- [ ] Envío de mensajes por Cloud API (solo recepción implementada)
- [ ] Dashboard de métricas
- [ ] Integración con Xubio real
- [ ] Moderación de contenido
- [ ] Contexto de historial en IA

#### Limitaciones Actuales
- [ ] Sesiones en memoria (no persistente)
- [ ] Sin autenticación de usuarios
- [ ] Sin validación de números de WhatsApp
- [ ] Sin manejo de errores de red

### ✅ Criterios de Aceptación

- [ ] **Funcionalidad**: Todos los flujos principales funcionan
- [ ] **Seguridad**: Protecciones activas y funcionando
- [ ] **Performance**: Respuestas rápidas y estables
- [ ] **Logs**: Información suficiente para debugging
- [ ] **Tests**: Smoke tests pasan consistentemente
- [ ] **Documentación**: README actualizado con ejemplos

---

## 🔧 Variables de Entorno Requeridas

```bash
# Básicas
PORT=3001
LEADS_FILE=./data/base_noclientes.xlsx
CORS_ORIGIN=http://localhost:5173

# Seguridad
ALLOWED_ORIGINS=http://localhost:5173
PROTECT_API=1
API_KEY=tu_api_key_secreta
RATE_WINDOW_MS=60000
RATE_MAX=60

# WhatsApp
WHATSAPP_VERIFY_TOKEN=tu_token_de_verificacion
APP_SECRET=tu_app_secret_opcional

# IA (opcional)
OPENAI_API_KEY=tu_openai_key
OPENAI_MODEL=gpt-4o-mini
AI_MAX_TOKENS=300
AI_TEMPERATURE=0.3

# Firebase (opcional)
USE_FIREBASE=0
FIREBASE_PROJECT_ID=tu_proyecto
FIREBASE_CLIENT_EMAIL=tu_email
FIREBASE_PRIVATE_KEY=tu_private_key
```

## 📞 Contacto

Para reportar problemas o sugerencias, contactar al equipo de desarrollo.
