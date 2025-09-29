# Seguridad - Documentación

## Capas de Seguridad Implementadas

### 1. Autenticación JWT
- **Tokens de acceso**: 30 minutos de duración
- **Tokens de refresh**: 7 días de duración
- **Almacenamiento**: localStorage (frontend)
- **Verificación**: Middleware en todas las rutas protegidas

### 2. API Key Adicional
- **Header requerido**: `x-api-key`
- **Uso**: Endpoints sensibles (simulación, export)
- **Configuración**: `DASHBOARD_API_KEY` en .env

### 3. CORS Estricto
- **Dominios permitidos**: Solo los listados en `ALLOWED_ORIGINS`
- **Métodos**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization, x-api-key
- **Credentials**: Habilitado para cookies de sesión

### 4. Rate Limiting
- **Global**: 60 requests por minuto por IP
- **Mensajes**: 10 requests por minuto por IP+phone
- **Headers**: X-RateLimit-* en respuestas
- **Bloqueo**: 429 Too Many Requests

### 5. Validación de Entrada
- **Librería**: Zod
- **Validación**: Todos los endpoints
- **Sanitización**: Texto, teléfonos, emails
- **Errores**: 400 Bad Request con detalles

### 6. Helmet Security Headers
- **CSP**: Content Security Policy estricto
- **HSTS**: HTTP Strict Transport Security (6 meses)
- **X-Frame-Options**: DENY
- **X-Content-Type-Options**: nosniff
- **X-XSS-Protection**: 1; mode=block

### 7. Auditoría y Logging
- **PII Masking**: Teléfonos y CUIT enmascarados
- **Auditoría**: Colección `audit` en Firestore
- **Eventos**: login, logout, cambios de rol, acciones sensibles
- **Rotación**: Logs rotan automáticamente

## Configuración de Seguridad

### Variables de Entorno Críticas

```bash
# JWT Secrets (CAMBIAR EN PRODUCCIÓN)
JWT_SECRET=tu-jwt-secret-super-secreto-789
JWT_REFRESH_SECRET=tu-refresh-secret-super-secreto-101112

# API Keys (CAMBIAR EN PRODUCCIÓN)
API_KEY=tu-api-key-super-secreta-123
DASHBOARD_API_KEY=dashboard-api-key-456

# CORS (AJUSTAR SEGÚN DOMINIO)
ALLOWED_ORIGINS=http://localhost:5173,https://tu-dominio.com

# Rate Limiting
RATE_WINDOW_MS=60000
RATE_MAX=60
```

### Cambios Requeridos para Producción

1. **Generar secrets únicos**:
   ```bash
   # JWT secrets (64 caracteres)
   openssl rand -hex 32
   
   # API keys (32 caracteres)
   openssl rand -hex 16
   ```

2. **Configurar CORS para dominio real**:
   ```bash
   ALLOWED_ORIGINS=https://dashboard.tu-dominio.com
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
       match /{document=**} {
         allow read, write: if request.auth != null 
           && request.auth.token.role in ['owner', 'operador'];
       }
     }
   }
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
- Más de 10 intentos de login fallidos en 5 minutos
- Más de 100 requests bloqueados por rate limiting en 1 hora
- Uso de API key inválida
- Error 500 en endpoints de autenticación

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
