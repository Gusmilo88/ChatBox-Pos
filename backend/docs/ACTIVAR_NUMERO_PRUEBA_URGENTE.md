# 🚨 ACTIVAR NÚMERO DE PRUEBA - SOLUCIÓN URGENTE

## 🎯 OBJETIVO

**Activar el número de prueba (+54 9 11 3762-3550) para poder hacer TODAS las pruebas antes de migrar al número final.**

---

## ✅ PASO 1: Verificar Phone Number ID del Número de Prueba

**El número de prueba YA tiene un Phone Number ID. Necesitamos verificar que esté configurado:**

1. Ir a: https://developers.facebook.com/tools/explorer/
2. Seleccionar app: **"Automatizacion Pos"**
3. Token: usar el token permanente
4. Query:
   ```
   /819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}
   ```
5. Buscar el número **+5491137623550** en la respuesta
6. Copiar el **`id`** (ese es el Phone Number ID del número de prueba)

**Ejemplo de respuesta:**
```json
{
  "phone_numbers": {
    "data": [
      {
        "id": "867302179797652",  // ← ESTE ES EL PHONE NUMBER ID
        "display_phone_number": "+5491137623550",
        "verified_name": "Pos Carlos Ivan",
        "code_verification_status": "PENDING"  // ← Está pendiente
      }
    ]
  }
}
```

---

## ✅ PASO 2: Verificar que esté en el `.env`

**Conectarse al servidor y verificar:**

```bash
ssh root@145.223.30.68
grep WHATSAPP_PHONE_NUMBER_ID /var/www/automatizacion-ivan-pos-backend/.env
```

**Debería mostrar:**
```env
WHATSAPP_PHONE_NUMBER_ID=867302179797652
```

**Si NO coincide con el ID del número de prueba, actualizarlo:**
```bash
nano /var/www/automatizacion-ivan-pos-backend/.env
```

Buscar y actualizar:
```env
WHATSAPP_PHONE_NUMBER_ID=el_id_del_numero_de_prueba
```

**Guardar:** `Ctrl + O`, luego `Enter`, luego `Ctrl + X`

---

## ✅ PASO 3: Completar Perfil de WhatsApp Business (OBLIGATORIO)

**Meta NO activa números sin perfil completo. Esto es CRÍTICO:**

1. Ir a: https://business.facebook.com/wa/manage/
2. Click en **"Configuración"** → **"Perfil"** (o buscar "Profile")
3. Completar **TODO** (todos los campos son obligatorios):
   - ✅ **Nombre:** "Pos & Asociados" o "Pos Carlos Ivan"
   - ✅ **Descripción:** "Estudio contable especializado en servicios contables, impositivos y laborales"
   - ✅ **Categoría:** "Contabilidad" o "Servicios profesionales"
   - ✅ **Dirección:** LIMAY 1238, Piso 2, Dpto 25, SAN ANTONIO DE PADUA, 1718, BUENOS AIRES
   - ✅ **Email:** tu email de contacto
   - ✅ **Sitio web:** https://posyasociados.com/
   - ✅ **Teléfono:** +54 9 11 3762-3550
4. **Guardar** todos los cambios

---

## ✅ PASO 4: Solicitar Verificación del Número

**Una vez completado el perfil:**

1. En WhatsApp Manager: https://business.facebook.com/wa/manage/
2. Click en **"Configuración"** → **"Números de teléfono"**
3. Buscar el número **+54 9 11 3762-3550**
4. Click en el número
5. Buscar botón **"Solicitar verificación"** o **"Request verification"**
6. Completar el formulario:
   - **Nombre para mostrar:** "Pos & Asociados"
   - **Categoría:** "Contabilidad"
   - **Descripción:** Breve descripción del negocio
7. **Enviar solicitud**

---

## ✅ PASO 5: Reiniciar el Servidor

```bash
pm2 restart chatbot-pos --update-env
```

---

## ✅ PASO 6: Probar (Aunque esté Pendiente)

**Aunque el número esté PENDIENTE, podés probarlo:**

### Opción A: Enviar mensaje desde el Panel del Chatbot

1. Ir al panel del chatbot (donde Iván gestiona conversaciones)
2. Crear una conversación de prueba
3. Enviar un mensaje desde el panel
4. El mensaje debería llegar a tu WhatsApp personal

### Opción B: Enviar mensaje usando la API directamente

**Desde el servidor, probar enviar un mensaje:**

```bash
curl -X POST https://api.posyasociados.com/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "Cookie: tu_cookie_de_sesion" \
  -d '{
    "to": "+5491137623550",
    "text": "Mensaje de prueba"
  }'
```

**O desde el código, usar el endpoint de prueba del backend.**

---

## ⚠️ IMPORTANTE: Limitaciones del Número Pendiente

**Mientras el número esté PENDIENTE:**

- ✅ **SÍ puede recibir mensajes** a través de la API
- ✅ **SÍ puede responder** mensajes (dentro de 24 horas)
- ❌ **NO puede iniciar conversaciones** (solo responder)
- ❌ **NO aparece en búsquedas de WhatsApp personal** (esto es normal)

**Esto es suficiente para hacer pruebas del bot.**

---

## 🎯 Si WhatsApp Personal Dice "No se Encontraron Resultados"

**Esto es NORMAL para números pendientes. Para probar:**

1. **NO buscar el número en WhatsApp**
2. **Usar el panel del chatbot** para enviar mensajes
3. **O esperar a que se verifique** (24-48 horas después de completar perfil)

---

## 📞 Si Después de 48 Horas Sigue Pendiente

**Contactar soporte de Meta URGENTE:**

1. Ir a: https://business.facebook.com/help/
2. Click en **"Contactar soporte"**
3. Categoría: **WhatsApp Business API**
4. Problema: **"Verificación de número pendiente"**
5. Detalles: 
   ```
   Mi número +54 9 11 3762-3550 está pendiente desde hace más de una semana.
   El Business Manager está verificado desde hace 2 semanas.
   Ya completé TODO el perfil de WhatsApp Business.
   Necesito verificación URGENTE para hacer pruebas del chatbot.
   ```
6. Adjuntar capturas de pantalla del perfil completo
7. Enviar

---

## ✅ CHECKLIST COMPLETO

- [ ] Obtener Phone Number ID del número de prueba
- [ ] Verificar que esté en `.env` del servidor
- [ ] Completar TODO el perfil de WhatsApp Business
- [ ] Solicitar verificación del número
- [ ] Reiniciar servidor
- [ ] Probar enviando mensaje desde el panel
- [ ] Verificar logs del servidor
- [ ] Contactar soporte si sigue pendiente después de 48 horas

---

## 🎯 RESUMEN: QUÉ HACER AHORA

1. **Completar el perfil de WhatsApp Business** (PASO 3) - Esto es OBLIGATORIO
2. **Solicitar verificación** (PASO 4)
3. **Probar desde el panel** mientras espera verificación
4. **Contactar soporte** si tarda más de 48 horas

**El número FUNCIONARÁ para pruebas aunque esté pendiente, pero necesitás completar el perfil primero.**

