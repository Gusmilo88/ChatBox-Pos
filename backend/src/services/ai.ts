import OpenAI from 'openai';
import config from '../config/env';
import logger from '../libs/logger';
import { truncateText } from '../utils/truncate';
import { 
  canUseAi, 
  recordAiUsage, 
  calculateCost,
  type AiUsageRecord 
} from './aiCostTracker';

// Cliente OpenAI
const client = new OpenAI({ 
  apiKey: config.openaiApiKey 
});

export type AiContext = {
  role: 'cliente' | 'no_cliente';
  interest?: 'alta_cliente' | 'honorarios' | 'turno_consulta' | 'otras_consultas';
  cuit?: string;
  nombre?: string;
  lastUserText?: string;
  history?: Array<{ from: 'user'|'bot'; text: string }>;
  conversationId?: string;
};

export async function aiReply(ctx: AiContext): Promise<string> {
  // Si no hay API key → fallback corto
  if (!config.openaiApiKey) {
    logger.info('IA fallback: No API key available', { 
      role: ctx.role, 
      hasKey: false 
    });
    
    if (ctx.role === 'no_cliente') {
      return "Contame brevemente qué necesitás y te derivo con el equipo. También puedo tomarte tus datos para coordinar.";
    } else {
      return "Para temas de cuenta, saldo o comprobantes te derivo con el equipo. ¿Querés que te contacten?";
    }
  }

  // Verificar si se puede usar IA (límite mensual)
  const canUse = await canUseAi();
  if (!canUse) {
    logger.warn('IA deshabilitada: límite mensual superado');
    // Fallback al bot predefinido
    if (ctx.role === 'no_cliente') {
      return "Contame brevemente qué necesitás y te derivo con el equipo. También puedo tomarte tus datos para coordinar.";
    } else {
      return "Para temas de cuenta, saldo o comprobantes te derivo con el equipo. ¿Querés que te contacten?";
    }
  }

  try {
    // Obtener datos del cliente desde Firebase si es cliente
    let clienteInfo = '';
    if (ctx.role === 'cliente' && ctx.cuit) {
      try {
        const { getDoc } = await import('./clientsRepo');
        const cliente = await getDoc(ctx.cuit);
        if (cliente) {
          // Construir información completa del cliente desde Firebase
          const clienteData: string[] = [];
          clienteData.push(`Nombre: ${cliente.nombre || 'No disponible'}`);
          clienteData.push(`CUIT: ${ctx.cuit}`);
          
          // Agregar información adicional si está disponible (sin datos sensibles)
          if (cliente.categoria_monotributo) {
            clienteData.push(`Categoría Monotributo: ${cliente.categoria_monotributo}`);
          }
          if (cliente.ingresos_brutos) {
            clienteData.push(`Ingresos Brutos: ${cliente.ingresos_brutos}`);
          }
          if (cliente.estado) {
            clienteData.push(`Estado: ${cliente.estado}`);
          }
          
          clienteInfo = `\n\nINFORMACIÓN DEL CLIENTE DESDE BASE DE DATOS (NO INVENTES NADA, SOLO USA ESTO):\n${clienteData.join('\n')}\n\nIMPORTANTE: NO tienes acceso a saldos, vencimientos, ni comprobantes específicos. Si preguntan por eso, decí que deben consultar en la app (https://app.posyasociados.com/login) o hablar con Iván.`;
        }
      } catch (error) {
        logger.debug('Error obteniendo datos del cliente para IA', { error: (error as Error)?.message });
      }
    }

    // Construir system prompt PREMIUM
    const systemPrompt = `Sos un asistente PREMIUM del estudio contable "POS & Asociados". Escribí en español argentino usando 'vos'. Sé amable, cálido, profesional y usa emojis moderados (👋✅📌🙌).

REGLAS ESTRICTAS (NO NEGOCIABLES):
1. SOLO temas contables/impositivos: servicios contables, impositivos, facturación, declaraciones, monotributo, ingresos brutos, ARCA, VEP, QR, deudas, pagos, planes de pago, facturas, comprobantes, alta/baja, consultas del estudio.
2. Si el usuario pregunta algo NO contable (deportes, recetas, política, etc.): respondé amablemente que solo atendés temas del estudio y ofrecé derivar.
3. NO inventes datos JAMÁS: saldos, vencimientos, comprobantes, montos, fechas. Si no sabés o no corresponde, decí que deben consultar en la app (https://app.posyasociados.com/login) o hablar con Iván.
4. Máximo 2-3 frases + un paso siguiente: "¿Querés que te derive con...?" o "¿Te ayudo con algo más?"
5. Si el usuario no está identificado (no tiene CUIT): pedí el CUIT amablemente.
6. Si es cliente identificado: saludalo por nombre si está disponible.
7. Si no es cliente: orientá a captar datos y ofrecé derivación con Iván para alta.
8. Tono PREMIUM: profesional, claro, amable, cálido, con emojis moderados (👋✅📌🙌).
9. Nunca prometas acciones automáticas externas; ofrecé derivar al equipo.
10. Si el usuario menciona "Elina", "Belén" o "Iván", orientá hacia esa persona.`;

    // Prefix dinámico según role
    let contextPrefix = '';
    if (ctx.role === 'cliente') {
      contextPrefix = `El usuario es cliente autenticado (CUIT: ${ctx.cuit || 'no disponible'}).${clienteInfo}`;
    } else {
      contextPrefix = `El usuario no es cliente (lead). Su interés es: ${ctx.interest || 'no especificado'}.`;
    }

    // Construir mensajes
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `${systemPrompt}\n\n${contextPrefix}`
      }
    ];

    // Agregar historial si existe (máximo 3 mensajes recientes)
    if (ctx.history && ctx.history.length > 0) {
      const recentHistory = ctx.history.slice(-3);
      for (const msg of recentHistory) {
        messages.push({
          role: msg.from === 'user' ? 'user' : 'assistant',
          content: msg.text
        });
      }
    }

    // Agregar último mensaje del usuario
    if (ctx.lastUserText) {
      messages.push({
        role: 'user',
        content: ctx.lastUserText
      });
    }

    // Log de la llamada a IA
    logger.info('Llamada a IA', {
      role: ctx.role,
      interest: ctx.interest,
      hasKey: !!config.openaiApiKey,
      tokensMax: config.aiMaxTokens
    });

    // Llamar a OpenAI
    const completion = await client.chat.completions.create({
      model: config.openaiModel,
      messages,
      max_tokens: config.aiMaxTokens,
      temperature: config.aiTemperature
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Obtener tokens usados
    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = completion.usage?.total_tokens || 0;
    
    // Calcular costo
    const cost = calculateCost(config.openaiModel, promptTokens, completionTokens);
    
    // Registrar uso (async, no esperamos)
    recordAiUsage({
      timestamp: new Date(),
      tokensUsed: {
        prompt: promptTokens,
        completion: completionTokens,
        total: totalTokens
      },
      costUsd: cost,
      model: config.openaiModel,
      role: ctx.role,
      conversationId: ctx.conversationId
    }).catch(err => {
      logger.error('Error registrando uso de IA:', err);
    });
    
    // Truncar respuesta a 600 caracteres máximo
    const truncatedResponse = truncateText(response, 600);
    
    logger.info('Respuesta de IA generada', {
      originalLength: response.length,
      truncatedLength: truncatedResponse.length,
      tokens: totalTokens,
      cost: cost.toFixed(6)
    });

    return truncatedResponse;

  } catch (error) {
    logger.error('Error en llamada a IA:', error);
    
    // Fallback en caso de error
    if (ctx.role === 'no_cliente') {
      return "Contame brevemente qué necesitás y te derivo con el equipo. También puedo tomarte tus datos para coordinar.";
    } else {
      return "Para temas de cuenta, saldo o comprobantes te derivo con el equipo. ¿Querés que te contacten?";
    }
  }
}
