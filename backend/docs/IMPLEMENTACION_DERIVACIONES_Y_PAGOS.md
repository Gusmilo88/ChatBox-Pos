# 📋 Implementación: Derivaciones y Flujo de Pagos

**Fecha:** 3 de Enero 2026  
**Estado:** ✅ Implementado

---

## 🎯 Objetivo

Implementar sistema de derivaciones inteligentes y flujo de pagos por app (Bio Libre) usando Firestore, sin inventar datos.

---

## ✅ Implementación Completada

### 1. Módulo de Routing por Intención (`intentRouter.ts`)

**Archivo:** `backend/src/services/intentRouter.ts`

**Funcionalidad:**
- Analiza el mensaje del usuario y determina la acción a tomar
- Devuelve: `action`, `assignedTo`, `needsCuit`, `paymentType`

**Tipos de acción:**
- `AUTO_RESOLVE`: Se puede resolver automáticamente (pagos, consultas simples)
- `HANDOFF`: Debe derivarse a operador (Elina, Belén, Iván)

**Operadores detectados:**
- **Elina**: Ingresos Brutos, VEP/QR, cambios registrales, SIRADIG, empleada doméstica
- **Belén**: Facturación, monotributo, planes de pago
- **Iván**: Altas/bajas, consultas complejas, mensajes ambiguos

**Tipos de pago detectados:**
- `honorarios`: Pago de honorarios
- `monotributo`: Pago de monotributo
- `deuda_generica`: Deuda genérica (requiere aclaración)

---

### 2. Función Mejorada `getClienteByCuit`

**Archivo:** `backend/src/services/clientsRepo.ts`

**Mejoras:**
- Usa `limpiarCuit()` para normalizar CUIT
- Query exacta de Firestore: `where('cuit', '==', cuitLimpio)`
- Devuelve: `{ exists: boolean, data: Cliente | null }`

**Función `limpiarCuit()`:**
- **Archivo:** `backend/src/utils/cuit.ts`
- Limpia CUIT: solo números (remueve guiones, espacios)

---

### 3. Handler de Pago (`paymentHandler.ts`)

**Archivo:** `backend/src/services/paymentHandler.ts`

**Flujo completo:**
1. **Si NO dio CUIT**: Pedir CUIT
2. **Validar CUIT**: Debe tener 11 números
3. **Buscar en Firestore**: `getClienteByCuit(cuitLimpio)`
4. **Si NO EXISTE**: Derivar a Iván
5. **Si EXISTE**:
   - Saludo con nombre
   - Determinar monto según tipo de pago:
     - `honorarios` → `deuda_honorarios`
     - `monotributo` → `monto_monotributo` (o `deuda` si pregunta por deuda)
     - `deuda_generica` → Priorizar `deuda_honorarios`, luego `deuda`, luego `monto_monotributo`
   - Informar monto (formato: `$X.XXX,XX`)
   - Indicar que NO hay que descargar nada
   - Enviar link: `https://app.posyasociados.com/login`
   - Indicar forma de pago: Bio Libre
   - Cierre amable

**Mensajes premium:**
- Tono profesional, claro, amable
- Emojis moderados (✅ 📄 💬 👩‍💼 👨‍💼)
- Formato de dinero: `toLocaleString('es-AR', { minimumFractionDigits: 2 })`

---

### 4. Gestor de Handoff (`handoffManager.ts`)

**Archivo:** `backend/src/services/handoffManager.ts`

**Funcionalidad:**
- Realiza handoff interno a operadores
- El cliente SIEMPRE ve el número del BOT
- Mensajes premium indicando quién responde:
  - "Perfecto, te va a atender Elina – POS & Asociados 👩‍💼"
  - "Perfecto, te va a atender Belén – POS & Asociados 👩‍💼"
  - "Perfecto, te va a atender Iván – POS & Asociados 👨‍💼"

**Estados:**
- `HANDOFF_ACTIVE`: Handoff activo (IA silenciada)
- `HANDOFF_CLOSED`: Handoff cerrado (vuelve a IA)

**Funciones:**
- `performHandoff()`: Realizar handoff
- `closeHandoff()`: Cerrar handoff y volver a IA
- `isHandoffActive()`: Verificar si hay handoff activo

---

### 5. Integración en `botReply.ts`

**Archivo:** `backend/src/services/botReply.ts`

**Flujo actualizado:**
1. Verificar handoff activo (si hay, silenciar IA)
2. Obtener CUIT y datos del cliente
3. **Routing por intención** (`routeIntent()`)
4. **Si es pago**: Manejar con `handlePayment()`
5. **Si es handoff**: Realizar con `performHandoff()`
6. **Si no es ni pago ni handoff**: Continuar con IA/FSM normal

**Prioridades:**
1. Handoff activo → Silenciar IA
2. Pago → `paymentHandler`
3. Handoff → `handoffManager`
4. IA/FSM → Flujo normal

---

## 📊 Esquema Firestore (Confirmado)

**Colección:** `clientes`

**Campos usados (exactos):**
- `cuit`: string
- `nombre`: string
- `estado`: 'regular' | 'irregular' | 'critico'
- `deuda`: number (deuda monotributo, si corresponde)
- `deuda_honorarios`: number (**ÚNICA fuente de verdad para honorarios**)
- `monto_monotributo`: number
- `planes_pago`: string
- `ingresos_brutos`: string
- `info_adicional`: string
- `whatsapp`: string | null
- `ventas_enviadas`: 'si' | 'no'
- `recategorizacion`: { categoria:number, facturacion_total:number, monto_disponible:number }

**⚠️ IMPORTANTE:**
- `conceptos` existe pero es **SOLO histórico administrativo interno**: NO usar para calcular ni mostrar montos al cliente
- Si un número falta, tratarlo como 0 (nunca NaN)
- ID del documento NO es el CUIT

---

## 🔄 Reglas de Derivación

### Elina – POS & Asociados (Administrativo)
- Ingresos Brutos (VEP/QR)
- Cambios registrales ARCA/AFIP (domicilio/actividad/datos)
- SIRADIG / deducciones / ganancias
- Empleada doméstica / casas particulares / liquidaciones

### Belén – POS & Asociados (Facturación / Monotributo / Planes)
- Facturación, emitir factura A/B/C
- Monotributo: deuda/pago/VEP/QR
- Planes de pago, cuota caída, rehabilitación

### Iván – POS & Asociados (Contador)
- Altas / bajas
- Consultas complejas
- Mensajes ambiguos o que no encajan claramente

**Regla de duda:**
- Si duda entre Elina y Belén: hacer 1 sola pregunta corta
- Si sigue la duda => Iván

---

## 💰 Qué Resuelve IA (NO DERIVA)

- Pagos (honorarios o monotributo) cuando se puede resolver con CUIT + Firestore + link a la app
- Consulta de montos desde Firestore
- Acceso a la app / cómo pagar
- Información general simple

**Regla crítica:**
- Si se puede resolver con datos de Firestore + link a la app: **NO derivar**

---

## 🧪 Tests Mínimos (Simulación)

1. ✅ "quiero pagar honorarios" + CUIT válido existente => usa `deuda_honorarios`
2. ✅ "quiero pagar monotributo" + CUIT válido existente => usa `monto_monotributo`
3. ✅ "tengo deuda" => pregunta aclaratoria 1 vez
4. ✅ CUIT inválido => repregunta
5. ✅ CUIT válido no encontrado => deriva Iván
6. ✅ monto = 0 => mensaje "no figura monto cargado" + derivación correcta si corresponde

---

## 📝 Archivos Creados/Modificados

### Nuevos archivos:
- `backend/src/services/intentRouter.ts` - Routing por intención
- `backend/src/services/paymentHandler.ts` - Handler de pagos
- `backend/src/services/handoffManager.ts` - Gestor de handoff

### Archivos modificados:
- `backend/src/services/botReply.ts` - Integración de routing, pagos y handoff
- `backend/src/services/clientsRepo.ts` - Función `getClienteByCuit` mejorada
- `backend/src/utils/cuit.ts` - Función `limpiarCuit()` agregada

---

## ✅ Checklist de Implementación

- [x] Módulo de routing por intención
- [x] Función `getClienteByCuit` mejorada
- [x] Handler de pago completo
- [x] Gestor de handoff
- [x] Integración en `botReply.ts`
- [x] Mensajes premium
- [x] Formato de dinero correcto
- [x] Link a app: `https://app.posyasociados.com/login`
- [x] Sin inventar campos (usa esquema real de Firestore)
- [x] Comentarios breves y claros

---

## 🚀 Próximos Pasos (Opcional)

1. **Mejorar detección de duda entre Elina y Belén**: Implementar pregunta aclaratoria automática
2. **Persistir estado de pregunta de pago**: Evitar preguntar múltiples veces por tipo de pago
3. **Integrar con sistema de notificaciones**: Notificar a operadores cuando se realiza handoff
4. **Métricas**: Tracking de derivaciones y pagos resueltos automáticamente

---

**Última actualización:** 3 de Enero 2026

