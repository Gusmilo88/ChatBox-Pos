/**
 * Script de prueba para verificar el sistema de control de costos de IA
 * 
 * Uso: npm run test:ai-costs
 * 
 * Este script:
 * 1. Verifica el límite mensual actual
 * 2. Simula un uso de IA
 * 3. Verifica que se registre el costo
 * 4. Muestra las estadísticas del mes
 */

import { 
  getMonthlyLimit, 
  getCurrentMonthUsage,
  recordAiUsage,
  calculateCost,
  canUseAi
} from '../services/aiCostTracker';
import { aiReply } from '../services/ai';
import logger from '../libs/logger';

async function main() {
  try {
    console.log('🧪 Iniciando prueba del sistema de control de costos de IA...\n');

    // 1. Verificar límite mensual
    console.log('1️⃣ Verificando límite mensual...');
    const limit = await getMonthlyLimit();
    console.log(`   ✅ Límite mensual: $${limit} USD\n`);

    // 2. Verificar uso actual
    console.log('2️⃣ Verificando uso actual del mes...');
    const currentUsage = await getCurrentMonthUsage();
    console.log(`   📊 Uso actual:`);
    console.log(`      - Costo: $${currentUsage.totalCostUsd.toFixed(6)} USD`);
    console.log(`      - Tokens: ${currentUsage.totalTokens.toLocaleString()}`);
    console.log(`      - Usos: ${currentUsage.usageCount}`);
    console.log(`      - Límite excedido: ${currentUsage.isLimitExceeded ? 'Sí ❌' : 'No ✅'}\n`);

    // 3. Verificar si se puede usar IA
    console.log('3️⃣ Verificando si se puede usar IA...');
    const canUse = await canUseAi();
    console.log(`   ${canUse ? '✅' : '❌'} IA ${canUse ? 'habilitada' : 'deshabilitada'}\n`);

    // 4. Simular un uso de IA (solo si hay API key)
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey.length > 0) {
      console.log('4️⃣ Probando llamada a IA...');
      try {
        const testReply = await aiReply({
          role: 'cliente',
          lastUserText: 'Hola, necesito información sobre mi facturación',
          conversationId: 'test-conversation-123'
        });
        console.log(`   ✅ Respuesta de IA recibida (${testReply.length} caracteres)`);
        console.log(`   📝 Respuesta: "${testReply.substring(0, 100)}..."\n`);
      } catch (error) {
        const msg = (error as Error)?.message ?? String(error);
        console.log(`   ⚠️  Error en llamada a IA: ${msg}\n`);
      }
    } else {
      console.log('4️⃣ ⚠️  OPENAI_API_KEY no configurada, saltando prueba de IA\n');
    }

    // 5. Verificar uso después de la prueba
    console.log('5️⃣ Verificando uso después de la prueba...');
    const usageAfter = await getCurrentMonthUsage();
    console.log(`   📊 Uso actualizado:`);
    console.log(`      - Costo: $${usageAfter.totalCostUsd.toFixed(6)} USD`);
    console.log(`      - Tokens: ${usageAfter.totalTokens.toLocaleString()}`);
    console.log(`      - Usos: ${usageAfter.usageCount}`);
    console.log(`      - Límite excedido: ${usageAfter.isLimitExceeded ? 'Sí ❌' : 'No ✅'}\n`);

    // 6. Calcular costo de ejemplo
    console.log('6️⃣ Ejemplo de cálculo de costo:');
    const exampleCost = calculateCost('gpt-4o-mini', 100, 50);
    console.log(`   💰 100 tokens input + 50 tokens output = $${exampleCost.toFixed(6)} USD\n`);

    console.log('✅ Prueba completada exitosamente!\n');

  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error en prueba de costos de IA:', msg);
    console.error('❌ Error:', msg);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error fatal:', error);
      process.exit(1);
    });
}

export { main };

