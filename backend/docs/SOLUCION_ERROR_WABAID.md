# Solución: Error "Unexpected null value for wabaID"

## 🔴 Problema

Al intentar agregar un número de teléfono, aparece el error:
```
Unexpected null value for wabaID
[WhatsAppBizxPlatformPhoneCreationContainer.react][#7]
```

## ⚠️ Causa

Este error significa que la **Cuenta de WhatsApp Business (WABA)** no está completamente configurada o no está asociada correctamente con tu app.

---

## ✅ SOLUCIÓN: Crear/Completar la Cuenta de WhatsApp Business

### Opción 1: Desde WhatsApp Manager (RECOMENDADO)

1. **Ve a WhatsApp Manager:**
   - Ve a: https://business.facebook.com/
   - O desde Meta for Developers, buscá "WhatsApp Manager" en el menú

2. **Crear cuenta de WhatsApp Business:**
   - Si no tenés una cuenta, creá una nueva
   - Completá TODOS los datos del perfil:
     - Nombre del negocio
     - Categoría
     - Descripción
     - Dirección (opcional pero recomendado)
     - Email
     - Sitio web (opcional)

3. **Asociar la cuenta a tu app:**
   - Volvé a Meta for Developers
   - Tu App → WhatsApp → Configuración
   - Buscá "Cuenta de WhatsApp Business" o "WhatsApp Business Account"
   - Seleccioná la cuenta que creaste

4. **Ahora intentá agregar el número de nuevo**

---

### Opción 2: Completar el Perfil desde la App

1. **Ve a Meta for Developers:**
   - https://developers.facebook.com/apps/
   - Seleccioná tu app "Automatizacion Pos"

2. **WhatsApp → Configuración:**
   - Buscá la sección "Perfil de WA Business"
   - Si está incompleto, completalo:
     - Nombre del negocio
     - Categoría
     - Descripción
     - Email
     - Dirección

3. **Guardá todos los cambios**

4. **Recargá la página (F5)**

5. **Intentá agregar el número de nuevo**

---

### Opción 3: Crear Nueva Cuenta de WhatsApp Business

Si ninguna de las anteriores funciona:

1. **Ve a WhatsApp Manager:**
   - https://business.facebook.com/
   - O desde Meta for Developers → WhatsApp → WhatsApp Manager

2. **Crear nueva cuenta:**
   - Click en "Crear cuenta" o "Add Account"
   - Completá TODOS los campos obligatorios
   - Guardá

3. **Asociar a tu app:**
   - Volvé a Meta for Developers
   - Tu App → WhatsApp → Configuración
   - Buscá "Seleccionar cuenta de WhatsApp Business"
   - Elegí la cuenta que acabas de crear

4. **Intentá agregar el número**

---

## 🔍 Verificar que la Cuenta esté Asociada

Para verificar que todo está bien:

1. Meta for Developers → Tu App → WhatsApp → Configuración
2. Buscá la sección "Cuenta de WhatsApp Business"
3. Deberías ver:
   - Nombre de la cuenta
   - ID de la cuenta (WABA ID)
   - Estado: "Activa" o "Verificada"

Si no ves nada o dice "No hay cuenta asociada", necesitás crear/asociar una cuenta primero.

---

## ⚠️ IMPORTANTE

- **El perfil de WhatsApp Business debe estar 100% completo** antes de agregar números
- **La cuenta debe estar asociada a tu app** en Meta for Developers
- **Esperá unos minutos** después de crear la cuenta antes de agregar números

---

## 📞 Si Nada Funciona

1. **Cerrá sesión y volvé a entrar** en Meta for Developers
2. **Esperá 10-15 minutos** y reintentá
3. **Contactá soporte de Meta:**
   - https://business.facebook.com/help
   - Explicá el error "Unexpected null value for wabaID"
   - Pedí ayuda para configurar la cuenta de WhatsApp Business

---

**Última actualización:** 21/12/2025

