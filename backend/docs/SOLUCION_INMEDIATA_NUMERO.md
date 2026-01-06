# 🚨 SOLUCIÓN INMEDIATA: Número No Recibe Mensajes

## 🔴 PROBLEMA ACTUAL

El número **+54 9 11 3762-3550** está **PENDIENTE** de verificación y **NO puede recibir mensajes** desde WhatsApp personal.

**WhatsApp dice:** "No se encontraron resultados" porque el número no está activo.

---

## ✅ SOLUCIÓN 1: Usar el Número Final (RECOMENDADO - FUNCIONA YA)

**El número final (+541131353729) ya está listo y verificado. Usémoslo:**

### PASO 1: Obtener Phone Number ID del número final

1. Ir a: https://developers.facebook.com/tools/explorer/
2. Seleccionar app: **"Automatizacion Pos"**
3. Token: usar el token permanente
4. Query:
   ```
   /819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}
   ```
5. Buscar el número **+541131353729** en la respuesta
6. Copiar el **`id`** (ese es el Phone Number ID)

### PASO 2: Actualizar `.env` en el servidor

```bash
# Conectarse al servidor
ssh root@145.223.30.68

# Editar .env
nano /var/www/automatizacion-ivan-pos-backend/.env
```

Buscar esta línea:
```env
WHATSAPP_PHONE_NUMBER_ID=867302179797652
```

Reemplazar con el Phone Number ID del número final:
```env
WHATSAPP_PHONE_NUMBER_ID=el_id_del_numero_final
```

**Guardar:** `Ctrl + O`, luego `Enter`, luego `Ctrl + X`

### PASO 3: Reiniciar el servidor

```bash
pm2 restart chatbot-pos --update-env
```

### PASO 4: Probar

1. Desde tu WhatsApp personal, escribir: **+541131353729**
2. Enviar mensaje: "Hola"
3. El bot debería responder ✅

---

## ✅ SOLUCIÓN 2: Activar el Número de Prueba (TARDA 24-48 HORAS)

**Si querés usar el número de prueba (+54 9 11 3762-3550):**

### PASO 1: Completar Perfil de WhatsApp Business

1. Ir a: https://business.facebook.com/wa/manage/
2. Click en **"Configuración"** → **"Perfil"**
3. Completar TODO:
   - ✅ Nombre: "Pos & Asociados"
   - ✅ Descripción: "Estudio contable especializado en..."
   - ✅ Categoría: "Contabilidad"
   - ✅ Dirección: LIMAY 1238, Piso 2, Dpto 25, SAN ANTONIO DE PADUA
   - ✅ Email: tu email
   - ✅ Sitio web: https://posyasociados.com/
4. **Guardar**

### PASO 2: Solicitar Verificación

1. En WhatsApp Manager, buscar el número **+54 9 11 3762-3550**
2. Click en el número
3. Buscar botón **"Solicitar verificación"** o **"Request verification"**
4. Completar el formulario
5. Enviar

### PASO 3: Esperar 24-48 horas

Meta verificará el número. Una vez verificado, podrás enviar mensajes.

---

## 🎯 RECOMENDACIÓN INMEDIATA

**Para probar AHORA mismo:**

1. ✅ **Usar el número final (+541131353729)** - Funciona inmediatamente
2. ⏳ Mientras tanto, completar verificación del número de prueba
3. 🔄 Después, cambiar al número de prueba si querés

---

## ⚠️ IMPORTANTE

**Los números de WhatsApp Cloud API:**
- ✅ Funcionan a través de la API (el bot envía mensajes)
- ❌ NO aparecen en búsquedas de WhatsApp personal
- ✅ Solo podés enviarles mensajes escribiendo el número completo

**Esto es NORMAL.** No es un error.

---

## 📞 SI NADA FUNCIONA

**Contactar soporte de Meta:**

1. Ir a: https://business.facebook.com/help/
2. Click en **"Contactar soporte"**
3. Categoría: **WhatsApp Business API**
4. Problema: **"Número no puede recibir mensajes"**
5. Detalles: "Mi número +54 9 11 3762-3550 está verificado en Meta pero no puedo enviarle mensajes desde WhatsApp personal. El número está en estado PENDIENTE desde hace una semana."

