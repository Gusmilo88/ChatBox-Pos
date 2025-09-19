import { Router } from 'express';
import { z } from 'zod';
import { FSMSessionManager } from '../fsm/engine';
import { ClientsRepository } from '../services/clientsRepo';
import { LeadsRepository } from '../services/leadsRepo';
import { aiReply, AiContext } from '../services/ai';
import logger from '../libs/logger';
import config from '../config/env';

// Esquema de validación para el request
const MessageRequestSchema = z.object({
  from: z.string().min(1, 'from es requerido'),
  text: z.string().min(1, 'text es requerido')
});

const router = Router();

// Instancias globales
const fsmManager = new FSMSessionManager();
const clientsRepo = new ClientsRepository(config.leadsFile);
const leadsRepo = new LeadsRepository(config.leadsFile);

router.post('/simulate/message', async (req, res) => {
  try {
    // Validar request
    const validationResult = MessageRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: validationResult.error.issues
      });
    }

    const { from, text } = validationResult.data;

    // Log del request entrante
    logger.info(`Mensaje recibido de ${from}: ${text}`);

    // Procesar mensaje con FSM
    const result = await fsmManager.processMessage(from, text);

    // Si es un cliente válido, verificar en la base de datos
    if (result.session.state === 'CLIENTE_MENU' && result.session.data.cuit) {
      const isClient = clientsRepo.existsByCuit(result.session.data.cuit);
      if (!isClient) {
        // No es cliente, redirigir al flujo de no-cliente
        result.session.state = 'NO_CLIENTE_NAME';
        result.replies = ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
      }
    }

    // Si se completó el flujo de no-cliente, guardar lead
    if (result.session.state === 'HUMANO' && result.session.data.name && result.session.data.email && result.session.data.interest) {
      try {
        await leadsRepo.saveLead(
          from,
          result.session.data.name,
          result.session.data.email,
          result.session.data.interest,
          result.session.data.cuit
        );
        logger.info(`Lead guardado para ${from}: ${result.session.data.name}`);
      } catch (error) {
        logger.error('Error guardando lead:', error);
      }
    }

    // Log de la respuesta
    logger.info(`Respuesta enviada a ${from}: ${result.replies.join(', ')}`);

    res.json({ replies: result.replies });

  } catch (error) {
    logger.error('Error procesando mensaje:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      replies: ['Lo siento, hubo un error. Por favor intentá de nuevo.']
    });
  }
});

// Endpoint de prueba para IA
const AiTestSchema = z.object({
  role: z.enum(['cliente', 'no_cliente']),
  interest: z.enum(['alta_cliente', 'honorarios', 'turno_consulta', 'otras_consultas']).optional(),
  text: z.string().min(1, 'text es requerido')
});

router.post('/ai', async (req, res) => {
  try {
    // Validar request
    const validationResult = AiTestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: validationResult.error.issues
      });
    }

    const { role, interest, text } = validationResult.data;

    // Crear contexto para IA
    const aiContext: AiContext = {
      role: role as 'cliente' | 'no_cliente',
      interest: interest as any,
      lastUserText: text
    };

    // Llamar a IA
    const reply = await aiReply(aiContext);

    res.json({ reply });

  } catch (error) {
    logger.error('Error en endpoint de IA:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      reply: 'Lo siento, hubo un error. Por favor intentá de nuevo.'
    });
  }
});

export default router;
