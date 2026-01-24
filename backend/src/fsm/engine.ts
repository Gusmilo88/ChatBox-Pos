import { Session, SessionData } from '../types/message';
import { FSMState, STATE_TEXTS } from './states';
import logger from '../libs/logger';
import { collections, Timestamp } from '../firebase';
import { enqueueInteractiveOutbox, sendInternalToBelen } from '../services/conversations';
import {
  buildRootMenuInteractive,
  buildClienteMenuInteractive,
  buildClienteEstadoMenuInteractive,
  buildNoClienteMenuInteractive,
  buildNCAltaMenuInteractive,
  buildNCPlanMenuInteractive,
  buildNCEstadoConsultaMenuInteractive,
  buildHablarConAlguienMenuInteractive,
  buildFacturaConfirmMenuInteractive,
  buildFacturaEditFieldMenuInteractive
} from '../services/interactiveMenu';
import { getClienteByCuit } from '../services/clientsRepo';
import { getFraseDerivacion } from './derivations';

/**
 * Helper para normalizar comandos de texto
 * - trim
 * - toLowerCase
 * - colapsar espacios internos múltiples a 1
 */
function normalizeCommand(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Verifica si el texto es el comando LISTO o sus sinónimos
 */
function isListoCommand(text: string): boolean {
  const normalized = normalizeCommand(text);
  const sinonimos = [
    'listo',
    'termine',
    'terminado',
    'ya',
    'ya está',
    'ya termine',
    'completo',
    'enviado'
  ];
  return sinonimos.includes(normalized);
}

/**
 * Verifica si el texto es el comando HABLAR CON ALGUIEN
 */
function isHablarConAlguienCommand(text: string): boolean {
  const normalized = normalizeCommand(text);
  return normalized.includes('hablar') && normalized.includes('alguien');
}

/**
 * Verifica si el texto es el comando PLANILLA
 */
function isPlanillaCommand(text: string): boolean {
  return normalizeCommand(text) === 'planilla';
}

/**
 * Parsea los datos de factura desde los mensajes acumulados
 * NO inventa datos, si no puede parsear -> "NO INFORMA"
 */
function parseFacturaData(messages: string[], cuitCliente?: string): {
  cuit_emisor: string;
  concepto: string;
  importe_total: string;
  fecha_operacion: string;
  receptor: string;
} {
  const allText = messages.join(' ').toLowerCase();
  
  // CUIT emisor: preferir CUIT del cliente, sino buscar en texto
  let cuit_emisor = 'NO INFORMA';
  if (cuitCliente) {
    cuit_emisor = cuitCliente;
  } else {
    // Buscar CUIT en texto (formato XX-XXXXXXXX-X o 11 dígitos)
    const cuitMatch = allText.match(/(\d{2}[-]?\d{8}[-]?\d{1})|(\d{11})/);
    if (cuitMatch) {
      cuit_emisor = cuitMatch[0].replace(/\D/g, '');
    }
  }
  
  // Concepto: buscar líneas con "concepto", "servicio", o texto descriptivo
  let concepto = 'NO INFORMA';
  for (const msg of messages) {
    const msgLower = msg.toLowerCase();
    if (msgLower.includes('concepto') || msgLower.includes('servicio') || msgLower.includes('producto')) {
      // Extraer texto después de la palabra clave
      const match = msg.match(/(?:concepto|servicio|producto)[:\s]+(.+)/i);
      if (match && match[1].trim().length > 3) {
        let conceptText = match[1].trim();
        // Limpiar: quitar CUIT (11 dígitos), importes ($ seguido de números), fechas
        conceptText = conceptText.replace(/\d{2}[-]?\d{8}[-]?\d{1}/g, ''); // CUIT
        conceptText = conceptText.replace(/\$\s*[\d.,]+/g, ''); // Importes con $
        conceptText = conceptText.replace(/\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/g, ''); // Fechas
        conceptText = conceptText.trim();
        if (conceptText.length > 3) {
          concepto = conceptText;
          break;
        }
      }
    }
  }
  // Si no encontró, usar el mensaje más largo como concepto (quitando CUIT/importes/fechas)
  if (concepto === 'NO INFORMA') {
    const longestMsg = messages.reduce((a, b) => a.length > b.length ? a : b, '');
    if (longestMsg.length > 10) {
      let cleanMsg = longestMsg;
      // Quitar CUIT, importes, fechas
      cleanMsg = cleanMsg.replace(/\d{2}[-]?\d{8}[-]?\d{1}/g, '');
      cleanMsg = cleanMsg.replace(/\$\s*[\d.,]+/g, '');
      cleanMsg = cleanMsg.replace(/\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/g, '');
      cleanMsg = cleanMsg.trim();
      if (cleanMsg.length > 3 && !cleanMsg.match(/^\d+$/)) {
        concepto = cleanMsg;
      }
    }
  }
  
  // Importe: primero buscar $ seguido de número
  let importe_total = 'NO INFORMA';
  
  // Primero: buscar patrón $ seguido de número
  const dollarMatch = allText.match(/\$\s*([0-9\.,]+)/);
  if (dollarMatch) {
    // Limpiar: remover puntos y espacios, permitir coma para centavos
    importe_total = dollarMatch[1].replace(/\./g, '').replace(/\s/g, '').replace(',', '.');
  } else {
    // Si no hay $, buscar por palabras clave pero excluir CUIT (11 dígitos)
    const importeMatch = allText.match(/(?:importe|total|monto|precio|valor)[:\s]*\$?\s*([\d.,]+)/i);
    if (importeMatch) {
      const candidate = importeMatch[1];
      // Verificar que no sea un CUIT (11 dígitos sin separadores)
      const digitsOnly = candidate.replace(/\D/g, '');
      if (digitsOnly.length !== 11) {
        importe_total = candidate.replace(/\./g, '').replace(/\s/g, '').replace(',', '.');
      }
    }
  }
  
  // Fecha: buscar fechas en formato dd/mm, dd-mm, yyyy-mm-dd
  let fecha_operacion = 'NO INFORMA';
  const fechaMatch = allText.match(/(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/) ||
                     allText.match(/(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/);
  if (fechaMatch) {
    fecha_operacion = fechaMatch[1];
  }
  
  // Receptor: buscar líneas con "receptor", "cliente", "a nombre de", "cuit", "dni"
  let receptor = 'NO INFORMA';
  for (const msg of messages) {
    const msgLower = msg.toLowerCase();
    if (msgLower.includes('receptor') || msgLower.includes('cliente') || 
        msgLower.includes('a nombre de') || msgLower.includes('cuit') || 
        msgLower.includes('dni')) {
      const match = msg.match(/(?:receptor|cliente|a nombre de|cuit|dni)[:\s]+(.+)/i);
      if (match && match[1].trim().length > 3) {
        receptor = match[1].trim();
        break;
      }
    }
  }
  
  return {
    cuit_emisor,
    concepto,
    importe_total,
    fecha_operacion,
    receptor
  };
}

/**
 * Obtiene el cierre fijo de conversación
 */
function getCierreAleatorio(): string {
  return '✔️ Listo.\nSi necesitás algo más o querés volver al menú de opciones, podés escribir *hola* en cualquier momento.';
}

/**
 * Construye el mensaje de estado ARCA con datos reales de Firestore (colección clientes).
 * Solo datos reales; si falta campo -> "No disponible".
 */
async function buildEstadoArcaMessage(cuit: string): Promise<string> {
  let NOMBRE = 'No disponible';
  let CUIT = cuit || 'No disponible';
  let CATEGORIA_MONO = 'No disponible';
  let REGIMEN_IIBB = 'No disponible';
  let MONO_ESTADO = 'Sin deuda';
  let IIBB_ESTADO = 'No disponible';
  let PLANES_ESTADO = 'No disponible';

  try {
    const clienteResult = await getClienteByCuit(cuit);
    if (clienteResult.exists && clienteResult.data) {
      const c = clienteResult.data;
      
      NOMBRE = c.nombre || 'No disponible';
      CUIT = c.cuit || cuit || 'No disponible';
      CATEGORIA_MONO = c.categoria_monotributo || 'No disponible';
      REGIMEN_IIBB = c.regimen_ingresos_brutos || 'No disponible';
      
      // MONOTRIBUTO: deuda (number) -> >0 "Con deuda $X", else "Sin deuda"
      const deudaNum = Number(c.deuda ?? 0);
      if (deudaNum > 0) {
        MONO_ESTADO = `Con deuda $${String(deudaNum)}`;
      } else {
        MONO_ESTADO = 'Sin deuda';
      }
      
      // INGRESOS BRUTOS: ingresos_brutos (string) -> mapear por texto
      const valor = String(c.ingresos_brutos ?? '').trim();
      if (!valor) {
        IIBB_ESTADO = 'No disponible';
      } else if (/al día|sin deuda/i.test(valor)) {
        IIBB_ESTADO = 'Sin deuda';
      } else if (/con deuda/i.test(valor)) {
        IIBB_ESTADO = 'Con deuda';
      } else {
        IIBB_ESTADO = valor;
      }
      
      // PLANES: planes_pago (string) -> mapear
      const p = String(c.planes_pago ?? '').trim().toLowerCase();
      const orig = String(c.planes_pago ?? '').trim();
      if (!p) {
        PLANES_ESTADO = 'No disponible';
      } else if (p.includes('no posee') || (p.includes('no') && p.includes('posee'))) {
        PLANES_ESTADO = 'No posee';
      } else if (/atras/.test(p)) {
        PLANES_ESTADO = 'Activo – con atraso';
      } else if (/al dia|al día/.test(p)) {
        PLANES_ESTADO = 'Activo – al día';
      } else {
        PLANES_ESTADO = orig || 'No disponible';
      }
    }
  } catch (error) {
    logger.debug('Error obteniendo datos del cliente para estado ARCA', { 
      error: (error as Error)?.message,
      cuit: cuit.substring(0, 3) + '***'
    });
  }

  return `📌 Estado general impositivo

Cliente: ${NOMBRE}
CUIT: ${CUIT}
Categoría de Monotributo: ${CATEGORIA_MONO}
Régimen de Ingresos Brutos: ${REGIMEN_IIBB}

Situación actual:
🧾 Monotributo: ${MONO_ESTADO}
🏛️ Ingresos Brutos: ${IIBB_ESTADO}
📄 Planes de pago vigentes: ${PLANES_ESTADO}

ℹ️ Esta información refleja el estado general registrado al día de hoy.

👉 Recordá que dentro de nuestra aplicación podés consultar esta información y mucho más, solo ingresas con tu CUIT en este link:
https://app.posyasociados.com/login

Si necesitás que analicemos tu caso o realizar algún trámite, escribí HABLAR CON ALGUIEN.`;
}

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
    const ttlMinutes = 120; // TTL de 2 horas
    
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
    conversationId?: string,
    messageType?: string
  ): Promise<{ session: Session; replies: string[]; handledByInteractive?: boolean }> {
    const session = this.getOrCreateSession(from);
    
    // Almacenar inboundMessageId temporalmente en la sesión
    if (inboundMessageId) {
      session.data._inboundMessageId = inboundMessageId;
    }
    
    // Almacenar messageType para usar en handlers
    if (messageType) {
      session.data._messageType = messageType;
    }

    session.lastActivityAt = new Date();

    // OPTIMIZACIÓN: Usar conversationId pasado como parámetro (evitar consulta duplicada)
    // Solo consultar Firestore si NO se pasó conversationId
    let targetConversationId: string | null = conversationId || null;
    if (!targetConversationId) {
      try {
        // Una sola consulta: buscar conversación existente
        const conversationDoc = await collections.conversations()
          .where('phone', '==', from)
          .limit(1)
          .get();
        if (!conversationDoc.empty) {
          targetConversationId = conversationDoc.docs[0].id;
          logger.debug('fsm_conversation_found', {
            conversationId: targetConversationId,
            phone: from.replace(/\d(?=\d{4})/g, '*')
          });
        } else {
          logger.debug('fsm_conversation_not_found', {
            phone: from.replace(/\d(?=\d{4})/g, '*')
          });
        }
      } catch (error) {
        logger.debug('fsm_conversation_query_error', { error: (error as Error)?.message });
      }
    } else {
      logger.debug('fsm_conversation_id_provided', {
        conversationId: targetConversationId,
        phone: from.replace(/\d(?=\d{4})/g, '*')
      });
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
    const textUpper = text.trim().toUpperCase();

    // 1️⃣ DETECCIÓN DE HONORARIOS (SOLO CLIENTES) - ANTES DE CUALQUIER OTRO PROCESAMIENTO
    // Solo si el usuario es CLIENTE (tiene CUIT en sesión)
    if (session.data.cuit_raw) {
      const honorariosKeywords = ['honorarios', 'pagar honorarios', 'pago honorarios'];
      const hasHonorarios = honorariosKeywords.some(keyword => 
        textUpper.includes(keyword.toUpperCase())
      );
      
      if (hasHonorarios) {
        // NO derivar, responder con texto específico
        // NO sacar del flujo si está esperando datos (ej: factura)
        // Solo responder con el texto de honorarios
        return { replies: [STATE_TEXTS.HONORARIOS_RESPUESTA] };
      }
    }

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
        return await this.handleClienteFacturaPedirDatos(session, text, conversationId, inboundMessageId, session.data._messageType as string | undefined);
      
      case FSMState.CLIENTE_FACTURA_CONFIRM:
        return await this.handleClienteFacturaConfirm(session, raw, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_FACTURA_EDIT_FIELD:
        return await this.handleClienteFacturaEditField(session, text, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_VENTAS_INFO:
        return await this.handleClienteVentasInfo(session, text, session.data._messageType as string | undefined);
      
      case FSMState.CLIENTE_REUNION:
        return await this.handleClienteReunion(session);
      
      case FSMState.CLIENTE_HABLAR_CON_ALGUIEN:
        return await this.handleClienteHablarConAlguien(session, raw, conversationId, inboundMessageId);
      
      case FSMState.NOCLIENTE_MENU:
        return await this.handleNoClienteMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.NC_ALTA_MENU:
        return await this.handleNCAltaMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.NC_ALTA_REQUISITOS:
        return await this.handleNCAltaRequisitos(session, text, session.data._messageType as string | undefined);
      
      case FSMState.NC_PLAN_MENU:
        return await this.handleNCPlanMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.NC_PLAN_REQUISITOS:
        return await this.handleNCPlanRequisitos(session, text, session.data._messageType as string | undefined);
      
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
      session.data.lastMenuState = 'NOCLIENTE_MENU';
      const menuPayload = buildNoClienteMenuInteractive(session.id);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }

    // Estado inicial: mostrar menú ROOT
    session.state = FSMState.ROOT;
    session.data.lastMenuState = 'ROOT';
    const menuPayload = buildRootMenuInteractive(session.id);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private async handleClientePedirCuit(
    session: Session,
    text: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    // a) Normalizar: solo dígitos (quitar puntos/guiones/espacios)
    const cuitLimpio = text.trim().replace(/\D/g, '');
    
    // b) Consultar Firestore clientes
    const clienteResult = await getClienteByCuit(cuitLimpio);
    
    // c) Si NO hay docs: responder texto exacto, mantener CLIENTE_PEDIR_CUIT, no menú
    if (!clienteResult.exists || !clienteResult.data) {
      return {
        replies: [STATE_TEXTS.CUIT_NO_ENCONTRADO]
      };
    }
    
    // d) Si SÍ existe: guardar en sesión y continuar al menú cliente
    const data = clienteResult.data;
    session.data.cuit_raw = cuitLimpio;
    session.data.cliente = { nombre: data.nombre, cuit: data.cuit || cuitLimpio };
    
    if (conversationId) {
      try {
        await collections.conversations().doc(conversationId).update({
          cuit: cuitLimpio,
          updatedAt: new Date()
        });
      } catch (error) {
        logger.debug('Error guardando CUIT', { error: (error as Error)?.message });
      }
    }

    session.state = FSMState.CLIENTE_MENU;
    session.data.lastMenuState = 'CLIENTE_MENU';
    const menuPayload = buildClienteMenuInteractive(session.id, data.nombre || null);
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
      // Construir mensaje con datos reales de Firestore
      const cuit = session.data.cuit_raw || '';
      const estadoArcaText = await buildEstadoArcaMessage(cuit);
      // Enviar texto largo + menú en UN SOLO interactive
      const menuPayload = buildClienteEstadoMenuInteractive(session.id, estadoArcaText);
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
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }
    
    if (raw === 'cli_constancias_arca') {
      session.state = FSMState.FINALIZA;
      
      // Obtener datos del cliente
      let nombreCompleto = 'Sin nombre';
      let cuit = session.data.cuit_raw || 'No disponible';
      
      if (session.data.cuit_raw) {
        try {
          const clienteResult = await getClienteByCuit(session.data.cuit_raw);
          if (clienteResult.exists && clienteResult.data?.nombre) {
            nombreCompleto = clienteResult.data.nombre;
          }
        } catch (error) {
          logger.debug('Error obteniendo datos del cliente para constancias', { error: (error as Error)?.message });
        }
      }
      
      // Enviar mensaje interno a Belén
      const mensajeInterno = `El cliente: ${nombreCompleto}
CUIT: ${cuit}
Solicita: constancias de ARCA actualizadas`;
      await sendInternalToBelen(mensajeInterno);
      
      return { replies: [getFraseDerivacion('Belén Maidana'), getCierreAleatorio()] };
    }
    
    if (raw === 'cli_vep_qr_deuda') {
      session.state = FSMState.FINALIZA;
      
      // Obtener datos del cliente
      let nombreCompleto = 'Sin nombre';
      let cuit = session.data.cuit_raw || 'No disponible';
      
      if (session.data.cuit_raw) {
        try {
          const clienteResult = await getClienteByCuit(session.data.cuit_raw);
          if (clienteResult.exists && clienteResult.data?.nombre) {
            nombreCompleto = clienteResult.data.nombre;
          }
        } catch (error) {
          logger.debug('Error obteniendo datos del cliente para VEP/QR', { error: (error as Error)?.message });
        }
      }
      
      // Enviar mensaje interno a Belén
      const mensajeInterno = `El cliente: ${nombreCompleto}
CUIT: ${cuit}
Solicita: VEP o QR para cancelar deuda de Monotributo`;
      await sendInternalToBelen(mensajeInterno);
      
      return { replies: [getFraseDerivacion('Belén Maidana'), getCierreAleatorio()] };
    }

    // Si no es una opción válida, reenviar menú (con nombre si está disponible)
    session.data.lastMenuState = 'CLIENTE_MENU';
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
      return { replies: [getCierreAleatorio()] };
    }
    
    if (raw === 'cli_estado_belen' || raw === 'cli_estado_hablar') {
      // Mostrar menú "Hablar con alguien"
      session.state = FSMState.CLIENTE_HABLAR_CON_ALGUIEN;
      const menuPayload = buildHablarConAlguienMenuInteractive(session.id);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }

    // Si no es una opción válida, mostrar menú de estado con texto largo
    // Construir mensaje con datos reales de Firestore
    const cuit = session.data.cuit_raw || '';
    const estadoArcaText = await buildEstadoArcaMessage(cuit);
    const menuPayload = buildClienteEstadoMenuInteractive(session.id, estadoArcaText);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private async handleClienteFacturaPedirDatos(
    session: Session, 
    text: string,
    conversationId: string | null,
    inboundMessageId?: string,
    messageType?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    // Si es adjunto (foto/video/documento) -> responder guiando SIEMPRE
    if (messageType === 'image' || messageType === 'video' || messageType === 'document') {
      return { replies: ['Te leo 🙂 Cuando termines de enviar todo, escribí *LISTO*.\nSi preferís, escribí *HABLAR CON ALGUIEN*.'] };
    }
    
    // Si es HABLAR CON ALGUIEN -> derivar a Iván
    if (isHablarConAlguienCommand(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }
    
    // Si es LISTO -> parsear datos y mostrar confirmación
    if (isListoCommand(text)) {
      // Inicializar array de mensajes si no existe
      if (!session.data.factura_raw_messages) {
        session.data.factura_raw_messages = [];
      }
      
      // Parsear datos
      const facturaData = parseFacturaData(
        session.data.factura_raw_messages,
        session.data.cuit_raw
      );
      
      // Guardar en sesión
      session.data.factura_fields = facturaData;
      
      // Construir mensaje de confirmación
      const confirmText = `Mensaje de confirmación,
Entiendo que la factura deberia quedar asi:

📌 Tu CUIT: ${facturaData.cuit_emisor}
📌 Concepto (descripción del producto o servicio): ${facturaData.concepto}
📌 Importe total. ${facturaData.importe_total}
📌 Fecha de la operación. ${facturaData.fecha_operacion}
📌 Datos del receptor (CUIT o DNI): ${facturaData.receptor}`;
      
      // Mostrar menú de confirmación
      session.state = FSMState.CLIENTE_FACTURA_CONFIRM;
      const menuPayload = buildFacturaConfirmMenuInteractive(session.id, confirmText);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    
    // Cualquier otro texto: acumular y responder guiado
    if (!session.data.factura_raw_messages) {
      session.data.factura_raw_messages = [];
    }
    session.data.factura_raw_messages.push(text);
    
    return { 
      replies: ['Te leo 🙂 Cuando termines de enviar todo, escribí *LISTO*. Si preferís, escribí *HABLAR CON ALGUIEN*.'] 
    };
  }
  
  private async handleClienteFacturaConfirm(
    session: Session,
    raw: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    if (raw === 'fac_ok') {
      // Obtener datos del cliente
      let nombreCompleto = 'Sin nombre';
      let cuit = session.data.cuit_raw || 'No disponible';
      
      if (session.data.cuit_raw) {
        try {
          const clienteResult = await getClienteByCuit(session.data.cuit_raw);
          if (clienteResult.exists && clienteResult.data?.nombre) {
            nombreCompleto = clienteResult.data.nombre;
          }
        } catch (error) {
          logger.debug('Error obteniendo datos del cliente para factura', { error: (error as Error)?.message });
        }
      }
      
      // Generar texto limpio para Belén (guardar en sesión, no enviar todavía)
      const facturaFields = session.data.factura_fields || {};
      const cleanText = `El cliente: ${nombreCompleto}
CUIT: ${cuit}
Solicita: Factura electrónica
Datos confirmados:
- CUIT: ${facturaFields.cuit_emisor || 'NO INFORMA'}
- Concepto: ${facturaFields.concepto || 'NO INFORMA'}
- Importe: ${facturaFields.importe_total || 'NO INFORMA'}
- Fecha: ${facturaFields.fecha_operacion || 'NO INFORMA'}
- Receptor: ${facturaFields.receptor || 'NO INFORMA'}`;
      
      session.data.factura_clean_text = cleanText;
      logger.info('factura_clean_text_generated', {
        phone: session.id.substring(0, 5) + '***',
        hasCleanText: !!cleanText
      });
      
      // Enviar mensaje al cliente (texto exacto del contador, SIN cierre estándar) y finalizar
      session.state = FSMState.FINALIZA;
      return {
        replies: ['Los datos informados fueron validados correctamente y ya fueron derivados a nuestro equipo para la emisión de la factura electrónica.\n\n📄 En breve recibirás la factura emitida por uno de nuestros colaboradores.']
      };
    }
    
    if (raw === 'fac_bad') {
      // Mostrar menú de edición
      session.state = FSMState.CLIENTE_FACTURA_EDIT_FIELD;
      const menuPayload = buildFacturaEditFieldMenuInteractive(session.id);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    
    // Si no es una opción válida, reenviar menú de confirmación
    const facturaFields = session.data.factura_fields || {};
    const confirmText = `Mensaje de confirmación,
Entiendo que la factura deberia quedar asi:

📌 Tu CUIT: ${facturaFields.cuit_emisor || 'NO INFORMA'}
📌 Concepto (descripción del producto o servicio): ${facturaFields.concepto || 'NO INFORMA'}
📌 Importe total. ${facturaFields.importe_total || 'NO INFORMA'}
📌 Fecha de la operación. ${facturaFields.fecha_operacion || 'NO INFORMA'}
📌 Datos del receptor (CUIT o DNI): ${facturaFields.receptor || 'NO INFORMA'}`;
    const menuPayload = buildFacturaConfirmMenuInteractive(session.id, confirmText);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }
  
  private async handleClienteFacturaEditField(
    session: Session,
    text: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    // Si es una selección del menú de edición
    const raw = normalizeCommand(text);
    
    if (raw === 'fac_edit_cuit') {
      session.data.factura_editing_field = 'cuit_emisor';
      return { replies: ['Escribí el CUIT correcto:'] };
    }
    
    if (raw === 'fac_edit_concept') {
      session.data.factura_editing_field = 'concepto';
      return { replies: ['Escribí el concepto correcto:'] };
    }
    
    if (raw === 'fac_edit_importe') {
      session.data.factura_editing_field = 'importe_total';
      return { replies: ['Escribí el importe correcto, sin puntos y con coma para los centavos.'] };
    }
    
    if (raw === 'fac_edit_fecha') {
      session.data.factura_editing_field = 'fecha_operacion';
      // Generar fecha actual en formato DD-MM-AA
      const hoy = new Date();
      const dia = String(hoy.getDate()).padStart(2, '0');
      const mes = String(hoy.getMonth() + 1).padStart(2, '0');
      const anio = String(hoy.getFullYear()).slice(-2);
      const fechaHoy = `${dia}-${mes}-${anio}`;
      return { replies: [`Escribí la fecha correcta en este formato DD-MM-AA.\nPor ejemplo hoy es ${fechaHoy}.`] };
    }
    
    if (raw === 'fac_edit_receptor') {
      session.data.factura_editing_field = 'receptor';
      return { replies: ['Escribí los datos del receptor correctos:'] };
    }
    
    if (raw === 'fac_edit_cancel') {
      session.state = FSMState.FINALIZA;
      return { replies: [getCierreAleatorio()] };
    }
    
    // Si hay un campo siendo editado, guardar el valor y volver a confirmación
    if (session.data.factura_editing_field) {
      const field = session.data.factura_editing_field;
      if (!session.data.factura_fields) {
        session.data.factura_fields = {};
      }
      
      // Mapear nombres de campos
      const fieldMap: { [key: string]: string } = {
        'cuit_emisor': 'cuit_emisor',
        'concepto': 'concepto',
        'importe_total': 'importe_total',
        'fecha_operacion': 'fecha_operacion',
        'receptor': 'receptor'
      };
      
      const actualField = fieldMap[field] || field;
      if (session.data.factura_fields) {
        (session.data.factura_fields as any)[actualField] = text.trim();
      }
      delete session.data.factura_editing_field;
      
      // Volver a mostrar confirmación
      session.state = FSMState.CLIENTE_FACTURA_CONFIRM;
      const facturaFields = session.data.factura_fields;
      const confirmText = `Mensaje de confirmación,
Entiendo que la factura deberia quedar asi:

📌 Tu CUIT: ${facturaFields.cuit_emisor || 'NO INFORMA'}
📌 Concepto (descripción del producto o servicio): ${facturaFields.concepto || 'NO INFORMA'}
📌 Importe total. ${facturaFields.importe_total || 'NO INFORMA'}
📌 Fecha de la operación. ${facturaFields.fecha_operacion || 'NO INFORMA'}
📌 Datos del receptor (CUIT o DNI): ${facturaFields.receptor || 'NO INFORMA'}`;
      const menuPayload = buildFacturaConfirmMenuInteractive(session.id, confirmText);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    
    // Si no hay campo siendo editado, mostrar menú de edición
    const menuPayload = buildFacturaEditFieldMenuInteractive(session.id);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private handleClienteVentasInfo(
    session: Session, 
    text: string,
    messageType?: string
  ): { replies: string[]; handledByInteractive?: boolean } {
    // Si es adjunto (foto/video/documento) -> responder guiando SIEMPRE
    if (messageType === 'image' || messageType === 'video' || messageType === 'document') {
      return { replies: ['Te leo 🙂 Cuando termines de enviar todo, escribí *LISTO*.\nSi preferís, escribí *HABLAR CON ALGUIEN*.'] };
    }
    
    // Si es HABLAR CON ALGUIEN -> derivar a Iván
    if (isHablarConAlguienCommand(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }
    
    // Si es LISTO -> responder texto específico y finalizar
    if (isListoCommand(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: ['Entendido 🙂 le enviaré la documentación a Belén Maidana.', getCierreAleatorio()] };
    }
    
    // Si es PLANILLA -> enviar instrucciones y seguir esperando
    if (isPlanillaCommand(text)) {
      return { replies: [STATE_TEXTS.PLANILLA_INSTRUCCIONES] };
    }
    
    // Cualquier otro texto: mensaje guiado sin derivar
    return { 
      replies: ['Te leo 🙂 Cuando termines de enviar todo, escribí *LISTO*. Si preferís, escribí *HABLAR CON ALGUIEN*.'] 
    };
  }

  private handleClienteReunion(session: Session): { replies: string[]; handledByInteractive?: boolean } {
    session.state = FSMState.FINALIZA;
    return { replies: [getCierreAleatorio()] };
  }

  private async handleClienteHablarConAlguien(
    session: Session,
    raw: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    if (raw === 'hablar_ivan') {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }
    
    if (raw === 'hablar_belen') {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Belén Maidana'), getCierreAleatorio()] };
    }
    
    if (raw === 'hablar_elina') {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Elina Maidana'), getCierreAleatorio()] };
    }
    
    if (raw === 'hablar_volver') {
      // Volver al menú de estado general
      session.state = FSMState.CLIENTE_ESTADO_GENERAL;
      const menuPayload = buildClienteEstadoMenuInteractive(session.id, STATE_TEXTS[FSMState.CLIENTE_ESTADO_GENERAL]);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }

    // Si no es una opción válida, reenviar menú
    const menuPayload = buildHablarConAlguienMenuInteractive(session.id);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
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
      return { replies: ['Perfecto, en breve te contactaré con Iván ☎️.', getCierreAleatorio()] };
    }
    
    if (raw === 'nc_estado') {
      session.state = FSMState.NC_ESTADO_CONSULTA;
      // Enviar texto primero, luego el menú aparecerá cuando el usuario responda
      // IMPORTANTE: Encolar el menú inmediatamente después del texto
      const menuPayload = buildNCEstadoConsultaMenuInteractive(session.id);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    
    if (raw === 'nc_ivan') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Perfecto, en breve te contactaré con Iván ☎️.', getCierreAleatorio()] };
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
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }

    // Si no es una opción válida, reenviar menú con texto del plan
    const menuPayload = buildNCAltaMenuInteractive(session.id, STATE_TEXTS.NC_ALTA_TEXTO_PLAN);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private handleNCAltaRequisitos(
    session: Session, 
    text: string,
    messageType?: string
  ): { replies: string[]; handledByInteractive?: boolean } {
    // Si es adjunto (foto/video/documento) -> responder guiando SIEMPRE
    if (messageType === 'image' || messageType === 'video' || messageType === 'document') {
      return { replies: ['Te leo 🙂 Cuando termines de enviar todo, escribí *LISTO*.\nSi preferís, escribí *HABLAR CON ALGUIEN*.'] };
    }
    
    // Si es HABLAR CON ALGUIEN -> derivar a Iván
    if (isHablarConAlguienCommand(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }
    
    // Si es LISTO -> derivar a Elina
    if (isListoCommand(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Elina Maidana'), getCierreAleatorio()] };
    }
    
    // Cualquier otro texto: mensaje guiado sin derivar
    return { 
      replies: ['Te leo 🙂 Cuando termines de enviar todo, escribí *LISTO*. Si preferís, escribí *HABLAR CON ALGUIEN*.'] 
    };
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
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }

    // Si no es una opción válida, mostrar menú de plan con texto
    const menuPayload = buildNCPlanMenuInteractive(session.id, STATE_TEXTS[FSMState.NC_PLAN_MENU]);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
  }

  private handleNCPlanRequisitos(
    session: Session, 
    text: string,
    messageType?: string
  ): { replies: string[]; handledByInteractive?: boolean } {
    // Si es adjunto (foto/video/documento) -> responder guiando SIEMPRE
    if (messageType === 'image' || messageType === 'video' || messageType === 'document') {
      return { replies: ['Te leo 🙂 Cuando termines de enviar todo, escribí *LISTO*.\nSi preferís, escribí *HABLAR CON ALGUIEN*.'] };
    }
    
    // Si es HABLAR CON ALGUIEN -> derivar a Iván
    if (isHablarConAlguienCommand(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }
    
    // Si es LISTO -> derivar a Elina
    if (isListoCommand(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Elina Maidana'), getCierreAleatorio()] };
    }
    
    // Cualquier otro texto: mensaje guiado sin derivar
    return { 
      replies: ['Te leo 🙂 Cuando termines de enviar todo, escribí *LISTO*. Si preferís, escribí *HABLAR CON ALGUIEN*.'] 
    };
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
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }
    
    if (text === 'nc_estado_menos24') {
      session.state = FSMState.FINALIZA;
      return { replies: ['Quedate tranquilo/a. Te vamos a responder en breve.', getCierreAleatorio()] };
    }
    
    // Si es texto libre (nombre y apellido), SIEMPRE mostrar menú 2 opciones
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
