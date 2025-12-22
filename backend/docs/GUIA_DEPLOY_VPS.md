# Guía de Deploy: Backend en VPS con Nginx

## 📋 Requisitos Previos

- VPS con Linux (Ubuntu/Debian recomendado)
- Nginx instalado
- Node.js 18+ instalado
- Acceso SSH al servidor
- Dominio configurado (en este caso: `api.posyasociados.com`)

---

## 📋 Paso 1: Conectarse al VPS

```bash
ssh root@145.223.30.68
```

---

## 📋 Paso 2: Instalar Node.js (si no está instalado)

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verificar instalación
node --version
npm --version
```

---

## 📋 Paso 3: Instalar PM2 (Gestor de Procesos)

```bash
npm install -g pm2
```

PM2 mantendrá el backend corriendo y lo reiniciará automáticamente si se cae.

---

## 📋 Paso 4: Detener el Proceso Viejo (si existe)

**IMPORTANTE:** Si ya tenés una versión anterior del chatbot corriendo, detenela primero.

```bash
# Ver procesos en PM2
pm2 list

# Si ves "automatizacion-ivan-pos-backend" o similar, detenelo:
pm2 stop automatizacion-ivan-pos-backend

# Eliminarlo de PM2 (opcional, pero recomendado)
pm2 delete automatizacion-ivan-pos-backend

# Verificar que el puerto 4000 esté libre
netstat -tulpn | grep 4000
# Si no sale nada, el puerto está libre ✅
```

**Nota:** Si el proceso viejo NO está en PM2 pero está usando el puerto 4000, podés detenerlo así:

```bash
# Encontrar el PID del proceso
netstat -tulpn | grep 4000

# Detener el proceso (reemplazá PID con el número que aparezca)
kill PID

# O si no funciona, forzar
kill -9 PID
```

---

## 📋 Paso 5: Crear Directorio para la Aplicación

```bash
# Crear directorio (o usar el existente si querés reemplazar)
mkdir -p /var/www/chatbot-pos
cd /var/www/chatbot-pos
```

**Nota:** Si ya existe `/var/www/automatizacion-ivan-pos-backend` y querés reemplazarlo, podés:
- Usar ese directorio directamente, o
- Crear uno nuevo y eliminar el viejo después

---

## 📋 Paso 6: Subir el Código al Servidor

### Opción A: Usando Git (Recomendado)

```bash
# Si tenés el código en un repositorio Git
git clone https://tu-repositorio.git /var/www/chatbot-pos
cd /var/www/chatbot-pos/backend
```

### Opción B: Usando SCP desde tu máquina local

Desde tu máquina Windows (PowerShell):

```powershell
# Navegar a la carpeta del proyecto
cd "C:\Users\gus_e\OneDrive\Desktop\Proyectos\automatizacion pos"

# Subir el código (solo backend)
scp -r backend root@145.223.30.68:/var/www/chatbot-pos/
```

Luego en el servidor:

```bash
cd /var/www/chatbot-pos/backend
```

---

## 📋 Paso 7: Instalar Dependencias

```bash
cd /var/www/chatbot-pos/backend
npm install
```

---

## 📋 Paso 8: Compilar TypeScript

```bash
npm run build
```

Esto generará la carpeta `dist/` con el código JavaScript compilado.

---

## 📋 Paso 9: Configurar Variables de Entorno

```bash
# Crear archivo .env
nano .env
```

Pegá el contenido de tu `.env` local (con todas las variables configuradas):

```env
PORT=4000
NODE_ENV=production

# Firebase Configuration
USE_FIREBASE=prod
FIREBASE_PROJECT_ID=contabilidad-a9963
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@contabilidad-a9963.iam.gserviceaccount.com
BASE64_FIREBASE_KEY="tu_base64_key_aqui"

# CORS - IMPORTANTE: Actualizar con tu dominio
ALLOWED_ORIGINS=https://app.posyasociados.com,https://api.posyasociados.com
CORS_ORIGIN=https://app.posyasociados.com

# Security
PROTECT_API=1
API_KEY=tu-api-key-super-secreta-123
DASHBOARD_API_KEY=dashboard-api-key-456
RATE_WINDOW_MS=60000
RATE_MAX=60

# Session
SESSION_SECRET=tu-jwt-secret-super-secreto-789
JWT_SECRET=tu-jwt-secret-super-secreto-789
JWT_REFRESH_SECRET=tu-refresh-secret-super-secreto-101112
SESSION_COOKIE_NAME=chatbox_sess
SESSION_TTL_MINUTES=30
ALLOW_ORIGIN_DASHBOARD=https://app.posyasociados.com

# OpenAI
OPENAI_API_KEY=tu-openai-api-key
OPENAI_MODEL=gpt-4o-mini
AI_MAX_TOKENS=300
AI_TEMPERATURE=0.3

# WhatsApp
WHATSAPP_DRIVER=cloud
WHATSAPP_TOKEN=EAAL76IwgeuMBQZAfZCWUyNudZBUEiF6ElGObdPNtvF3KPo7ywfc0sBnsI51JhrfVfjBqkWTwD49ZAlD5GcO2WDlgW6s6lug8oig8JyicP8HAJkEcZArxvqzZBBqvPss2ggDrZBlsfRdA55VVtuayCdgml6r41mCXIMsnsKendf5oxZAf7pZC5Kzde0BAjP6bDTWqplECanmkmhcdxjTN21INSZAnUhjiCsvmb1VXeZAgk59ohYcnhjGPayVos9OglSMXmtR6jxf1AmGnIJKsWkF3JuMSAZDZD
WHATSAPP_PHONE_NUMBER_ID=854224223995823
WHATSAPP_VERIFY_TOKEN=mi_token_secreto_whatsapp_2025_pos

# Outbox
OUTBOX_POLL_INTERVAL_MS=3000
OUTBOX_BATCH_SIZE=10

# Files
LEADS_FILE=./data/base_noclientes.xlsx
```

**Guardar:** `Ctrl + O`, luego `Enter`, luego `Ctrl + X`

---

## 📋 Paso 10: Subir Archivos Necesarios

### Subir el archivo de Firebase (si es necesario)

```bash
# Crear directorio secrets
mkdir -p /var/www/chatbot-pos/backend/secrets

# Desde tu máquina local (PowerShell):
# scp backend/secrets/contabilidad-a9963-firebase-adminsdk-fbsvc-7f4f045372.json root@145.223.30.68:/var/www/chatbot-pos/backend/secrets/
```

### Subir el archivo de clientes (si es necesario)

```bash
# Crear directorio data
mkdir -p /var/www/chatbot-pos/backend/data

# Desde tu máquina local (PowerShell):
# scp backend/data/base_noclientes.xlsx root@145.223.30.68:/var/www/chatbot-pos/backend/data/
```

---

## 📋 Paso 11: Iniciar la Aplicación con PM2

```bash
cd /var/www/chatbot-pos/backend

# Iniciar la aplicación
pm2 start dist/index.js --name chatbot-pos

# Si querés reemplazar el nombre viejo, podés usar:
# pm2 start dist/index.js --name automatizacion-ivan-pos-backend --update-env

# Verificar que esté corriendo
pm2 status

# Ver logs
pm2 logs chatbot-pos

# Configurar PM2 para iniciar automáticamente al reiniciar el servidor
pm2 startup
pm2 save
```

---

## 📋 Paso 12: Configurar Nginx

### Crear configuración de Nginx

```bash
nano /etc/nginx/sites-available/chatbot-pos
```

Pegá esta configuración:

```nginx
server {
    listen 80;
    server_name api.posyasociados.com;

    # Redirigir HTTP a HTTPS (después de configurar SSL)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout para webhooks de Meta (pueden tardar)
        proxy_read_timeout 30s;
        proxy_connect_timeout 30s;
    }
}
```

**Guardar:** `Ctrl + O`, luego `Enter`, luego `Ctrl + X`

### Habilitar el sitio

```bash
# Crear enlace simbólico
ln -s /etc/nginx/sites-available/chatbot-pos /etc/nginx/sites-enabled/

# Verificar configuración de Nginx
nginx -t

# Recargar Nginx
systemctl reload nginx
```

---

## 📋 Paso 13: Configurar DNS

En tu panel de DNS (donde compraste el dominio), agregá un registro:

- **Tipo:** A
- **Nombre:** `api` (o `@` si querés el dominio raíz)
- **Valor:** `145.223.30.68`
- **TTL:** 3600 (o el que prefieras)

Esperá unos minutos a que se propague el DNS.

---

## 📋 Paso 14: Configurar SSL (HTTPS) con Let's Encrypt

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
certbot --nginx -d api.posyasociados.com

# Seguir las instrucciones en pantalla
# Certbot modificará automáticamente la configuración de Nginx
```

Después de esto, descomentá la línea de redirección HTTP a HTTPS en la configuración de Nginx:

```bash
nano /etc/nginx/sites-available/chatbot-pos
```

Descomentá esta línea:
```nginx
return 301 https://$server_name$request_uri;
```

Recargá Nginx:
```bash
systemctl reload nginx
```

---

## 📋 Paso 15: Verificar que Todo Funcione

### Probar el endpoint de health

```bash
curl http://localhost:4000/health
```

O desde tu navegador:
```
https://api.posyasociados.com/health
```

Deberías recibir una respuesta JSON con el estado del servidor.

---

## 📋 Paso 16: Configurar Webhook en Meta

Ahora que tu servidor está en producción:

1. Ve a: https://developers.facebook.com/apps/
2. Selecciona tu app de WhatsApp
3. Ve a: **WhatsApp** → **Configuración**
4. Busca la sección **"Suscribirse a webhooks"**
5. Completa:
   - **URL de devolución de llamada:** `https://api.posyasociados.com/api/webhook/whatsapp`
   - **Identificador de verificación:** `mi_token_secreto_whatsapp_2025_pos`
6. Click en **"Verificar y guardar"**
7. Meta debería verificar automáticamente ✅

---

## 📋 Comandos Útiles

### Ver logs del backend
```bash
pm2 logs chatbot-pos
```

### Reiniciar el backend
```bash
pm2 restart chatbot-pos
```

### Detener el backend
```bash
pm2 stop chatbot-pos
```

### Ver estado
```bash
pm2 status
```

### Ver logs de Nginx
```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### Recargar Nginx después de cambios
```bash
systemctl reload nginx
```

---

## 🔧 Solución de Problemas

### El backend no inicia:
- Verifica los logs: `pm2 logs chatbot-pos`
- Verifica que el `.env` esté correcto
- Verifica que el puerto 4000 no esté ocupado: `netstat -tulpn | grep 4000`

### Nginx da error 502:
- Verifica que el backend esté corriendo: `pm2 status`
- Verifica que el backend escuche en `localhost:4000`
- Revisa los logs de Nginx: `tail -f /var/log/nginx/error.log`

### El webhook no se verifica:
- Verifica que la URL sea accesible desde internet
- Verifica que el `WHATSAPP_VERIFY_TOKEN` sea correcto
- Revisa los logs del backend: `pm2 logs chatbot-pos`

### No llegan mensajes:
- Verifica que el webhook esté suscrito a "messages" en Meta
- Revisa los logs del backend
- Verifica que el `WHATSAPP_TOKEN` no haya expirado

---

## ✅ Checklist Final

- [ ] Node.js instalado
- [ ] PM2 instalado
- [ ] Código subido al servidor
- [ ] Dependencias instaladas (`npm install`)
- [ ] Código compilado (`npm run build`)
- [ ] `.env` configurado correctamente
- [ ] Backend corriendo con PM2
- [ ] Nginx configurado
- [ ] DNS configurado (api.posyasociados.com)
- [ ] SSL configurado (HTTPS)
- [ ] Webhook configurado en Meta
- [ ] Webhook verificado en Meta ✅
- [ ] Prueba de mensaje enviada y recibida

---

**¡Listo! Tu backend debería estar funcionando en producción.** 🚀

