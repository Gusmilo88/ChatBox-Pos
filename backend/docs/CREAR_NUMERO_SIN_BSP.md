# 📱 Crear Nuevo Número de Prueba (Sin BSP)

## Cuándo Usar Esta Opción

- Si 360Dialog no responde o tarda mucho
- Si querés empezar a probar YA sin esperar
- Si preferís tener un número limpio sin asociación previa

## Pasos

### 1. Ir a WhatsApp Manager
https://business.facebook.com/wa/manage/phone-numbers/

### 2. Agregar Nuevo Número
1. Click en **"Añadir"** o **"Add"**
2. Seleccionar **"Agregar número de teléfono"** o **"Add phone number"**
3. **IMPORTANTE:** Asegurarte de que NO esté asociado a ningún BSP
4. Seguir el proceso de verificación

### 3. Verificar que NO esté asociado a BSP
- En la configuración del número, NO debería aparecer "Business Solution Provider"
- Debería decir "Cloud API" o "Direct API"

### 4. Configurar en tu .env
Una vez tengas el nuevo número:
- Actualizar `WHATSAPP_PHONE_NUMBER_ID` con el nuevo ID
- Generar nuevo token de acceso
- Actualizar `WHATSAPP_TOKEN`

---

## Ventajas
- ✅ Número limpio, sin asociación previa
- ✅ Control directo con Meta
- ✅ Puede verificarse más rápido

## Desventajas
- ❌ Perdés el número anterior (o lo recuperás cuando 360Dialog lo libere)
- ❌ Tenés que reconfigurar webhooks

