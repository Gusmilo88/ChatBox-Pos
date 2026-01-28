import { Session, SessionData } from '../types/message';
import { FSMState, STATE_TEXTS } from './states';
import logger from '../libs/logger';
import { collections, Timestamp } from '../firebase';
import { enqueueInteractiveOutbox, sendInternalToBelen, sendInternalToIvan } from '../services/conversations';
import {
  buildRootMenuInteractive,
  buildClienteTipoSelectorMenuInteractive,
  buildClienteMenuInteractive,
  buildClienteEstadoMenuInteractive,
  buildNoClienteMenuInteractive,
  buildNCAltaMenuInteractive,
  buildNCPlanMenuInteractive,
  buildNCRIMenuInteractive,
  buildNCEstadoConsultaMenuInteractive,
  buildHablarConAlguienMenuInteractive,
  buildFacturaConfirmMenuInteractive,
  buildFacturaEditFieldMenuInteractive
} from '../services/interactiveMenu';
import { getClienteByCuit } from '../services/clientsRepo';
import { getFraseDerivacion } from './derivations';
import { isHandoffToHuman } from '../utils/handoffCommand';
import { formatARS } from '../utils/formatARS';
import { isPaymentIntent, isMontoCommand } from '../utils/paymentIntent';

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
    'lito',
    'lisot',
    'ya',
    'ok',
    'termine',
    'fin',
    'finalizar',
    'finalice',
    'terminado',
    'ya está',
    'ya termine',
    'completo',
    'enviado'
  ];
  return sinonimos.includes(normalized);
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
      
      // MONOTRIBUTO: deuda (number) -> >0 "Con deuda $X" (formateado AR), else "Sin deuda"
      const deudaNum = Number(c.deuda ?? 0);
      if (deudaNum > 0) {
        MONO_ESTADO = `Con deuda ${formatARS(deudaNum)}`;
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

*Cliente:* ${NOMBRE}
*CUIT:* ${CUIT}
*Categoría de Monotributo:* ${CATEGORIA_MONO}
*Régimen de Ingresos Brutos:* ${REGIMEN_IIBB}

*Situación actual:*
🧾 *Monotributo:* ${MONO_ESTADO}
🏛️ *Ingresos Brutos:* ${IIBB_ESTADO}
📄 *Planes de pago vigentes:* ${PLANES_ESTADO}

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
    
    // 🔧 COMANDO RESET (QA - Solo para número de Gus)
    const GUS_QA_PHONE = '+5491125522465';
    const isResetCommand = text.trim().toLowerCase() === 'reset';
    if (isResetCommand && from === GUS_QA_PHONE) {
      // Limpiar sesión completamente
      session.state = FSMState.ROOT;
      session.data = {
        // Mantener solo campos técnicos mínimos
        _inboundMessageId: inboundMessageId,
        _messageType: messageType
      };
      session.lastActivityAt = new Date();
      
      logger.info('qa_reset_executed', {
        phone: from.replace(/\d(?=\d{4})/g, '*'),
        conversationId: conversationId || 'none'
      });
      
      return {
        session,
        replies: ['✔️ Listo. Reinicié la conversación.\nEscribí *hola* para empezar.'],
        handledByInteractive: false
      };
    }
    
    // Almacenar inboundMessageId temporalmente en la sesión
    if (inboundMessageId) {
      session.data._inboundMessageId = inboundMessageId;
    }
    
    // Almacenar messageType para usar en handlers (solo para referencia, NO usar para decisiones)
    // CRÍTICO: Las decisiones de tipo deben usar siempre el messageType del mensaje actual (currentMessageType)
    // NO usar session.data._messageType para determinar si es media o texto
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

    // Procesar según estado actual (pasar messageType actual, no de sesión)
    const result = await this.processState(session, text, targetConversationId, inboundMessageId, messageType);

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
    inboundMessageId?: string,
    currentMessageType?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    const raw = text.trim().toLowerCase();
    const textUpper = text.trim().toUpperCase();
    
    // IMPORTANTE: Usar messageType del mensaje ACTUAL, no de sesión previa
    // El messageType debe venir del payload actual (currentMessageType)
    // CRÍTICO: Si currentMessageType no está definido, asumir 'text' (no usar sesión previa para evitar arrastre de tipos)
    const messageType = currentMessageType !== undefined ? currentMessageType : (text.trim().length > 0 ? 'text' : undefined);
    

    // 1️⃣ DETECCIÓN DE PAGO DE HONORARIOS Y COMANDO MONTO
    // Solo en estados no-sensibles (menús/idle)
    const paymentEnabledStates = [
      FSMState.ROOT,
      FSMState.CLIENTE_MENU,
      FSMState.NOCLIENTE_MENU,
      FSMState.FINALIZA,
      FSMState.CLIENTE_ESTADO_GENERAL,
      FSMState.CLIENTE_REUNION,
      FSMState.CLIENTE_HABLAR_CON_ALGUIEN,
      FSMState.NC_ALTA_MENU,
      FSMState.NC_PLAN_MENU,
      FSMState.NC_RI_MENU,
      FSMState.NC_ESTADO_CONSULTA
    ];
    
    if (paymentEnabledStates.includes(session.state as FSMState)) {
      // A) Comando MONTO
      if (isMontoCommand(text)) {
        // Si está logueado como cliente
        if (session.data.cuit_raw) {
          try {
            const clienteResult = await getClienteByCuit(session.data.cuit_raw);
            if (clienteResult.exists && clienteResult.data) {
              const cliente = clienteResult.data;
              const monto = cliente.deuda_honorarios;
              
              if (monto !== undefined && monto !== null && monto > 0) {
                const nombre = cliente.nombre || 'Cliente';
                const montoFormateado = formatARS(monto);
                return { 
                  replies: [`${nombre} tu monto a abonar es de: ${montoFormateado}`, getCierreAleatorio()] 
                };
              } else {
                return { replies: [STATE_TEXTS.HONORARIOS_MONTO_NO_DISPONIBLE] };
              }
            } else {
              return { replies: [STATE_TEXTS.HONORARIOS_MONTO_NO_DISPONIBLE] };
            }
          } catch (error) {
            logger.debug('Error obteniendo monto de honorarios', { error: (error as Error)?.message });
            return { replies: [STATE_TEXTS.HONORARIOS_MONTO_NO_DISPONIBLE] };
          }
        } else {
          // No está logueado: pedir CUIT y guardar flag
          session.data.pendingHonorariosMonto = true;
          session.state = FSMState.CLIENTE_PEDIR_CUIT;
          return { replies: [STATE_TEXTS.HONORARIOS_PEDIR_CUIT] };
        }
      }
      
      // B) Intención de pago (nuevas keywords)
      if (isPaymentIntent(text)) {
        // Si está logueado como cliente
        if (session.data.cuit_raw) {
          return { replies: [STATE_TEXTS.HONORARIOS_RESPUESTA] };
        } else {
          // No está logueado: pedir CUIT y guardar flag
          session.data.pendingHonorariosMonto = true;
          session.state = FSMState.CLIENTE_PEDIR_CUIT;
          return { replies: [STATE_TEXTS.HONORARIOS_PEDIR_CUIT] };
        }
      }
    }

    // 2️⃣ COMANDO GLOBAL "HABLAR CON ALGUIEN" — antes del handler del estado
    // En estados de menú/estado: encolar menú Hablar (Iván/Belén/Elina/Volver) y NO reenviar el estado.
    // Excluir: adjuntos (image/video/document/audio/file) y estados "esperando datos" (ahí ya lo maneja el handler).
    // IMPORTANTE: Usar messageType del mensaje ACTUAL, no de sesión previa
    const isAttachment = messageType === 'image' || messageType === 'video' || messageType === 'document' || messageType === 'audio' || messageType === 'file';
    const waitingDataStates = [
      FSMState.CLIENTE_PEDIR_CUIT,
      FSMState.CLIENTE_FACTURA_PEDIR_DATOS,
      FSMState.CLIENTE_FACTURA_CONFIRM,
      FSMState.CLIENTE_FACTURA_EDIT_FIELD,
      FSMState.CLIENTE_VENTAS_INFO,
      FSMState.NC_ALTA_REQUISITOS,
      FSMState.NC_PLAN_REQUISITOS
    ];
    const handoffEnabledStates = [
      FSMState.ROOT,
      FSMState.CLIENTE_ESTADO_GENERAL,
      FSMState.CLIENTE_MENU,
      FSMState.CLIENTE_REUNION,
      FSMState.CLIENTE_HABLAR_CON_ALGUIEN,
      FSMState.NOCLIENTE_MENU,
      FSMState.NC_ALTA_MENU,
      FSMState.NC_PLAN_MENU,
      FSMState.NC_RI_MENU,
      FSMState.NC_ESTADO_CONSULTA
    ];

    if (!isAttachment && isHandoffToHuman(text) && handoffEnabledStates.includes(session.state as FSMState) && !waitingDataStates.includes(session.state as FSMState)) {
      if (session.state !== FSMState.CLIENTE_HABLAR_CON_ALGUIEN) {
        session.data.hablarVolverState = session.state;
      }
      session.state = FSMState.CLIENTE_HABLAR_CON_ALGUIEN;
      session.data.lastMenuState = 'CLIENTE_HABLAR_CON_ALGUIEN';
      const menuPayload = buildHablarConAlguienMenuInteractive(session.id);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }

    // 2.5️⃣ PRE-HANDLER: LISTO en estados expectsMedia (ANTES del bloque de media)
    // Si el estado espera media y el mensaje actual es texto LISTO, procesarlo ANTES del bloque de media
    // para evitar que el bloque de media se ejecute incorrectamente
    const expectsMediaStates = [
      FSMState.CLIENTE_VENTAS_INFO,
      FSMState.CLIENTE_FACTURA_PEDIR_DATOS,
      FSMState.NC_ALTA_REQUISITOS,
      FSMState.NC_PLAN_REQUISITOS
    ];
    // Estados que permiten consulta libre (audio/media/texto) - NO deben ser interceptados por bloque de media global
    const consultaLibreStates = [
      FSMState.CLIENTE_RI_CONSULTA_LIBRE,
      FSMState.CLIENTE_OTRO_CONSULTA_LIBRE
    ];
    const expectsMedia = expectsMediaStates.includes(session.state as FSMState);
    const isConsultaLibre = consultaLibreStates.includes(session.state as FSMState);
    
    // Si el estado espera media y el mensaje actual es texto (no media)
    if (expectsMedia && !isAttachment && (messageType === 'text' || messageType === undefined)) {
      // Si es LISTO, dejar que continúe al switch (los handlers específicos lo procesarán)
      if (isListoCommand(text)) {
        logger.info('listo_processed_prehandler', {
          stateKey: session.state,
          textPreview: text.substring(0, 20),
          messageType: messageType
        });
        // NO ejecutar bloque de media, dejar continuar al switch
        // El handler específico procesará LISTO correctamente
      } else {
        // Si es texto normal (no LISTO), responder guiado y NO ejecutar bloque de media
        // Los handlers específicos manejarán esto, pero para evitar confusión, responder aquí
        // y dejar que el switch continúe normalmente
      }
    }

    // 3️⃣ MANEJO CENTRAL DE MEDIA (imágenes/archivos/videos) — SOLO para media real
    // IMPORTANTE: Este bloque solo se ejecuta si messageType ACTUAL es realmente media (image/document/video/audio/file)
    // NO debe ejecutarse para texto, incluso si el estado espera media
    // Para texto en estados expectsMedia, los handlers específicos manejan LISTO y otros comandos
    // CRÍTICO: Usar messageType del mensaje ACTUAL, no de sesión previa
    // CRÍTICO: Solo ejecutar si realmente es media (verificación explícita de messageType)
    // CRÍTICO: NUNCA ejecutar si messageType es 'text' o undefined
    
    // PRIMERO: Verificar si es texto - si es texto, NO ejecutar bloque de media (salir temprano)
    const isTextMessage = messageType === 'text' || (messageType === undefined && text.trim().length > 0);
    if (isTextMessage) {
      // Es texto: NO ejecutar bloque de media, continuar al switch
      // Los handlers específicos manejarán el texto (LISTO, guiado, etc.)
      // NO loguear media_received ni media_ack_sent para texto
    } else {
      // NO es texto: verificar si es media real
      const isMediaType = messageType === 'image' || messageType === 'video' || messageType === 'document' || messageType === 'audio' || messageType === 'file' || messageType === 'sticker';
      
      // CRÍTICO: Si es estado de consulta libre, NO interceptar aquí - dejar que el handler específico lo maneje
      if (isMediaType && isConsultaLibre) {
        // Es media en estado de consulta libre: NO ejecutar bloque de media global, continuar al switch
        // El handler específico (handleClienteRIConsultaLibre / handleClienteOtroConsultaLibre) lo procesará
      } else if (isMediaType) {
        // Es media real en otros estados: ejecutar bloque de media
        // Log solo cuando realmente es media (usar messageType actual)
        logger.info('media_received', {
          type: messageType,
          state: session.state,
          expectsMedia,
          conversationId
        });

        if (expectsMedia) {
          // A) Estado espera media Y realmente llegó media: responder con recordatorio LISTO (mantener estado)
          logger.info('media_ack_sent', {
            type: messageType,
            state: session.state
          });
          return { 
            replies: ['Perfecto 👍\nRecibimos el archivo que enviaste.\n\nSi aún tenés más información para adjuntar, podés hacerlo ahora.\n\nCuando finalices, escribí la palabra *LISTO* para continuar.']
          };
        } else {
          // B) Estado NO espera media: responder con texto + menú contextual
          let menuPayload;
          let chosenMenu = 'ROOT';

          // Determinar menú contextual
          if (session.data.cuit_raw) {
            // Cliente identificado
            let nombreCliente: string | null = null;
            try {
              const clienteResult = await getClienteByCuit(session.data.cuit_raw);
              if (clienteResult.exists && clienteResult.data?.nombre) {
                nombreCliente = clienteResult.data.nombre;
              }
            } catch (error) {
              logger.debug('Error obteniendo nombre del cliente para menú media', { error: (error as Error)?.message });
            }
            menuPayload = buildClienteMenuInteractive(session.id, nombreCliente);
            chosenMenu = 'CLIENTE_MENU';
            session.data.lastMenuState = 'CLIENTE_MENU';
          } else if (session.data.lastMenuState === 'NOCLIENTE_MENU') {
            // No-cliente (último menú fue no-cliente)
            menuPayload = buildNoClienteMenuInteractive(session.id);
            chosenMenu = 'NOCLIENTE_MENU';
            session.data.lastMenuState = 'NOCLIENTE_MENU';
          } else {
            // Root (no se puede determinar)
            menuPayload = buildRootMenuInteractive(session.id);
            chosenMenu = 'ROOT';
            session.data.lastMenuState = 'ROOT';
          }

          logger.info('media_prompt_sent', {
            type: messageType,
            state: session.state,
            prompt: 'contextual_menu',
            chosenMenu
          });

          // Determinar texto según contexto
          let responseText = '';
          if (session.data.cuit_raw) {
            // Cliente logueado
            responseText = 'Perdón 😅\nEn este momento no estoy esperando archivos o imágenes.\n\n👉 Elegí una opción del menú y te ayudo enseguida.';
            session.state = FSMState.CLIENTE_MENU;
          } else {
            // No cliente
            responseText = 'Perdón 😅\nEn este momento no estoy esperando archivos o imágenes.\n\n👉 Elegí una opción del menú para continuar.';
            if (chosenMenu === 'NOCLIENTE_MENU') {
              session.state = FSMState.NOCLIENTE_MENU;
            } else {
              session.state = FSMState.ROOT;
            }
          }
          
          await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
          return { replies: [responseText], handledByInteractive: true };
        }
      }
    }

    switch (session.state) {
      case FSMState.ROOT:
        return await this.handleRoot(session, raw, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_TIPO_SELECTOR:
        return await this.handleClienteTipoSelector(session, raw, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_PEDIR_CUIT:
        return await this.handleClientePedirCuit(session, text, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_MENU:
        return await this.handleClienteMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_ESTADO_GENERAL:
        return await this.handleClienteEstadoGeneral(session, raw, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_FACTURA_PEDIR_DATOS:
        return await this.handleClienteFacturaPedirDatos(session, text, conversationId, inboundMessageId, messageType);
      
      case FSMState.CLIENTE_FACTURA_CONFIRM:
        return await this.handleClienteFacturaConfirm(session, raw, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_FACTURA_EDIT_FIELD:
        return await this.handleClienteFacturaEditField(session, text, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_VENTAS_INFO:
        return await this.handleClienteVentasInfo(session, text, messageType);
      
      case FSMState.CLIENTE_REUNION:
        return await this.handleClienteReunion(session);
      
      case FSMState.CLIENTE_HABLAR_CON_ALGUIEN:
        return await this.handleClienteHablarConAlguien(session, raw, conversationId, inboundMessageId);
      
      case FSMState.CLIENTE_RI_CONSULTA_LIBRE:
        return await this.handleClienteRIConsultaLibre(session, text, conversationId, inboundMessageId, messageType);
      
      case FSMState.CLIENTE_OTRO_CONSULTA_LIBRE:
        return await this.handleClienteOtroConsultaLibre(session, text, conversationId, inboundMessageId, messageType);
      
      case FSMState.NOCLIENTE_MENU:
        return await this.handleNoClienteMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.NC_ALTA_MENU:
        return await this.handleNCAltaMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.NC_ALTA_REQUISITOS:
        return await this.handleNCAltaRequisitos(session, text, messageType);
      
      case FSMState.NC_PLAN_MENU:
        return await this.handleNCPlanMenu(session, raw, conversationId, inboundMessageId);
      
      case FSMState.NC_PLAN_REQUISITOS:
        return await this.handleNCPlanRequisitos(session, text, messageType);
      
      case FSMState.NC_RI_MENU:
        return await this.handleNCRIMenu(session, raw, conversationId, inboundMessageId);
      
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
      session.state = FSMState.CLIENTE_TIPO_SELECTOR;
      session.data.lastMenuState = 'CLIENTE_TIPO_SELECTOR';
      const menuPayload = buildClienteTipoSelectorMenuInteractive(session.id, STATE_TEXTS[FSMState.CLIENTE_TIPO_SELECTOR]);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
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

  private async handleClienteTipoSelector(
    session: Session,
    raw: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    // Si es una selección del menú de tipo de cliente
    if (raw === 'cli_tipo_monotributo') {
      // Monotributista: flujo actual (pedir CUIT)
      session.state = FSMState.CLIENTE_PEDIR_CUIT;
      return { replies: [STATE_TEXTS[FSMState.CLIENTE_PEDIR_CUIT]] };
    }
    
    if (raw === 'cli_tipo_ri') {
      // Responsable Inscripto: derivar a consulta libre
      session.state = FSMState.CLIENTE_RI_CONSULTA_LIBRE;
      // Limpiar datos previos si existen
      session.data.consulta_libre_text = '';
      session.data.consulta_libre_textCount = 0;
      session.data.consulta_libre_media = [];
      if (session.data.consultaLibreLastAckAtByState) {
        delete session.data.consultaLibreLastAckAtByState[FSMState.CLIENTE_RI_CONSULTA_LIBRE];
      }
      return { replies: [STATE_TEXTS[FSMState.CLIENTE_RI_CONSULTA_LIBRE]] };
    }
    
    if (raw === 'cli_tipo_otro') {
      // Otro tipo: derivar a consulta libre
      session.state = FSMState.CLIENTE_OTRO_CONSULTA_LIBRE;
      // Limpiar datos previos si existen
      session.data.consulta_libre_text = '';
      session.data.consulta_libre_textCount = 0;
      session.data.consulta_libre_media = [];
      if (session.data.consultaLibreLastAckAtByState) {
        delete session.data.consultaLibreLastAckAtByState[FSMState.CLIENTE_OTRO_CONSULTA_LIBRE];
      }
      return { replies: [STATE_TEXTS[FSMState.CLIENTE_OTRO_CONSULTA_LIBRE]] };
    }

    // Estado inicial: mostrar menú de tipo de cliente
    session.state = FSMState.CLIENTE_TIPO_SELECTOR;
    session.data.lastMenuState = 'CLIENTE_TIPO_SELECTOR';
    const menuPayload = buildClienteTipoSelectorMenuInteractive(session.id, STATE_TEXTS[FSMState.CLIENTE_TIPO_SELECTOR]);
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
    
    // d) Si SÍ existe: guardar en sesión
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

    // e) Si hay flag pendingHonorariosMonto, responder con el monto y limpiar flag
    if (session.data.pendingHonorariosMonto) {
      session.data.pendingHonorariosMonto = false;
      const monto = data.deuda_honorarios;
      
      if (monto !== undefined && monto !== null && monto > 0) {
        const nombre = data.nombre || 'Cliente';
        const montoFormateado = formatARS(monto);
        session.state = FSMState.CLIENTE_MENU;
        session.data.lastMenuState = 'CLIENTE_MENU';
        const menuPayload = buildClienteMenuInteractive(session.id, data.nombre || null);
        // Encolar menú y responder monto
        await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
        return { 
          replies: [`${nombre} tu monto a abonar es de: ${montoFormateado}`, getCierreAleatorio()],
          handledByInteractive: true
        };
      } else {
        // No hay monto: ir al menú cliente y responder mensaje
        session.state = FSMState.CLIENTE_MENU;
        session.data.lastMenuState = 'CLIENTE_MENU';
        const menuPayload = buildClienteMenuInteractive(session.id, data.nombre || null);
        await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
        return { 
          replies: [STATE_TEXTS.HONORARIOS_MONTO_NO_DISPONIBLE],
          handledByInteractive: true
        };
      }
    }

    // f) Flujo normal: continuar al menú cliente
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
    // IMPORTANTE: Verificar LISTO PRIMERO (solo si NO es media) para evitar responder "Recibimos archivo" cuando es texto
    // Si es LISTO (y es texto, no media) -> parsear datos y mostrar confirmación
    if (isListoCommand(text) && messageType !== 'image' && messageType !== 'video' && messageType !== 'document' && messageType !== 'audio' && messageType !== 'file') {
      logger.info('listo_processed', {
        stateKey: session.state,
        textPreview: text.substring(0, 20)
      });
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
    
    // Si es adjunto (foto/video/documento/audio/file) -> responder guiando SIEMPRE
    if (messageType === 'image' || messageType === 'video' || messageType === 'document' || messageType === 'audio' || messageType === 'file') {
      return { replies: ['Perfecto 👍\nRecibimos el archivo que enviaste.\n\nSi aún tenés más información para adjuntar, podés hacerlo ahora.\n\nCuando finalices, escribí la palabra *LISTO* para continuar.'] };
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
    // IMPORTANTE: Verificar LISTO PRIMERO (solo si NO es media) para evitar responder "Recibimos archivo" cuando es texto
    // Si es LISTO (y es texto, no media) -> responder texto específico y finalizar
    if (isListoCommand(text) && messageType !== 'image' && messageType !== 'video' && messageType !== 'document' && messageType !== 'audio' && messageType !== 'file') {
      logger.info('listo_processed', {
        stateKey: session.state,
        textPreview: text.substring(0, 20)
      });
      session.state = FSMState.FINALIZA;
      return { replies: ['Entendido 🙂 le enviaré la documentación a Belén Maidana.', getCierreAleatorio()] };
    }
    
    // Si es adjunto (foto/video/documento/audio/file) -> responder guiando SIEMPRE
    if (messageType === 'image' || messageType === 'video' || messageType === 'document' || messageType === 'audio' || messageType === 'file') {
      return { replies: ['Perfecto 👍\nRecibimos el archivo que enviaste.\n\nSi aún tenés más información para adjuntar, podés hacerlo ahora.\n\nCuando finalices, escribí la palabra *LISTO* para continuar.'] };
    }
    
    // Si es HABLAR CON ALGUIEN -> derivar a Iván
    if (isHandoffToHuman(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
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

  private async handleClienteRIConsultaLibre(
    session: Session,
    text: string,
    conversationId: string | null,
    inboundMessageId?: string,
    messageType?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    // Inicializar campos si no existen
    if (!session.data.consulta_libre_text) {
      session.data.consulta_libre_text = '';
    }
    if (!session.data.consulta_libre_media) {
      session.data.consulta_libre_media = [];
    }
    if (!session.data.consultaLibreLastAckAtByState) {
      session.data.consultaLibreLastAckAtByState = {};
    }

    // Constante para cooldown de ACK (12 segundos)
    const ACK_COOLDOWN_MS = 12000;

    // Helper para verificar si debe enviar ACK (throttle)
    const stateKey = session.state;
    const shouldSendAck = (): boolean => {
      const lastAck = session.data.consultaLibreLastAckAtByState![stateKey];
      if (!lastAck) return true; // Primer mensaje
      return Date.now() - lastAck >= ACK_COOLDOWN_MS;
    };

    // Helper para actualizar timestamp de ACK
    const updateAckTimestamp = (): void => {
      session.data.consultaLibreLastAckAtByState![stateKey] = Date.now();
    };

    // 1️⃣ COMANDO LISTO: procesar y derivar a Iván
    if (isListoCommand(text) && messageType !== 'image' && messageType !== 'video' && messageType !== 'document' && messageType !== 'audio' && messageType !== 'file') {
      const hasText = session.data.consulta_libre_text.trim().length > 0;
      const hasMedia = session.data.consulta_libre_media.length > 0;
      
      logger.info('consulta_libre_listo', {
        state: session.state,
        textLen: session.data.consulta_libre_text.length,
        audiosCount: session.data.consulta_libre_media.filter(m => m.type === 'audio' || m.type === 'voice').length,
        mediaCount: session.data.consulta_libre_media.length
      });

      // Si no hay contenido: pedir que envíe consulta
      if (!hasText && !hasMedia) {
        return { 
          replies: ['Antes enviame tu consulta (texto o audio). Cuando termines, escribí LISTO.'] 
        };
      }

      // Generar resumen para Iván
      const phone = session.id;
      const cuit = session.data.cuit_raw || '(sin CUIT)';
      const textos = session.data.consulta_libre_text.trim() || '(sin texto)';
      
      // Contar audios y otros media
      const audios = session.data.consulta_libre_media.filter(m => m.type === 'audio' || m.type === 'voice');
      const otrosMedia = session.data.consulta_libre_media.filter(m => m.type !== 'audio' && m.type !== 'voice');
      const textCount = session.data.consulta_libre_textCount || 0;
      const audiosCount = audios.length;
      const archivosCount = otrosMedia.length;
      
      let mediaInfo = '';
      if (audios.length > 0) {
        mediaInfo += `Audios: ${audios.length}`;
      }
      if (otrosMedia.length > 0) {
        if (mediaInfo) mediaInfo += ', ';
        mediaInfo += `Otros archivos: ${otrosMedia.length}`;
      }
      if (!mediaInfo) {
        mediaInfo = 'Sin archivos adjuntos';
      }

      // 1️⃣ MENSAJE RESUMEN VISIBLE (unificado con derivación)
      const mensajeResumen = `🔴 CONSULTA PRIORITARIA – RESPONSABLE INSCRIPTO
━━━━━━━━━━━━━━━━━━━━━━
Gracias por tu mensaje.

📝 Mensajes enviados: ${textCount}
🎧 Audios enviados: ${audiosCount}
📎 Archivos enviados: ${archivosCount}

Listo ✅ Ya le enviamos tu consulta a Iván.
Te va a responder a la brevedad.`;

      // 2️⃣ MENSAJE INTERNO (para Iván)
      const mensajeInterno = `🔴 CONSULTA PRIORITARIA - Responsable Inscripto / Sociedades

📞 Teléfono: ${phone}
${cuit !== '(sin CUIT)' ? `🆔 CUIT: ${cuit}` : ''}

📝 Consulta:
${textos}

📎 ${mediaInfo}

---
Esta consulta fue enviada desde el chatbot. El usuario escribió LISTO para finalizar.`;

      // Enviar a Iván
      await sendInternalToIvan(mensajeInterno);

      // Limpiar datos de sesión completamente
      session.data.consulta_libre_text = '';
      session.data.consulta_libre_textCount = 0;
      session.data.consulta_libre_media = [];
      if (session.data.consultaLibreLastAckAtByState) {
        delete session.data.consultaLibreLastAckAtByState[stateKey];
      }

      // Finalizar y volver a ROOT (sin enviar menú automático)
      session.state = FSMState.ROOT;
      return { 
        replies: [
          mensajeResumen,
          getCierreAleatorio()
        ] 
      };
    }

    // 2️⃣ COMANDO HABLAR CON ALGUIEN: derivar normalmente
    if (isHandoffToHuman(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }

    // 3️⃣ AUDIO: acumular referencia y responder ACK
    if (messageType === 'audio' || messageType === 'voice') {
      session.data.consulta_libre_media.push({
        type: messageType,
        mediaId: inboundMessageId,
        messageId: inboundMessageId,
        ts: new Date()
      });

      logger.info('consulta_libre_received', {
        state: session.state,
        messageType: messageType,
        textPreview: '',
        hasMediaId: !!inboundMessageId
      });

      return { 
        replies: ['✅ Perfecto, recibimos tu AUDIO. Podés enviar más información si querés. Cuando termines, escribí LISTO.'] 
      };
    }

    // 4️⃣ IMAGEN/DOCUMENTO/VIDEO: acumular referencia y responder ACK
    if (messageType === 'image' || messageType === 'document' || messageType === 'video' || messageType === 'file') {
      session.data.consulta_libre_media.push({
        type: messageType,
        mediaId: inboundMessageId,
        messageId: inboundMessageId,
        ts: new Date()
      });

      logger.info('consulta_libre_received', {
        state: session.state,
        messageType: messageType,
        textPreview: '',
        hasMediaId: !!inboundMessageId
      });

      return { 
        replies: ['✅ Perfecto, recibimos tu ARCHIVO. Podés enviar más información. Cuando termines, escribí LISTO.'] 
      };
    }

    // 5️⃣ TEXTO: acumular y responder guiado (con throttling restrictivo)
    if (messageType === 'text' || messageType === undefined) {
      // SIEMPRE guardar (no perder nada)
      if (text.trim().length > 0) {
        // Incrementar contador de mensajes de texto
        session.data.consulta_libre_textCount = (session.data.consulta_libre_textCount || 0) + 1;
        // Append con saltos de línea
        if (session.data.consulta_libre_text) {
          session.data.consulta_libre_text += '\n\n' + text.trim();
        } else {
          session.data.consulta_libre_text = text.trim();
        }
      }

      logger.info('consulta_libre_received', {
        state: session.state,
        messageType: 'text',
        textPreview: text.substring(0, 50),
        hasMediaId: false
      });

      // Throttling restrictivo: responder solo si es el primer mensaje o pasa el throttle
      if (shouldSendAck()) {
        updateAckTimestamp();
        return { 
          replies: ['Perfecto ✅ Cuando termines, escribí LISTO.'] 
        };
      }

      // No responder si no pasa throttle (evitar spam)
      return { replies: [] };
    }

    // Fallback: mantener estado
    return { 
      replies: ['Podés enviar tu consulta por texto o audio. Cuando termines, escribí LISTO.'] 
    };
  }

  private async handleClienteOtroConsultaLibre(
    session: Session,
    text: string,
    conversationId: string | null,
    inboundMessageId?: string,
    messageType?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    // Inicializar campos si no existen
    if (!session.data.consulta_libre_text) {
      session.data.consulta_libre_text = '';
    }
    if (session.data.consulta_libre_textCount === undefined) {
      session.data.consulta_libre_textCount = 0;
    }
    if (!session.data.consulta_libre_media) {
      session.data.consulta_libre_media = [];
    }
    if (!session.data.consultaLibreLastAckAtByState) {
      session.data.consultaLibreLastAckAtByState = {};
    }

    // Constante para cooldown de ACK (12 segundos)
    const ACK_COOLDOWN_MS = 12000;

    // Helper para verificar si debe enviar ACK (throttle)
    const stateKey = session.state;
    const shouldSendAck = (): boolean => {
      const lastAck = session.data.consultaLibreLastAckAtByState![stateKey];
      if (!lastAck) return true; // Primer mensaje
      return Date.now() - lastAck >= ACK_COOLDOWN_MS;
    };

    // Helper para actualizar timestamp de ACK
    const updateAckTimestamp = (): void => {
      session.data.consultaLibreLastAckAtByState![stateKey] = Date.now();
    };

    // 1️⃣ COMANDO LISTO: procesar y derivar al equipo
    if (isListoCommand(text) && messageType !== 'image' && messageType !== 'video' && messageType !== 'document' && messageType !== 'audio' && messageType !== 'file') {
      const hasText = session.data.consulta_libre_text.trim().length > 0;
      const hasMedia = session.data.consulta_libre_media.length > 0;
      
      logger.info('consulta_libre_listo', {
        state: session.state,
        textLen: session.data.consulta_libre_text.length,
        audiosCount: session.data.consulta_libre_media.filter(m => m.type === 'audio' || m.type === 'voice').length,
        mediaCount: session.data.consulta_libre_media.length
      });

      // Si no hay contenido: pedir que envíe consulta
      if (!hasText && !hasMedia) {
        return { 
          replies: ['Antes enviame tu consulta (texto o audio). Cuando termines, escribí LISTO.'] 
        };
      }

      // Generar resumen para el equipo (usar sendInternalToBelen como genérico, o crear función genérica)
      const phone = session.id;
      const cuit = session.data.cuit_raw || '(sin CUIT)';
      const textos = session.data.consulta_libre_text.trim() || '(sin texto)';
      
      // Contar audios y otros media
      const audios = session.data.consulta_libre_media.filter(m => m.type === 'audio' || m.type === 'voice');
      const otrosMedia = session.data.consulta_libre_media.filter(m => m.type !== 'audio' && m.type !== 'voice');
      const textCount = session.data.consulta_libre_textCount || 0;
      const audiosCount = audios.length;
      const archivosCount = otrosMedia.length;
      
      let mediaInfo = '';
      if (audios.length > 0) {
        mediaInfo += `Audios: ${audios.length}`;
      }
      if (otrosMedia.length > 0) {
        if (mediaInfo) mediaInfo += ', ';
        mediaInfo += `Otros archivos: ${otrosMedia.length}`;
      }
      if (!mediaInfo) {
        mediaInfo = 'Sin archivos adjuntos';
      }

      // 1️⃣ MENSAJE RESUMEN VISIBLE (unificado con derivación)
      const mensajeResumen = `🟡 NUEVA CONSULTA – OTRO TIPO DE CLIENTE
━━━━━━━━━━━━━━━━━━━━━━
Gracias por tu mensaje.

📝 Mensajes enviados: ${textCount}
🎧 Audios enviados: ${audiosCount}
📎 Archivos enviados: ${archivosCount}

Listo ✅ Ya enviamos tu consulta al equipo.
Te van a responder a la brevedad.`;

      // 2️⃣ MENSAJE INTERNO (para el equipo)
      const mensajeInterno = `📋 CONSULTA - Otro tipo de cliente

📞 Teléfono: ${phone}
${cuit !== '(sin CUIT)' ? `🆔 CUIT: ${cuit}` : ''}

📝 Consulta:
${textos}

📎 ${mediaInfo}

---
Esta consulta fue enviada desde el chatbot. El usuario escribió LISTO para finalizar.`;

      // Enviar al equipo (usar sendInternalToBelen como genérico por ahora)
      await sendInternalToBelen(mensajeInterno);

      // Limpiar datos de sesión completamente
      session.data.consulta_libre_text = '';
      session.data.consulta_libre_textCount = 0;
      session.data.consulta_libre_media = [];
      if (session.data.consultaLibreLastAckAtByState) {
        delete session.data.consultaLibreLastAckAtByState[stateKey];
      }

      // Finalizar y volver a ROOT (sin enviar menú automático)
      session.state = FSMState.ROOT;
      return { 
        replies: [
          mensajeResumen,
          getCierreAleatorio()
        ] 
      };
    }

    // 2️⃣ COMANDO HABLAR CON ALGUIEN: derivar normalmente
    if (isHandoffToHuman(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
    }

    // 3️⃣ AUDIO: acumular referencia y responder ACK (con throttle)
    if (messageType === 'audio' || messageType === 'voice') {
      // SIEMPRE guardar (no perder nada)
      session.data.consulta_libre_media.push({
        type: messageType,
        mediaId: inboundMessageId,
        messageId: inboundMessageId,
        ts: new Date()
      });

      logger.info('consulta_libre_received', {
        state: session.state,
        messageType: messageType,
        textPreview: '',
        hasMediaId: !!inboundMessageId
      });

      // SOLO enviar ACK si pasa el throttle
      if (shouldSendAck()) {
        updateAckTimestamp();
        return { 
          replies: ['✅ Perfecto, recibimos tu AUDIO. Podés enviar más información si querés. Cuando termines, escribí LISTO.'] 
        };
      }

      // No responder si no pasa throttle (evitar spam)
      return { replies: [] };
    }

    // 4️⃣ IMAGEN/DOCUMENTO/VIDEO: acumular referencia y responder ACK (con throttle)
    if (messageType === 'image' || messageType === 'document' || messageType === 'video' || messageType === 'file') {
      // SIEMPRE guardar (no perder nada)
      session.data.consulta_libre_media.push({
        type: messageType,
        mediaId: inboundMessageId,
        messageId: inboundMessageId,
        ts: new Date()
      });

      logger.info('consulta_libre_received', {
        state: session.state,
        messageType: messageType,
        textPreview: '',
        hasMediaId: !!inboundMessageId
      });

      // SOLO enviar ACK si pasa el throttle
      if (shouldSendAck()) {
        updateAckTimestamp();
        return { 
          replies: ['✅ Perfecto, recibimos tu ARCHIVO. Podés enviar más información si querés. Cuando termines, escribí LISTO.'] 
        };
      }

      // No responder si no pasa throttle (evitar spam)
      return { replies: [] };
    }

    // 5️⃣ TEXTO: acumular y responder guiado (con throttling restrictivo)
    if (messageType === 'text' || messageType === undefined) {
      // SIEMPRE guardar (no perder nada)
      if (text.trim().length > 0) {
        // Incrementar contador de mensajes de texto
        session.data.consulta_libre_textCount = (session.data.consulta_libre_textCount || 0) + 1;
        // Append con saltos de línea
        if (session.data.consulta_libre_text) {
          session.data.consulta_libre_text += '\n\n' + text.trim();
        } else {
          session.data.consulta_libre_text = text.trim();
        }
      }

      logger.info('consulta_libre_received', {
        state: session.state,
        messageType: 'text',
        textPreview: text.substring(0, 50),
        hasMediaId: false
      });

      // Throttling restrictivo: responder solo si es el primer mensaje o pasa el throttle
      if (shouldSendAck()) {
        updateAckTimestamp();
        return { 
          replies: ['Perfecto ✅ Cuando termines, escribí LISTO.'] 
        };
      }

      // No responder si no pasa throttle (evitar spam)
      return { replies: [] };
    }

    // Fallback: mantener estado
    return { 
      replies: ['Podés enviar tu consulta por texto o audio. Cuando termines, escribí LISTO.'] 
    };
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
      const volverA = session.data.hablarVolverState || FSMState.CLIENTE_ESTADO_GENERAL;
      session.state = volverA;
      delete session.data.hablarVolverState;

      if (volverA === FSMState.CLIENTE_ESTADO_GENERAL) {
        const cuit = session.data.cuit_raw || '';
        const body = await buildEstadoArcaMessage(cuit);
        const menuPayload = buildClienteEstadoMenuInteractive(session.id, body);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
      }
      if (volverA === FSMState.CLIENTE_MENU) {
        let nombre: string | null = null;
        if (session.data.cuit_raw) {
          try {
            const r = await getClienteByCuit(session.data.cuit_raw);
            if (r.exists && r.data?.nombre) nombre = r.data.nombre;
          } catch (_) {}
        }
        const menuPayload = buildClienteMenuInteractive(session.id, nombre);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
      }
      if (volverA === FSMState.NOCLIENTE_MENU) {
        const menuPayload = buildNoClienteMenuInteractive(session.id);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
      }
      if (volverA === FSMState.ROOT) {
        const menuPayload = buildRootMenuInteractive(session.id);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
      }
      if (volverA === FSMState.NC_ALTA_MENU) {
        const menuPayload = buildNCAltaMenuInteractive(session.id, STATE_TEXTS.NC_ALTA_TEXTO_PLAN);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
      }
      if (volverA === FSMState.NC_PLAN_MENU) {
        const menuPayload = buildNCPlanMenuInteractive(session.id, STATE_TEXTS[FSMState.NC_PLAN_MENU]);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
      }
      if (volverA === FSMState.NC_ESTADO_CONSULTA) {
        const menuPayload = buildNCEstadoConsultaMenuInteractive(session.id);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
      }
      if (volverA === FSMState.CLIENTE_REUNION) {
        session.state = FSMState.CLIENTE_MENU;
        let nombre: string | null = null;
        if (session.data.cuit_raw) {
          try {
            const r = await getClienteByCuit(session.data.cuit_raw);
            if (r.exists && r.data?.nombre) nombre = r.data.nombre;
          } catch (_) {}
        }
        const menuPayload = buildClienteMenuInteractive(session.id, nombre);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
      }
      // Fallback: estado general
      const cuit = session.data.cuit_raw || '';
      const body = await buildEstadoArcaMessage(cuit);
      const menuPayload = buildClienteEstadoMenuInteractive(session.id, body);
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
      session.state = FSMState.NC_RI_MENU;
      // Enviar texto del plan RI + menú en UN SOLO interactive
      const menuPayload = buildNCRIMenuInteractive(session.id, STATE_TEXTS[FSMState.NC_RI_MENU]);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
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
    // IMPORTANTE: Verificar LISTO PRIMERO (solo si NO es media) para evitar responder "Recibimos archivo" cuando es texto
    // Si es LISTO (y es texto, no media) -> derivar a Elina
    if (isListoCommand(text) && messageType !== 'image' && messageType !== 'video' && messageType !== 'document' && messageType !== 'audio' && messageType !== 'file') {
      logger.info('listo_processed', {
        stateKey: session.state,
        textPreview: text.substring(0, 20)
      });
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Elina Maidana'), getCierreAleatorio()] };
    }
    
    // Si es adjunto (foto/video/documento/audio/file) -> responder guiando SIEMPRE
    if (messageType === 'image' || messageType === 'video' || messageType === 'document' || messageType === 'audio' || messageType === 'file') {
      return { replies: ['Perfecto 👍\nRecibimos el archivo que enviaste.\n\nSi aún tenés más información para adjuntar, podés hacerlo ahora.\n\nCuando finalices, escribí la palabra *LISTO* para continuar.'] };
    }
    
    // Si es HABLAR CON ALGUIEN -> derivar a Iván
    if (isHandoffToHuman(text)) {
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Iván Pos'), getCierreAleatorio()] };
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
    // IMPORTANTE: Verificar LISTO PRIMERO (solo si NO es media) para evitar responder "Recibimos archivo" cuando es texto
    // Si es LISTO (y es texto, no media) -> derivar a Elina
    if (isListoCommand(text) && messageType !== 'image' && messageType !== 'video' && messageType !== 'document' && messageType !== 'audio' && messageType !== 'file') {
      logger.info('listo_processed', {
        stateKey: session.state,
        textPreview: text.substring(0, 20)
      });
      session.state = FSMState.FINALIZA;
      return { replies: [getFraseDerivacion('Elina Maidana'), getCierreAleatorio()] };
    }
    
    // Cualquier otro texto: mensaje guiado sin derivar
    return { 
      replies: ['Te leo 🙂 Cuando termines de enviar todo, escribí *LISTO*. Si preferís, escribí *HABLAR CON ALGUIEN*.'] 
    };
  }

  private async handleNCRIMenu(
    session: Session,
    raw: string,
    conversationId: string | null,
    inboundMessageId?: string
  ): Promise<{ replies: string[]; handledByInteractive?: boolean }> {
    if (raw === 'ri_agendar_si') {
      session.state = FSMState.FINALIZA;
      return { replies: [STATE_TEXTS[FSMState.CLIENTE_REUNION], getCierreAleatorio()] };
    }
    
    if (raw === 'ri_agendar_no') {
      session.state = FSMState.NOCLIENTE_MENU;
      session.data.lastMenuState = 'NOCLIENTE_MENU';
      const menuPayload = buildNoClienteMenuInteractive(session.id);
      return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }

    // Si no es una opción válida, mostrar menú RI con texto
    const menuPayload = buildNCRIMenuInteractive(session.id, STATE_TEXTS[FSMState.NC_RI_MENU]);
    return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
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
