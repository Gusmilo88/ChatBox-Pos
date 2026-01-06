# 🎯 OBTENER PHONE NUMBER ID - PASO A PASO

## ✅ PASO 1: Verificar que el Token existe

**Ejecutá esto:**

```bash
grep WHATSAPP_TOKEN /var/www/automatizacion-ivan-pos-backend/.env | head -c 100
```

**Esto te muestra los primeros 100 caracteres del token. Si muestra algo, el token existe.**

---

## ✅ PASO 2: Guardar el Token en una variable

**Ejecutá esto:**

```bash
cd /var/www/automatizacion-ivan-pos-backend
```

```bash
TOKEN=$(grep WHATSAPP_TOKEN .env | cut -d '=' -f2)
```

**Verificar que se guardó (debería mostrar algo):**

```bash
echo "Token tiene ${#TOKEN} caracteres"
```

**Si muestra un número mayor a 0, el token se guardó correctamente.**

---

## ✅ PASO 3: Hacer la consulta a Meta API

**Ejecutá esto:**

```bash
curl -s "https://graph.facebook.com/v19.0/819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}&access_token=$TOKEN"
```

**Esto debería mostrar un JSON con los números.**

**Si muestra un error, copiá TODO lo que aparece y compartilo.**

---

## ✅ PASO 4: Si muestra el JSON

**Buscá en el resultado el número que tiene "22913122" y copiá el "id" que está ahí.**

**Ejemplo de cómo se ve:**
```json
{
  "phone_numbers": {
    "data": [
      {
        "id": "123456789012345",  ← ESTE ES EL PHONE NUMBER ID
        "display_phone_number": "+5491122913122",
        "verified_name": "Estudio Pos y Asociados",
        "code_verification_status": "PENDING"
      }
    ]
  }
}
```

---

## 🆘 SI NO FUNCIONA - OPCIÓN MANUAL

**Si los comandos no funcionan, hacelo manualmente desde Meta:**

1. **Ir a:** https://developers.facebook.com/apps/
2. **Seleccionar app:** "Automatizacion Pos"
3. **Click en "WhatsApp"** (menú lateral izquierdo)
4. **Click en "Configuración"** o **"API Setup"**
5. **Buscar sección "Phone number"** o **"Número de teléfono"**
6. **Ver el número +5491122913122 y su Phone Number ID** (número largo)
7. **Copiar el Phone Number ID**

---

## ✅ PASO 5: Actualizar el .env

**Una vez que tengas el Phone Number ID:**

```bash
nano /var/www/automatizacion-ivan-pos-backend/.env
```

**Buscar:**
```
WHATSAPP_PHONE_NUMBER_ID=867302179797652
```

**Reemplazar con el nuevo ID.**

**Guardar:** `Ctrl + O`, `Enter`, `Ctrl + X`

---

## ✅ PASO 6: Reiniciar

```bash
pm2 restart chatbot-pos --update-env
```

---

## ✅ PASO 7: Probar

**Desde tu WhatsApp personal, escribir a +5491122913122 y enviar "Hola".**

