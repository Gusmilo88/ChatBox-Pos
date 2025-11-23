import { getDb, collections, Timestamp } from '../firebase';
import logger from '../libs/logger';

// Precios de OpenAI por modelo (por 1M tokens)
const PRICING = {
  'gpt-4o-mini': {
    input: 0.150,  // USD por 1M tokens
    output: 0.600  // USD por 1M tokens
  },
  'gpt-4o': {
    input: 2.50,
    output: 10.00
  },
  'gpt-4': {
    input: 30.00,
    output: 60.00
  },
  'gpt-3.5-turbo': {
    input: 0.50,
    output: 1.50
  }
} as const;

// Límite por defecto: $50 USD/mes
const DEFAULT_MONTHLY_LIMIT_USD = 50;

export interface AiUsageRecord {
  timestamp: Date;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  costUsd: number;
  model: string;
  role: 'cliente' | 'no_cliente';
  conversationId?: string;
}

export interface MonthlyUsage {
  month: string; // YYYY-MM
  totalCostUsd: number;
  totalTokens: number;
  usageCount: number;
  limitUsd: number;
  isLimitExceeded: boolean;
}

/**
 * Calcula el costo en USD basado en tokens usados
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) {
    logger.warn(`Modelo ${model} no encontrado en pricing, usando gpt-4o-mini`);
    const fallback = PRICING['gpt-4o-mini'];
    return (promptTokens / 1_000_000) * fallback.input + (completionTokens / 1_000_000) * fallback.output;
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Registra un uso de IA en Firebase
 */
export async function recordAiUsage(record: AiUsageRecord): Promise<void> {
  try {
    const db = getDb();
    const cost = record.costUsd;
    const month = new Date(record.timestamp).toISOString().slice(0, 7); // YYYY-MM

    // Guardar registro individual
    await collections.aiUsage(db).add({
      timestamp: Timestamp.fromDate(record.timestamp),
      tokensUsed: {
        prompt: record.tokensUsed.prompt,
        completion: record.tokensUsed.completion,
        total: record.tokensUsed.total
      },
      costUsd: cost,
      model: record.model,
      role: record.role,
      conversationId: record.conversationId || null,
      month // Para queries por mes
    });

    logger.info('AI usage recorded', {
      cost: cost.toFixed(6),
      tokens: record.tokensUsed.total,
      model: record.model
    });
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error recording AI usage:', msg);
    // No lanzar error, solo loguear (no queremos romper el flujo)
  }
}

/**
 * Obtiene el límite mensual configurado (por defecto $50 USD)
 */
export async function getMonthlyLimit(): Promise<number> {
  try {
    const db = getDb();
    const settingsDoc = await collections.aiSettings(db).doc('limits').get();
    
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      return data?.monthlyLimitUsd ?? DEFAULT_MONTHLY_LIMIT_USD;
    }
    
    // Si no existe, crear con valor por defecto
    await collections.aiSettings(db).doc('limits').set({
      monthlyLimitUsd: DEFAULT_MONTHLY_LIMIT_USD,
      updatedAt: Timestamp.now()
    });
    
    return DEFAULT_MONTHLY_LIMIT_USD;
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error getting monthly limit:', msg);
    return DEFAULT_MONTHLY_LIMIT_USD; // Fallback seguro
  }
}

/**
 * Actualiza el límite mensual
 */
export async function setMonthlyLimit(limitUsd: number): Promise<void> {
  try {
    const db = getDb();
    await collections.aiSettings(db).doc('limits').set({
      monthlyLimitUsd: limitUsd,
      updatedAt: Timestamp.now()
    }, { merge: true });
    
    logger.info('Monthly limit updated', { limitUsd });
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error setting monthly limit:', msg);
    throw new Error(`No se pudo actualizar el límite: ${msg}`);
  }
}

/**
 * Obtiene el uso del mes actual
 */
export async function getCurrentMonthUsage(): Promise<MonthlyUsage> {
  try {
    const db = getDb();
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

    // Obtener límite
    const limitUsd = await getMonthlyLimit();

    // Query simplificada: solo por mes (no necesita índice compuesto)
    // Si la colección no existe, la query simplemente devuelve vacío
    let snapshot;
    try {
      snapshot = await collections.aiUsage(db)
        .where('month', '==', currentMonth)
        .get();
    } catch (error) {
      // Si la colección no existe o hay error, devolver valores por defecto
      logger.info('Colección ai_usage no existe aún o error en query, devolviendo valores por defecto');
      return {
        month: currentMonth,
        totalCostUsd: 0,
        totalTokens: 0,
        usageCount: 0,
        limitUsd,
        isLimitExceeded: false
      };
    }

    let totalCost = 0;
    let totalTokens = 0;
    let usageCount = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      totalCost += data.costUsd || 0;
      totalTokens += data.tokensUsed?.total || 0;
      usageCount++;
    });

    return {
      month: currentMonth,
      totalCostUsd: totalCost,
      totalTokens,
      usageCount,
      limitUsd,
      isLimitExceeded: totalCost >= limitUsd
    };
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error getting current month usage:', msg);
    const limitUsd = await getMonthlyLimit();
    return {
      month: new Date().toISOString().slice(0, 7),
      totalCostUsd: 0,
      totalTokens: 0,
      usageCount: 0,
      limitUsd,
      isLimitExceeded: false
    };
  }
}

/**
 * Verifica si se puede usar IA (no se superó el límite)
 */
export async function canUseAi(): Promise<boolean> {
  try {
    const usage = await getCurrentMonthUsage();
    return !usage.isLimitExceeded;
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error checking if AI can be used:', msg);
    return true; // En caso de error, permitir uso (fallback seguro)
  }
}

/**
 * Obtiene estadísticas de uso por mes
 */
export async function getMonthlyStats(month?: string): Promise<MonthlyUsage> {
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  
  try {
    const db = getDb();
    const limitUsd = await getMonthlyLimit();

    // Query simplificada: solo por mes (no necesita índice compuesto)
    let snapshot;
    try {
      snapshot = await collections.aiUsage(db)
        .where('month', '==', targetMonth)
        .get();
    } catch (error) {
      // Si la colección no existe o hay error, devolver valores por defecto
      logger.info('Colección ai_usage no existe aún o error en query, devolviendo valores por defecto');
      return {
        month: targetMonth,
        totalCostUsd: 0,
        totalTokens: 0,
        usageCount: 0,
        limitUsd,
        isLimitExceeded: false
      };
    }

    let totalCost = 0;
    let totalTokens = 0;
    let usageCount = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      totalCost += data.costUsd || 0;
      totalTokens += data.tokensUsed?.total || 0;
      usageCount++;
    });

    return {
      month: targetMonth,
      totalCostUsd: totalCost,
      totalTokens,
      usageCount,
      limitUsd,
      isLimitExceeded: totalCost >= limitUsd
    };
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error getting monthly stats:', msg);
    const limitUsd = await getMonthlyLimit();
    return {
      month: targetMonth,
      totalCostUsd: 0,
      totalTokens: 0,
      usageCount: 0,
      limitUsd,
      isLimitExceeded: false
    };
  }
}

