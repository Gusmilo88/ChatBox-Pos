# 📱 AGREGAR NÚMERO MOVISTAR - PASO A PASO

## ✅ NÚMERO A AGREGAR

**+5491122913122** (Movistar)

---

## 📋 PASO 1: Agregar el Número en WhatsApp Manager

1. **En la página donde estás** (Números de teléfono)
2. **Click en el botón azul:** **"Añadir número de teléfono"** (arriba a la derecha)
3. **Se abrirá un modal o formulario**

---

## 📋 PASO 2: Ingresar el Número

1. **En el campo de número, ingresar:**
   ```
   +5491122913122
   ```
   O con formato:
   ```
   +54 9 11 2291-3122
   ```

2. **Click en "Siguiente" o "Continuar"**

---

## 📋 PASO 3: Verificación por SMS

1. **Meta enviará un código SMS** al número +5491122913122
2. **Revisar el celular** con ese número
3. **Ingresar el código de 6 dígitos** que recibas
4. **Click en "Verificar" o "Confirmar"**

**⚠️ IMPORTANTE:**
- El código puede tardar 1-2 minutos en llegar
- Si no llega, podés pedir que lo reenvíen
- Asegurate de tener el celular con ese número a mano

---

## 📋 PASO 4: Completar el Perfil de WhatsApp Business

**Después de verificar el SMS, Meta te pedirá completar el perfil:**

### Campos a completar:

1. **Display Name (Nombre para mostrar):**
   ```
   Estudio Pos y Asociados
   ```
   ⚠️ Este nombre debe ser aprobado por Meta (puede tardar 24-48 horas)

2. **Descripción del negocio:**
   ```
   Servicios contables y asesoría fiscal para empresas y profesionales.
   ```
   (O la descripción que prefieras)

3. **Categoría:**
   - Seleccionar: **"Contabilidad"** o **"Servicios profesionales"** o la que más se ajuste

4. **Email:**
   - Ingresar el email de contacto del negocio

5. **Dirección (opcional pero recomendado):**
   - Ingresar la dirección del negocio (ayuda con la verificación)

6. **Sitio web (opcional):**
   - Si tenés sitio web, ingresarlo

7. **Click en "Guardar" o "Enviar para aprobación"**

---

## 📋 PASO 5: Obtener el Phone Number ID

**Después de agregar el número, necesitás obtener el Phone Number ID para configurarlo en el servidor:**

### Opción A: Desde Meta for Developers (MÁS FÁCIL)

1. **Ir a:** https://developers.facebook.com/apps/
2. **Seleccionar app:** "Automatizacion Pos"
3. **Click en "WhatsApp"** (menú lateral)
4. **Click en "Configuración"** o **"API Setup"**
5. **Buscar sección "Phone number"** o **"Número de teléfono"**
6. **Ahí deberías ver:**
   - El número: **+5491122913122**
   - El **Phone Number ID** (número largo, ej: `123456789012345`)
7. **Copiar el Phone Number ID**

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

## 📋 PASO 6: Actualizar Configuración en el Servidor

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
   (O el ID que tenías antes)

4. **Reemplazar con el nuevo Phone Number ID:**
   ```env
   WHATSAPP_PHONE_NUMBER_ID=el_nuevo_phone_number_id_que_obtuviste
   ```

5. **Guardar:**
   - `Ctrl + O` (guardar)
   - `Enter` (confirmar)
   - `Ctrl + X` (salir)

---

## 📋 PASO 7: Reiniciar el Servidor

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

## 📋 PASO 8: Probar el Bot

**Después de reiniciar, probar que funciona:**

1. **Desde tu WhatsApp personal**, escribir al número: **+5491122913122**
2. **Enviar mensaje:** "Hola"
3. **El bot debería responder** ✅

**Si el bot responde, ¡todo está funcionando!**

---

## ⚠️ IMPORTANTE: Display Name Pendiente

**El Display Name "Estudio Pos y Asociados" puede estar en estado "PENDING" por 24-48 horas.**

**Mientras tanto:**
- ✅ **Podés usar el número** para hacer pruebas
- ✅ **El bot funcionará** normalmente
- ⚠️ **El Display Name puede aparecer como el número** hasta que se apruebe

**Una vez aprobado el Display Name, aparecerá "Estudio Pos y Asociados" en lugar del número.**

---

## ✅ CHECKLIST

- [ ] Agregar número +5491122913122 en WhatsApp Manager
- [ ] Verificar con código SMS
- [ ] Completar perfil de WhatsApp Business
- [ ] Obtener Phone Number ID
- [ ] Actualizar `.env` en el servidor
- [ ] Reiniciar servidor con `pm2 restart chatbot-pos --update-env`
- [ ] Probar enviando mensaje al número

---

## 🎯 SI ALGO FALLA

### Si el código SMS no llega:
- Esperar 2-3 minutos
- Pedir reenvío del código
- Verificar que el número esté correcto

### Si el número no se agrega:
- Verificar que el número no tenga WhatsApp normal activo
- Verificar que el número no esté en otra WABA
- Esperar unos minutos y reintentar

### Si el bot no responde después de configurar:
- Verificar que el Phone Number ID esté correcto en el `.env`
- Verificar que el servidor se reinició correctamente
- Revisar los logs: `pm2 logs chatbot-pos --lines 50`

---

**Última actualización:** 30/12/2025

