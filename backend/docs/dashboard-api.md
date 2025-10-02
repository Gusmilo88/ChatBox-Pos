# Dashboard API - Documentación

## Endpoints

### Autenticación
- `POST /auth/login` - Iniciar sesión con email/password
- `GET /auth/me` - Información del usuario actual
- `POST /auth/logout` - Cerrar sesión

### Conversaciones
- `GET /api/conversations` - Listar conversaciones (requiere auth)
- `GET /api/conversations/:id` - Obtener conversación (requiere auth)
- `POST /api/conversations/:id/reply` - Enviar respuesta manual (requiere auth)

### Simulación
- `POST /api/simulate/incoming` - Simular mensaje entrante (requiere API key)

## Flujo de Envío de Mensajes

### 1. Envío Manual desde Dashboard
```
POST /api/conversations/:id/reply
Body: { text: string, idempotencyKey?: string }

Proceso:
1. Validar sesión y datos
2. Agregar mensaje a conversación (optimista)
3. Crear item en outbox con status='pending'
4. Responder 202 Accepted
```

### 2. Worker de Outbox
```
Comando: npm run worker:outbox

Proceso:
1. Poll cada 3 segundos por mensajes pending
2. Procesar hasta 10 mensajes por batch
3. Usar driver mock (simula envío a WhatsApp)
4. Actualizar status: pending → sent/failed
5. Backoff exponencial para reintentos
```

### 3. Estados de Entrega
- **pending**: Mensaje en cola, esperando envío
- **sent**: Enviado exitosamente
- **failed**: Falló después de 5 intentos

## Índices Firestore Requeridos

### Colección `conversations`
```javascript
// Índice simple
lastMessageAt (desc)

// Índice compuesto
isClient (asc), lastMessageAt (desc)
needsReply (asc), lastMessageAt (desc)
isClient (asc), needsReply (asc), lastMessageAt (desc)
```

### Colección `messages` (subcolección de conversations)
```javascript
// Índice simple
ts (asc)
```

### Colección `outbox`
```javascript
// Índice simple
status (asc), createdAt (asc)
conversationId (asc), createdAt (asc)
```

### Colección `admins`
```javascript
// Índice simple
email (asc)
```

### Colección `audit`
```javascript
// Índice simple
timestamp (desc)
userId (asc), timestamp (desc)
action (asc), timestamp (desc)
```

## Crear Índices Automáticamente

Si Firestore devuelve un error de índice faltante, seguir el enlace proporcionado en el error para crear el índice automáticamente.

Ejemplo de error:
```
The query requires an index. You can create it here: 
https://console.firebase.google.com/v1/r/project/contabilidad-a9963/firestore/indexes?create_composite=...
```

## Seguridad

### Variables de Entorno Requeridas

```bash
# Firebase
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Sesión
SESSION_SECRET=tu-session-secret-super-secreto-64-caracteres-minimo
SESSION_COOKIE_NAME=chatbox_sess
SESSION_TTL_MINUTES=30

# API Keys
DASHBOARD_API_KEY=tu-dashboard-api-key-super-secreta-32-caracteres

# CORS
ALLOW_ORIGIN_DASHBOARD=http://localhost:5173

# Worker de Outbox
OUTBOX_POLL_INTERVAL_MS=3000
OUTBOX_BATCH_SIZE=10
WHATSAPP_DRIVER=mock

# Rate Limiting
RATE_WINDOW_MS=60000
RATE_MAX=60
```

### Middlewares de Seguridad

1. **Helmet**: Headers de seguridad, CSP, HSTS
2. **CORS**: Solo dominios permitidos
3. **Rate Limiting**: 60 req/min global, 10 req/min para mensajes
4. **JWT Auth**: Tokens de acceso (30min) y refresh (7 días)
5. **API Key**: Para endpoints sensibles
6. **Validación**: Zod para todos los inputs
7. **Auditoría**: Log de todas las acciones

### Roles

- **owner**: Acceso completo, puede crear otros admins
- **operador**: Acceso limitado, solo conversaciones

## Uso

### 1. Iniciar Servicios

```bash
# Terminal 1: Backend API
npm run dev

# Terminal 2: Worker de Outbox
npm run worker:outbox

# Terminal 3: Frontend (opcional)
cd ../frontend && npm run dev
```

### 2. Crear Admin

```bash
# Crear administrador
npm run admin:add -- --email=admin@test.com --password=password123 --role=owner
```

### 3. Simular Mensaje

```bash
# Simular mensaje entrante
npm run simulate:one "+5491151093439" "Hola, necesito ayuda"
```

### 4. Crear Datos de Prueba

```bash
# Crear conversaciones de ejemplo
npm run seed:conversations
```

## Scripts Disponibles

- `npm run dev` - Iniciar backend en modo desarrollo
- `npm run worker:outbox` - Iniciar worker de outbox
- `npm run admin:add` - Crear nuevo administrador
- `npm run admin:migrate` - Migrar passwords a bcrypt
- `npm run seed:conversations` - Crear datos de prueba
- `npm run simulate:one` - Simular mensaje entrante

## Monitoreo

### Logs
- Todos los logs incluyen contexto y PII enmascarado
- Logs de auditoría en colección `audit`
- Rotación automática de logs

### Métricas
- Rate limiting por IP
- Contadores de mensajes por conversación
- Tiempo de respuesta de endpoints

## Troubleshooting

### Error de Índice Faltante
1. Copiar URL del error de Firestore
2. Abrir en navegador
3. Crear índice automáticamente
4. Esperar 2-3 minutos para que se propague

### Error de Autenticación
1. Verificar JWT_SECRET en .env
2. Verificar que el token no haya expirado
3. Verificar que el usuario exista en Firestore

### Error de CORS
1. Verificar ALLOWED_ORIGINS en .env
2. Verificar que el frontend esté en el dominio correcto
3. Verificar headers de la request
