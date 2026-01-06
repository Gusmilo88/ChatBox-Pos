# 📱 Guía Completa: Verificación y Activación de WhatsApp Cloud API

**Fecha de creación:** 3 de Enero 2026  
**Última actualización:** 3 de Enero 2026  
**Estado:** ✅ Proceso validado y funcionando

---

## 🎯 Objetivo

Documentar el proceso real de verificación y activación de un número de WhatsApp usando WhatsApp Cloud API (Meta), incluyendo errores encontrados y cómo se resolvieron. Esta guía sirve como referencia para futuras migraciones de números, evitando bloqueos, demoras y errores de configuración.

---

## 📌 1. Problema Inicial

### Síntomas observados:

1. **Estado "Pendiente"**: El número aparecía como "Pendiente" en WhatsApp Cloud API Manager
2. **Error al enviar mensajes**: Al intentar enviar mensajes desde la API se recibía:
   ```
   (#133010) Account not registered
   ```
3. **BSP incorrecto**: Meta indicaba que la cuenta estaba gestionada por un BSP (360dialog), aun cuando el código no usaba 360dialog
4. **Webhook sin eventos**: El webhook no recibía mensajes reales desde WhatsApp, aunque funcionaba correctamente en `/api/simulate/message`

---

## 🔍 2. Causa Raíz Identificada

### Problemas encontrados:

1. **BSP bloqueando control**: El Business Manager tenía a 360dialog como socio activo, lo que bloqueaba el control directo del número desde Cloud API
2. **WABA no suscrita**: El número estaba registrado, pero la WABA (WhatsApp Business Account) no estaba correctamente suscrita a la app
3. **Webhook sin suscripción**: El webhook estaba bien configurado técnicamente, pero Meta no enviaba eventos porque la app no estaba asociada a la cuenta WhatsApp
4. **Modo desarrollo**: El número estaba en modo desarrollo, por lo que no entregaba mensajes reales a usuarios no verificados

---

## ✅ 3. Soluciones Aplicadas (en orden)

### A. Eliminación del BSP (360dialog)

**Problema:** El Business Manager tenía a 360dialog como socio activo, bloqueando el control directo.

**Solución:**

1. Ir a **Business Manager** → **Socios** (Partners)
2. Buscar **360dialog** en la lista
3. Eliminar/Remover el socio
4. Confirmar la eliminación

**Resultado:** Esto liberó el control del número para usar Cloud API directo.

**⚠️ Importante:** Si el número está asociado a un BSP, Meta no permite control directo desde Cloud API. Debe eliminarse primero.

---

### B. Verificación correcta del webhook

**Problema:** El webhook no estaba correctamente configurado o verificado.

**Solución:**

1. **Configurar el endpoint del webhook:**
   - URL: `https://tu-dominio.com/api/webhook/whatsapp`
   - Método: `GET` (para verificación) y `POST` (para eventos)

2. **Configurar el Verify Token:**
   - Variable de entorno: `WHATSAPP_VERIFY_TOKEN`
   - Debe coincidir con el token configurado en Meta

3. **Verificar en Meta:**
   - Ir a **Meta for Developers** → Tu App → **WhatsApp** → **Configuración**
   - En "Webhook", hacer clic en **"Verificar y guardar"**
   - Meta enviará un challenge GET con:
     - `hub.mode=subscribe`
     - `hub.verify_token=<TU_TOKEN>`
     - `hub.challenge=<RANDOM_STRING>`
   - El backend debe responder con `hub.challenge`

4. **Confirmar verificación:**
   - Buscar en logs: `whatsapp_webhook_verified`
   - En Meta debe aparecer: ✅ "Webhook verificado"

**Código de ejemplo (backend):**

```typescript
// GET /api/webhook/whatsapp
router.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('whatsapp_webhook_verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});
```

**Resultado:** Meta confirmó la verificación del webhook.

---

### C. Suscripción de la app a la WABA (PASO CLAVE) ⚠️

**Problema:** La app no estaba suscrita a la WABA, por lo que Meta no enviaba eventos al webhook.

**⚠️ Este es el paso MÁS IMPORTANTE y el que más se olvida.**

**Solución:**

1. **Obtener el WABA ID:**
   ```bash
   curl -G "https://graph.facebook.com/v19.0/me/businesses" \
     --data-urlencode "access_token=$TOKEN"
   ```
   O desde Meta for Developers → Tu App → WhatsApp → Configuración

2. **Suscripción de la app a la WABA:**
   ```bash
   curl -X POST "https://graph.facebook.com/v19.0/{WABA_ID}/subscribed_apps" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

   **Respuesta esperada:**
   ```json
   {
     "success": true
   }
   ```

3. **Verificar la suscripción:**
   ```bash
   curl -G "https://graph.facebook.com/v19.0/{WABA_ID}/subscribed_apps" \
     --data-urlencode "access_token=$TOKEN"
   ```

   **Respuesta esperada:**
   ```json
   {
     "data": [
       {
         "id": "{APP_ID}",
         "name": "Automatizacion Pos"
       }
     ]
   }
   ```

**⚠️ Sin este paso, Meta NO envía mensajes al webhook aunque el número esté verificado.**

**Resultado:** La app quedó asociada a la WABA y Meta comenzó a enviar eventos.

---

### D. Prueba de envío desde Cloud API

**Problema:** Necesitábamos confirmar que el token y el número estaban funcionando.

**Solución:**

1. **Obtener el Phone Number ID:**
   ```bash
   curl -G "https://graph.facebook.com/v19.0/{WABA_ID}" \
     --data-urlencode "fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}" \
     --data-urlencode "access_token=$TOKEN"
   ```

2. **Enviar mensaje de prueba:**
   ```bash
   curl -X POST "https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "messaging_product": "whatsapp",
       "to": "+5491125522465",
       "type": "text",
       "text": {
         "body": "Mensaje de prueba desde Cloud API"
       }
     }'
   ```

   **Respuesta exitosa:**
   ```json
   {
     "messaging_product": "whatsapp",
     "contacts": [
       {
         "input": "+5491125522465",
         "wa_id": "5491125522465"
       }
     ],
     "messages": [
       {
         "id": "wamid.xxx..."
       }
     ]
   }
   ```

**Resultado:** Confirmó que:
- ✅ El token era válido
- ✅ El número estaba activo
- ✅ Cloud API podía enviar mensajes

---

## 🎉 4. Resultado Final

### Estado del sistema:

- ✅ El número quedó verificado y operativo en WhatsApp Cloud API
- ✅ El backend recibió mensajes reales desde WhatsApp
- ✅ El bot respondió correctamente sin usar IA (solo flujos FSM)
- ✅ El sistema quedó listo para pruebas funcionales completas

### Configuración final:

- **Phone Number ID:** `874874495717063`
- **Número:** `+5491122913122`
- **Token:** Permanente (generado desde System User)
- **Webhook:** Verificado y funcionando
- **WABA:** Suscrita a la app

---

## 📚 5. Lecciones Aprendidas (IMPORTANTE)

### ⚠️ Errores comunes y cómo evitarlos:

1. **BSP bloqueando control:**
   - **Problema:** Un número puede ser real pero igual estar bloqueado si hay un BSP asociado
   - **Solución:** Eliminar el BSP desde Business Manager → Socios antes de intentar usar Cloud API

2. **Estado "Pendiente":**
   - **Problema:** El estado "Pendiente" NO se soluciona esperando
   - **Solución:** Debe completarse el perfil, verificar el número, y suscribir la app a la WABA

3. **Paso `/subscribed_apps` es obligatorio:**
   - **Problema:** El webhook puede estar bien y aun así no recibir eventos
   - **Solución:** SIEMPRE ejecutar `POST /{WABA_ID}/subscribed_apps` después de configurar el webhook

4. **Modo desarrollo:**
   - **Problema:** En modo desarrollo, solo se pueden enviar mensajes a números verificados
   - **Solución:** Para producción, solicitar acceso a producción desde Meta for Developers

5. **Token temporal vs permanente:**
   - **Problema:** Los tokens temporales expiran y causan errores
   - **Solución:** Generar token permanente desde System User (ver `TOKEN_PERMANENTE_SOLUCIONADO.md`)

6. **Migración de números:**
   - **Problema:** Nunca migrar el número final hasta que el bot esté 100% probado
   - **Solución:** Usar número de prueba primero, probar todo, luego migrar al número final

---

## 🔄 6. Checklist para Futuras Migraciones

### Antes de empezar:

- [ ] Verificar que no hay BSP asociado al número
- [ ] Tener el WABA ID a mano
- [ ] Tener el Phone Number ID a mano
- [ ] Tener un token permanente configurado
- [ ] Tener el webhook configurado y verificado

### Pasos obligatorios:

1. [ ] **Eliminar BSP** (si existe)
2. [ ] **Completar perfil** del número (nombre, descripción, sitio web)
3. [ ] **Verificar número** (código SMS)
4. [ ] **Configurar webhook** (URL + Verify Token)
5. [ ] **Verificar webhook** en Meta
6. [ ] **SUSCRIBIR APP A WABA** (`POST /{WABA_ID}/subscribed_apps`) ⚠️
7. [ ] **Probar envío** de mensaje desde API
8. [ ] **Probar recepción** de mensaje en webhook
9. [ ] **Actualizar `.env`** con Phone Number ID y Token
10. [ ] **Reiniciar PM2** con `--update-env`

### Verificación final:

```bash
# 1. Verificar suscripción
curl -G "https://graph.facebook.com/v19.0/{WABA_ID}/subscribed_apps" \
  --data-urlencode "access_token=$TOKEN"

# 2. Verificar número
curl -G "https://graph.facebook.com/v19.0/{WABA_ID}" \
  --data-urlencode "fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}" \
  --data-urlencode "access_token=$TOKEN"

# 3. Enviar mensaje de prueba
curl -X POST "https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+5491125522465",
    "type": "text",
    "text": {"body": "Prueba"}
  }'
```

---

## 📖 7. Referencias

- **Token permanente:** `TOKEN_PERMANENTE_SOLUCIONADO.md`
- **Configuración webhook:** `DONDE_ESTA_WEBHOOK.md`
- **Obtener Phone Number ID:** `OBTENER_PHONE_NUMBER_ID.md`
- **Error 133010:** `SOLUCION_ERROR_133010.md`

---

## 🆘 8. Troubleshooting

### Error: "Account not registered" (#133010)

**Causa:** La app no está suscrita a la WABA o el número no está asociado.

**Solución:**
1. Verificar suscripción: `GET /{WABA_ID}/subscribed_apps`
2. Si no está suscrita: `POST /{WABA_ID}/subscribed_apps`
3. Verificar que el número esté en la lista de números de la WABA

---

### Error: "Session has expired" (Token)

**Causa:** El token temporal expiró.

**Solución:**
1. Generar token permanente desde System User
2. Actualizar `.env` con el nuevo token
3. Reiniciar PM2 con `--update-env`

---

### Webhook no recibe eventos

**Causa:** La app no está suscrita a la WABA.

**Solución:**
1. Verificar suscripción: `GET /{WABA_ID}/subscribed_apps`
2. Si no está: `POST /{WABA_ID}/subscribed_apps`
3. Verificar que el webhook esté verificado en Meta

---

### Número en estado "Pendiente"

**Causa:** Falta completar perfil o verificar número.

**Solución:**
1. Completar perfil (nombre, descripción, sitio web)
2. Verificar número con código SMS
3. Esperar aprobación de Display Name (puede tardar días)
4. Mientras tanto, el número puede funcionar aunque diga "Pendiente"

---

**Última actualización:** 3 de Enero 2026  
**Autor:** Documentación del proceso real de activación

