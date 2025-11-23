# Cómo Probar el Sistema de Control de Costos de IA

## Opción 1: Script Automático (Más Fácil)

1. Abre una terminal en la carpeta `backend`
2. Ejecuta:
   ```bash
   npm run test:ai-costs
   ```

Este script te mostrará:
- ✅ Límite mensual configurado
- 📊 Uso actual del mes
- 🤖 Estado de la IA (habilitada/deshabilitada)
- 💰 Costo de ejemplo
- 📈 Estadísticas actualizadas

## Opción 2: Desde el Dashboard (Visual)

1. **Inicia el backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Inicia el frontend (en otra terminal):**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Abre el navegador:**
   - Ve a `http://localhost:5173`
   - Logueate
   - Verás la tarjeta "Estado de IA" arriba de los filtros
   - Ahí podés ver:
     - Estado (Habilitada/Deshabilitada)
     - Costo del mes actual
     - Barra de progreso
     - Límite mensual (editable)

## Opción 3: Probar con Llamada Real a IA

Si tenés `OPENAI_API_KEY` configurada en tu `.env`:

### Usando curl (terminal):
```bash
curl -X POST http://localhost:4000/api/simulate/ai \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tu-api-key" \
  -d '{
    "role": "cliente",
    "text": "Hola, necesito información sobre mi facturación"
  }'
```

### O desde el navegador (Postman/Thunder Client):
- URL: `POST http://localhost:4000/api/simulate/ai`
- Headers:
  - `Content-Type: application/json`
  - `X-API-Key: tu-api-key` (la que configuraste en `.env`)
- Body:
  ```json
  {
    "role": "cliente",
    "text": "Hola, necesito información"
  }
  ```

Después de hacer la llamada, refrescá el dashboard y deberías ver que el costo aumentó.

## Verificar que Funciona

1. **Ejecuta el script de prueba:**
   ```bash
   cd backend
   npm run test:ai-costs
   ```

2. **O revisa el dashboard:**
   - Abrí `http://localhost:5173`
   - Logueate
   - Mirá la tarjeta "Estado de IA"
   - Deberías ver el costo actualizado

## Nota Importante

- Si no tenés `OPENAI_API_KEY` configurada, la IA usará respuestas predefinidas (fallback)
- El tracking de costos solo funciona cuando se usa la IA real (con API key)
- El límite por defecto es $50 USD/mes
- Podés cambiar el límite desde el dashboard haciendo clic en "Editar"

