# 🔍 OBTENER PHONE NUMBER ID - QUERY CORRECTA

## ❌ ERROR ACTUAL
```
"Unknown path components: /819576794391923"
```

El problema es que `819576794391923` es el **WABA ID** (WhatsApp Business Account ID), no un endpoint directo.

---

## ✅ SOLUCIÓN: Query Correcta

### OPCIÓN 1: Desde el WABA ID (RECOMENDADA)

**En Graph API Explorer:**

1. **Query:** Cambiar a esto:
   ```
   /819576794391923?fields=phone_numbers
   ```
   O más específico:
   ```
   /819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}
   ```

2. **Si sigue dando error**, probar sin el `fields`:
   ```
   /819576794391923
   ```
   Y luego agregar `?fields=phone_numbers` en el siguiente paso.

### OPCIÓN 2: Desde la App Directamente

**Si la Opción 1 no funciona:**

1. **Query:**
   ```
   /me?fields=whatsapp_business_accounts{phone_numbers{id,display_phone_number,verified_name,code_verification_status}}
   ```

2. **O desde la app:**
   ```
   /{app-id}/whatsapp_business_accounts?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}
   ```
   (Reemplazar `{app-id}` con el ID de tu app "Automatizacion Pos")

### OPCIÓN 3: Desde Meta for Developers (MÁS FÁCIL)

**Si Graph API no funciona, hacer esto:**

1. Ir a: https://developers.facebook.com/apps/
2. Seleccionar app: **"Automatizacion Pos"**
3. En el menú lateral, click en **"WhatsApp"**
4. Click en **"Configuración"** o **"API Setup"**
5. Buscar sección **"Phone number"** o **"Número de teléfono"**
6. Ahí deberías ver:
   - El número: **+54 9 11 3762-3550**
   - El **Phone Number ID** (número largo, ej: `123456789012345`)

---

## 🎯 PASOS EXACTOS PARA GRAPH API EXPLORER

### Paso 1: Verificar Token

1. En el panel derecho, verificar que el **Access Token** esté presente
2. Verificar que los permisos incluyan:
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_messaging`

### Paso 2: Probar Query Simple Primero

1. **Query:**
   ```
   /819576794391923
   ```
2. Click en **"Enviar"** (Send)
3. Si funciona, deberías ver información del WABA

### Paso 3: Agregar Fields

1. Si el Paso 2 funcionó, agregar:
   ```
   /819576794391923?fields=phone_numbers
   ```
2. Click en **"Enviar"**
3. Deberías ver un array con los números de teléfono

### Paso 4: Obtener Detalles Completos

1. **Query completa:**
   ```
   /819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}
   ```
2. Click en **"Enviar"**
3. Buscar el número que termina en **3550**
4. Copiar el **`id`** (ese es el Phone Number ID)

---

## 🔄 SI NADA FUNCIONA: Método Alternativo

### Desde Business Manager (MÁS DIRECTO)

1. Ir a: https://business.facebook.com/settings/whatsapp_accounts
2. Click en **"Pos Carlos Ivan"** (la cuenta)
3. En el panel de la derecha, pestaña **"Números de teléfono"**
4. Click en el número **"+54 9 11 3762-3550"**
5. Si se abre un modal o nueva pantalla, buscá:
   - **"Phone Number ID"**
   - **"ID del número"**
   - O en la URL de la página, puede aparecer el ID

### Desde WhatsApp Manager

1. Ir a: https://business.facebook.com/wa/manage/
2. En el menú lateral, **"Configuración"** → **"Números de teléfono"**
3. Click en el número **+54 9 11 3762-3550**
4. En los detalles, buscá el **Phone Number ID**

---

## 📋 QUÉ BUSCAR EN LA RESPUESTA

Cuando la query funcione, deberías ver algo así:

```json
{
  "phone_numbers": [
    {
      "id": "123456789012345",
      "display_phone_number": "+5491137623550",
      "verified_name": "Pos Carlos Ivan",
      "code_verification_status": "PENDING"
    }
  ]
}
```

**El `id` es el Phone Number ID que necesitás.**

---

## ✅ CHECKLIST

- [ ] Probar query simple: `/819576794391923`
- [ ] Si funciona, agregar `?fields=phone_numbers`
- [ ] Si no funciona, probar desde Meta for Developers
- [ ] Si no funciona, buscar desde Business Manager
- [ ] Copiar el `id` del número que termina en 3550
- [ ] Agregar al `.env` como `WHATSAPP_PHONE_NUMBER_ID`

