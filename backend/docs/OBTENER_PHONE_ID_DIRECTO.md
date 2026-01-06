# 🎯 OBTENER PHONE NUMBER ID - COMANDOS DIRECTOS

## ✅ PASO 1: Ver el Token Actual

**Ejecutá esto para ver tu token (necesitamos verificar que esté configurado):**

```bash
grep WHATSAPP_TOKEN /var/www/automatizacion-ivan-pos-backend/.env | head -c 50
```

**Esto te muestra los primeros 50 caracteres del token (para verificar que existe).**

---

## ✅ PASO 2: Obtener Phone Number ID con Comando Directo

**Ejecutá este comando (copiá y pegá TODO, es un solo comando largo):**

```bash
cd /var/www/automatizacion-ivan-pos-backend && source .env 2>/dev/null; curl -s "https://graph.facebook.com/v19.0/819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}&access_token=$WHATSAPP_TOKEN" | node -e "const data=require('fs').readFileSync(0,'utf-8'); const json=JSON.parse(data); if(json.error){console.log('❌ ERROR:',JSON.stringify(json,null,2));process.exit(1);} if(json.phone_numbers&&json.phone_numbers.data){console.log('📱 NÚMEROS ENCONTRADOS:\n');json.phone_numbers.data.forEach((p,i)=>{console.log(\`\${i+1}. Número: \${p.display_phone_number}\`);console.log(\`   Phone Number ID: \${p.id}\`);console.log(\`   Estado: \${p.code_verification_status||'N/A'}\`);if(p.display_phone_number.includes('22913122')){console.log(\`   🎯 ESTE ES EL NÚMERO NUEVO\`);console.log(\`   📋 COPIÁ ESTE ID: \${p.id}\`);}console.log('');});}else{console.log('⚠️ No se encontraron números');}"
```

**Este comando te va a mostrar:**
- Todos los números de tu cuenta
- El Phone Number ID de cada uno
- Te va a marcar cuál es el número nuevo (+5491122913122)
- Te va a decir qué ID copiar

**COPIÁ el Phone Number ID que te muestra para el número nuevo.**

---

## ✅ PASO 3: Si el comando anterior no funciona, usar este método alternativo

**Ejecutá esto paso a paso:**

```bash
cd /var/www/automatizacion-ivan-pos-backend
```

```bash
TOKEN=$(grep WHATSAPP_TOKEN .env | cut -d '=' -f2)
```

```bash
curl -s "https://graph.facebook.com/v19.0/819576794391923?fields=phone_numbers{id,display_phone_number,verified_name,code_verification_status}&access_token=$TOKEN"
```

**Esto te va a mostrar un JSON con todos los números. Buscá el que tiene "22913122" en el número y copiá el "id" que está ahí.**

---

## ✅ PASO 4: Una vez que tengas el Phone Number ID

**Actualizá el .env:**

```bash
nano /var/www/automatizacion-ivan-pos-backend/.env
```

**Buscar:**
```
WHATSAPP_PHONE_NUMBER_ID=867302179797652
```

**Reemplazar con el nuevo ID que copiaste.**

**Guardar:** `Ctrl + O`, `Enter`, `Ctrl + X`

---

## ✅ PASO 5: Reiniciar

```bash
pm2 restart chatbot-pos --update-env
```

---

## ✅ PASO 6: Probar

**Desde tu WhatsApp personal, escribir a +5491122913122 y enviar "Hola".**

---

## 🆘 SI NINGÚN COMANDO FUNCIONA

**Podés obtener el Phone Number ID manualmente desde Meta:**

1. **Ir a:** https://developers.facebook.com/apps/
2. **Seleccionar app:** "Automatizacion Pos"
3. **Click en "WhatsApp"** (menú lateral)
4. **Click en "Configuración"** o **"API Setup"**
5. **Buscar sección "Phone number"**
6. **Ver el número +5491122913122 y su Phone Number ID**
7. **Copiar el Phone Number ID**

**Luego actualizá el .env con ese ID y reiniciá el servidor.**

