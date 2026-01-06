# ✅ PROBAR EL BOT - PASOS FINALES

## 📋 ESTADO ACTUAL
- ✅ Servidor corriendo
- ✅ Phone Number ID configurado: `867302179797652`
- ✅ Número verificado: `+54 9 11 3762-3550`
- ✅ Firebase funcionando
- ✅ Webhook montado
- ⚠️ Error de bcrypt (no crítico, no afecta el bot)

---

## 🎯 PASO 1: Verificar Webhook en Meta

**El webhook debe estar configurado para que Meta envíe mensajes al servidor:**

1. Ir a: https://developers.facebook.com/apps/
2. Seleccionar app: **"Automatizacion Pos"**
3. En el menú lateral, click en **"WhatsApp"**
4. Click en **"Configuración"** o **"API Setup"**
5. Buscar sección **"Webhook"** o **"Configuración de webhook"**
6. Verificar que esté configurado:
   - **URL del webhook:** `https://api.posyasociados.com/api/webhook/whatsapp`
   - **Token de verificación:** El mismo que está en tu `.env` como `WHATSAPP_VERIFY_TOKEN`
7. Si NO está configurado:
   - Click en **"Configurar webhook"** o **"Edit"**
   - URL: `https://api.posyasociados.com/api/webhook/whatsapp`
   - Token: El mismo de tu `.env`
   - Suscribir a eventos: `messages`, `message_status`
   - Guardar

---

## 🎯 PASO 2: Probar el Bot

### Test 1: Enviar mensaje desde tu celular

1. Desde tu celular, abrir WhatsApp
2. Enviar un mensaje al número: **+54 9 11 3762-3550**
3. Mensaje de prueba: **"Hola"**
4. El bot debería responder automáticamente

### Test 2: Verificar logs en tiempo real

**En otra terminal del servidor:**

```bash
pm2 logs chatbot-pos --lines 100
```

**Deberías ver:**
- `whatsapp_webhook_received` - Mensaje recibido
- `whatsapp_message_processed` - Mensaje procesado
- `auto_reply_generated` - Respuesta generada
- `cloud_whatsapp_driver_sent` - Mensaje enviado

### Test 3: Verificar en el panel de administración

1. Ir a: https://app.posyasociados.com/login
2. Iniciar sesión
3. Verificar que aparezca la conversación
4. Verificar que el mensaje del bot esté ahí

---

## 🎯 PASO 3: Probar Funcionalidades

### Test de detección de cliente:

1. Enviar mensaje con un CUIT: **"Mi CUIT es 20123456786"**
2. El bot debería detectar que es cliente y responder acorde

### Test de derivación automática:

1. Enviar mensaje: **"Necesito ayuda con facturación"**
2. El bot debería derivar automáticamente (si está configurado)

### Test de IA:

1. Enviar mensaje: **"¿Qué servicios ofrecen?"**
2. El bot debería responder usando IA (si está configurada)

---

## 🎯 PASO 4: Verificar Configuración de Operadores

**Si querés probar la derivación automática:**

1. Editar `.env` en el servidor:
   ```bash
   nano .env
   ```

2. Agregar configuración de operadores (cuando tengas los números):
   ```env
   OPERATORS_CONFIG={"operators":[{"name":"Belén","phone":"+54911XXXX-XXXX","keywords":["factura","facturación"],"priority":10},{"name":"María","phone":"+54911YYYY-YYYY","keywords":["turno","consulta"],"priority":10},{"name":"Iván","phone":"+54911ZZZZ-ZZZZ","keywords":["urgente"],"priority":20,"default":true}]}
   ```

3. Reiniciar:
   ```bash
   pm2 restart chatbot-pos --update-env
   ```

---

## ✅ CHECKLIST FINAL

- [ ] Verificar webhook configurado en Meta
- [ ] Enviar mensaje de prueba al número
- [ ] Verificar que el bot responde
- [ ] Verificar logs para confirmar funcionamiento
- [ ] Probar detección de cliente
- [ ] Probar derivación automática (si está configurada)
- [ ] Verificar en panel de administración

---

## 🐛 SI EL BOT NO RESPONDE

### Verificar webhook:

1. Verificar que el webhook esté configurado en Meta
2. Verificar que la URL sea correcta: `https://api.posyasociados.com/api/webhook/whatsapp`
3. Verificar que el token de verificación coincida

### Verificar logs:

```bash
pm2 logs chatbot-pos --err --lines 50
```

**Buscar errores como:**
- Error de autenticación (verificar `WHATSAPP_TOKEN`)
- Error de webhook (verificar configuración en Meta)
- Error de envío (verificar Phone Number ID)

### Verificar configuración:

```bash
grep WHATSAPP .env
```

**Debería mostrar:**
- `WHATSAPP_TOKEN=...` (debe tener valor)
- `WHATSAPP_PHONE_NUMBER_ID=867302179797652`
- `WHATSAPP_VERIFY_TOKEN=...` (debe tener valor)

---

## 🎉 PRÓXIMOS PASOS DESPUÉS DE PROBAR

1. **Configurar operadores** (cuando tengas los números)
2. **Probar derivación automática**
3. **Ajustar respuestas del bot** (si es necesario)
4. **Cuando todo funcione:** Cambiar al número final (+541131353729)

---

## 📞 SI NECESITÁS AYUDA

**Si el bot no responde después de verificar todo:**
1. Verificar logs completos
2. Verificar webhook en Meta
3. Verificar que el número esté asociado a la app
4. Contactar si sigue sin funcionar

