# 🧪 Simulador del Chatbot

## Descripción

El simulador permite probar **TODO el flujo del chatbot** sin depender de Meta WhatsApp API. Usa la **lógica REAL** del bot (detección de urgencia, derivación automática, respuestas del bot, etc.) pero simula los envíos de WhatsApp.

## Acceso

### Interfaz Web
Abrí en tu navegador: `http://localhost:5173/simulator` (o la URL de tu frontend)

### API Endpoints

#### 1. Simular Mensaje de Cliente
```bash
POST /api/simulator/client
Content-Type: application/json

{
  "phone": "+5491125522465",
  "text": "Hola, necesito ayuda con facturación urgente"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Mensaje simulado exitosamente",
  "conversationId": "abc123",
  "botReplies": [
    "Hola! Te ayudo con facturación..."
  ],
  "derivedTo": "Belén", // Si fue derivado automáticamente
  "info": {
    "note": "Este mensaje fue procesado con la lógica REAL del bot",
    "nextStep": "El cliente fue derivado a Belén..."
  }
}
```

#### 2. Simular Respuesta de Operador
```bash
POST /api/simulator/operator
Content-Type: application/json

{
  "operatorPhone": "+54911XXXX-XXXX",
  "messageText": "Hola, te ayudo con la facturación...",
  "clientPhone": "+5491125522465" // Opcional
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Respuesta del operador simulada exitosamente",
  "conversationId": "abc123",
  "clientPhone": "+549****2465",
  "operatorName": "Belén"
}
```

#### 3. Ver Estado del Simulador
```bash
GET /api/simulator/status
```

**Respuesta:**
```json
{
  "success": true,
  "status": {
    "operators": [
      {
        "name": "Belén",
        "phone": "+549****XXXX",
        "keywords": ["facturación", "factura"]
      }
    ],
    "recentConversations": [
      {
        "id": "abc123",
        "phone": "+549****2465",
        "lastMessage": "Hola, necesito ayuda...",
        "assignedTo": "Belén",
        "needsReply": false
      }
    ]
  }
}
```

#### 4. Obtener Mensajes de una Conversación
```bash
GET /api/simulator/messages/:conversationId
```

## Características

✅ **Lógica REAL del bot:**
- Detección de urgencia (palabras clave: "urgente", "inmediato", etc.)
- Derivación automática basada en keywords
- Respuestas del bot usando IA
- Reenvío a operadores
- Gestión de conversaciones

✅ **Sin dependencias externas:**
- No requiere Meta WhatsApp API
- No requiere números verificados
- Funciona completamente offline

✅ **Interfaz web completa:**
- Simular mensajes de clientes
- Ver respuestas del bot en tiempo real
- Simular respuestas de operadores
- Ver conversaciones recientes
- Ver estado del simulador

## Uso Recomendado

1. **Probar detección de urgencia:**
   ```
   Cliente: "Necesito ayuda urgente con facturación"
   → El bot detecta urgencia y marca como needsReply
   ```

2. **Probar derivación automática:**
   ```
   Cliente: "Tengo un problema con mi factura"
   → El bot deriva automáticamente a Belén (si maneja "facturación")
   ```

3. **Probar flujo completo:**
   ```
   1. Cliente envía mensaje
   2. Bot responde automáticamente
   3. Si es urgente o requiere humano, se deriva
   4. Operador responde
   5. Cliente recibe respuesta del operador
   ```

## Notas Importantes

- El simulador usa la **misma lógica** que el bot en producción
- Los mensajes se guardan en Firebase (igual que en producción)
- Las conversaciones aparecen en el dashboard normal
- Los operadores deben estar configurados en `OPERATORS_CONFIG` en el `.env`

## Solución de Problemas

### "No hay operadores configurados"
Configurá `OPERATORS_CONFIG` en el `.env`:
```env
OPERATORS_CONFIG='[{"name":"Belén","phone":"+54911XXXX-XXXX","keywords":["facturación","factura"]}]'
```

### "No se encontró conversación"
Asegurate de simular primero un mensaje del cliente que active la derivación.

### Los mensajes no aparecen en la interfaz
Verificá que el frontend esté conectado al backend correcto (variable `VITE_API_URL`).

