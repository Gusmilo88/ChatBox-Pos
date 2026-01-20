import { FSMSessionManager } from '../fsm/engine';
import logger from '../libs/logger';
import { REPLIES, maskPhone } from './replies';
import { collections } from '../firebase';

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
 * Genera una respuesta del bot usando FSM mínima
 */
export async function generateBotReply(
  phone: string,
  text: string,
  conversationId?: string,
  messageType?: string
): Promise<{ replies: string[]; via: 'fsm'; handledByInteractive?: boolean }> {
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

    // FSM: Procesar con FSM (pasar conversationId si está disponible)
    const fsm = getFSMManager();
    const fsmResult = await fsm.processMessage(normalizedPhone, text, undefined, conversationId);
    
    logger.info('bot_reply_generated', {
      conversationId,
      phone: maskPhone(normalizedPhone),
      repliesCount: fsmResult.replies.length,
      via: 'fsm',
      state: fsmResult.session.state,
      handledByInteractive: fsmResult.handledByInteractive || false
    });

    // Si se manejó con interactive menu, log específico
    if (fsmResult.handledByInteractive) {
      logger.info('fsm_handled_by_interactive', {
        conversationId,
        phone: maskPhone(normalizedPhone),
        state: fsmResult.session.state
      });
    }

    return {
      replies: fsmResult.replies,
      via: 'fsm',
      handledByInteractive: fsmResult.handledByInteractive
    };
  } catch (error) {
    logger.error('error_generating_bot_reply', {
      conversationId,
      phone: maskPhone(normalizedPhone),
      error: (error as Error)?.message
    });

    // Fallback silencioso: no enviar nada en caso de error
    return {
      replies: [],
      via: 'fsm'
    };
  }
}
