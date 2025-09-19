# Backend - Chatbot FSM para Automatización POS

Backend desarrollado en Node.js + TypeScript con máquina de estados (FSM) para simular un chatbot por HTTP.

## 🚀 Inicio Rápido

```bash
cd backend
npm install
npm run dev
```

El servidor se iniciará en `http://localhost:3001`

## 📋 Scripts Disponibles

- `npm run dev` - Ejecuta en modo desarrollo con hot reload
- `npm run build` - Compila TypeScript a JavaScript
- `npm start` - Ejecuta la versión compilada

## 🏗️ Arquitectura

### Estructura de Archivos
```
backend/
├── src/
│   ├── index.ts              # Servidor principal
│   ├── config/
│   │   └── env.ts            # Configuración de entorno
│   ├── libs/
│   │   └── logger.ts         # Logger Winston
│   ├── utils/
│   │   └── cuit.ts           # Validación de CUIT
│   ├── types/
│   │   └── message.ts        # Tipos TypeScript
│   ├── fsm/
│   │   ├── states.ts         # Estados y textos
│   │   └── engine.ts         # Motor de FSM
│   ├── services/
│   │   ├── clientsRepo.ts    # Repositorio de clientes
│   │   ├── leadsRepo.ts      # Repositorio de leads
│   │   └── router.ts         # Router principal
│   └── routes/
│       ├── health.ts         # Health check
│       └── simulate.ts       # API del chatbot
├── data/                     # Archivos Excel (se crean automáticamente)
├── logs/                     # Logs de Winston
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Configuración

### Variables de Entorno (.env)
```env
PORT=3001
LEADS_FILE=./data/base_noclientes.xlsx
CORS_ORIGIN=http://localhost:5173
```

### Dependencias
- **Producción**: express, cors, dotenv, zod, dayjs, uuid, axios, xlsx, winston
- **Desarrollo**: typescript, tsx, @types/express, @types/node

## 🤖 API del Chatbot

### Endpoints

#### Health Check
```http
GET /health
```
Respuesta: `{ "ok": true }`

#### Simular Mensaje
```http
POST /api/simulate/message
Content-Type: application/json

{
  "from": "+5491100000000",
  "text": "hola"
}
```

Respuesta:
```json
{
  "replies": ["Hola 👋 soy el asistente del estudio..."]
}
```

## 🔄 Estados del Chatbot

1. **START** - Estado inicial
2. **WAIT_CUIT** - Esperando CUIT válido
3. **CLIENTE_MENU** - Menú para clientes existentes
4. **NO_CLIENTE_NAME** - Recopilando nombre del lead
5. **NO_CLIENTE_EMAIL** - Recopilando email del lead
6. **NO_CLIENTE_INTEREST** - Recopilando interés del lead
7. **HUMANO** - Derivación a humano

### Comandos Globales
- `menu` - Mostrar menú actual
- `volver` - Volver al inicio
- `humano` - Derivar a humano

## 📊 Gestión de Datos

### Clientes
- Se cargan desde `data/base_noclientes.xlsx` hoja `clientes_mock`
- Si no existe, se crea con datos de ejemplo
- Métodos: `existsByCuit()`, `getSaldo()`, `getUltimosComprobantes()`

### Leads
- Se guardan en `data/base_noclientes.xlsx` hoja `leads`
- Columnas: created_at, phone_e164, full_name, cuit, email, city, company, interest, source, utm_campaign, consent_ts, stage, assigned_to, last_msg_at, last_msg_text, notes, tag1, tag2
- Asignación automática según interés:
  - `turno_consulta` → Secretaria1
  - `honorarios` → Secretaria2
  - Otros → Ivan

## 🧪 Testing

### Test Básico (PowerShell)
```powershell
# Test inicial
curl -X POST http://localhost:3001/api/simulate/message `
  -H "Content-Type: application/json" `
  -d "{ \"from\": \"+5491100000000\", \"text\": \"hola\" }"

# Test con CUIT válido
curl -X POST http://localhost:3001/api/simulate/message `
  -H "Content-Type: application/json" `
  -d "{ \"from\": \"+5491100000000\", \"text\": \"20123456786\" }"
```

### Test Flujo No-Cliente
```powershell
# 1. Iniciar flujo
curl -X POST http://localhost:3001/api/simulate/message `
  -H "Content-Type: application/json" `
  -d "{ \"from\": \"+5491100000001\", \"text\": \"quiero info\" }"

# 2. Nombre
curl -X POST http://localhost:3001/api/simulate/message `
  -H "Content-Type: application/json" `
  -d "{ \"from\": \"+5491100000001\", \"text\": \"Juan Pérez - Empresa ABC\" }"

# 3. Email
curl -X POST http://localhost:3001/api/simulate/message `
  -H "Content-Type: application/json" `
  -d "{ \"from\": \"+5491100000001\", \"text\": \"juan@empresa.com\" }"

# 4. Interés
curl -X POST http://localhost:3001/api/simulate/message `
  -H "Content-Type: application/json" `
  -d "{ \"from\": \"+5491100000001\", \"text\": \"honorarios\" }"
```

## 📝 Logs

Los logs se guardan en:
- `logs/app.log` - Archivo de logs
- Consola - Logs en tiempo real

Cada request y transición de estado se registra automáticamente.

## 🤖 Módulo de IA

El backend incluye un módulo de IA integrado que funciona como fallback para consultas no estándar.

### Configuración de IA

Variables de entorno para IA:
```env
OPENAI_API_KEY=tu_api_key_aqui
OPENAI_MODEL=gpt-4o-mini
AI_MAX_TOKENS=300
AI_TEMPERATURE=0.3
```

### Funcionalidades de IA

- **Fallback automático**: Si no hay API key, devuelve respuestas predefinidas
- **Integración en FSM**: Se activa en consultas libres de clientes y "otras_consultas"
- **Respuestas truncadas**: Máximo 600 caracteres para WhatsApp
- **Logging completo**: Cada llamada a IA se registra

### Endpoints de IA

#### Test directo de IA
```http
POST /api/ai
Content-Type: application/json

{
  "role": "no_cliente",
  "interest": "otras_consultas", 
  "text": "tienen plan para monotributistas con empleados?"
}
```

### Testing de IA

```powershell
# Test flujo no-cliente con IA
curl -X POST http://localhost:3001/api/simulate/message `
  -H "Content-Type: application/json" `
  -d "{ \"from\": \"+5491100000000\", \"text\": \"quiero info\" }"

# Completar flujo: nombre → email → "otras_consultas"
# Luego enviar consulta libre para activar IA

# Test cliente con IA
curl -X POST http://localhost:3001/api/simulate/message `
  -H "Content-Type: application/json" `
  -d "{ \"from\": \"+5491100000000\", \"text\": \"20123456786\" }"

# Luego enviar mensaje libre (no 1/2/3/4) para activar IA
```

### Test CLIENTE_MENU (Opciones 1/2/3/4)
```powershell
# 1. Autenticar como cliente
curl -sS -H "Content-Type: application/json" -d '{"from":"+5491100000002","text":"20123456786"}' http://localhost:3001/api/simulate/message

# 2. Ver saldo (opción 1)
curl -sS -H "Content-Type: application/json" -d '{"from":"+5491100000002","text":"1"}' http://localhost:3001/api/simulate/message

# 3. Ver comprobantes (opción 2)
curl -sS -H "Content-Type: application/json" -d '{"from":"+5491100000002","text":"2"}' http://localhost:3001/api/simulate/message

# 4. Volver al inicio (opción 4)
curl -sS -H "Content-Type: application/json" -d '{"from":"+5491100000002","text":"4"}' http://localhost:3001/api/simulate/message

# 5. Test con sinónimos
curl -sS -H "Content-Type: application/json" -d '{"from":"+5491100000002","text":"saldo"}' http://localhost:3001/api/simulate/message
curl -sS -H "Content-Type: application/json" -d '{"from":"+5491100000002","text":"comprobantes"}' http://localhost:3001/api/simulate/message
```

### Test Webhook WhatsApp
```powershell
# 1. Verificación inicial (GET)
curl "http://localhost:3001/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=12345"
# Debe devolver: 12345

# 2. Mensaje de texto (POST)
curl -X POST http://localhost:3001/webhook/whatsapp `
  -H "Content-Type: application/json" `
  -d '{
    "object":"whatsapp_business_account",
    "entry":[{"changes":[{"value":{
      "messages":[{"from":"+5491100000002","id":"wamid.X","timestamp":"0","type":"text","text":{"body":"hola"}}]
    }}]}]
  }'
# Debe devolver: {"received":true,"n_messages":1}

# 3. Test con CUIT válido
curl -X POST http://localhost:3001/webhook/whatsapp `
  -H "Content-Type: application/json" `
  -d '{
    "object":"whatsapp_business_account",
    "entry":[{"changes":[{"value":{
      "messages":[{"from":"+5491100000002","id":"wamid.Y","timestamp":"0","type":"text","text":{"body":"20123456786"}}]
    }}]}]
  }'
```

## 🔥 Conexión a Firestore (producción)

El backend puede conectarse a Firestore real para leer datos de clientes.

### Configuración

1. **Variables de entorno** (agregar a `.env`):
```env
# --- FIREBASE (producción) ---
USE_FIREBASE=prod             # opciones: 0 | emu | prod
FIREBASE_PROJECT_ID=tu-proyecto-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

2. **Estructura en Firestore**:
```
colección: clientes
documento: {CUIT} (ej: "20123456786")
campos:
  - cuit: string
  - nombre: string
  - email?: string
  - saldo?: number
  - id_xubio?: string
  - last_doc_date?: string
  - comprobantes?: string[]
```

3. **Modos de operación**:
- `USE_FIREBASE=0` o vacío: Excel local (modo actual)
- `USE_FIREBASE=emu`: Firestore Emulator
- `USE_FIREBASE=prod`: Firestore real

### Seguridad API

El backend incluye protecciones de seguridad:

- **CORS**: Solo orígenes permitidos en `ALLOWED_ORIGINS`
- **Rate Limiting**: 60 requests/min por IP (configurable)
- **API Key**: Protección opcional con `x-api-key` header
- **Helmet**: Headers de seguridad
- **PII Masking**: Logs enmascaran CUITs y teléfonos

### Variables de Seguridad

```env
# --- SEGURIDAD API ---
ALLOWED_ORIGINS=http://localhost:5173,https://tu-dominio.com
PROTECT_API=1                 # 1 = exigir API key
API_KEY=tu-clave-secreta      # clave para header x-api-key
RATE_WINDOW_MS=60000          # ventana de rate limiting (ms)
RATE_MAX=60                   # máximo requests por ventana
```

## 🔮 TODOs para Futuro

- [ ] Webhook de WhatsApp
- [ ] Redis para sesiones persistentes
- [ ] Google Sheets/Base de datos para leads
- [ ] Mapeo de assigned_to a números reales
- [ ] Integración con Xubio para saldos reales
- [ ] Sistema de notificaciones
- [ ] Tool calling para IA cuando conectemos WhatsApp
- [ ] Contexto de cliente real desde Xubio
- [ ] Moderación simple antes de llamar a IA
- [ ] Resumen de historial para contexto de IA

## 🛠️ Desarrollo

### Proxy en Vite (Frontend)
Para probar desde React, agregar en `frontend/vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

Así desde React podés hacer `fetch('/api/simulate/message')` directamente.
