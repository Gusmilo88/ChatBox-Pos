# Dashboard API - Documentación

## Endpoints

### Autenticación
- `POST /auth/login` - Iniciar sesión
- `POST /auth/refresh` - Renovar token
- `GET /auth/me` - Información del usuario actual
- `POST /auth/logout` - Cerrar sesión

### Conversaciones
- `GET /api/conversations` - Listar conversaciones (requiere auth)
- `GET /api/conversations/:id` - Obtener conversación (requiere auth)
- `POST /api/conversations/:id/reply` - Enviar respuesta (requiere auth)

### Simulación
- `POST /api/simulate/incoming` - Simular mensaje entrante (requiere API key)

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
# JWT
JWT_SECRET=tu-jwt-secret-super-secreto-789
JWT_REFRESH_SECRET=tu-refresh-secret-super-secreto-101112
JWT_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d

# API Keys
API_KEY=tu-api-key-super-secreta-123
DASHBOARD_API_KEY=dashboard-api-key-456

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://tu-dominio.com

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

### 1. Crear Admin Inicial

```bash
# Usar el script de seed que crea admin@pos.com / admin123
npm run seed:conversations
```

### 2. Simular Mensaje

```bash
# Simular mensaje entrante
npm run simulate:one "+5491151093439" "Hola, necesito ayuda"
```

### 3. Crear Datos de Prueba

```bash
# Crear 50 conversaciones de ejemplo
npm run seed:conversations
```

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
