# 🚀 PASOS FINALES - TIEMPOS REALES

## ⏱️ TIEMPO TOTAL ESTIMADO: 15-20 MINUTOS (una vez verificado)

---

## 📋 PASO 1: Agregar API Key de OpenAI (2 minutos)

**Cuándo hacerlo:** AHORA (antes de dormir o cuando quieras)

1. Ir a: https://platform.openai.com/api-keys
2. Crear nueva API key (si no tenés)
3. Copiar la key
4. En el VPS, editar `.env`:
   ```bash
   nano /var/www/automatizacion-ivan-pos-backend/.env
   ```
5. Agregar esta línea:
   ```
   OPENAI_API_KEY=sk-tu-key-aqui
   ```
6. Guardar (Ctrl+X, Y, Enter)
7. Reiniciar:
   ```bash
   pm2 restart chatbot-pos --update-env
   ```

**✅ Listo en 2 minutos**

---

## 📋 PASO 2: Verificar Estado del Número (1 minuto)

**Cuándo hacerlo:** Al despertar

1. Ir a: https://business.facebook.com/
2. WhatsApp Manager → Números de teléfono
3. Ver si el número que termina en **3550** dice:
   - ✅ **"Verificado"** → Seguir al Paso 3
   - ⏳ **"Pendiente"** → Esperar más (puede tardar 24-48 horas)
   - ❌ **"Rechazado"** → Contactar soporte de Meta

**✅ Verificación: 1 minuto**

---

## 📋 PASO 3: Obtener Phone Number ID Real (5-10 minutos)

**Cuándo hacerlo:** Cuando el número esté "Verificado"

### Opción A: Desde Meta for Developers (RECOMENDADO)

1. Ir a: https://developers.facebook.com/apps/
2. Seleccionar tu app "Automatizacion Pos"
3. WhatsApp → Configuración
4. Buscar sección **"Phone number"** o **"Número de teléfono"**
5. Ver el número que termina en **3550**
6. **Copiar el "Phone number ID"** (número largo, ej: `123456789012345`)

### Opción B: Desde Graph API Explorer (si no aparece)

1. Ir a: https://developers.facebook.com/tools/explorer/
2. Seleccionar tu app
3. Token: usar el token permanente que ya tenés
4. Query:
   ```
   /{WABA_ID}?fields=phone_numbers{id,display_phone_number,verified_name}
   ```
   (Reemplazar `{WABA_ID}` con `819576794391923`)
5. Buscar el número que termina en **3550** en la respuesta
6. **Copiar el "id"** (ese es el Phone Number ID)

**✅ Tiempo: 5-10 minutos**

---

## 📋 PASO 4: Actualizar .env en VPS (2 minutos)

**Cuándo hacerlo:** Inmediatamente después del Paso 3

1. Conectarse al VPS:
   ```bash
   ssh root@tu-vps
   ```

2. Editar `.env`:
   ```bash
   nano /var/www/automatizacion-ivan-pos-backend/.env
   ```

3. Buscar esta línea:
   ```
   WHATSAPP_PHONE_NUMBER_ID=819576794391923
   ```

4. Reemplazar con el Phone Number ID real que copiaste:
   ```
   WHATSAPP_PHONE_NUMBER_ID=el-id-real-que-copiaste
   ```

5. Guardar (Ctrl+X, Y, Enter)

**✅ Tiempo: 2 minutos**

---

## 📋 PASO 5: Reiniciar Backend (1 minuto)

**Cuándo hacerlo:** Inmediatamente después del Paso 4

```bash
pm2 restart chatbot-pos --update-env
pm2 logs chatbot-pos --lines 20
```

Verificar que no haya errores en los logs.

**✅ Tiempo: 1 minuto**

---

## 📋 PASO 6: Probar que Funciona (5 minutos)

**Cuándo hacerlo:** Inmediatamente después del Paso 5

1. Enviar un mensaje de WhatsApp al número que termina en **3550**
2. Verificar que:
   - ✅ El mensaje llegue al backend (revisar logs: `pm2 logs chatbot-pos`)
   - ✅ El bot responda automáticamente
   - ✅ Aparezca en el panel de administración

**✅ Tiempo: 5 minutos**

---

## 🎯 RESUMEN DE TIEMPOS

| Paso | Tiempo | Cuándo |
|------|--------|--------|
| 1. Agregar OpenAI API Key | 2 min | AHORA (opcional) |
| 2. Verificar estado número | 1 min | Al despertar |
| 3. Obtener Phone Number ID | 5-10 min | Cuando esté verificado |
| 4. Actualizar .env | 2 min | Inmediatamente después |
| 5. Reiniciar backend | 1 min | Inmediatamente después |
| 6. Probar | 5 min | Inmediatamente después |
| **TOTAL ACTIVO** | **15-20 min** | Una vez verificado |

---

## 🔄 MIGRAR AL NÚMERO FINAL (cuando quieras)

**Tiempo activo:** 15-20 minutos (mismo proceso)

**Proceso:**
1. Agregar el número final a Meta (si no está)
2. Esperar verificación (24-48 horas, automático)
3. Obtener Phone Number ID del número final (5-10 min)
4. Actualizar `.env` con el nuevo ID (2 min)
5. Reiniciar backend (1 min)
6. Probar (5 min)

**⚠️ IMPORTANTE:**
- Podés borrar el número de prueba (3550) después de migrar
- El límite es 2 números por cuenta, así que si querés agregar el final, primero borrá el de prueba
- La migración es solo cambiar el `WHATSAPP_PHONE_NUMBER_ID` en `.env`

---

## ✅ CHECKLIST FINAL

Antes de considerar "TERMINADO":

- [ ] OpenAI API Key agregada al `.env`
- [ ] Número verificado en Meta
- [ ] Phone Number ID real obtenido
- [ ] `.env` actualizado con Phone Number ID real
- [ ] Backend reiniciado con `--update-env`
- [ ] Prueba exitosa: mensaje recibido y respondido
- [ ] Panel de administración muestra la conversación
- [ ] IA responde correctamente (si agregaste la API key)

---

## 🆘 SI ALGO FALLA

### Error: "Invalid phone number ID"
- Verificar que el Phone Number ID sea el correcto
- Verificar que el número esté "Verificado" en Meta

### Error: "Webhook verification failed"
- Verificar que el webhook esté configurado en Meta
- Verificar que `WHATSAPP_VERIFY_TOKEN` coincida

### Error: "Message not sent"
- Verificar que el token de acceso tenga permisos
- Verificar que el número esté verificado
- Revisar logs: `pm2 logs chatbot-pos`

---

**Última actualización:** 22/12/2025
**Estado actual:** Esperando verificación del número (Pendiente)

