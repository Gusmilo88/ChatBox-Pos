# 🧪 Pruebas Mínimas: Derivaciones y Pagos

## Casos de Prueba

### A) Handoff activo + usuario: "quiero pagar honorarios"
**Input:**
- `conversationId`: "conv-123"
- `handoffStatus`: "HANDOFF_ACTIVE" (en Firestore)
- `text`: "quiero pagar honorarios"

**Flujo:**
1. `generateBotReply()` línea 57: `isHandoffActive(conversationId)` → `true`
2. Línea 58-65: Retorna early con `replies: []`
3. **NO** llega a `routeIntent()` (línea 115)
4. **NO** llega a `handlePayment()` (línea 127)

**Salida esperada:**
```typescript
{
  replies: [],
  via: 'handoff'
}
```

**Log esperado:**
```
handoff_active_silencing_ia { conversationId: 'conv-123' }
```

---

### B) Usuario: "quiero pagar honorarios" + CUIT válido existente
**Input:**
- `text`: "quiero pagar honorarios"
- `cuit`: "20123456786" (en conversación o texto)
- Cliente en Firestore: `{ cuit: "20123456786", nombre: "Cliente Demo", deuda_honorarios: 50000 }`

**Flujo:**
1. `generateBotReply()` línea 115: `routeIntent("quiero pagar honorarios", true)` → `{ paymentType: 'honorarios', action: 'AUTO_RESOLVE' }`
2. Línea 127: `handlePayment("quiero pagar honorarios", "20123456786", "honorarios")`
3. `paymentHandler.ts` línea 91: `getClienteByCuit("20123456786")` → `{ exists: true, data: {...} }`
4. Línea 112: `getMontoForPaymentType(clienteData, "honorarios")` → `50000` (de `deuda_honorarios`)
5. Línea 116: `formatMonto(50000)` → `"50.000,00"`

**Salida esperada:**
```typescript
{
  replies: [
    "Listo, Cliente Demo ✅ ya encontré tus datos.\n\n" +
    "Monto informado: 50.000,00.\n\n" +
    "No hace falta descargar nada ✅ Entrás desde el navegador con tu CUIT.\n\n" +
    "https://app.posyasociados.com/login\n\n" +
    "Ahí podés pagar por Bio Libre.\n\n" +
    "Si querés, cuando lo hagas avisame y lo verificamos 👋"
  ],
  via: 'payment'
}
```

---

### C) Usuario: "quiero pagar monotributo" + CUIT válido existente
**Input:**
- `text`: "quiero pagar monotributo"
- `cuit`: "20123456786"
- Cliente: `{ cuit: "20123456786", nombre: "Cliente Demo", monto_monotributo: 15000, deuda: 0 }`

**Flujo:**
1. `routeIntent()` → `{ paymentType: 'monotributo', action: 'AUTO_RESOLVE' }`
2. `handlePayment(..., "monotributo")`
3. `getMontoForPaymentType(clienteData, "monotributo")` → `15000` (de `monto_monotributo`)

**Salida esperada:**
```typescript
{
  replies: [
    "Listo, Cliente Demo ✅ ya encontré tus datos.\n\n" +
    "Monto informado: 15.000,00.\n\n" +
    "No hace falta descargar nada ✅ Entrás desde el navegador con tu CUIT.\n\n" +
    "https://app.posyasociados.com/login\n\n" +
    "Ahí podés pagar por Bio Libre.\n\n" +
    "Si querés, cuando lo hagas avisame y lo verificamos 👋"
  ],
  via: 'payment'
}
```

**Nota:** Si pregunta por "deuda monotributo", usar `deuda` en lugar de `monto_monotributo`.

---

### D) Usuario: "tengo deuda"
**Input:**
- `text`: "tengo deuda"
- `cuit`: null (no tiene CUIT aún)

**Flujo:**
1. `routeIntent("tengo deuda", false)` → `{ paymentType: 'deuda_generica', action: 'AUTO_RESOLVE' }`
2. `botReply.ts` línea 122: `routing.paymentType === 'deuda_generica'` → `true`
3. Línea 125: `askPaymentTypeClarification()` → pregunta aclaratoria

**Salida esperada:**
```typescript
{
  replies: ["¿Querés pagar honorarios o monotributo?"],
  via: 'payment'
}
```

**Nota:** Actualmente pregunta siempre. TODO: Persistir en conversación si ya se preguntó.

---

### E) CUIT inválido (no 11 dígitos)
**Input:**
- `text`: "quiero pagar honorarios"
- `cuit`: "12345" (solo 5 dígitos)

**Flujo:**
1. `handlePayment(..., "12345", "honorarios")`
2. `paymentHandler.ts` línea 80: `limpiarCuit("12345")` → `"12345"`
3. Línea 81: `cuitLimpio.length !== 11` → `true`

**Salida esperada:**
```typescript
{
  success: false,
  message: "Dale, pasame el CUIT completo (11 números).",
  needsCuit: true
}
```

---

### F) CUIT no encontrado
**Input:**
- `text`: "quiero pagar honorarios"
- `cuit`: "99999999999" (no existe en Firestore)

**Flujo:**
1. `handlePayment(..., "99999999999", "honorarios")`
2. `getClienteByCuit("99999999999")` → `{ exists: false, data: null }`
3. `paymentHandler.ts` línea 94: `!cliente.exists` → `true`

**Salida esperada:**
```typescript
{
  success: false,
  message: "No encuentro ese CUIT en nuestra base. ¿Querés que Iván te contacte para darte el alta?",
  needsCuit: false,
  cuit: "99999999999"
}
```

**Luego en `botReply.ts` línea 149:**
- Si `!paymentResult.cliente && conversationId` → `performHandoff(..., 'ivan')`
- Deriva a Iván automáticamente

---

## Validaciones Adicionales

### Formato de dinero
- `formatMonto(50000)` → `"50.000,00"`
- `formatMonto(0)` → `"0,00"`
- `formatMonto(null)` → `"0,00"`

### Campos usados (sin inventar)
- ✅ `deuda_honorarios` (honorarios)
- ✅ `monto_monotributo` (monotributo)
- ✅ `deuda` (deuda monotributo)
- ✅ `nombre` (saludo)
- ✅ `cuit` (búsqueda)
- ❌ `conceptos` (NO usado, es histórico)

---

## Logs Esperados

### Pago exitoso:
```
intent_routing_payment { paymentType: 'honorarios', needsCuit: false, textPreview: 'quiero pagar honorarios' }
payment_handler_success { cuit: '20123456786', nombre: 'Cliente Demo', paymentType: 'honorarios', monto: 50000 }
payment_handler_success { phone: '+54911...', conversationId: 'conv-123', paymentType: 'honorarios' }
```

### Handoff activo:
```
handoff_active_silencing_ia { conversationId: 'conv-123' }
```

### CUIT no encontrado:
```
payment_handler_cliente_not_found { cuit: '99999999999' }
handoff_performed { conversationId: 'conv-123', assignedTo: 'ivan', operatorName: 'Iván', clientPhone: '+54911...***' }
```

