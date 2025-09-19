import { FSMSessionManager } from '../fsm/engine';
import logger from '../libs/logger';

// Instancia global del session manager
let sessionManager: FSMSessionManager | null = null;

function getSessionManager(): FSMSessionManager {
  if (!sessionManager) {
    sessionManager = new FSMSessionManager();
  }
  return sessionManager;
}

export async function processInbound(from: string, text: string): Promise<string[]> {
  const sm = getSessionManager();
  const result = await sm.processMessage(from, text);
  
  logger.info('whatsapp_inbound_processed', { 
    fromMasked: from?.slice(0,3)+'***'+from?.slice(-2), 
    repliesCount: result.replies?.length ?? 0 
  });
  
  return result.replies;
}
