# Configuración de Derivación Automática

## Descripción

El sistema de derivación automática permite que el bot detecte automáticamente a qué operador (secretaria) debe derivar cada conversación basándose en las palabras clave del mensaje del cliente.

## Características Premium

✅ **Derivación 100% automática** - Sin intervención manual de Iván  
✅ **Detección inteligente** - Analiza el contenido del mensaje para determinar el operador correcto  
✅ **Manejo de múltiples conversaciones** - Las secretarias pueden manejar varias conversaciones simultáneas  
✅ **Notificaciones estructuradas** - Mensajes claros y organizados para las secretarias  
✅ **Detección automática de respuestas** - El sistema detecta quién responde y reenvía al cliente correcto  
✅ **Cliente siempre ve el mismo número** - El cliente siempre ve el número del chatbot, no cambia  

## Configuración

### 1. Agregar números de operadores al `.env`

```env
# Número de Iván (opcional, para respuestas desde su celular)
IVAN_PHONE=+54911XXXX-XXXX

# Configuración de operadores (JSON)
OPERATORS_CONFIG={"operators":[{"name":"Belén","phone":"+54911XXXX-XXXX","keywords":["factura","facturación","monotributo","ingresos brutos","arba","comprobante"],"priority":10},{"name":"María","phone":"+54911YYYY-YYYY","keywords":["turno","consulta","cita","reunión","agendar","horario"],"priority":10},{"name":"Iván","phone":"+54911ZZZZ-ZZZZ","keywords":["urgente","importante","contador","hablar con ivan","ivan"],"priority":20,"default":true}]}
```

### 2. Estructura del JSON de operadores

```json
{
  "operators": [
    {
      "name": "Belén",
      "phone": "+54911XXXX-XXXX",
      "keywords": ["factura", "facturación", "monotributo", "ingresos brutos", "arba", "comprobante"],
      "priority": 10
    },
    {
      "name": "María",
      "phone": "+54911YYYY-YYYY",
      "keywords": ["turno", "consulta", "cita", "reunión", "agendar", "horario"],
      "priority": 10
    },
    {
      "name": "Iván",
      "phone": "+54911ZZZZ-ZZZZ",
      "keywords": ["urgente", "importante", "contador", "hablar con ivan", "ivan"],
      "priority": 20,
      "default": true
    }
  ]
}
```

### 3. Campos de cada operador

- **name**: Nombre del operador (se mostrará al cliente)
- **phone**: Número de WhatsApp en formato E.164 (ej: +54911XXXX-XXXX)
- **keywords**: Array de palabras clave que activan la derivación a este operador
- **priority**: Prioridad del operador (mayor = más importante, se usa para desempates)
- **default**: (opcional) Si es `true`, se usa cuando no hay match con ningún operador

## Cómo Funciona

### 1. Cliente escribe al chatbot

```
Cliente: "Hola, necesito ayuda con facturación"
```

### 2. Bot detecta derivación automática

El bot analiza el mensaje y detecta la palabra "facturación" → deriva a Belén automáticamente.

### 3. Bot avisa al cliente

```
Bot: "Te derivamos con Belén. En breve te responderá. ¡Gracias! 🙌"
```

### 4. Sistema reenvía a Belén

Belén recibe en su WhatsApp (en el chat con el chatbot):

```
🔔 Nueva conversación asignada

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Cliente: +54 9 11 1234-5678
📞 Teléfono: +54 9 11 1234-5678
🆔 ID: abc123...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Mensaje actual:
"Hola, necesito ayuda con facturación"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Responde aquí normalmente.
💡 Tip: Incluí el número del cliente si hay múltiples conversaciones.
📝 Ejemplo: "+54 9 11 XXXX-XXXX Tu respuesta aquí"
```

### 5. Belén responde

Belén puede responder de dos formas:

**Opción A: Responder directamente** (si es la única conversación)
```
Belén: "Hola! Soy Belén, te ayudo con facturación. ¿Qué necesitás?"
```

**Opción B: Incluir número del cliente** (si hay múltiples conversaciones)
```
Belén: "+54 9 11 1234-5678 Hola! Soy Belén, te ayudo con facturación. ¿Qué necesitás?"
```

### 6. Sistema reenvía al cliente

El cliente recibe desde el número del chatbot:
```
"Hola! Soy Belén, te ayudo con facturación. ¿Qué necesitás?"
```

### 7. Cliente responde

```
Cliente: "Necesito facturar servicios profesionales"
```

### 8. Sistema reenvía a Belén automáticamente

Belén recibe:
```
📨 Actualización de conversación

Cliente: +54 9 11 1234-5678
Teléfono: +54 9 11 1234-5678
ID: abc123...

💬 Nuevo mensaje:
"Necesito facturar servicios profesionales"

✅ Responde normalmente.
```

## Manejo de Múltiples Conversaciones

Cuando una secretaria recibe múltiples conversaciones simultáneas, el sistema muestra cada una con su contexto:

```
🔔 Conversación #1 de 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Cliente: Juan Pérez
📞 Teléfono: +54 9 11 1234-5678
🆔 ID: abc123...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 Mensaje:
"Hola, necesito facturar"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Responde normalmente o incluí el número del cliente.
💡 Ejemplo: "+54 9 11 1234-5678 Tu respuesta aquí"
```

La secretaria debe incluir el número del cliente en su respuesta para que el sistema sepa a quién reenviar.

## Detección Automática de Respuestas

El sistema detecta automáticamente:

1. **Por número del cliente en el mensaje**: Si la secretaria incluye el número del cliente, el sistema lo detecta y reenvía a ese cliente.

2. **Por conversación más reciente**: Si no hay número explícito, el sistema usa la conversación más reciente asignada a esa secretaria.

3. **Por conversación pendiente**: Si no hay conversación reciente, busca la primera conversación pendiente sin respuesta.

## Prioridad de Derivación

1. **Palabras clave específicas**: Si el mensaje contiene palabras clave de un operador, se deriva a ese operador.

2. **Prioridad del operador**: Si hay múltiples matches, se usa el operador con mayor prioridad.

3. **Cantidad de matches**: Si hay empate en prioridad, se usa el operador con más palabras clave coincidentes.

4. **Operador por defecto**: Si no hay matches, se usa el operador marcado como `default: true`.

## Notas Importantes

- ⚠️ Los números de operadores deben estar en formato E.164 (ej: +54911XXXX-XXXX)
- ⚠️ Las secretarias NO necesitan WhatsApp Business, pueden usar WhatsApp normal
- ⚠️ El cliente SIEMPRE ve el mismo número (el del chatbot)
- ⚠️ Las secretarias responden en el chat con el chatbot, no abren nueva conversación
- ⚠️ El sistema detecta automáticamente a qué cliente reenviar las respuestas

## Troubleshooting

### La secretaria no recibe notificaciones

1. Verificar que el número esté correcto en `OPERATORS_CONFIG`
2. Verificar que el número esté en formato E.164
3. Verificar logs del servidor para ver si hay errores de envío

### El sistema no detecta la respuesta de la secretaria

1. Verificar que el número de la secretaria esté correctamente configurado
2. Verificar que la secretaria esté respondiendo al número del chatbot
3. Si hay múltiples conversaciones, la secretaria debe incluir el número del cliente

### La derivación no funciona

1. Verificar que las palabras clave estén correctamente escritas en `OPERATORS_CONFIG`
2. Verificar que el JSON esté bien formateado
3. Verificar logs del servidor para ver qué operador se detectó

