# Instrucciones de Deploy PM2 - Outbox Worker

## Contrato Unificado del Outbox

El outbox usa el siguiente contrato (unificado en todo el sistema):

```typescript
{
  id: string,
  conversationId: string,
  phone: string,            // destino (NO "to")
  text: string,
  status: 'pending' | 'sending' | 'sent' | 'failed',
  tries: number,             // intentos (NO "retries")
  idempotencyKey?: string,
  error?: string | null,
  createdAt: Date | Timestamp,
  nextAttemptAt?: Timestamp | null,
  sentAt?: Timestamp | null,
  remoteId?: string
}
```

## Procesos PM2 Requeridos

### 1. Servidor Principal (chatbot-pos)
```bash
pm2 start dist/index.js --name chatbot-pos
# o si ya existe:
pm2 restart chatbot-pos
```

### 2. Worker de Outbox (chatbot-outbox) - OBLIGATORIO
```bash
pm2 start dist/worker/outbox.js --name chatbot-outbox
# o si ya existe:
pm2 restart chatbot-outbox
```

## Comandos de Deploy Completos

```bash
# 1. Compilar en local
npm run build

# 2. Subir dist al VPS (ajustar ruta según tu setup)
scp -r dist/ user@vps:/path/to/backend/
scp package.json user@vps:/path/to/backend/
scp .env user@vps:/path/to/backend/

# 3. En el VPS, reiniciar procesos
pm2 restart chatbot-pos
pm2 restart chatbot-outbox

# 4. Verificar que ambos estén corriendo
pm2 list
pm2 logs chatbot-outbox
```

## Validación

Para validar que el worker funciona:

1. Crear un documento de prueba en Firestore `outbox`:
```javascript
{
  id: "test-123",
  conversationId: "test-conv",
  phone: "+5491100000000",
  text: "Test message",
  status: "pending",
  tries: 0,
  createdAt: new Date(),
  error: null,
  nextAttemptAt: null,
  sentAt: null
}
```

2. Esperar el poll interval (default: 3000ms)
3. Verificar que el documento cambie a:
   - `status: "sent"`
   - `sentAt: <timestamp>`
   - `remoteId: <id del mensaje>`

## Variables de Entorno Requeridas

El worker necesita las mismas variables que el servidor principal:
- `WHATSAPP_DRIVER=cloud`
- `WHATSAPP_TOKEN=...`
- `WHATSAPP_PHONE_NUMBER_ID=...`
- `OUTBOX_POLL_INTERVAL_MS=3000` (opcional, default: 3000)
- Variables de Firebase

## Notas Importantes

- El worker consulta SOLO por `status='pending'`
- Usa lock transaccional (`status='sending'`) para evitar duplicados
- Si falla, vuelve a `status='pending'` con backoff exponencial
- El servidor principal NO debe iniciar el worker automáticamente si usas PM2 separado
- Para desactivar el worker automático en el servidor, setear `START_OUTBOX_WORKER=false`

