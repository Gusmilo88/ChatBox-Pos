import { Session, SessionData } from '../types/message';
import { FSMState, GlobalCommands, STATE_TEXTS } from './states';
import { validarCUIT } from '../utils/cuit';
import logger from '../libs/logger';
import { aiReply, AiContext } from '../services/ai';
import { existsByCuit } from '../services/clientsRepo';

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

    // Si está en cualquier estado de cliente y dice "hola", volver al menú del cliente si tiene CUIT
    if ([FSMState.HUMANO, FSMState.CLIENTE_REUNION, FSMState.CLIENTE_ARCA, FSMState.CLIENTE_FACTURA, FSMState.CLIENTE_VENTAS, FSMState.CLIENTE_IVAN].includes(session.state) && ['hola', 'holi', 'holis', 'buenos días', 'buenas tardes', 'buenas noches', 'saludos'].includes(msg)) {
      if (session.data.cuit) {
        session.state = FSMState.CLIENTE_MENU;
        logger.info(`Sesión ${session.id} volvió al menú del cliente desde ${session.state}`);
        return [STATE_TEXTS[FSMState.CLIENTE_MENU]];
      } else {
        session.state = FSMState.START;
        session.data = {};
        logger.info(`Sesión ${session.id} reseteada a START desde ${session.state}`);
        return [STATE_TEXTS[FSMState.START]];
      }
    }

    // Si está en cualquier estado y dice algo que no es comando específico, volver al inicio
    if ([FSMState.HUMANO, FSMState.CLIENTE_REUNION, FSMState.CLIENTE_ARCA, FSMState.CLIENTE_FACTURA, FSMState.CLIENTE_VENTAS, FSMState.CLIENTE_IVAN].includes(session.state)) {
      // Si es texto corto (1-2 caracteres) o no es comando específico, volver al inicio
      if (text.length <= 2 || !['1', '2', '3', '4', '5', 'menu', 'inicio', 'volver', 'start', 'humano'].includes(msg)) {
        session.state = FSMState.START;
        session.data = {};
        logger.info(`Sesión ${session.id} reseteada a START desde ${session.state} por texto: ${text}`);
        return [STATE_TEXTS[FSMState.START]];
      }
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
        return await this.handleStart(session, text);
      
      case FSMState.WAIT_CUIT:
        return await this.handleWaitCuit(session, text);
      
      case FSMState.CLIENTE_MENU:
        return await this.handleClienteMenu(session, text);
      
      case FSMState.CLIENTE_ARCA:
        return this.handleClienteArca(session, text);
      
      case FSMState.CLIENTE_FACTURA:
        return this.handleClienteFactura(session, text);
      
      case FSMState.CLIENTE_VENTAS:
        return this.handleClienteVentas(session, text);
      
      case FSMState.CLIENTE_REUNION:
        return this.handleClienteReunion(session, text);
      
      case FSMState.CLIENTE_IVAN:
        return this.handleClienteIvan(session, text);
      
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

  private async handleStart(session: Session, text: string): Promise<string[]> {
    const lowerText = text.toLowerCase().trim();
    
    // Si es un CUIT válido, verificar si existe en la base de datos
    if (validarCUIT(text)) {
      try {
        logger.info(`Verificando CUIT: ${text}`);
        const isClient = await existsByCuit(text);
        logger.info(`Resultado verificación CUIT ${text}: ${isClient}`);
        if (isClient) {
          session.data.cuit = text;
          // Obtener nombre del cliente desde la misma fuente que verifica existsByCuit
          try {
            const { getDb } = await import('../firebase');
            const db = getDb();
            const snapshot = await db.collection('clientes').where('cuit', '==', text).limit(1).get();
            const nombre = snapshot.empty ? null : snapshot.docs[0].data().nombre;
            if (!nombre) {
              session.state = FSMState.NO_CLIENTE_NAME;
              return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
            }
            session.state = FSMState.CLIENTE_MENU;
            return [`¡Hola ${nombre}! 👋 Soy el asistente 🤖 de POS & Asociados. Elegí una opción:\n\n1. Consultar mi estado general en ARCA e Ingresos Brutos\n2. Solicitar una factura electrónica\n3. Enviar las ventas del mes\n4. Agendar una reunión\n5. Hablar con Iván por otras consultas`];
          } catch (error) {
            logger.error('Error obteniendo nombre del cliente:', error);
            session.state = FSMState.NO_CLIENTE_NAME;
            return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
          }
        } else {
          session.state = FSMState.NO_CLIENTE_NAME;
          return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
        }
      } catch (error) {
        logger.error('Error verificando cliente:', error);
        session.state = FSMState.NO_CLIENTE_NAME;
        return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
      }
    }
    
    // Opción 1: Soy cliente
    if (lowerText === '1' || lowerText.includes('soy cliente') || lowerText.includes('cliente')) {
      return ["Perfecto! Para continuar, necesito tu CUIT (solo números)."];
    }
    
    // Opción 2: Quiero ser cliente / Consultar servicios
    if (lowerText === '2' || lowerText.includes('quiero ser cliente') || lowerText.includes('consultar servicios') || lowerText.includes('quiero info')) {
      session.state = FSMState.NO_CLIENTE_NAME;
      return [STATE_TEXTS[FSMState.NO_CLIENTE_NAME]];
    }
    
    // Para CUALQUIER otro texto (hola, abc, etc.), mostrar el menú inicial
    return [STATE_TEXTS[FSMState.START]];
  }

  private async handleWaitCuit(session: Session, text: string): Promise<string[]> {
    if (validarCUIT(text)) {
      // Verificar si el CUIT existe en la base de datos
      try {
        logger.info(`Verificando CUIT (WaitCuit): ${text}`);
        const isClient = await existsByCuit(text);
        logger.info(`Resultado verificación CUIT (WaitCuit) ${text}: ${isClient}`);
        if (isClient) {
          session.data.cuit = text;
          // Obtener nombre del cliente desde la misma fuente que verifica existsByCuit
          try {
            const { getDb } = await import('../firebase');
            const db = getDb();
            const snapshot = await db.collection('clientes').where('cuit', '==', text).limit(1).get();
            const nombre = snapshot.empty ? null : snapshot.docs[0].data().nombre;
            if (!nombre) {
              session.state = FSMState.NO_CLIENTE_NAME;
              return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
            }
            session.state = FSMState.CLIENTE_MENU;
            return [`¡Hola ${nombre}! 👋 Soy el asistente 🤖 de POS & Asociados. Elegí una opción:\n\n1. Consultar mi estado general en ARCA e Ingresos Brutos\n2. Solicitar una factura electrónica\n3. Enviar las ventas del mes\n4. Agendar una reunión\n5. Hablar con Iván por otras consultas`];
          } catch (error) {
            logger.error('Error obteniendo nombre del cliente:', error);
            session.state = FSMState.NO_CLIENTE_NAME;
            return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
          }
        } else {
          session.state = FSMState.NO_CLIENTE_NAME;
          return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
        }
      } catch (error) {
        logger.error('Error verificando cliente:', error);
        session.state = FSMState.NO_CLIENTE_NAME;
        return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
      }
    } else {
      return [STATE_TEXTS[FSMState.WAIT_CUIT]];
    }
  }

  private async handleClienteMenu(session: Session, text: string): Promise<string[]> {
    const raw = text.trim().toLowerCase();
    
    // Opción 1: Consultar ARCA e Ingresos Brutos
    if (raw === '1' || raw.includes('arca') || raw.includes('ingresos brutos') || raw.includes('estado')) {
      session.state = FSMState.CLIENTE_ARCA;
      return [STATE_TEXTS[FSMState.CLIENTE_ARCA]];
    }
    
    // Opción 2: Solicitar factura electrónica
    if (raw === '2' || raw.includes('factura') || raw.includes('facturación')) {
      session.state = FSMState.CLIENTE_FACTURA;
      return [STATE_TEXTS[FSMState.CLIENTE_FACTURA]];
    }
    
    // Opción 3: Enviar ventas del mes
    if (raw === '3' || raw.includes('ventas') || raw.includes('venta') || raw.includes('planilla')) {
      session.state = FSMState.CLIENTE_VENTAS;
      return [STATE_TEXTS[FSMState.CLIENTE_VENTAS]];
    }
    
    // Opción 4: Agendar reunión
    if (raw === '4' || raw.includes('reunión') || raw.includes('agendar') || raw.includes('cita')) {
      session.state = FSMState.CLIENTE_REUNION;
      return [STATE_TEXTS[FSMState.CLIENTE_REUNION]];
    }
    
    // Opción 5: Hablar con Iván
    if (raw === '5' || raw.includes('iván') || raw.includes('ivan') || raw.includes('hablar') || raw.includes('consulta')) {
      session.state = FSMState.CLIENTE_IVAN;
      return [STATE_TEXTS[FSMState.CLIENTE_IVAN]];
    }
    
    // Si no coincide con ninguna opción, mostrar el menú nuevamente
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

  // Handlers para los nuevos estados de cliente
  private handleClienteArca(session: Session, text: string): string[] {
    const raw = text.trim().toLowerCase();
    
    if (raw === '1' || raw.includes('gracias') || raw.includes('consulta') || raw.includes('app')) {
      return ["¡Perfecto! 🎉 Cualquier duda que tengas, no dudes en consultarnos."];
    }
    
    if (raw === '2' || raw.includes('persona') || raw.includes('asesor') || raw.includes('ayuda')) {
      session.state = FSMState.HUMANO;
      logger.info(`Sesión ${session.id} derivada a Belén Maidana (1131134588)`);
      return ["Te derivamos con Belén Maidana (1131134588) para que te asista personalmente. ¡Gracias!"];
    }
    
    return [STATE_TEXTS[FSMState.CLIENTE_ARCA]];
  }

  private handleClienteFactura(session: Session, text: string): string[] {
    // Si el usuario envía información de factura, derivar a Belén
    session.state = FSMState.HUMANO;
    logger.info(`Sesión ${session.id} derivada a Belén Maidana (1131134588) para factura`);
    return ["Recibimos tu solicitud de factura. Te derivamos con Belén Maidana (1131134588) para procesarla. ¡Gracias!"];
  }

  private handleClienteVentas(session: Session, text: string): string[] {
    const raw = text.trim().toLowerCase();
    
    if (raw === 'planilla' || raw.includes('planilla')) {
      return ["📋 Te envío la planilla. Podés completarla en tu celu o imprimirla y completarla a mano, siguiendo estas instrucciones:\n\n☑️ Ingresá la fecha de cada operación (día y mes).\n☑️ Colocá el monto exacto de la venta en pesos.\n☑️ Cliente: escribí el CUIT o DNI. Si no lo tenés, poné Consumidor Final.\n☑️ Detalle: agregá una breve descripción (ejemplo: 'servicio de pintura', 'venta de velas').\n☑️ El campo % sobre el total se calcula solo, no lo modifiques.\n☑️ Revisá que el Monto total a facturar arriba coincida con lo que recibiste en tus cuentas bancarias.\n☑️ Una vez completada, podés enviarnos la planilla directamente por WhatsApp con el botón que figura en ella o adjuntándola acá con una foto."];
    }
    
    // Si envía archivo o información de ventas, derivar a Belén
    session.state = FSMState.HUMANO;
    logger.info(`Sesión ${session.id} derivada a Belén Maidana (1131134588) para ventas`);
    return ["Recibimos tu información de ventas. Te derivamos con Belén Maidana (1131134588) para procesarla. ¡Gracias!"];
  }

  private handleClienteReunion(session: Session, text: string): string[] {
    // Siempre mostrar el mensaje de reunión
    return [STATE_TEXTS[FSMState.CLIENTE_REUNION]];
  }

  private handleClienteIvan(session: Session, text: string): string[] {
    // Siempre derivar a Iván (sin número por ahora)
    session.state = FSMState.HUMANO;
    logger.info(`Sesión ${session.id} derivada a Iván`);
    return ["Te derivamos con Iván. Te contactará a la brevedad. ¡Gracias!"];
  }
}
