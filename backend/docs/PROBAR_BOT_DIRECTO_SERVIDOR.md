# 🚀 PROBAR BOT DIRECTAMENTE DESDE EL SERVIDOR

## ✅ SOLUCIÓN INMEDIATA

**Probar el bot SIN necesidad de WhatsApp personal. Usar la API directamente desde el servidor.**

---

## 🎯 PASO 1: Ejecutar Script de Prueba

**Conectarse al servidor y ejecutar:**

```bash
ssh root@145.223.30.68
cd /var/www/automatizacion-ivan-pos-backend
npm run build
node dist/scripts/test-whatsapp-direct.js
```

**O si tenés TypeScript instalado:**

```bash
cd /var/www/automatizacion-ivan-pos-backend
npx ts-node scripts/test-whatsapp-direct.ts
```

---

## 🎯 PASO 2: Ver Resultado

**El script enviará un mensaje a tu número personal (+5491125522465).**

**Si funciona:**
- ✅ Verás "MENSAJE ENVIADO EXITOSAMENTE"
- ✅ Revisá tu WhatsApp personal, deberías recibir el mensaje
- ✅ El bot está funcionando correctamente

**Si NO funciona:**
- ❌ Verás el error específico
- ❌ Revisá los logs para más detalles

---

## 🔍 VERIFICAR CONFIGURACIÓN

**Antes de probar, verificar que esté todo configurado:**

```bash
ssh root@145.223.30.68
grep WHATSAPP /var/www/automatizacion-ivan-pos-backend/.env
```

**Debería mostrar:**
- `WHATSAPP_TOKEN=...` (no vacío)
- `WHATSAPP_PHONE_NUMBER_ID=867302179797652`

---

## ⚠️ IMPORTANTE

**Este script:**
- ✅ Prueba la API directamente (no necesita WhatsApp personal)
- ✅ Envía un mensaje REAL a tu número personal
- ✅ Verifica que el bot esté funcionando

**Si el mensaje llega a tu WhatsApp personal, el bot está funcionando correctamente.**

---

## 📞 SI NO FUNCIONA

**Verificar logs del servidor:**

```bash
pm2 logs chatbot-pos --lines 50
```

**Buscar errores relacionados con WhatsApp o la API de Meta.**

