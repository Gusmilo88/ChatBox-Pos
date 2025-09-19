import OpenAI from 'openai';
import config from '../config/env';
import logger from '../libs/logger';
import { truncateText } from '../utils/truncate';

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

  try {
    // Construir system prompt
    const systemPrompt = `Sos un asistente de un estudio contable. Escribí en español rioplatense usando 'vos'. Sé claro y breve (máx. 4 líneas).
No inventes datos de clientes, saldos ni comprobantes. Para temas contables específicos, recomendá hablar con Iván del estudio.
Si el usuario no es cliente, orientá a captar datos y proponer contacto.
Nunca prometas acciones automáticas externas; ofrecé derivar al equipo.`;

    // Prefix dinámico según role
    let contextPrefix = '';
    if (ctx.role === 'cliente') {
      contextPrefix = 'El usuario es cliente autenticado (CUIT presente).';
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
    
    // Truncar respuesta a 600 caracteres máximo
    const truncatedResponse = truncateText(response, 600);
    
    logger.info('Respuesta de IA generada', {
      originalLength: response.length,
      truncatedLength: truncatedResponse.length
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
