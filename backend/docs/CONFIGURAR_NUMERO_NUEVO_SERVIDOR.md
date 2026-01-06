# ⚙️ CONFIGURAR NÚMERO NUEVO EN EL SERVIDOR

## ✅ ESTADO ACTUAL

- ✅ Número agregado: **+5491122913122**
- ✅ Código SMS verificado
- ✅ Display Name cambiado: "Estudio Pos y Asociados"
- ✅ Descripción y página web completadas
- ⏳ Estado: **Pendiente** (normal, puede tardar 24-48 horas en aprobarse el Display Name)

---

## 🎯 IMPORTANTE: El Número YA Funciona

**Aunque el Display Name esté "Pendiente", el número YA debería funcionar para:**
- ✅ Recibir mensajes
- ✅ Enviar respuestas
- ✅ Usar el bot

**Solo el Display Name puede tardar 24-48 horas en aprobarse, pero el bot funciona ahora mismo.**

---

## 📋 PASO 1: Obtener el Phone Number ID

**Necesitás obtener el Phone Number ID del nuevo número para configurarlo en el servidor:**

### Opción A: Desde Meta for Developers (MÁS FÁCIL)

1. **Ir a:** https://developers.facebook.com/apps/
2. **Seleccionar app:** "Automatizacion Pos"
3. **Click en "WhatsApp"** (menú lateral)
4. **Click en "Configuración"** o **"API Setup"**
5. **Buscar sección "Phone number"** o **"Número de teléfono"**
6. **Ahí deberías ver:**
   - El número: **+5491122913122**
   - El **Phone Number ID** (número largo, ej: `123456789012345`)
7. **Copiar el Phone Number ID** (ese número largo)

### Opción B: Desde Graph API Explorer

1. **Ir a:** https://developers.facebook.com/tools/explorer/
2. **Seleccionar app:** "Automatizacion Pos"
3. **Token:** usar el token permanente
4. **Query:**
   ```
   /819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}
   ```
5. **Click en "Enviar"**
6. **En la respuesta, buscar el número +5491122913122**
7. **Copiar el `id`** (ese es el Phone Number ID)

---

## 📋 PASO 2: Actualizar Configuración en el Servidor

**Una vez que tengas el Phone Number ID:**

1. **Conectarse al servidor:**
   ```bash
   ssh root@145.223.30.68
   ```

2. **Editar el `.env`:**
   ```bash
   nano /var/www/automatizacion-ivan-pos-backend/.env
   ```

3. **Buscar esta línea:**
   ```env
   WHATSAPP_PHONE_NUMBER_ID=867302179797652
   ```
   (O el ID que tenías antes del número eliminado)

4. **Reemplazar con el nuevo Phone Number ID:**
   ```env
   WHATSAPP_PHONE_NUMBER_ID=el_nuevo_phone_number_id_que_obtuviste
   ```

5. **Guardar:**
   - `Ctrl + O` (guardar)
   - `Enter` (confirmar)
   - `Ctrl + X` (salir)

---

## 📋 PASO 3: Reiniciar el Servidor

**Después de actualizar el `.env`:**

```bash
pm2 restart chatbot-pos --update-env
```

**Verificar que reinició correctamente:**
```bash
pm2 logs chatbot-pos --lines 20
```

**Deberías ver:**
- ✅ Server listening on http://localhost:4000
- ✅ Meta WhatsApp webhook mounted
- ✅ Outbox worker iniciado

---

## 📋 PASO 4: Probar el Bot

**Después de reiniciar, probar que funciona:**

1. **Desde tu WhatsApp personal**, escribir al número: **+5491122913122**
2. **Enviar mensaje:** "Hola"
3. **El bot debería responder** ✅

**Si el bot responde, ¡todo está funcionando!**

---

## ⏰ Sobre el Display Name "Pendiente"

**El Display Name "Estudio Pos y Asociados" puede estar en estado "PENDING" por 24-48 horas.**

**Mientras tanto:**
- ✅ **El bot funciona normalmente** (podés usarlo ahora mismo)
- ✅ **Podés recibir y enviar mensajes**
- ⚠️ **El Display Name puede aparecer como el número** hasta que se apruebe
- ✅ **Una vez aprobado**, aparecerá "Estudio Pos y Asociados" en lugar del número

**NO necesitás esperar a que se apruebe el Display Name para usar el bot.**

---

## ✅ CHECKLIST

- [ ] Obtener Phone Number ID del nuevo número
- [ ] Actualizar `.env` en el servidor con el nuevo Phone Number ID
- [ ] Reiniciar servidor con `pm2 restart chatbot-pos --update-env`
- [ ] Probar enviando mensaje al número +5491122913122
- [ ] Verificar que el bot responde

---

## 🎯 RESUMEN

**Lo que ya hiciste:**
- ✅ Agregaste el número
- ✅ Verificaste con SMS
- ✅ Completaste el perfil

**Lo que falta hacer AHORA:**
1. Obtener Phone Number ID
2. Actualizar servidor
3. Reiniciar
4. Probar

**Después de eso, el bot funcionará inmediatamente. El Display Name se aprobará en 24-48 horas, pero no necesitás esperar para usar el bot.**

---

**Última actualización:** 30/12/2025

