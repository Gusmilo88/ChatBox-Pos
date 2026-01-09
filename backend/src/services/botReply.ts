import { FSMSessionManager } from '../fsm/engine';
import { aiReply, type AiContext } from './ai';
import { canUseAi } from './aiCostTracker';
import { existsByCuit, getDoc, getClienteByCuit } from './clientsRepo';
import { collections } from '../firebase';
import { findAutoReply } from './autoReplies';
import { routeIntent, type PaymentType } from './intentRouter';
import { handlePayment, askPaymentTypeClarification } from './paymentHandler';
import { performHandoff, isHandoffActive } from './handoffManager';
import { isOffTopic, extractCUIT, shouldAskForCUIT, routeToStaff, getStaffName, type StaffMember } from './topicGuard';
import { REPLIES, maskCuit, maskPhone } from './replies';
import { aiRewrite, canRewriteMessage } from './aiRewrite';
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
  conversationId?: string,
  messageType?: string
): Promise<{ replies: string[]; via: 'ai' | 'fsm' | 'payment' | 'handoff' }> {
  const normalizedPhone = normalizePhone(phone);
  
  try {
    // MANEJO DE AUDIOS (OBLIGATORIO) - ANTES DE CUALQUIER PROCESAMIENTO
    if (messageType === 'audio' || messageType === 'voice') {
      logger.info('audio_received', {
        conversationId,
        phone: maskPhone(normalizedPhone)
      });
      return {
        replies: [REPLIES.audioNotSupported],
        via: 'fsm'
      };
    }

    // ============================================
    // PRE-HANDLER GLOBAL: COMANDOS DE RESET
    // ============================================
    // Detectar comandos globales ANTES de cualquier otro procesamiento
    const textLower = text.trim().toLowerCase();
    const globalCommands = ['reset', 'inicio', 'menu', 'start', 'volver'];
    
    if (globalCommands.includes(textLower)) {
      logger.info('global_command_detected', {
        command: textLower,
        phone: maskPhone(normalizedPhone),
        conversationId
      });
      
      // Buscar conversación por phone (si no tenemos conversationId)
      let targetConversationId = conversationId;
      if (!targetConversationId) {
        try {
          const conversationSnapshot = await collections.conversations()
            .where('phone', '==', normalizedPhone)
            .limit(1)
            .get();
          
          if (!conversationSnapshot.empty) {
            targetConversationId = conversationSnapshot.docs[0].id;
          }
        } catch (error) {
          logger.debug('Error buscando conversación para reset', {
            error: (error as Error)?.message,
            phone: maskPhone(normalizedPhone)
          });
        }
      }
      
      // Resetear sesión completa en Firestore
      if (targetConversationId) {
        try {
          await collections.conversations().doc(targetConversationId).update({
            // Resetear estado
            state: 'START',
            // Borrar datos de cliente
            cuit: null,
            nombre: null,
            clientName: null,
            displayName: null,
            // Borrar datos de sesión
            topic: null,
            subtopic: null,
            // Cerrar handoff
            handoffTo: null,
            handoffStatus: 'IA_ACTIVE',
            assignedTo: null,
            // Resetear flags
            initialGreetingShown: false,
            offTopicStrikes: 0,
            mutedUntil: null,
            // Mantener datos básicos
            updatedAt: new Date()
          });
          
          logger.info('session_reset_done', {
            conversationId: targetConversationId,
            phone: maskPhone(normalizedPhone),
            command: textLower
          });
        } catch (error) {
          logger.error('error_resetting_session', {
            conversationId: targetConversationId,
            error: (error as Error)?.message,
            phone: maskPhone(normalizedPhone)
          });
          // Continuar aunque falle el reset
        }
      }
      
      // El FSM manejará el reset cuando procese el mensaje START
      // No necesitamos resetear la sesión FSM aquí porque el comando global
      // será procesado por el FSM y reseteará su propia sesión
      
      // Responder con mensaje START exacto (no reformulado)
      const { FSMState, STATE_TEXTS } = await import('../fsm/states');
      const startMessage = STATE_TEXTS[FSMState.START];
      
      logger.info('reset_short_circuit_pipeline', {
        command: textLower,
        phone: maskPhone(normalizedPhone),
        conversationId: targetConversationId,
        repliesCount: 1,
        shortCircuit: true
      });
      
      // CORTAR TOTALMENTE el pipeline - retornar inmediatamente
      // NO continuar con handoff, payment, FSM, IA, ni ningún otro procesamiento
      // El return aquí debe ser respetado por el código que llama a generateBotReply
      // y NO debe continuar procesando el mensaje
      return {
        replies: [startMessage],
        via: 'fsm'
      };
    }
    
    // ============================================
    // FIN DEL PRE-HANDLER DE RESET
    // Si llegamos aquí, NO es un comando global de reset
    // ============================================
    
    // 0. Verificar si hay handoff activo (si hay, silenciar IA hasta HANDOFF_CLOSED)
    if (conversationId) {
      const handoffActive = await isHandoffActive(conversationId);
      if (handoffActive) {
        // Verificar si handoffTo está seteado pero no hay operatorPhone válido
        try {
          const conversationDoc = await collections.conversations().doc(conversationId).get();
          if (conversationDoc.exists) {
            const data = conversationDoc.data();
            const assignedToPhone = data?.assignedTo;
            const handoffTo = data?.handoffTo;
            
            // Si hay handoffTo pero no hay assignedTo (operatorPhone), limpiar
            if (handoffTo && (!assignedToPhone || assignedToPhone.trim() === '')) {
              logger.warn('handoff_to_without_phone_cleaning', {
                conversationId,
                handoffTo,
                phone: maskPhone(normalizedPhone)
              });
              await collections.conversations().doc(conversationId).update({
                handoffTo: null,
                handoffStatus: 'IA_ACTIVE',
                updatedAt: new Date()
              });
              // Continuar con flujo normal (IA)
            } else {
              // Verificar si el usuario escribe "menu" o "inicio" para resetear
              const textLower = text.toLowerCase().trim();
              if (textLower === 'menu' || textLower === 'inicio' || textLower === 'volver') {
                // Resetear handoff
                await collections.conversations().doc(conversationId).update({
                  handoffTo: null,
                  handoffStatus: 'IA_ACTIVE',
                  updatedAt: new Date()
                });
                // Continuar con flujo normal
              } else {
                // Si hay handoff activo válido, no responder automáticamente
                // El operador responderá manualmente
                logger.info('handoff_active_silencing_ia', { 
                  conversationId,
                  phone: maskPhone(normalizedPhone)
                });
                return {
                  replies: [],
                  via: 'handoff'
                };
              }
            }
          }
        } catch (error) {
          logger.error('error_checking_handoff_state', {
            conversationId,
            error: (error as Error)?.message
          });
          // Continuar con flujo normal si falla
        }
      }
    }

    // 1. Obtener estado de conversación y CUIT
    let isClient = false;
    let cuit: string | undefined;
    let nombre: string | undefined;
    let role: 'cliente' | 'no_cliente' | null = null;
    let offTopicStrikes = 0;
    let handoffTo: StaffMember = null;
    let initialGreetingShown = false;
    let isFirstMessage = false;
    
    // Intentar obtener información del cliente desde la conversación
    if (conversationId) {
      try {
        const conversationDoc = await collections.conversations().doc(conversationId).get();
        if (conversationDoc.exists) {
          const data = conversationDoc.data();
          isClient = data?.isClient || false;
          role = data?.role || (isClient ? 'cliente' : 'no_cliente');
          cuit = data?.cuit || undefined;
          nombre = data?.displayName || undefined;
          offTopicStrikes = data?.offTopicStrikes || 0;
          handoffTo = data?.handoffTo || null;
          initialGreetingShown = data?.initialGreetingShown || false;
          
          // Verificar si es el primer mensaje (no hay mensajes del bot aún)
          try {
            const botMessagesSnapshot = await collections.messages(conversationId)
              .where('from', 'in', ['bot', 'system', 'sistema'])
              .limit(1)
              .get();
            isFirstMessage = botMessagesSnapshot.empty;
          } catch (error) {
            // Si falla, asumir que no es el primero
            logger.debug('Error verificando primer mensaje', { error: (error as Error)?.message });
          }
          
          // Si hay CUIT pero no nombre, obtenerlo
          if (cuit && !nombre) {
            const cliente = await getDoc(cuit);
            if (cliente) {
              nombre = cliente.nombre;
            }
          }
        } else {
          // Si no existe conversación, es el primer mensaje
          isFirstMessage = true;
        }
      } catch (error) {
        logger.debug('Error obteniendo datos de conversación', { error: (error as Error)?.message });
        // Si falla, asumir que es el primer mensaje
        isFirstMessage = true;
      }
    } else {
      // Si no hay conversationId, es el primer mensaje
      isFirstMessage = true;
    }
    
    // 1.0. GUARD: Mostrar saludo inicial PREMIUM solo una vez
    if (isFirstMessage && !initialGreetingShown && !isOffTopic(text)) {
      const hasRoleOrCuit = !!(role || cuit);
      const greetingMessage = REPLIES.greetingInitial(hasRoleOrCuit);
      
      // Guardar flag en conversación
      if (conversationId) {
        await collections.conversations().doc(conversationId).update({
          initialGreetingShown: true,
          updatedAt: new Date()
        });
      }
      
      logger.info('initial_greeting_shown', {
        conversationId,
        phone: maskPhone(normalizedPhone),
        hasRoleOrCuit
      });
      
      return {
        replies: [greetingMessage],
        via: 'fsm'
      };
    }
    
    // 1.1. Extraer CUIT del texto si no está en conversación
    if (!cuit) {
      const extractedCuit = extractCUIT(text);
      if (extractedCuit) {
        cuit = extractedCuit;
        // Validar y buscar cliente
        const clienteResult = await getClienteByCuit(extractedCuit);
        if (clienteResult.exists && clienteResult.data) {
          isClient = true;
          role = 'cliente';
          nombre = clienteResult.data.nombre;
          
          // Guardar en conversación
          if (conversationId) {
            await collections.conversations().doc(conversationId).update({
              cuit: extractedCuit,
              role: 'cliente',
              displayName: nombre,
              isClient: true,
              updatedAt: new Date()
            });
            logger.info('cuit_extracted_and_client_identified', {
              conversationId,
              cuit: maskCuit(extractedCuit),
              phone: maskPhone(normalizedPhone),
              hasName: !!nombre
            });
          }
        } else {
          role = 'no_cliente';
          // Guardar en conversación
          if (conversationId) {
            await collections.conversations().doc(conversationId).update({
              cuit: extractedCuit,
              role: 'no_cliente',
              isClient: false,
              updatedAt: new Date()
            });
            logger.info('cuit_extracted_not_client', {
              conversationId,
              cuit: maskCuit(extractedCuit),
              phone: maskPhone(normalizedPhone)
            });
          }
        }
      }
    }
    
    // 1.2. GUARD: Verificar off-topic ANTES de procesar
    const isOffTopicMessage = isOffTopic(text);
    if (isOffTopicMessage) {
      // Verificar si está muted (después de 2 strikes)
      if (conversationId) {
        const conversationDoc = await collections.conversations().doc(conversationId).get();
        if (conversationDoc.exists) {
          const data = conversationDoc.data();
          const mutedUntil = data?.mutedUntil;
          if (mutedUntil) {
            const mutedDate = mutedUntil.toDate ? mutedUntil.toDate() : new Date(mutedUntil);
            if (mutedDate > new Date()) {
              // Está muted, no responder
              logger.info('off_topic_muted', { 
                conversationId, 
                mutedUntil: mutedDate.toISOString(),
                textPreview: text.substring(0, 50) 
              });
              return {
                replies: [],
                via: 'fsm'
              };
            }
          }
        }
      }
      
      offTopicStrikes += 1;
      
      // Calcular mutedUntil si es 2da vez o más (mute por 30 minutos)
      const mutedUntil = offTopicStrikes >= 2 
        ? new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
        : null;
      
      // Guardar strikes y mutedUntil en conversación
      if (conversationId) {
        const updateData: any = {
          offTopicStrikes,
          updatedAt: new Date()
        };
        if (mutedUntil) {
          updateData.mutedUntil = mutedUntil;
        }
        await collections.conversations().doc(conversationId).update(updateData);
      }
      
      // 1ra vez: respuesta amable
      if (offTopicStrikes === 1) {
        logger.info('off_topic_first_strike', { 
          conversationId, 
          phone: maskPhone(normalizedPhone),
          textPreview: text.substring(0, 50) 
        });
        return {
          replies: [REPLIES.offTopicFirst],
          via: 'fsm'
        };
      }
      
      // 2da vez o más: cierre amable, NO llamar IA
      logger.info('off_topic_second_strike_closing', { 
        conversationId, 
        strikes: offTopicStrikes,
        phone: maskPhone(normalizedPhone),
        mutedUntil: mutedUntil?.toISOString()
      });
      return {
        replies: [REPLIES.offTopicSecond],
        via: 'fsm'
      };
    }
    
    // 1.3. GUARD: Verificar si debe pedir CUIT
    if (!cuit && !role) {
      // Contar mensajes del usuario en la conversación
      let messageCount = 0;
      if (conversationId) {
        try {
          const messagesSnapshot = await collections.messages(conversationId)
            .where('from', '==', 'usuario')
            .get();
          messageCount = messagesSnapshot.size;
        } catch (error) {
          logger.debug('Error contando mensajes para CUIT', { error: (error as Error)?.message });
        }
      }
      
      const shouldAsk = shouldAskForCUIT({ role, cuit }, text, messageCount);
      if (shouldAsk) {
        logger.info('should_ask_for_cuit', { 
          conversationId, 
          messageCount, 
          phone: maskPhone(normalizedPhone),
          textPreview: text.substring(0, 50) 
        });
        return {
          replies: [REPLIES.askCuit],
          via: 'fsm'
        };
      }
    }
    
    // 1.4. GUARD: Routing por keywords (derivación a staff)
    // Solo hacer handoff si hay match claro (menciona nombre o keywords fuertes)
    const staffRouting = routeToStaff(text);
    if (staffRouting.staff && conversationId) {
      // Validar que el motivo sea válido (no default_ivan ni no_match)
      const validReasons = ['mentioned_directly', 'keyword_match'];
      if (!validReasons.includes(staffRouting.reason)) {
        // No hacer handoff si no hay match claro
        logger.debug('staff_routing_skipped_invalid_reason', {
          conversationId,
          reason: staffRouting.reason,
          phone: maskPhone(normalizedPhone)
        });
      } else {
        const staffName = getStaffName(staffRouting.staff);
        logger.info('staff_routing_detected', {
          conversationId,
          staff: staffRouting.staff,
          reason: staffRouting.reason,
          phone: maskPhone(normalizedPhone),
          textPreview: text.substring(0, 50)
        });
        
        // Realizar handoff (validará operatorPhone internamente)
        try {
          const conversationDoc = await collections.conversations().doc(conversationId).get();
          const conversationData = conversationDoc.exists ? conversationDoc.data() : null;
          await performHandoff(
            conversationId,
            normalizedPhone,
            conversationData?.name || nombre || null,
            text,
            staffRouting.staff
          );
          
          // Solo guardar handoffTo si performHandoff fue exitoso
          await collections.conversations().doc(conversationId).update({
            handoffTo: staffRouting.staff,
            updatedAt: new Date()
          });
          
          return {
            replies: [REPLIES.handoffTo(staffName)],
            via: 'handoff'
          };
        } catch (error) {
          // Si falla por falta de operatorPhone, continuar con flujo normal (IA)
          logger.warn('error_performing_staff_handoff_continuing', { 
            error: (error as Error)?.message,
            phone: maskPhone(normalizedPhone),
            staff: staffRouting.staff
          });
          // NO setear handoffTo, continuar con flujo normal
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
          phone: maskPhone(normalizedPhone),
          conversationId,
          cuit: cuit ? maskCuit(cuit) : undefined,
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
    
    // 2.5. Verificar respuestas automáticas (horario/palabras clave)
    // Esto tiene prioridad sobre FSM e IA
    const autoReply = await findAutoReply(text, isClient);
    if (autoReply) {
      logger.info('auto_reply_applied', {
        phone: maskPhone(normalizedPhone),
        conversationId,
        isClient,
        responseLength: autoReply.length
      });
      return {
        replies: [autoReply],
        via: 'fsm'
      };
    }

    // ============================================
    // PASO 1: EJECUTAR FSM PRIMERO (FUENTE DE VERDAD)
    // ============================================
    const fsm = getFSMManager();
    const fsmResult = await fsm.processMessage(normalizedPhone, text);
    
    // Obtener el primer mensaje del FSM (normalmente hay solo uno)
    const fsmMessage = fsmResult.replies[0] || '';
    
    logger.info('fsm_executed_first', {
      phone: maskPhone(normalizedPhone),
      conversationId,
      fsmRepliesCount: fsmResult.replies.length,
      fsmMessagePreview: fsmMessage.substring(0, 50),
      handoffTo: handoffTo || null,
      messageType: messageType || 'text'
    });
    
    // ============================================
    // PASO 2: VERIFICAR SI SE PUEDE REFORMULAR CON IA
    // ============================================
    
    // NO reformular si:
    // 1. Hay handoff activo (handoffTo está seteado)
    // 2. Es un audio
    // 3. El mensaje es exacto (START, menú, derivaciones, etc.)
    // 4. No hay IA disponible
    
    const hasHandoffActive = !!handoffTo;
    const isAudio = messageType === 'audio' || messageType === 'voice';
    const isExactMessage = !canRewriteMessage(fsmMessage);
    const aiAvailable = await canUseAi();
    const hasAiKey = !!config.openaiApiKey;
    
    // Log de verificación
    logger.info('ai_rewrite_check', {
      phone: maskPhone(normalizedPhone),
      conversationId,
      hasHandoffActive,
      isAudio,
      isExactMessage,
      aiAvailable,
      hasAiKey,
      canRewrite: !hasHandoffActive && !isAudio && !isExactMessage && aiAvailable && hasAiKey
    });
    
    // Si NO se puede reformular, usar mensaje del FSM directamente
    if (hasHandoffActive || isAudio || isExactMessage || !aiAvailable || !hasAiKey) {
      let skipReason = '';
      if (hasHandoffActive) skipReason = 'handoff_active';
      else if (isAudio) skipReason = 'audio_message';
      else if (isExactMessage) skipReason = 'exact_message';
      else if (!aiAvailable) skipReason = 'ai_not_available';
      else if (!hasAiKey) skipReason = 'no_ai_key';
      
      logger.info('ai_rewrite_skipped', {
        phone: maskPhone(normalizedPhone),
        conversationId,
        reason: skipReason,
        fsmMessagePreview: fsmMessage.substring(0, 50)
      });
      
      return {
        replies: fsmResult.replies,
        via: 'fsm'
      };
    }
    
    // ============================================
    // PASO 3: REFORMULAR CON IA (SI CORRESPONDE)
    // ============================================
    try {
      const rewritten = await aiRewrite(fsmMessage, {
        role: role || (isClient ? 'cliente' : 'no_cliente'),
        nombre,
        cuit,
        conversationId
      });
      
      if (rewritten && rewritten.trim().length > 0) {
        logger.info('ai_rewrite_applied', {
          phone: maskPhone(normalizedPhone),
          conversationId,
          originalLength: fsmMessage.length,
          rewrittenLength: rewritten.length
        });
        
        return {
          replies: [rewritten],
          via: 'ai' // Marcar como 'ai' aunque sea reformulación
        };
      } else {
        // Si la reformulación falló o devolvió null, usar FSM
        logger.debug('ai_rewrite_failed_using_fsm', {
          phone: maskPhone(normalizedPhone),
          conversationId,
          fsmMessagePreview: fsmMessage.substring(0, 50)
        });
        
        return {
          replies: fsmResult.replies,
          via: 'fsm'
        };
      }
    } catch (error) {
      const msg = (error as Error)?.message ?? String(error);
      logger.warn('ai_rewrite_error_using_fsm', {
        phone: maskPhone(normalizedPhone),
        conversationId,
        error: msg,
        fsmMessagePreview: fsmMessage.substring(0, 50)
      });
      
      // Si falla la reformulación, usar mensaje del FSM
      return {
        replies: fsmResult.replies,
        via: 'fsm'
      };
    }
    
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error generando respuesta del bot', {
      phone: maskPhone(normalizedPhone),
      conversationId,
      error: msg
    });
    
    // Fallback de emergencia
    return {
      replies: ['Lo siento, hubo un error. Por favor intentá de nuevo.'],
      via: 'fsm'
    };
  }
}

