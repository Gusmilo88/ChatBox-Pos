# ✅ VERIFICAR CONFIGURACIÓN FINAL

## 📋 ESTADO ACTUAL

### ✅ Lo que está funcionando:
- ✅ Servidor corriendo en `http://localhost:4000`
- ✅ Webhook de WhatsApp montado
- ✅ Outbox worker iniciado
- ✅ Firebase inicializado correctamente
- ✅ Phone Number ID configurado: `867302179797652`

### ⚠️ Problema detectado:
- ⚠️ Error de `bcrypt` (pero el servidor sigue funcionando)

---

## 🔧 PASO 1: Arreglar Error de bcrypt

**El error de bcrypt no debería afectar el bot, pero es mejor arreglarlo:**

```bash
cd /var/www/automatizacion-ivan-pos-backend
npm uninstall bcrypt
npm install bcrypt
npm rebuild bcrypt
pm2 restart chatbot-pos --update-env
```

---

## 🔍 PASO 2: Verificar Configuración

**Verificar que el Phone Number ID esté correcto:**

```bash
cd /var/www/automatizacion-ivan-pos-backend
grep WHATSAPP_PHONE_NUMBER_ID .env
```

**Debería mostrar:**
```
WHATSAPP_PHONE_NUMBER_ID=867302179797652
```

---

## 🧪 PASO 3: Probar el Bot

### Test 1: Verificar que el servidor responde

```bash
curl http://localhost:4000/api/health
```

**Debería responder:** `{"status":"ok"}` o similar

### Test 2: Enviar mensaje de prueba

1. Desde tu celular, enviar un mensaje al número: **+54 9 11 3762-3550**
2. El mensaje puede ser: "Hola"
3. El bot debería responder automáticamente

### Test 3: Verificar logs en tiempo real

```bash
pm2 logs chatbot-pos --lines 50
```

**Deberías ver:**
- Mensaje entrante procesado
- Respuesta generada
- Mensaje enviado

---

## ✅ CHECKLIST FINAL

- [ ] Arreglar error de bcrypt (opcional, no crítico)
- [ ] Verificar Phone Number ID en `.env`
- [ ] Probar que el servidor responde
- [ ] Enviar mensaje de prueba al número
- [ ] Verificar que el bot responde
- [ ] Verificar logs para confirmar funcionamiento

---

## 🎯 QUÉ FALTA (si algo no funciona)

### Si el bot NO responde:

1. **Verificar webhook en Meta:**
   - Ir a: https://developers.facebook.com/apps/
   - Seleccionar app "Automatizacion Pos"
   - WhatsApp → Configuración
   - Verificar que el webhook esté configurado: `https://api.posyasociados.com/api/webhook/whatsapp`
   - Verificar que el verify token sea correcto

2. **Verificar que el número esté asociado a la app:**
   - En WhatsApp Manager, verificar que el número esté en la cuenta correcta

3. **Verificar logs:**
   ```bash
   pm2 logs chatbot-pos --err --lines 50
   ```

### Si hay errores en los logs:

- **Error de autenticación:** Verificar `WHATSAPP_TOKEN` en `.env`
- **Error de webhook:** Verificar que el webhook esté configurado en Meta
- **Error de Firebase:** Ya está funcionando ✅

---

## 🎉 PRÓXIMOS PASOS

Una vez que el bot funcione:

1. **Probar todas las funcionalidades:**
   - Respuesta automática
   - Detección de cliente
   - Derivación automática
   - Respuestas de IA

2. **Configurar operadores:**
   - Agregar números de Belén, María, Iván al `.env`
   - Configurar palabras clave

3. **Cuando todo funcione:**
   - Cambiar al número final (+541131353729)
   - Configurar en producción

