# 🔑 GENERAR TOKEN PERMANENTE (NO TEMPORAL)

## ⚠️ IMPORTANTE: Diferencia entre Token Temporal y Permanente

- **Token Temporal:** Expira en 1-2 horas, solo para pruebas
- **Token Permanente:** No expira, es para producción

**Necesitás un TOKEN PERMANENTE para que el bot funcione de forma estable.**

---

## ✅ PASO 1: Ir a Business Settings

1. **Ir a:** https://business.facebook.com/settings/
2. **Seleccionar tu Business:** "Pos Carlos Ivan" (o el que corresponda)

---

## ✅ PASO 2: Crear System User

1. **En el menú lateral izquierdo, buscar "Usuarios del sistema" o "System Users"**
2. **Click en "Agregar" o "Add"**
3. **Completar:**
   - **Nombre:** "WhatsApp Bot Token" (o el que quieras)
   - **Rol:** "Administrador del sistema" o "System Administrator"
4. **Click en "Crear usuario del sistema" o "Create System User"**

---

## ✅ PASO 3: Generar Token para el System User

1. **Click en el System User que acabas de crear**
2. **Click en "Generar nuevo token" o "Generate New Token"**
3. **Seleccionar la app:** "Automatizacion Pos"
4. **Seleccionar permisos:**
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
5. **Click en "Generar token" o "Generate Token"**
6. **COPIAR EL TOKEN COMPLETO** (es largo, copiá TODO)
7. **⚠️ IMPORTANTE: Guardar el token en un lugar seguro, NO se puede ver de nuevo después**

---

## ✅ PASO 4: Asignar Assets al System User

1. **En la página del System User, buscar "Assets" o "Recursos"**
2. **Click en "Asignar assets" o "Assign Assets"**
3. **Seleccionar:**
   - ✅ **WhatsApp Business Account:** "Pos Carlos Ivan" (o la que corresponda)
4. **Click en "Guardar" o "Save"**

---

## ✅ PASO 5: Actualizar Token en el Servidor

**Una vez que tengas el token permanente:**

```bash
nano /var/www/automatizacion-ivan-pos-backend/.env
```

**Buscar:**
```
WHATSAPP_TOKEN=EAAL76IwgeuMBQWZBrxU9i3OY2ByBNpL9bAU79by8pbNaG5FiZCQr9oshyd0Fw4FDWcLBXeZAFYt4r7XjrAT2
```

**Reemplazar con el nuevo token permanente que copiaste.**

**Guardar:** `Ctrl + O`, `Enter`, `Ctrl + X`

---

## ✅ PASO 6: Reiniciar Servidor

```bash
pm2 restart chatbot-pos --update-env
```

---

## ✅ PASO 7: Verificar que Funciona

**Revisar logs:**
```bash
pm2 logs chatbot-pos --lines 30
```

**Buscar:**
- ✅ Server listening
- ✅ Meta WhatsApp webhook mounted
- ❌ NO debería haber errores de token

---

## 🎯 SOBRE EL DISPLAY NAME "PENDIENTE"

**El Display Name "Pendiente" NO impide que el bot funcione:**

- ✅ **El bot puede recibir mensajes** (aunque el Display Name esté pendiente)
- ✅ **El bot puede enviar respuestas** (aunque el Display Name esté pendiente)
- ✅ **El bot funciona normalmente** (aunque el Display Name esté pendiente)

**El Display Name "Pendiente" solo afecta:**
- ⚠️ **Cómo aparece el nombre** en WhatsApp (puede aparecer como número en lugar de "Estudio Pos y Asociados")
- ⚠️ **La búsqueda en WhatsApp personal** (puede no aparecer en búsquedas)

**PERO el bot funciona igual. Los clientes pueden escribir al número directamente y el bot responderá.**

---

## ✅ CÓMO PROBAR EL BOT

**Aunque el número no aparezca en búsquedas de WhatsApp personal, podés probarlo:**

1. **Desde el panel del chatbot** (si tenés acceso)
2. **Escribiendo directamente al número** desde WhatsApp (aunque no aparezca en búsqueda, si escribís el número completo, podés enviar mensaje)
3. **Usando el simulador** que ya creamos

---

## 🎯 RESUMEN

**Lo que necesitás hacer HOY:**
1. ✅ Generar token PERMANENTE (no temporal)
2. ✅ Actualizar token en servidor
3. ✅ Reiniciar servidor
4. ✅ Probar el bot

**Una vez hecho esto, el bot funcionará de forma estable, aunque el Display Name esté pendiente.**

**El Display Name se aprobará eventualmente (puede tardar días o semanas), pero el bot funciona ahora mismo.**

---

**Última actualización:** 3/1/2026

