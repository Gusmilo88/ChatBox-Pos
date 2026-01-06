# 🎯 SIMULADOR COMPLETO DEL BOT

## ✅ SOLUCIÓN PREMIUM - PROBÁ TODO AHORA MISMO

Este simulador te permite probar **TODO el flujo del bot** sin depender de Meta WhatsApp API. Usa la **lógica REAL** del bot, así que si funciona en el simulador, funcionará en producción.

---

## 🚀 CÓMO USARLO

### 1. Verificar que el servidor esté corriendo

```bash
# En el servidor
pm2 status
# Deberías ver "chatbot-pos" corriendo
```

### 2. Ver estado del simulador

```bash
curl http://localhost:4000/api/simulator/status
```

O desde el navegador:
```
http://TU_SERVIDOR:4000/api/simulator/status
```

**Respuesta esperada:**
```json
{
  "success": true,
  "status": {
    "operators": [
      {
        "name": "Iván",
        "phone": "+549****2465",
        "keywords": ["urgente", "importante", "contador"]
      }
    ],
    "recentConversations": []
  }
}
```

---

## 📝 SIMULAR MENSAJE DE CLIENTE

### Endpoint
```
POST /api/simulator/client
```

### Ejemplo con cURL

```bash
curl -X POST http://localhost:4000/api/simulator/client \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5491125522465",
    "text": "Hola, necesito ayuda con facturación urgente"
  }'
```

### Ejemplo con JavaScript (fetch)

```javascript
const response = await fetch('http://localhost:4000/api/simulator/client', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '+5491125522465',
    text: 'Hola, necesito ayuda con facturación urgente'
  })
});

const result = await response.json();
console.log(result);
```

### Respuesta exitosa

```json
{
  "success": true,
  "message": "Mensaje simulado exitosamente",
  "conversationId": "abc123...",
  "botReplies": [
    "Hola! Te ayudo con facturación. Te derivamos con Belén. En breve te responderá. ¡Gracias! 🙌"
  ],
  "derivedTo": "Belén",
  "info": {
    "note": "Este mensaje fue procesado con la lógica REAL del bot",
    "nextStep": "El cliente fue derivado a Belén. Usá POST /api/simulator/operator para simular su respuesta."
  }
}
```

---

## 👤 SIMULAR RESPUESTA DE OPERADOR

### Endpoint
```
POST /api/simulator/operator
```

### Ejemplo con cURL

```bash
curl -X POST http://localhost:4000/api/simulator/operator \
  -H "Content-Type: application/json" \
  -d '{
    "operatorPhone": "+5491125522465",
    "messageText": "Hola! Te ayudo con la facturación. ¿Qué necesitás?",
    "clientPhone": "+5491125522465"
  }'
```

**Nota:** Si no especificás `clientPhone`, usa la conversación más reciente asignada a ese operador.

### Respuesta exitosa

```json
{
  "success": true,
  "message": "Respuesta del operador simulada exitosamente",
  "conversationId": "abc123...",
  "clientPhone": "+549****2465",
  "operatorName": "Belén",
  "info": {
    "note": "Esta respuesta fue procesada con la lógica REAL del bot",
    "nextStep": "El cliente recibió la respuesta. Podés simular otro mensaje del cliente con POST /api/simulator/client"
  }
}
```

---

## 🧪 FLUJO COMPLETO DE PRUEBA

### Escenario 1: Cliente pregunta sobre facturación → Deriva a Belén

```bash
# 1. Cliente envía mensaje
curl -X POST http://localhost:4000/api/simulator/client \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5491125522465",
    "text": "Necesito ayuda con facturación"
  }'

# Respuesta: El bot deriva a Belén automáticamente

# 2. Belén responde
curl -X POST http://localhost:4000/api/simulator/operator \
  -H "Content-Type: application/json" \
  -d '{
    "operatorPhone": "+54911XXXX-XXXX",  # Número de Belén
    "messageText": "Hola! Te ayudo con la facturación. ¿Qué necesitás?"
  }'

# 3. Cliente responde
curl -X POST http://localhost:4000/api/simulator/client \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5491125522465",
    "text": "Necesito emitir una factura"
  }'
```

### Escenario 2: Cliente pregunta sobre turnos → Deriva a María

```bash
# 1. Cliente envía mensaje
curl -X POST http://localhost:4000/api/simulator/client \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5491198765432",
    "text": "Quiero agendar un turno"
  }'

# Respuesta: El bot deriva a María automáticamente

# 2. María responde
curl -X POST http://localhost:4000/api/simulator/operator \
  -H "Content-Type: application/json" \
  -d '{
    "operatorPhone": "+54911YYYY-YYYY",  # Número de María
    "messageText": "¡Hola! Te ayudo a agendar un turno. ¿Qué día te viene bien?"
  }'
```

### Escenario 3: Mensaje urgente → Deriva a Iván

```bash
# 1. Cliente envía mensaje urgente
curl -X POST http://localhost:4000/api/simulator/client \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+5491134567890",
    "text": "URGENTE! Necesito hablar con el contador"
  }'

# Respuesta: El bot deriva a Iván automáticamente (mayor prioridad)
```

---

## 📊 VERIFICAR RESULTADOS

### 1. Ver conversaciones en el dashboard

Abrí el panel de administración y verificá que las conversaciones aparezcan correctamente.

### 2. Ver logs del servidor

```bash
# En el servidor
pm2 logs chatbot-pos --lines 50
```

Buscá logs que empiecen con `simulator_`:
- `simulator_client_message`
- `simulator_operator_response`
- `simulator_status`

---

## ✅ QUÉ PROBÁS CON ESTE SIMULADOR

1. ✅ **Detección automática de urgencia** - Mensajes con palabras clave urgentes
2. ✅ **Derivación automática** - El bot deriva según keywords
3. ✅ **Respuestas del bot** - Generación automática de respuestas
4. ✅ **Asignación de conversaciones** - Se asignan correctamente a operadores
5. ✅ **Respuestas de operadores** - Se reenvían correctamente al cliente
6. ✅ **Múltiples conversaciones** - Podés probar varios clientes simultáneos
7. ✅ **Historial de mensajes** - Todo se guarda en Firestore

---

## 🔧 CONFIGURACIÓN DE OPERADORES

Los operadores se configuran en el `.env`:

```bash
OPERATORS_CONFIG='{"operators":[{"name":"Belén","phone":"+54911XXXX-XXXX","keywords":["factura","facturación","monotributo"],"priority":10},{"name":"María","phone":"+54911YYYY-YYYY","keywords":["turno","consulta","cita"],"priority":10},{"name":"Iván","phone":"+54911ZZZZ-ZZZZ","keywords":["urgente","importante","contador"],"priority":20,"default":true}]}'
```

---

## 🎯 VENTAJAS DEL SIMULADOR

1. **No depende de Meta** - Probá todo sin esperar verificación
2. **Lógica REAL** - Usa el mismo código que producción
3. **Rápido** - Probá en segundos, no en días
4. **Completo** - Probá todo el flujo end-to-end
5. **Seguro** - No afecta números reales

---

## 🚨 IMPORTANTE

- Este simulador **NO envía mensajes reales** por WhatsApp
- Los mensajes se guardan en Firestore (base de datos)
- Podés ver las conversaciones en el dashboard
- Cuando Meta verifique el número, todo funcionará igual en producción

---

## 📞 SOPORTE

Si tenés problemas:

1. Verificá los logs: `pm2 logs chatbot-pos`
2. Verificá el estado: `GET /api/simulator/status`
3. Verificá que el servidor esté corriendo: `pm2 status`

---

**¡Listo! Ahora podés probar TODO el bot sin depender de Meta! 🎉**

