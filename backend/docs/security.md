# Seguridad - Documentación

## Capas de Seguridad Implementadas

### 1. Autenticación por Sesión con Cookies
- **Tipo**: JWT firmado con SESSION_SECRET
- **Almacenamiento**: Cookie HttpOnly (no accesible desde JavaScript)
- **Duración**: 30 minutos (configurable via SESSION_TTL_MINUTES)
- **Seguridad**: HttpOnly, Secure, SameSite=Strict
- **Verificación**: Middleware `requireSession` en todas las rutas /api/*

### 2. Autenticación de Administradores
- **Base de datos**: Colección `admins` en Firestore
- **Password**: Hash bcrypt (12 rounds)
- **Roles**: `owner` | `operador`
- **Validación**: Email válido, password mínimo 8 caracteres
- **Rate limiting**: 5 intentos por 15 minutos por IP

### 3. API Key Adicional
- **Header requerido**: `x-api-key`
- **Uso**: Endpoints sensibles (simulación, export)
- **Configuración**: `DASHBOARD_API_KEY` en .env

### 4. CORS Estricto
- **Dominios permitidos**: Solo `ALLOW_ORIGIN_DASHBOARD`
- **Métodos**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization, x-api-key
- **Credentials**: Habilitado para cookies de sesión

### 5. Rate Limiting
- **Global**: 60 requests por minuto por IP
- **Login**: 5 intentos por 15 minutos por IP
- **Mensajes**: 10 requests por minuto por IP+phone
- **Headers**: X-RateLimit-* en respuestas
- **Bloqueo**: 429 Too Many Requests

### 6. Validación de Entrada
- **Librería**: Zod
- **Login**: Email válido, password mínimo 8 caracteres
- **Otros endpoints**: Validación específica por endpoint
- **Sanitización**: Texto, teléfonos, emails
- **Errores**: 400 Bad Request con detalles

### 7. Helmet Security Headers
- **CSP**: Content Security Policy estricto
- **HSTS**: HTTP Strict Transport Security (6 meses)
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **X-XSS-Protection**: 1; mode=block

### 8. Auditoría y Logging
- **PII Masking**: Teléfonos y CUIT enmascarados
- **No logging**: Emails completos ni passwords en logs
- **Auditoría**: Colección `audit` en Firestore
- **Eventos**: login, logout, intentos fallidos, acciones sensibles
- **Rotación**: Logs rotan automáticamente

### 9. Middleware de Roles
- **requireSession**: Valida sesión en todas las rutas /api/*
- **requireRole**: Restringe acceso por roles específicos
- **Uso**: `requireRole(['owner'])` para endpoints admin-only

## Configuración de Seguridad

### Variables de Entorno Críticas

```bash
# Firebase (CAMBIAR EN PRODUCCIÓN)
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# Sesión (CAMBIAR EN PRODUCCIÓN)
SESSION_SECRET=tu-session-secret-super-secreto-64-caracteres-minimo
SESSION_COOKIE_NAME=chatbox_sess
SESSION_TTL_MINUTES=30

# API Keys (CAMBIAR EN PRODUCCIÓN)
DASHBOARD_API_KEY=tu-dashboard-api-key-super-secreta-32-caracteres

# CORS (AJUSTAR SEGÚN DOMINIO)
ALLOW_ORIGIN_DASHBOARD=http://localhost:5173
# Para producción: ALLOW_ORIGIN_DASHBOARD=https://dashboard.tu-dominio.com

# Rate Limiting
RATE_WINDOW_MS=60000
RATE_MAX=60
```

### Scripts de Administración

1. **Migrar passwords existentes**:
   ```bash
   cd backend
   npm run admin:migrate
   ```
   - Convierte passwords en texto plano a hash bcrypt
   - Normaliza emails a minúsculas
   - Elimina campo `pass` original

2. **Crear nuevo administrador**:
   ```bash
   cd backend
   npm run admin:add -- --email=admin@empresa.com --password=miPassword123 --role=owner
   ```

3. **Estructura de admin en Firestore**:
   ```javascript
   // admins/{adminId}
   {
     email: "admin@empresa.com",           // único, minúsculas
     passwordHash: "$2b$12$...",           // bcrypt hash
     role: "owner",                        // "owner" | "operador"
     createdAt: Timestamp,
     lastLoginAt: Timestamp,               // opcional
     isActive: true
   }
   ```

### Cambios Requeridos para Producción

1. **Generar secrets únicos**:
   ```bash
   # Session secret (64 caracteres)
   openssl rand -hex 32
   
   # API keys (32 caracteres)
   openssl rand -hex 16
   ```

2. **Configurar CORS para dominio real**:
   ```bash
   ALLOW_ORIGIN_DASHBOARD=https://dashboard.tu-dominio.com
   ```

3. **Configurar HTTPS**:
   - Certificado SSL válido
   - Redirect HTTP → HTTPS
   - HSTS habilitado

4. **Configurar Firestore Rules**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Solo admins autenticados pueden leer/escribir
       match /admins/{adminId} {
         allow read, write: if request.auth != null 
           && request.auth.token.role in ['owner', 'operador'];
       }
       
       match /conversations/{conversationId} {
         allow read, write: if request.auth != null;
       }
       
       match /audit/{auditId} {
         allow read: if request.auth != null;
         allow write: if false; // Solo el backend puede escribir
       }
     }
   }
   ```

## Flujo de Autenticación

### 1. Login
```
POST /auth/login
Body: { email: string, password: string }

Validaciones:
- Email válido (Zod)
- Password mínimo 8 caracteres (Zod)
- Rate limit: 5 intentos/15 min por IP
- Email normalizado a minúsculas
- Password verificado con bcrypt.compare()

Respuesta exitosa:
- Cookie HttpOnly con JWT firmado
- TTL: 30 minutos
- { ok: true, user: { email, role } }

Respuesta fallida:
- 401: Credenciales inválidas
- 429: Rate limit excedido
- 400: Datos inválidos
```

### 2. Verificación de Sesión
```
GET /auth/me

Middleware: requireSession
- Lee cookie HttpOnly
- Verifica JWT con SESSION_SECRET
- Valida expiración
- Adjunta req.user = { adminId, email, role }

Respuesta:
- 200: { email, role }
- 401: No autenticado/Sesión inválida
```

### 3. Protección de Rutas
```
Todas las rutas /api/* requieren:
- Middleware: requireSession
- Cookie válida con JWT
- Usuario activo en Firestore

Rutas con roles específicos:
- requireRole(['owner']) - Solo owners
- requireRole(['owner', 'operador']) - Owners y operadores
```

### 4. Logout
```
POST /auth/logout

Middleware: requireSession
- Limpia cookie HttpOnly
- Respuesta: { ok: true }

Efecto:
- Cookie expirada inmediatamente
- Próxima request a /api/* → 401
```

## Monitoreo de Seguridad

### Logs de Seguridad
- **Rate limiting**: IPs bloqueadas
- **Autenticación fallida**: Intentos de login
- **API key inválida**: Requests con key incorrecta
- **CORS bloqueado**: Origins no permitidos

### Métricas Recomendadas
- Intentos de login fallidos por IP
- Requests bloqueados por rate limiting
- Uso de API keys por endpoint
- Tiempo de respuesta de autenticación

### Alertas Recomendadas
- Más de 5 intentos de login fallidos por IP en 15 minutos
- Más de 100 requests bloqueados por rate limiting en 1 hora
- Uso de API key inválida
- Error 500 en endpoints de autenticación
- Sesiones expiradas frecuentemente (posible problema de TTL)
- Intentos de acceso a rutas protegidas sin sesión

## Mejores Prácticas

### Desarrollo
- Nunca commitear .env o credenciales
- Usar secrets diferentes para dev/prod
- Rotar API keys regularmente
- Monitorear logs de seguridad

### Producción
- Usar secret manager (AWS Secrets Manager, Azure Key Vault)
- Implementar WAF (Web Application Firewall)
- Configurar alertas de seguridad
- Auditoría regular de accesos

### Backup y Recuperación
- Backup cifrado de Firestore
- Backup de logs de auditoría
- Plan de recuperación de secrets
- Documentación de procedimientos de emergencia

## Incidentes de Seguridad

### Procedimiento de Respuesta
1. **Identificar**: Revisar logs de seguridad
2. **Contener**: Bloquear IPs/usuarios comprometidos
3. **Eradicar**: Rotar secrets comprometidos
4. **Recuperar**: Restaurar desde backups
5. **Documentar**: Registrar lecciones aprendidas

### Contactos de Emergencia
- **Admin Principal**: [email]
- **DevOps**: [email]
- **Seguridad**: [email]

## Checklist de Seguridad

### Pre-Deploy
- [ ] Secrets únicos generados
- [ ] CORS configurado correctamente
- [ ] Rate limiting ajustado
- [ ] Firestore rules actualizadas
- [ ] HTTPS configurado
- [ ] Logs de auditoría funcionando

### Post-Deploy
- [ ] Monitoreo activo
- [ ] Alertas configuradas
- [ ] Backup funcionando
- [ ] Tests de seguridad ejecutados
- [ ] Documentación actualizada
