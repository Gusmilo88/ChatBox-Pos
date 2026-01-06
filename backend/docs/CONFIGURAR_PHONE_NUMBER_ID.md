# ✅ CONFIGURAR PHONE NUMBER ID EN EL SERVIDOR

## 📋 DATOS OBTENIDOS
- ✅ **Phone Number ID:** `867302179797652`
- ✅ **Número:** `+54 9 11 3762-3550`
- ✅ **Estado:** `VERIFIED` ✅

---

## 🎯 PASO 1: Conectarse al VPS

1. Conectarse por SSH al servidor
2. Navegar al directorio del backend:
   ```bash
   cd /var/www/automatizacion-ivan-pos-backend
   ```

---

## 🎯 PASO 2: Editar el archivo `.env`

1. Abrir el archivo `.env`:
   ```bash
   nano .env
   ```

2. Buscar la línea que dice:
   ```
   WHATSAPP_PHONE_NUMBER_ID=
   ```

3. Reemplazar con:
   ```
   WHATSAPP_PHONE_NUMBER_ID=867302179797652
   ```

4. **Guardar:**
   - Presionar `Ctrl + X`
   - Presionar `Y` (para confirmar)
   - Presionar `Enter` (para guardar)

---

## 🎯 PASO 3: Reiniciar el servidor

1. Reiniciar PM2 con las nuevas variables:
   ```bash
   pm2 restart chatbot-pos --update-env
   ```

2. Verificar que esté corriendo:
   ```bash
   pm2 status
   ```

3. Ver logs para confirmar:
   ```bash
   pm2 logs chatbot-pos --lines 20
   ```

---

## 🎯 PASO 4: Probar el bot

1. Desde tu celular, enviar un mensaje al número: **+54 9 11 3762-3550**
2. El bot debería responder automáticamente
3. Verificar en los logs que el mensaje se procesó correctamente

---

## ✅ CHECKLIST

- [ ] Conectarse al VPS
- [ ] Editar `.env` y agregar `WHATSAPP_PHONE_NUMBER_ID=867302179797652`
- [ ] Guardar el archivo
- [ ] Reiniciar PM2 con `--update-env`
- [ ] Verificar que el servidor esté corriendo
- [ ] Enviar mensaje de prueba al número
- [ ] Verificar que el bot responda

---

## 🎉 ¡LISTO!

Una vez configurado, el bot debería funcionar perfectamente con el número verificado.

**Próximos pasos:**
- Probar el bot con mensajes reales
- Verificar que la derivación automática funcione
- Cuando todo esté probado, cambiar al número final (+541131353729)

