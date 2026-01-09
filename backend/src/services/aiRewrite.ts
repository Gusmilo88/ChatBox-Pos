/**
 * Función para reformular mensajes del FSM usando IA
 * SOLO reformula, NUNCA cambia significado, decisiones, opciones ni textos obligatorios
 */

import { canUseAi } from './aiCostTracker';
import config from '../config/env';
import logger from '../libs/logger';
import { truncateText } from '../utils/truncate';
import OpenAI from 'openai';

/**
 * Determina si un mensaje puede ser reformulado por IA
 * NO se reformulan:
 * - Mensajes exactos del START
 * - Mensajes exactos del menú de 7 opciones
 * - Derivaciones automáticas
 * - Pago de honorarios
 * - Audios
 * - Off-topic
 */
export function canRewriteMessage(message: string): boolean {
  const msgLower = message.toLowerCase().trim();
  
  // Mensajes exactos del START que NO deben reformularse
  const startMessages = [
    '¡hola! soy el asistente virtual del estudio contable pos & asociados',
    'para empezar, escribime tu cuit',
    'el cuit ingresado no es válido'
  ];
  
  // Mensajes de derivación que NO deben reformularse
  const handoffMessages = [
    'te derivo con belén',
    'te derivo con elina',
    'te derivo con iván',
    'ya te derivamos con el equipo'
  ];
  
  // Mensajes de pago que NO deben reformularse
  const paymentMessages = [
    'para pagar tus honorarios',
    'ingresá a https://app.posyasociados.com/login',
    'bio libre'
  ];
  
  // Mensajes de audio que NO deben reformularse
  const audioMessages = [
    'no puedo escuchar audios',
    'escribime tu consulta'
  ];
  
  // Verificar si contiene alguno de estos mensajes exactos
  const isStartMessage = startMessages.some(start => msgLower.includes(start));
  const isHandoffMessage = handoffMessages.some(handoff => msgLower.includes(handoff));
  const isPaymentMessage = paymentMessages.some(payment => msgLower.includes(payment));
  const isAudioMessage = audioMessages.some(audio => msgLower.includes(audio));
  
  // Si contiene el menú de 7 opciones (tiene "1️⃣" o "facturación / comprobantes")
  const hasMenuOptions = msgLower.includes('1️⃣') || msgLower.includes('facturación / comprobantes') || 
                         msgLower.includes('pagos / vep / deudas') || msgLower.includes('pagar honorarios') ||
                         msgLower.includes('datos registrales') || msgLower.includes('sueldos / empleada doméstica') ||
                         msgLower.includes('consultas generales') || msgLower.includes('hablar con el estudio');
  
  // NO reformular si es alguno de estos casos
  if (isStartMessage || isHandoffMessage || isPaymentMessage || isAudioMessage || hasMenuOptions) {
    return false;
  }
  
  return true;
}

/**
 * Reformula un mensaje del FSM usando IA
 * MANTIENE el mismo significado, solo mejora el tono y naturalidad
 */
export async function aiRewrite(
  fsmMessage: string,
  context: {
    role?: 'cliente' | 'no_cliente';
    nombre?: string;
    cuit?: string;
    conversationId?: string;
  }
): Promise<string | null> {
  // Verificar si se puede usar IA
  if (!config.openaiApiKey) {
    logger.debug('ai_rewrite_skipped_no_key', { messageLength: fsmMessage.length });
    return null;
  }
  
  const canUse = await canUseAi();
  if (!canUse) {
    logger.debug('ai_rewrite_skipped_limit_exceeded', { messageLength: fsmMessage.length });
    return null;
  }
  
  // Verificar si el mensaje puede ser reformulado
  if (!canRewriteMessage(fsmMessage)) {
    logger.debug('ai_rewrite_skipped_exact_message', { 
      messagePreview: fsmMessage.substring(0, 50) 
    });
    return null;
  }
  
  try {
    // Construir system prompt para REFORMULACIÓN (no decisión)
    const systemPrompt = `Sos un asistente PREMIUM del estudio contable "POS & Asociados". Tu tarea es REFORMULAR un mensaje del bot para que suene más natural y humana, MANTENIENDO EXACTAMENTE el mismo significado.

REGLAS ESTRICTAS:
1. MANTÉN el mismo significado y contenido del mensaje original
2. NO cambies decisiones, opciones, derivaciones ni textos obligatorios
3. NO agregues información nueva que no esté en el mensaje original
4. NO cambies links, números, fechas ni datos específicos
5. Solo mejora el tono: más natural, cálido, profesional
6. Máximo 2-3 frases (igual que el original)
7. Usa emojis moderados (👋✅📌🙌) si el original los tiene
8. Escribí en español argentino usando 'vos'
9. Si el mensaje original es muy corto o específico, devolvelo casi igual

El mensaje original es:
"${fsmMessage}"

Reformulalo manteniendo EXACTAMENTE el mismo significado:`;

    // Llamar a OpenAI con prompt de reformulación
    const client = new OpenAI({ apiKey: config.openaiApiKey });
    
    const completion = await client.chat.completions.create({
      model: config.openaiModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: 'Reformulá este mensaje manteniendo el mismo significado:'
        }
      ],
      max_tokens: Math.min(config.aiMaxTokens, 200), // Limitar tokens para reformulación
      temperature: 0.7 // Más creativo pero controlado
    });

    const rewritten = completion.choices[0]?.message?.content || '';
    
    if (!rewritten || rewritten.trim().length === 0) {
      logger.warn('ai_rewrite_empty_response', { originalLength: fsmMessage.length });
      return null;
    }
    
    // Truncar a máximo 600 caracteres
    const truncated = truncateText(rewritten, 600);
    
    // Validar que el mensaje reformulado no sea muy diferente del original
    // (máximo 50% más largo o más corto)
    const lengthRatio = truncated.length / fsmMessage.length;
    if (lengthRatio < 0.5 || lengthRatio > 1.5) {
      logger.warn('ai_rewrite_length_mismatch', {
        originalLength: fsmMessage.length,
        rewrittenLength: truncated.length,
        ratio: lengthRatio.toFixed(2)
      });
      // Si es muy diferente, usar el original
      return null;
    }
    
    logger.info('ai_rewrite_success', {
      originalLength: fsmMessage.length,
      rewrittenLength: truncated.length,
      conversationId: context.conversationId
    });
    
    return truncated;
    
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.warn('ai_rewrite_error', {
      error: msg,
      messageLength: fsmMessage.length
    });
    return null;
  }
}
