import { Session, SessionData } from '../types/message';
import { FSMState, STATE_TEXTS } from './states';
import logger from '../libs/logger';
import { collections, Timestamp } from '../firebase';
import { enqueueInteractiveOutbox } from '../services/conversations';
import {
  buildRootMenuInteractive,
  buildClienteMenuInteractive,
  buildClienteEstadoMenuInteractive,
  buildNoClienteMenuInteractive,
  buildNCAltaMenuInteractive,
  buildNCPlanMenuInteractive,
  buildNCEstadoConsultaMenuInteractive
} from '../services/interactiveMenu';
import { getClienteByCuit } from '../services/clientsRepo';

export class FSMSessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Limpiar sesiones inactivas cada 30 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanupSessions();
    }, 30 * 60 * 1000);
  }

  private cleanupSessions(): void {
    const now = new Date();
    const ttlMinutes = 60; // TTL de 1 hora
    
    for (const [phone, session] of this.sessions.entries()) {
      const lastActivity = session.lastActivityAt;
      const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
      
      if (minutesSinceActivity > ttlMinutes) {
        this.sessions.delete(phone);
        logger.debug(`Sesión ${session.id} eliminada por inactividad`);
      }
    }
  }

  private getOrCreateSession(from: string): Session {
    if (this.sessions.has(from)) {
      const session = this.sessions.get(from)!;
      session.lastActivityAt = new Date();
      return session;
    }

    const newSession: Session = {
      id: from,
      state: FSMState.ROOT,
      data: {},
      createdAt: new Date(),
      lastActivityAt: new Date(),
      ttl: 60 // 60 minutos
    };

    this.sessions.set(from, newSession);
    logger.debug(`Nueva sesión creada para ${from}`);
    return newSession;
  }

  /**
   * Encola un menú interactivo al outbox y retorna array vacío (para evitar duplicados)
   * Retorna un objeto con replies y flag indicando si se encoló
   */
  private async enqueueInteractiveMenu(
    phone: string,
    menuPayload: any,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive: boolean }> {
    try {
      // Obtener conversationId si no está disponible
      let targetConversationId = conversationId;
      if (!targetConversationId) {
        try {
          const conversationDoc = await collections.conversations()
            .where('phone', '==', phone)
            .limit(1)
            .get();
          if (!conversationDoc.empty) {
            targetConversationId = conversationDoc.docs[0].id;
          }
        } catch (error) {
          logger.debug('Error obteniendo conversationId para menú', { error: (error as Error)?.message });
        }
      }

      if (!targetConversationId) {
        logger.warn('interactive_menu_no_conversation_id', { phone: phone.substring(0, 5) + '***' });
        return { replies: [], handledByInteractive: false };
      }

      // Generar idempotencyKey basado en inboundMessageId o timestamp
      const idempotencyKey = inboundMessageId 
        ? `${targetConversationId}:${inboundMessageId}:menu`
        : `${targetConversationId}:${Date.now()}:menu`;

      await enqueueInteractiveOutbox(
        targetConversationId,
        phone,
        menuPayload,
        idempotencyKey
      );

      logger.info('interactive_menu_enqueued', {
        conversationId: targetConversationId,
        phone: phone.substring(0, 5) + '***',
        buttonText: menuPayload.interactive?.action?.button || 'N/A'
      });

      // Retornar array vacío + flag indicando que se encoló un interactive
      return { replies: [], handledByInteractive: true };
    } catch (error) {
      logger.error('error_enqueuing_interactive_menu', {
        phone: phone.substring(0, 5) + '***',
        error: (error as Error)?.message
      });
      return { replies: [], handledByInteractive: false };
    }
  }

  public async processMessage(
    from: string,
    text: string,
    inboundMessageId?: string,
    conversationId?: string
  ): Promise<{ session: Session; replies: string[]; handledByInteractive?: boolean }> {
    const session = this.getOrCreateSession(from);
    
    // Almacenar inboundMessageId temporalmente en la sesión
    if (inboundMessageId) {
      session.data._inboundMessageId = inboundMessageId;
    }

    session.lastActivityAt = new Date();

    // Obtener conversationId si no se pasó como parámetro
    let targetConversationId: string | null = conversationId || null;
    if (!targetConversationId) {
      try {
        const conversationDoc = await collections.conversations()
          .where('phone', '==', from)
          .limit(1)
          .get();
        if (!conversationDoc.empty) {
          targetConversationId = conversationDoc.docs[0].id;
        }
      } catch (error) {
        logger.debug('Error obteniendo conversationId', { error: (error as Error)?.message });
      }
    }

    // Procesar según estado actual
    const result = await this.processState(session, text, targetConversationId, inboundMessageId);

    logger.info('fsm_message_processed', {
      sessionId: session.id,
      state: session.state,
      textPreview: text.substring(0, 50),
      repliesCount: result.replies.length,
      handledByInteractive: result.handledByInteractive || false
    });

    return {
      session,
      replies: result.replies,
      handledByInteractive: result.handledByInteractive
    };
  }

  private async processState(
    session: Session,
    text: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    const raw = text.trim().toLowerCase();

    switch (session.state) {
      case FSMState.ROOT:
        return await this.handleRoot(session, raw, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_PEDIR_CUIT:
        return await this.handleClientePedirCuit(session, text, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_MENU:
        return await this.handleClienteMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_ESTADO_GENERAL:
        return await this.handleClienteEstadoGeneral(session, raw, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_FACTURA_PEDIR_DATOS:
        return await this.handleClienteFacturaPedirDatos(session, text);
      
      case FSMState.CLIENTE_VENTAS_INFO:
        return await this.handleClienteVentasInfo(session, text);
      
      case FSMState.CLIENTE_REUNION:
        return await this.handleClienteReunion(session);
      
      case FSMState.NOCLIENTE_MENU:
        return await this.handleNoClienteMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.NC_ALTA_MENU:
        return await this.handleNCAltaMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.NC_ALTA_REQUISITOS:
        return await this.handleNCAltaRequisitos(session, text);
      
      case FSMState.NC_PLAN_MENU:
        return await this.handleNCPlanMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.NC_PLAN_REQUISITOS:
        return await this.handleNCPlanRequisitos(session, text);
      
      case FSMState.NC_ESTADO_CONSULTA:
        return await this.handleNCEstadoConsulta(session, text, conversationId, inboundMessageId);
      
      case FSMState.NC_DERIVA_IVAN_TEXTO:
      case FSMState.DERIVA_IVAN:
      case FSMState.FINALIZA:
        // Estados finales: no procesar más, volver a ROOT si el usuario escribe de nuevo
        session.state = FSMState.ROOT;
        return await this.handleRoot(session, raw, conversationId, inboundMessageId);
      
      default:
        // Estado desconocido: volver a ROOT
        session.state = FSMState.ROOT;
        return await this.handleRoot(session, raw, conversationId, inboundMessageId);
    }
  }

  private async handleRoot(
    session: Session,
    raw: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    // Si es una selección de menú del ROOT
    if (raw === 'root_cliente') {
      session.state = FSMState.CLIENTE_PEDIR_CUIT;
      return { replies: [STATE_TEXTS[FSMState.CLIENTE_PEDIR_CUIT]] };
    }
    
    if (raw === 'root_nocliente') {
      session.state = FSMState.NOCLIENTE_MENU;
      const menuPayload = buildNoClienteMenuInteractive(session.id);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }

    // Estado inicial: mostrar menú ROOT
    session.state = FSMState.ROOT;
    const menuPayload = buildRootMenuInteractive(session.id);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private async handleClientePedirCuit(
    session: Session,
    text: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    // Guardar CUIT sin validar (solo guardar raw)
    session.data.cuit_raw = text.trim();
    
    // Guardar en Firestore si hay conversationId
    if (conversationId) {
      try {
        await collections.conversations().doc(conversationId).update({
          cuit: text.trim(),
          updatedAt: new Date()
        });
      } catch (error) {
        logger.debug('Error guardando CUIT', { error: (error as Error)?.message });
      }
    }

    // Obtener nombre del cliente desde Firestore
    let nombreCliente: string | null = null;
    try {
      const clienteResult = await getClienteByCuit(text.trim());
      if (clienteResult.exists && clienteResult.data?.nombre) {
        nombreCliente = clienteResult.data.nombre;
      }
    } catch (error) {
      logger.debug('Error obteniendo nombre del cliente', { error: (error as Error)?.message });
    }

    session.state = FSMState.CLIENTE_MENU;
    const menuPayload = buildClienteMenuInteractive(session.id, nombreCliente);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private async handleClienteMenu(
    session: Session,
    raw: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    if (raw === 'cli_estado') {
      session.state = FSMState.CLIENTE_ESTADO_GENERAL;
      // Enviar texto largo + menú en UN SOLO interactive
      const menuPayload = buildClienteEstadoMenuInteractive(session.id, STATE_TEXTS[FSMState.CLIENTE_ESTADO_GENERAL]);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    
    if (raw === 'cli_factura') {
      session.state = FSMState.CLIENTE_FACTURA_PEDIR_DATOS;
      return { replies: [STATE_TEXTS[FSMState.CLIENTE_FACTURA_PEDIR_DATOS]] };
    }
    
    if (raw === 'cli_ventas') {
      session.state = FSMState.CLIENTE_VENTAS_INFO;
      return { replies: [STATE_TEXTS[FSMState.CLIENTE_VENTAS_INFO]] };
    }
    
    if (raw === 'cli_reunion') {
      session.state = FSMState.CLIENTE_REUNION;
      return { replies: [STATE_TEXTS[FSMState.CLIENTE_REUNION]] };
    }
    
    if (raw === 'cli_ivan') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Perfecto. Te derivo con el contador Iván Pos.'] };
    }

    // Si no es una opción válida, reenviar menú (con nombre si está disponible)
    let nombreCliente: string | null = null;
    if (session.data.cuit_raw) {
      try {
        const clienteResult = await getClienteByCuit(session.data.cuit_raw);
        if (clienteResult.exists && clienteResult.data?.nombre) {
          nombreCliente = clienteResult.data.nombre;
        }
      } catch (error) {
        logger.debug('Error obteniendo nombre del cliente', { error: (error as Error)?.message });
      }
    }
    const menuPayload = buildClienteMenuInteractive(session.id, nombreCliente);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private async handleClienteEstadoGeneral(
    session: Session,
    raw: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    if (raw === 'cli_estado_ok') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Gracias, finalizar'] };
    }
    
    if (raw === 'cli_estado_belen') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Perfecto. Te derivo con Belén Maidana 😊'] };
    }

    // Si no es una opción válida, mostrar menú de estado con texto largo
    const menuPayload = buildClienteEstadoMenuInteractive(session.id, STATE_TEXTS[FSMState.CLIENTE_ESTADO_GENERAL]);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private handleClienteFacturaPedirDatos(session: Session, text: string): { replies: string[]; handledByInteractive?: boolean } {
    // Cualquier texto recibido: derivar a Belén con texto lindo
    session.state = FSMState.FINALIZA;
    return { replies: ['Perfecto. Te derivo con Belén Maidana 😊'] };
  }

  private handleClienteVentasInfo(session: Session, text: string): { replies: string[]; handledByInteractive?: boolean } {
    const textUpper = text.trim().toUpperCase();
    
    // Si el usuario escribe PLANILLA (case-insensitive, trim, tolerar espacios)
    if (textUpper === 'PLANILLA' || textUpper.replace(/\s+/g, '') === 'PLANILLA') {
      // Enviar bloque naranja (instrucciones de planilla)
      return { replies: [STATE_TEXTS.PLANILLA_INSTRUCCIONES] };
      // NO finalizar: queda esperando más mensajes
    }
    
    // Cualquier otro mensaje: derivar a Belén con texto lindo
    session.state = FSMState.FINALIZA;
    return { replies: ['Perfecto. Te derivo con Belén Maidana 😊'] };
  }

  private handleClienteReunion(session: Session): { replies: string[]; handledByInteractive?: boolean } {
    session.state = FSMState.FINALIZA;
    return { replies: [] };
  }

  private async handleNoClienteMenu(
    session: Session,
    raw: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    if (raw === 'nc_alta') {
      session.state = FSMState.NC_ALTA_MENU;
      // Enviar texto del plan + menú en UN SOLO interactive
      const menuPayload = buildNCAltaMenuInteractive(session.id, STATE_TEXTS.NC_ALTA_TEXTO_PLAN);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    
    if (raw === 'nc_plan') {
      session.state = FSMState.NC_PLAN_MENU;
      // Enviar texto del plan + menú en UN SOLO interactive
      const menuPayload = buildNCPlanMenuInteractive(session.id, STATE_TEXTS[FSMState.NC_PLAN_MENU]);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    
    if (raw === 'nc_ri') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Perfecto, en breve te contactaré con Iván ☎️.'] };
    }
    
    if (raw === 'nc_estado') {
      session.state = FSMState.NC_ESTADO_CONSULTA;
      // Enviar texto primero, luego el menú aparecerá cuando el usuario responda
      return { replies: [STATE_TEXTS[FSMState.NC_ESTADO_CONSULTA]] };
    }
    
    if (raw === 'nc_ivan') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Perfecto, en breve te contactaré con Iván ☎️.'] };
    }

    // Si no es una opción válida, reenviar menú
    const menuPayload = buildNoClienteMenuInteractive(session.id);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private async handleNCAltaMenu(
    session: Session,
    raw: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    if (raw === 'nc_alta_si') {
      session.state = FSMState.NC_ALTA_REQUISITOS;
      return { replies: [STATE_TEXTS[FSMState.NC_ALTA_REQUISITOS]] };
    }
    
    if (raw === 'nc_alta_dudas') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Entendido. Ya te derivo con el contador Iván Pos.'] };
    }

    // Si no es una opción válida, reenviar menú con texto del plan
    const menuPayload = buildNCAltaMenuInteractive(session.id, STATE_TEXTS.NC_ALTA_TEXTO_PLAN);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private handleNCAltaRequisitos(session: Session, text: string): { replies: string[]; handledByInteractive?: boolean } {
    const textUpper = text.trim().toUpperCase().replace(/\s+/g, ' ');
    
    // Detección tolerante de "HABLAR CON ALGUIEN" (case-insensitive, trim, tolerar espacios)
    if (textUpper.includes('HABLAR') && textUpper.includes('ALGUIEN')) {
      session.state = FSMState.FINALIZA;
      return { replies: ['Entendido. Ya te derivo con el contador Iván Pos.'] };
    }
    
    // Cualquier otro texto: derivar a Elina
    session.state = FSMState.FINALIZA;
    return { replies: ['Perfecto. Ahora te derivo con Elina Maidana 😊'] };
  }

  private async handleNCPlanMenu(
    session: Session,
    raw: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    if (raw === 'nc_plan_si') {
      session.state = FSMState.NC_PLAN_REQUISITOS;
      return { replies: [STATE_TEXTS[FSMState.NC_PLAN_REQUISITOS]] };
    }
    
    if (raw === 'nc_plan_dudas') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Entendido. Ya te derivo con el contador Iván Pos.'] };
    }

    // Si no es una opción válida, mostrar menú de plan con texto
    const menuPayload = buildNCPlanMenuInteractive(session.id, STATE_TEXTS[FSMState.NC_PLAN_MENU]);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private handleNCPlanRequisitos(session: Session, text: string): { replies: string[]; handledByInteractive?: boolean } {
    const textUpper = text.trim().toUpperCase().replace(/\s+/g, ' ');
    
    // Detección tolerante de "HABLAR CON ALGUIEN"
    if (textUpper.includes('HABLAR') && textUpper.includes('ALGUIEN')) {
      session.state = FSMState.FINALIZA;
      return { replies: ['Entendido. Ya te derivo con el contador Iván Pos.'] };
    }
    
    // Cualquier otro texto: derivar a Elina
    session.state = FSMState.FINALIZA;
    return { replies: ['Perfecto. Ahora te derivo con Elina Maidana 😊'] };
  }

  private async handleNCEstadoConsulta(
    session: Session,
    text: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    // Si es una selección del menú (nuevos ids)
    if (text === 'nc_estado_mas24') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Perfecto. Te derivo con el contador Iván Pos.'] };
    }
    
    if (text === 'nc_estado_menos24') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Quedate tranquilo/a. Te vamos a responder en breve.'] };
    }
    
    // Si es texto libre (nombre y apellido), mostrar menú 2 opciones
    const menuPayload = buildNCEstadoConsultaMenuInteractive(session.id);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}
