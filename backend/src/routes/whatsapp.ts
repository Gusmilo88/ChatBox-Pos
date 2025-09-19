import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import logger from '../libs/logger';
import { processInbound } from '../services/processMessage';

const router = Router();

// Esquema de validación para el webhook de WhatsApp
const WhatsAppWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    changes: z.array(z.object({
      value: z.object({
        messages: z.array(z.object({
          from: z.string(),
          id: z.string(),
          timestamp: z.string(),
          type: z.string(),
          text: z.object({
            body: z.string()
          }).optional()
        })).optional()
      }).optional()
    })).optional()
  })).optional()
});

// Función para verificar firma de Meta
function verifySignature(appSecret: string, raw: Buffer, header: string): boolean {
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// GET /webhook/whatsapp - Verificación inicial
router.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': verifyToken, 'hub.challenge': challenge } = req.query;
  
  if (mode === 'subscribe' && verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) {
    logger.info('WhatsApp webhook verified', { mode, challenge });
    return res.status(200).send(challenge);
  }
  
  logger.warn('WhatsApp webhook verification failed', { mode, verifyToken });
  return res.status(403).json({ error: 'verification_failed' });
});

// POST /webhook/whatsapp - Mensajes entrantes
router.post('/', (req, res) => {
  try {
    // Verificar firma si APP_SECRET está configurado
    const appSecret = process.env.APP_SECRET;
    if (appSecret) {
      const signature = req.header('x-hub-signature-256');
      const rawBody = req.body;
      
      if (!signature || !verifySignature(appSecret, rawBody, signature)) {
        logger.warn('Invalid WhatsApp signature', { signature: signature?.slice(0, 10) + '...' });
        return res.status(401).json({ error: 'invalid_signature' });
      }
    }

    // Validar estructura del webhook
    const validationResult = WhatsAppWebhookSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.warn('Invalid WhatsApp webhook structure', { errors: validationResult.error.errors });
      return res.status(400).json({ error: 'invalid_webhook_structure' });
    }

    const data = validationResult.data;
    let processedMessages = 0;

    // Procesar mensajes de texto
    if (data.entry) {
      for (const entry of data.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.value?.messages) {
              for (const message of change.value.messages) {
                if (message.type === 'text' && message.text?.body) {
                  // Procesar mensaje con FSM
                  processInbound(message.from, message.text.body)
                    .then(replies => {
                      logger.info('WhatsApp message processed', {
                        from: message.from.slice(0, 3) + '***' + message.from.slice(-2),
                        messageId: message.id,
                        repliesCount: replies.length
                      });
                    })
                    .catch(error => {
                      logger.error('Error processing WhatsApp message', { error, messageId: message.id });
                    });
                  
                  processedMessages++;
                }
              }
            }
          }
        }
      }
    }

    logger.info('WhatsApp webhook received', { 
      object: data.object,
      processedMessages 
    });

    // Responder rápidamente a Meta
    res.status(200).json({ received: true, n_messages: processedMessages });

  } catch (error) {
    logger.error('WhatsApp webhook error', { error });
    res.status(500).json({ error: 'internal_server_error' });
  }
});

export default router;
