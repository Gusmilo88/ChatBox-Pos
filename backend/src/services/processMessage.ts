import { generateBotReply } from './botReply';
import logger from '../libs/logger';

export async function processInbound(
  from: string, 
  text: string, 
  conversationId?: string
): Promise<string[]> {
  const result = await generateBotReply(from, text, conversationId);
  
  logger.info('whatsapp_inbound_processed', { 
    fromMasked: from?.slice(0,3)+'***'+from?.slice(-2), 
    repliesCount: result.replies?.length ?? 0,
    via: result.via
  });
  
  return result.replies;
}
