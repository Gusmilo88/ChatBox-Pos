import { Session, SessionData } from '../types/message';
import { FSMState, GlobalCommands, STATE_TEXTS } from './states';
import { validarCUIT } from '../utils/cuit';
import logger from '../libs/logger';
import { aiReply, AiContext } from '../services/ai';

export class FSMSessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  private formatARS(n: number): string {
    return n.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2
    });
  }

  constructor() {
    // Limpieza automática cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionAge = (now.getTime() - session.lastActivityAt.getTime()) / (1000 * 60);
      if (sessionAge > session.ttl) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
      logger.info(`Sesión expirada eliminada: ${sessionId}`);
    });

    if (expiredSessions.length > 0) {
      logger.info(`Limpieza completada: ${expiredSessions.length} sesiones eliminadas`);
    }
  }

  private getOrCreateSession(from: string): Session {
    let session = this.sessions.get(from);
    
    if (!session) {
      session = {
        id: from,
        state: FSMState.START,
        data: {},
        createdAt: new Date(),
        lastActivityAt: new Date(),
        ttl: 30 // 30 minutos
      };
      this.sessions.set(from, session);
      logger.info(`Nueva sesión creada: ${from}`);
    } else {
      session.lastActivityAt = new Date();
    }

    return session;
  }

  private handleGlobalCommands(text: string, session: Session): string[] | null {
    const msg = text.trim().toLowerCase();
    
    // Comandos globales que SIEMPRE resetean a START
    if (['menu', 'inicio', 'volver', 'start'].includes(msg)) {
      session.state = FSMState.START;
      session.data = {};
      logger.info(`Sesión ${session.id} reseteada a START por comando global: ${msg}`);
      return [STATE_TEXTS[FSMState.START]];
    }
    
    // Comando humano (no resetea, solo deriva)
    if (msg === 'humano') {
      session.state = FSMState.HUMANO;
      logger.info(`Sesión ${session.id} derivada a humano`);
      return [STATE_TEXTS[FSMState.HUMANO]];
    }

    return null;
  }

  public async processMessage(from: string, text: string): Promise<{ session: Session; replies: string[] }> {
    const session = this.getOrCreateSession(from);
    
    // Verificar comandos globales primero
    const globalResponse = this.handleGlobalCommands(text, session);
    if (globalResponse) {
      return { session, replies: globalResponse };
    }

    // Procesar según el estado actual
    const result = await this.processState(session, text);
    
    // Actualizar sesión
    session.lastActivityAt = new Date();
    this.sessions.set(from, session);
    
    logger.info(`Transición de estado: ${session.id} -> ${session.state}`);
    
    return { session, replies: result };
  }

  private async processState(session: Session, text: string): Promise<string[]> {
    switch (session.state) {
      case FSMState.START:
        return this.handleStart(session, text);
      
      case FSMState.WAIT_CUIT:
        return this.handleWaitCuit(session, text);
      
      case FSMState.CLIENTE_MENU:
        return await this.handleClienteMenu(session, text);
      
      case FSMState.NO_CLIENTE_NAME:
        return this.handleNoClienteName(session, text);
      
      case FSMState.NO_CLIENTE_EMAIL:
        return this.handleNoClienteEmail(session, text);
      
      case FSMState.NO_CLIENTE_INTEREST:
        return await this.handleNoClienteInterest(session, text);
      
      case FSMState.HUMANO:
        return [STATE_TEXTS[FSMState.HUMANO]];
      
      default:
        session.state = FSMState.START;
        return [STATE_TEXTS[FSMState.START]];
    }
  }

  private handleStart(session: Session, text: string): string[] {
    const lowerText = text.toLowerCase().trim();
    
    if (lowerText === 'quiero info') {
      session.state = FSMState.NO_CLIENTE_NAME;
      return [STATE_TEXTS[FSMState.NO_CLIENTE_NAME]];
    }
    
    // Asumir que es un CUIT
    if (validarCUIT(text)) {
      session.data.cuit = text;
      session.state = FSMState.CLIENTE_MENU;
      return [STATE_TEXTS[FSMState.CLIENTE_MENU]];
    } else {
      session.state = FSMState.WAIT_CUIT;
      return [STATE_TEXTS[FSMState.WAIT_CUIT]];
    }
  }

  private handleWaitCuit(session: Session, text: string): string[] {
    if (validarCUIT(text)) {
      session.data.cuit = text;
      session.state = FSMState.CLIENTE_MENU;
      return [STATE_TEXTS[FSMState.CLIENTE_MENU]];
    } else {
      return [STATE_TEXTS[FSMState.WAIT_CUIT]];
    }
  }

  private async handleClienteMenu(session: Session, text: string): Promise<string[]> {
    const raw = text.trim().toLowerCase();
    
    // Mapear entradas 1/2/3/4 y sinónimos
    const isSaldo = raw === '1' || raw.includes('saldo');
    const isComp = raw === '2' || raw.includes('comprobante');
    const isHum = raw === '3' || /humano|asesor|agente/.test(raw);
    const isInicio = raw === '4' || /inicio|menu/.test(raw);
    
    if (isSaldo) {
      const cuit = session.data.cuit;
      if (!cuit) {
        return ['No tengo tu CUIT registrado. Volvé al inicio.'];
      }
      
      try {
        const clientsRepo = new (await import('../services/clientsRepo')).ClientsRepository('./data/base_noclientes.xlsx');
        const monto = await clientsRepo.getSaldo(cuit) ?? 0;
        const montoFormateado = this.formatARS(monto);
        return [`Tu saldo al día es ARS ${montoFormateado}. Si ves algo raro, decime y te derivamos con el equipo.`];
      } catch (error) {
        logger.error('Error obteniendo saldo:', error);
        return ['Error obteniendo tu saldo. Te derivamos con el equipo.'];
      }
    }
    
    if (isComp) {
      const cuit = session.data.cuit;
      if (!cuit) {
        return ['No tengo tu CUIT registrado. Volvé al inicio.'];
      }
      
      try {
        const clientsRepo = new (await import('../services/clientsRepo')).ClientsRepository('./data/base_noclientes.xlsx');
        const items = await clientsRepo.getUltimosComprobantes(cuit);
        
        if (items.length === 0) {
          return ['Por ahora no encuentro comprobantes recientes. ¿Querés que te los envíe por mail o te derivamos con el equipo?'];
        }
        
        const lista = items.slice(0, 3).map(item => `• ${item}`).join('\n');
        return [`Últimos comprobantes:\n${lista}\n¿Querés que te los reenviemos por mail?`];
      } catch (error) {
        logger.error('Error obteniendo comprobantes:', error);
        return ['Error obteniendo tus comprobantes. Te derivamos con el equipo.'];
      }
    }
    
    if (isHum) {
      session.state = FSMState.HUMANO;
      return ['Listo, te derivamos con el equipo. ¡Gracias! 🙌'];
    }
    
    if (isInicio) {
      session.state = FSMState.START;
      session.data = {};
      return [STATE_TEXTS[FSMState.START]];
    }
    
    // Si no coincide con ninguna opción, re-mostrar menú
    return [STATE_TEXTS[FSMState.CLIENTE_MENU]];
  }

  private handleNoClienteName(session: Session, text: string): string[] {
    session.data.name = text;
    session.state = FSMState.NO_CLIENTE_EMAIL;
    return [STATE_TEXTS[FSMState.NO_CLIENTE_EMAIL]];
  }

  private handleNoClienteEmail(session: Session, text: string): string[] {
    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      return ['Por favor, ingresá un email válido.'];
    }
    
    session.data.email = text;
    session.state = FSMState.NO_CLIENTE_INTEREST;
    return [STATE_TEXTS[FSMState.NO_CLIENTE_INTEREST]];
  }

  private async handleNoClienteInterest(session: Session, text: string): Promise<string[]> {
    const validInterests = ['alta cliente', 'honorarios', 'turno_consulta', 'otras_consultas'];
    const lowerText = text.toLowerCase().trim();
    
    if (!validInterests.includes(lowerText)) {
      return ['Por favor, elegí una de las opciones: alta cliente / honorarios / turno_consulta / otras_consultas'];
    }
    
    session.data.interest = lowerText;
    
    // Si es "otras_consultas", usar IA
    if (lowerText === 'otras_consultas') {
      try {
        const aiContext: AiContext = {
          role: 'no_cliente',
          interest: 'otras_consultas',
          lastUserText: text
        };
        
        const aiResponse = await aiReply(aiContext);
        return [aiResponse + " ¿Querés que te derive con el equipo?"];
      } catch (error) {
        logger.error('Error en IA para no-cliente:', error);
        session.state = FSMState.HUMANO;
        return [STATE_TEXTS[FSMState.HUMANO]];
      }
    }
    
    // Para otros intereses, mantener flujo actual
    session.state = FSMState.HUMANO;
    
    // TODO: Guardar lead en leadsRepo
    logger.info(`Lead completado: ${JSON.stringify(session.data)}`);
    
    return [STATE_TEXTS[FSMState.HUMANO]];
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
