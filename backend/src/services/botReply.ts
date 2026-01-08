import { FSMSessionManager } from '../fsm/engine';
import { aiReply, type AiContext } from './ai';
import { canUseAi } from './aiCostTracker';
import { existsByCuit, getDoc } from './clientsRepo';
import { collections } from '../firebase';
import { findAutoReply } from './autoReplies';
import { routeIntent, type PaymentType } from './intentRouter';
import { handlePayment, askPaymentTypeClarification } from './paymentHandler';
import { performHandoff, isHandoffActive } from './handoffManager';
import logger from '../libs/logger';
import config from '../config/env';

// Instancia global del FSM manager
let fsmManager: FSMSessionManager | null = null;

function getFSMManager(): FSMSessionManager {
  if (!fsmManager) {
    fsmManager = new FSMSessionManager();
  }
  return fsmManager;
}

// Función para normalizar teléfono a E.164
function normalizePhone(phone: string): string {
  // Remover espacios, guiones, paréntesis
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Si no empieza con +, asumir que es argentino
  if (!cleaned.startsWith('+')) {
    // Si empieza con 0, removerlo
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    // Si no empieza con 54, agregarlo
    if (!cleaned.startsWith('54')) {
      cleaned = '54' + cleaned;
    }
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

/**
 * Genera una respuesta del bot usando routing inteligente, pagos, handoff, IA y FSM
 */
export async function generateBotReply(
  phone: string,
  text: string,
  conversationId?: string
): Promise<{ replies: string[]; via: 'ai' | 'fsm' | 'payment' | 'handoff' }> {
  const normalizedPhone = normalizePhone(phone);
  
  try {
    // 0. Verificar si hay handoff activo (si hay, silenciar IA hasta HANDOFF_CLOSED)
    if (conversationId) {
      const handoffActive = await isHandoffActive(conversationId);
      if (handoffActive) {
        // Si hay handoff activo, no responder automáticamente
        // El operador responderá manualmente
        logger.info('handoff_active_silencing_ia', { conversationId });
        return {
          replies: [],
          via: 'handoff'
        };
      }
    }

    // 1. Verificar si es cliente y obtener CUIT
    let isClient = false;
    let cuit: string | undefined;
    let nombre: string | undefined;
    
    // Intentar obtener información del cliente desde la conversación
    if (conversationId) {
      try {
        const conversationDoc = await collections.conversations().doc(conversationId).get();
        if (conversationDoc.exists) {
          const data = conversationDoc.data();
          isClient = data?.isClient || false;
          // Si hay CUIT en la conversación, intentar obtener nombre
          if (data?.cuit) {
            cuit = data.cuit;
            if (cuit) {
              const cliente = await getDoc(cuit);
              if (cliente) {
                nombre = cliente.nombre;
              }
            }
          }
        }
      } catch (error) {
        logger.debug('Error obteniendo datos de conversación para IA', { error: (error as Error)?.message });
      }
    }
    
    // Si no hay conversación, intentar buscar por CUIT en el texto
    if (!isClient && !cuit) {
      // Buscar CUIT en el texto (formato XX-XXXXXXXX-X o solo números)
      const cuitMatch = text.match(/\b\d{2}[-]?\d{8}[-]?\d{1}\b/);
      if (cuitMatch) {
        const foundCuit = cuitMatch[0].replace(/\D/g, '');
        if (await existsByCuit(foundCuit)) {
          isClient = true;
          cuit = foundCuit;
          const cliente = await getDoc(foundCuit);
          if (cliente) {
            nombre = cliente.nombre;
          }
        }
      }
    }

    // 2. Routing por intención
    const routing = routeIntent(text, !!cuit);
    
    // 3. Si es un pago, manejar con paymentHandler
    if (routing.paymentType && routing.action === 'AUTO_RESOLVE') {
      let paymentResult;
      
      // Si es deuda_generica, preguntar aclaratoria una vez
      if (routing.paymentType === 'deuda_generica') {
        // TODO: Verificar si ya se preguntó (usar session/conversation state)
        // Por ahora, preguntar siempre
        paymentResult = askPaymentTypeClarification();
      } else {
        paymentResult = await handlePayment(text, cuit || undefined, routing.paymentType);
      }
      
      if (paymentResult.success) {
        logger.info('payment_handler_success', {
          phone: normalizedPhone,
          conversationId,
          paymentType: routing.paymentType
        });
        return {
          replies: [paymentResult.message],
          via: 'payment'
        };
      } else {
        // Si necesita CUIT o no encontró cliente, devolver mensaje
        if (paymentResult.needsCuit || !paymentResult.cliente) {
          return {
            replies: [paymentResult.message],
            via: 'payment'
          };
        }
        // Si no encontró cliente, derivar a Iván
        if (!paymentResult.cliente && conversationId) {
          try {
            const conversationDoc = await collections.conversations().doc(conversationId).get();
            const conversationData = conversationDoc.exists ? conversationDoc.data() : null;
            await performHandoff(
              conversationId,
              normalizedPhone,
              conversationData?.name || null,
              text,
              'ivan'
            );
            return {
              replies: [paymentResult.message],
              via: 'handoff'
            };
          } catch (error) {
            logger.error('error_performing_handoff_after_payment', { error: (error as Error)?.message });
          }
        }
      }
    }

    // 4. Si es handoff, realizar derivación
    if (routing.action === 'HANDOFF' && conversationId) {
      try {
        const conversationDoc = await collections.conversations().doc(conversationId).get();
        const conversationData = conversationDoc.exists ? conversationDoc.data() : null;
        await performHandoff(
          conversationId,
          normalizedPhone,
          conversationData?.name || nombre || null,
          text,
          routing.assignedTo as 'elina' | 'belen' | 'ivan'
        );
        return {
          replies: [], // El mensaje ya se envió en performHandoff
          via: 'handoff'
        };
      } catch (error) {
        logger.error('error_performing_handoff', { error: (error as Error)?.message });
        // Continuar con flujo normal si falla handoff
      }
    }
    
    // 2. Obtener historial de conversación si existe
    let history: Array<{ from: 'user' | 'bot'; text: string }> = [];
    if (conversationId) {
      try {
        const messagesSnapshot = await collections.messages(conversationId)
          .orderBy('ts', 'desc')
          .limit(6) // Obtener últimos 6 mensajes (3 pares user-bot)
          .get();
        
        if (!messagesSnapshot.empty) {
          const messages = messagesSnapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                from: (data.from === 'usuario' || data.from === 'user') ? 'user' as const : 'bot' as const,
                text: data.text || data.message || ''
              };
            })
            .reverse(); // Invertir para tener orden cronológico
          
          history = messages;
        }
      } catch (error) {
        logger.debug('Error obteniendo historial para IA', { error: (error as Error)?.message });
      }
    }
    
    // 2.5. Verificar respuestas automáticas (horario/palabras clave)
    // Esto tiene prioridad sobre IA y FSM
    const autoReply = await findAutoReply(text, isClient);
    if (autoReply) {
      logger.info('Respuesta automática aplicada', {
        phone: normalizedPhone,
        conversationId,
        isClient,
        responseLength: autoReply.length
      });
      return {
        replies: [autoReply],
        via: 'fsm' // Marcar como FSM para consistencia
      };
    }

    // 2.6. Fallback mínimo: si intentRouter devolvió HANDOFF pero no hay conversationId
    // (handoff no se ejecutó) y la IA está desactivada, usar mensaje default del FSM
    const aiAvailable = await canUseAi();
    const handoffRequestedButNoConversation = routing.action === 'HANDOFF' && !conversationId;
    
    if (handoffRequestedButNoConversation && (!aiAvailable || !config.openaiApiKey)) {
      // Usar el mensaje default del FSM (START) para evitar silencio
      const { FSMState, STATE_TEXTS } = await import('../fsm/states');
      logger.info('fallback_default_message_no_ia', {
        phone: normalizedPhone,
        conversationId,
        routingAction: routing.action,
        textPreview: text.substring(0, 50)
      });
      return {
        replies: [STATE_TEXTS[FSMState.START]],
        via: 'fsm'
      };
    }

    // 3. Intentar usar IA primero (si está disponible y no se superó el límite)
    if (aiAvailable && config.openaiApiKey) {
      try {
        const aiContext: AiContext = {
          role: isClient ? 'cliente' : 'no_cliente',
          cuit,
          nombre,
          lastUserText: text,
          history: history.length > 0 ? history : undefined,
          conversationId
        };
        
        const aiResponse = await aiReply(aiContext);
        
        logger.info('Respuesta generada por IA', {
          phone: normalizedPhone,
          conversationId,
          isClient,
          responseLength: aiResponse.length
        });
        
        return {
          replies: [aiResponse],
          via: 'ai'
        };
      } catch (error) {
        const msg = (error as Error)?.message ?? String(error);
        logger.warn('Error en IA, usando FSM como fallback', {
          phone: normalizedPhone,
          error: msg
        });
        // Continuar con FSM como fallback
      }
    } else {
      logger.info('IA no disponible, usando FSM', {
        phone: normalizedPhone,
        aiAvailable,
        hasApiKey: !!config.openaiApiKey
      });
    }
    
    // 4. Fallback a FSM
    const fsm = getFSMManager();
    const fsmResult = await fsm.processMessage(normalizedPhone, text);
    
    logger.info('Respuesta generada por FSM', {
      phone: normalizedPhone,
      repliesCount: fsmResult.replies.length
    });
    
    return {
      replies: fsmResult.replies,
      via: 'fsm'
    };
    
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error generando respuesta del bot', {
      phone: normalizedPhone,
      error: msg
    });
    
    // Fallback de emergencia
    return {
      replies: ['Lo siento, hubo un error. Por favor intentá de nuevo.'],
      via: 'fsm'
    };
  }
}

