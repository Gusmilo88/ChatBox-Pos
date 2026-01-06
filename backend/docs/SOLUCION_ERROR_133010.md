# 🚨 SOLUCIÓN: Error 133010 "Account not registered"

## 🔴 PROBLEMA

El error `(#133010) Account not registered` significa que el número **NO está registrado correctamente** en la API de WhatsApp Business.

---

## ✅ SOLUCIÓN 1: Verificar que el Número Esté en la App Correcta

1. Ir a: https://developers.facebook.com/apps/839926155344611/whatsapp-business/phone-numbers/
2. Verificar que el número **+54 9 11 3762-3550** aparezca en la lista
3. Si NO aparece:
   - Click en **"Añadir número de teléfono"** o **"Add phone number"**
   - Seleccionar el número **+54 9 11 3762-3550**
   - Seguir las instrucciones

---

## ✅ SOLUCIÓN 2: Verificar WhatsApp Business Account ID

1. Ir a: https://developers.facebook.com/apps/839926155344611/whatsapp-business/configuration/
2. Buscar **"WhatsApp Business Account ID"** o **"WABA ID"**
3. Debería ser: **819576794391923**
4. Verificar que esté correcto

---

## ✅ SOLUCIÓN 3: Verificar que el Número Esté Conectado a la App

1. Ir a: https://business.facebook.com/wa/manage/phone-numbers
2. Click en el número **+54 9 11 3762-3550**
3. Verificar que esté asociado a la app **"Automatizacion Pos"**
4. Si NO está asociado:
   - Buscar opción **"Conectar a app"** o **"Connect to app"**
   - Seleccionar la app **"Automatizacion Pos"**

---

## ✅ SOLUCIÓN 4: Usar el Número Final (TEMPORAL)

**Si el número de prueba no funciona, usar el número final temporalmente:**

1. Obtener Phone Number ID del número final (+541131353729):
   - Ir a: https://developers.facebook.com/tools/explorer/
   - Query: `/819576794391923?fields=phone_numbers{id,display_phone_number}`
   - Buscar el número **+541131353729**
   - Copiar el `id`

2. Actualizar `.env`:
   ```bash
   nano /var/www/automatizacion-ivan-pos-backend/.env
   ```
   Cambiar:
   ```env
   WHATSAPP_PHONE_NUMBER_ID=el_id_del_numero_final
   ```

3. Reiniciar:
   ```bash
   pm2 restart chatbot-pos --update-env
   ```

4. Probar:
   ```bash
   node test-whatsapp-simple.js
   ```

---

## 🎯 VERIFICAR CONFIGURACIÓN COMPLETA

**Ejecutar esto para verificar todo:**

```bash
ssh root@145.223.30.68
cd /var/www/automatizacion-ivan-pos-backend

# Verificar variables
grep WHATSAPP .env

# Verificar que el servidor esté corriendo
pm2 status

# Verificar logs
pm2 logs chatbot-pos --lines 20
```

---

## ⚠️ IMPORTANTE

**El número pendiente puede tener limitaciones. Si necesitás probar YA:**

1. **Usar el número final temporalmente** (Solución 4)
2. **O esperar a que se verifique el número de prueba** (puede tardar más)

