# Solución: Error al Agregar Número a WhatsApp Business API

## 🔴 Problema

Cuando intentás agregar un número a WhatsApp Business API, aparece un error en rojo que dice algo como:
- "Este número no está disponible"
- "No se puede reactivar este número"
- "Este número ya está en uso"
- "Error al agregar número"

## ⚠️ Causa Común

Esto pasa cuando:
1. El número **ya tiene WhatsApp normal** activo
2. El número **tuvo WhatsApp Business** (no API) y se borró recientemente
3. Meta aún no "liberó" el número (puede tardar **24-72 horas**)

---

## ✅ SOLUCIÓN 1: Usar un Número Nuevo (RECOMENDADO)

**La forma más rápida y segura:**

### Opción A: Número de Prueba Temporal
1. **Conseguí un número nuevo** que NUNCA haya tenido WhatsApp
   - Puede ser un número de prepago
   - O un número de otra línea
   - O un número virtual (Twilio, etc.)

2. **Agregalo a WhatsApp Business API:**
   - Ve a Meta for Developers → Tu App → WhatsApp → Configuración
   - Click en "Crear cuenta de WhatsApp Business"
   - Ingresá el número nuevo
   - Verificá con el código que te llegue

3. **Una vez funcionando, podés migrar al número real más adelante**

### Opción B: Usar el Número Real (si no tiene WhatsApp)
Si el número real **NUNCA tuvo WhatsApp**, podés usarlo directamente:
- Agregalo normalmente en Meta
- Verificá con el código

---

## ✅ SOLUCIÓN 2: Esperar y Reintentar

Si borraste WhatsApp del número hace menos de 72 horas:

1. **Esperá 48-72 horas** desde que borraste WhatsApp
2. **NO intentes agregarlo** durante ese tiempo (cada intento puede resetear el contador)
3. **Después de 72 horas**, intentá agregarlo de nuevo

**⚠️ IMPORTANTE:** Meta puede tardar hasta 72 horas en "liberar" un número después de borrarlo.

---

## ✅ SOLUCIÓN 3: Migrar Número Existente (AVANZADO)

Si el número **ya tiene WhatsApp Business normal** y querés migrarlo a API:

### Proceso de Migración:
1. **NO borres WhatsApp Business** del número
2. En Meta for Developers, buscá la opción **"Migrar número"** o **"Transferir número"**
3. Seguí el proceso de migración oficial de Meta
4. Esto puede tardar varios días

**⚠️ NOTA:** Este proceso es complejo y puede causar downtime. Mejor usar un número nuevo para pruebas.

---

## 🎯 RECOMENDACIÓN PARA TU CASO

**Usá un número de prueba temporal:**

1. **Conseguí un número nuevo** (prepago, otra línea, etc.)
2. **Agregalo a WhatsApp Business API** en Meta
3. **Probá que todo funcione** con ese número
4. **Una vez que todo esté funcionando**, podés:
   - Dejar ese número como definitivo, O
   - Migrar al número real más adelante (proceso más complejo)

---

## 📋 Pasos para Agregar Número Nuevo

1. Ve a: https://developers.facebook.com/apps/
2. Seleccioná tu app "Automatizacion Pos"
3. WhatsApp → Configuración
4. Buscá "Crea una cuenta de WhatsApp Business"
5. Click en "Crear cuenta"
6. Ingresá el número nuevo (formato: +541122913122)
7. Meta te enviará un código por WhatsApp o SMS
8. Ingresá el código
9. Una vez creada, copiá el **Phone Number ID**

---

## 🔍 Verificar Estado del Número

Si querés verificar si un número está "libre":

1. Intentá agregarlo en Meta
2. Si da error, el número aún no está disponible
3. Esperá 24-48 horas más y reintentá

---

## ⚠️ IMPORTANTE

- **NO uses el número real** hasta que todo esté probado y funcionando
- **El número de prueba** puede ser cualquier número que no tenga WhatsApp
- **Una vez funcionando**, podés cambiar al número real más adelante

---

## 📞 Si Nada Funciona

Si después de 72 horas sigue sin funcionar:

1. Contactá soporte de Meta: https://business.facebook.com/help
2. Explicá que necesitás agregar un número a WhatsApp Business API
3. Pueden ayudarte a liberar el número manualmente

---

**Última actualización:** 21/12/2025

