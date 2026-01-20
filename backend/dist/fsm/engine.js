"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FSMSessionManager = void 0;
const states_1 = require("./states");
const logger_1 = __importDefault(require("../libs/logger"));
const firebase_1 = require("../firebase");
const conversations_1 = require("../services/conversations");
const interactiveMenu_1 = require("../services/interactiveMenu");
const clientsRepo_1 = require("../services/clientsRepo");
class FSMSessionManager {
    constructor() {
        this.sessions = new Map();
        // Limpiar sesiones inactivas cada 30 minutos
        this.cleanupInterval = setInterval(() => {
            this.cleanupSessions();
        }, 30 * 60 * 1000);
    }
    cleanupSessions() {
        const now = new Date();
        const ttlMinutes = 60; // TTL de 1 hora
        for (const [phone, session] of this.sessions.entries()) {
            const lastActivity = session.lastActivityAt;
            const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
            if (minutesSinceActivity > ttlMinutes) {
                this.sessions.delete(phone);
                logger_1.default.debug(`Sesión ${session.id} eliminada por inactividad`);
            }
        }
    }
    getOrCreateSession(from) {
        if (this.sessions.has(from)) {
            const session = this.sessions.get(from);
            session.lastActivityAt = new Date();
            return session;
        }
        const newSession = {
            id: from,
            state: states_1.FSMState.ROOT,
            data: {},
            createdAt: new Date(),
            lastActivityAt: new Date(),
            ttl: 60 // 60 minutos
        };
        this.sessions.set(from, newSession);
        logger_1.default.debug(`Nueva sesión creada para ${from}`);
        return newSession;
    }
    /**
     * Encola un menú interactivo al outbox y retorna array vacío (para evitar duplicados)
     * Retorna un objeto con replies y flag indicando si se encoló
     */
    async enqueueInteractiveMenu(phone, menuPayload, conversationId, inboundMessageId) {
        try {
            // Obtener conversationId si no está disponible
            let targetConversationId = conversationId;
            if (!targetConversationId) {
                try {
                    const conversationDoc = await firebase_1.collections.conversations()
                        .where('phone', '==', phone)
                        .limit(1)
                        .get();
                    if (!conversationDoc.empty) {
                        targetConversationId = conversationDoc.docs[0].id;
                    }
                }
                catch (error) {
                    logger_1.default.debug('Error obteniendo conversationId para menú', { error: error?.message });
                }
            }
            if (!targetConversationId) {
                logger_1.default.warn('interactive_menu_no_conversation_id', { phone: phone.substring(0, 5) + '***' });
                return { replies: [], handledByInteractive: false };
            }
            // Generar idempotencyKey basado en inboundMessageId o timestamp
            const idempotencyKey = inboundMessageId
                ? `${targetConversationId}:${inboundMessageId}:menu`
                : `${targetConversationId}:${Date.now()}:menu`;
            await (0, conversations_1.enqueueInteractiveOutbox)(targetConversationId, phone, menuPayload, idempotencyKey);
            logger_1.default.info('interactive_menu_enqueued', {
                conversationId: targetConversationId,
                phone: phone.substring(0, 5) + '***',
                buttonText: menuPayload.interactive?.action?.button || 'N/A'
            });
            // Retornar array vacío + flag indicando que se encoló un interactive
            return { replies: [], handledByInteractive: true };
        }
        catch (error) {
            logger_1.default.error('error_enqueuing_interactive_menu', {
                phone: phone.substring(0, 5) + '***',
                error: error?.message
            });
            return { replies: [], handledByInteractive: false };
        }
    }
    async processMessage(from, text, inboundMessageId, conversationId) {
        const session = this.getOrCreateSession(from);
        // Almacenar inboundMessageId temporalmente en la sesión
        if (inboundMessageId) {
            session.data._inboundMessageId = inboundMessageId;
        }
        session.lastActivityAt = new Date();
        // Obtener conversationId si no se pasó como parámetro
        let targetConversationId = conversationId || null;
        if (!targetConversationId) {
            try {
                const conversationDoc = await firebase_1.collections.conversations()
                    .where('phone', '==', from)
                    .limit(1)
                    .get();
                if (!conversationDoc.empty) {
                    targetConversationId = conversationDoc.docs[0].id;
                }
            }
            catch (error) {
                logger_1.default.debug('Error obteniendo conversationId', { error: error?.message });
            }
        }
        // Procesar según estado actual
        const result = await this.processState(session, text, targetConversationId, inboundMessageId);
        logger_1.default.info('fsm_message_processed', {
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
    async processState(session, text, conversationId, inboundMessageId) {
        const raw = text.trim().toLowerCase();
        switch (session.state) {
            case states_1.FSMState.ROOT:
                return await this.handleRoot(session, raw, conversationId, inboundMessageId);
            case states_1.FSMState.CLIENTE_PEDIR_CUIT:
                return await this.handleClientePedirCuit(session, text, conversationId, inboundMessageId);
            case states_1.FSMState.CLIENTE_MENU:
                return await this.handleClienteMenu(session, raw, conversationId, inboundMessageId);
            case states_1.FSMState.CLIENTE_ESTADO_GENERAL:
                return await this.handleClienteEstadoGeneral(session, raw, conversationId, inboundMessageId);
            case states_1.FSMState.CLIENTE_FACTURA_PEDIR_DATOS:
                return await this.handleClienteFacturaPedirDatos(session, text);
            case states_1.FSMState.CLIENTE_VENTAS_INFO:
                return await this.handleClienteVentasInfo(session, text);
            case states_1.FSMState.CLIENTE_REUNION:
                return await this.handleClienteReunion(session);
            case states_1.FSMState.NOCLIENTE_MENU:
                return await this.handleNoClienteMenu(session, raw, conversationId, inboundMessageId);
            case states_1.FSMState.NC_ALTA_MENU:
                return await this.handleNCAltaMenu(session, raw, conversationId, inboundMessageId);
            case states_1.FSMState.NC_ALTA_REQUISITOS:
                return await this.handleNCAltaRequisitos(session, text);
            case states_1.FSMState.NC_PLAN_MENU:
                return await this.handleNCPlanMenu(session, raw, conversationId, inboundMessageId);
            case states_1.FSMState.NC_PLAN_REQUISITOS:
                return await this.handleNCPlanRequisitos(session, text);
            case states_1.FSMState.NC_ESTADO_CONSULTA:
                return await this.handleNCEstadoConsulta(session, text, conversationId, inboundMessageId);
            case states_1.FSMState.NC_DERIVA_IVAN_TEXTO:
            case states_1.FSMState.DERIVA_IVAN:
            case states_1.FSMState.FINALIZA:
                // Estados finales: no procesar más, volver a ROOT si el usuario escribe de nuevo
                session.state = states_1.FSMState.ROOT;
                return await this.handleRoot(session, raw, conversationId, inboundMessageId);
            default:
                // Estado desconocido: volver a ROOT
                session.state = states_1.FSMState.ROOT;
                return await this.handleRoot(session, raw, conversationId, inboundMessageId);
        }
    }
    async handleRoot(session, raw, conversationId, inboundMessageId) {
        // Si es una selección de menú del ROOT
        if (raw === 'root_cliente') {
            session.state = states_1.FSMState.CLIENTE_PEDIR_CUIT;
            return { replies: [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_PEDIR_CUIT]] };
        }
        if (raw === 'root_nocliente') {
            session.state = states_1.FSMState.NOCLIENTE_MENU;
            const menuPayload = (0, interactiveMenu_1.buildNoClienteMenuInteractive)(session.id);
            return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
        }
        // Estado inicial: mostrar menú ROOT
        session.state = states_1.FSMState.ROOT;
        const menuPayload = (0, interactiveMenu_1.buildRootMenuInteractive)(session.id);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    async handleClientePedirCuit(session, text, conversationId, inboundMessageId) {
        // Guardar CUIT sin validar (solo guardar raw)
        session.data.cuit_raw = text.trim();
        // Guardar en Firestore si hay conversationId
        if (conversationId) {
            try {
                await firebase_1.collections.conversations().doc(conversationId).update({
                    cuit: text.trim(),
                    updatedAt: new Date()
                });
            }
            catch (error) {
                logger_1.default.debug('Error guardando CUIT', { error: error?.message });
            }
        }
        // Obtener nombre del cliente desde Firestore
        let nombreCliente = null;
        try {
            const clienteResult = await (0, clientsRepo_1.getClienteByCuit)(text.trim());
            if (clienteResult.exists && clienteResult.data?.nombre) {
                nombreCliente = clienteResult.data.nombre;
            }
        }
        catch (error) {
            logger_1.default.debug('Error obteniendo nombre del cliente', { error: error?.message });
        }
        session.state = states_1.FSMState.CLIENTE_MENU;
        const menuPayload = (0, interactiveMenu_1.buildClienteMenuInteractive)(session.id, nombreCliente);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    async handleClienteMenu(session, raw, conversationId, inboundMessageId) {
        if (raw === 'cli_estado') {
            session.state = states_1.FSMState.CLIENTE_ESTADO_GENERAL;
            // Enviar texto largo + menú en UN SOLO interactive
            const menuPayload = (0, interactiveMenu_1.buildClienteEstadoMenuInteractive)(session.id, states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_ESTADO_GENERAL]);
            return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
        }
        if (raw === 'cli_factura') {
            session.state = states_1.FSMState.CLIENTE_FACTURA_PEDIR_DATOS;
            return { replies: [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_FACTURA_PEDIR_DATOS]] };
        }
        if (raw === 'cli_ventas') {
            session.state = states_1.FSMState.CLIENTE_VENTAS_INFO;
            return { replies: [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_VENTAS_INFO]] };
        }
        if (raw === 'cli_reunion') {
            session.state = states_1.FSMState.CLIENTE_REUNION;
            return { replies: [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_REUNION]] };
        }
        if (raw === 'cli_ivan') {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Perfecto. Te derivo con el contador Iván Pos.'] };
        }
        // Si no es una opción válida, reenviar menú (con nombre si está disponible)
        let nombreCliente = null;
        if (session.data.cuit_raw) {
            try {
                const clienteResult = await (0, clientsRepo_1.getClienteByCuit)(session.data.cuit_raw);
                if (clienteResult.exists && clienteResult.data?.nombre) {
                    nombreCliente = clienteResult.data.nombre;
                }
            }
            catch (error) {
                logger_1.default.debug('Error obteniendo nombre del cliente', { error: error?.message });
            }
        }
        const menuPayload = (0, interactiveMenu_1.buildClienteMenuInteractive)(session.id, nombreCliente);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    async handleClienteEstadoGeneral(session, raw, conversationId, inboundMessageId) {
        if (raw === 'cli_estado_ok') {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Gracias, finalizar'] };
        }
        if (raw === 'cli_estado_belen') {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Perfecto. Te derivo con Belén Maidana 😊'] };
        }
        // Si no es una opción válida, mostrar menú de estado con texto largo
        const menuPayload = (0, interactiveMenu_1.buildClienteEstadoMenuInteractive)(session.id, states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_ESTADO_GENERAL]);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    handleClienteFacturaPedirDatos(session, text) {
        // Cualquier texto recibido: derivar a Belén con texto lindo
        session.state = states_1.FSMState.FINALIZA;
        return { replies: ['Perfecto. Te derivo con Belén Maidana 😊'] };
    }
    handleClienteVentasInfo(session, text) {
        const textUpper = text.trim().toUpperCase();
        // Si el usuario escribe PLANILLA (case-insensitive, trim, tolerar espacios)
        if (textUpper === 'PLANILLA' || textUpper.replace(/\s+/g, '') === 'PLANILLA') {
            // Enviar bloque naranja (instrucciones de planilla)
            return { replies: [states_1.STATE_TEXTS.PLANILLA_INSTRUCCIONES] };
            // NO finalizar: queda esperando más mensajes
        }
        // Cualquier otro mensaje: derivar a Belén con texto lindo
        session.state = states_1.FSMState.FINALIZA;
        return { replies: ['Perfecto. Te derivo con Belén Maidana 😊'] };
    }
    handleClienteReunion(session) {
        session.state = states_1.FSMState.FINALIZA;
        return { replies: [] };
    }
    async handleNoClienteMenu(session, raw, conversationId, inboundMessageId) {
        if (raw === 'nc_alta') {
            session.state = states_1.FSMState.NC_ALTA_MENU;
            // Enviar texto del plan + menú en UN SOLO interactive
            const menuPayload = (0, interactiveMenu_1.buildNCAltaMenuInteractive)(session.id, states_1.STATE_TEXTS.NC_ALTA_TEXTO_PLAN);
            return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
        }
        if (raw === 'nc_plan') {
            session.state = states_1.FSMState.NC_PLAN_MENU;
            // Enviar texto del plan + menú en UN SOLO interactive
            const menuPayload = (0, interactiveMenu_1.buildNCPlanMenuInteractive)(session.id, states_1.STATE_TEXTS[states_1.FSMState.NC_PLAN_MENU]);
            return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
        }
        if (raw === 'nc_ri') {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Perfecto, en breve te contactaré con Iván ☎️.'] };
        }
        if (raw === 'nc_estado') {
            session.state = states_1.FSMState.NC_ESTADO_CONSULTA;
            // Enviar texto primero, luego el menú aparecerá cuando el usuario responda
            return { replies: [states_1.STATE_TEXTS[states_1.FSMState.NC_ESTADO_CONSULTA]] };
        }
        if (raw === 'nc_ivan') {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Perfecto, en breve te contactaré con Iván ☎️.'] };
        }
        // Si no es una opción válida, reenviar menú
        const menuPayload = (0, interactiveMenu_1.buildNoClienteMenuInteractive)(session.id);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    async handleNCAltaMenu(session, raw, conversationId, inboundMessageId) {
        if (raw === 'nc_alta_si') {
            session.state = states_1.FSMState.NC_ALTA_REQUISITOS;
            return { replies: [states_1.STATE_TEXTS[states_1.FSMState.NC_ALTA_REQUISITOS]] };
        }
        if (raw === 'nc_alta_dudas') {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Entendido. Ya te derivo con el contador Iván Pos.'] };
        }
        // Si no es una opción válida, reenviar menú con texto del plan
        const menuPayload = (0, interactiveMenu_1.buildNCAltaMenuInteractive)(session.id, states_1.STATE_TEXTS.NC_ALTA_TEXTO_PLAN);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    handleNCAltaRequisitos(session, text) {
        const textUpper = text.trim().toUpperCase().replace(/\s+/g, ' ');
        // Detección tolerante de "HABLAR CON ALGUIEN" (case-insensitive, trim, tolerar espacios)
        if (textUpper.includes('HABLAR') && textUpper.includes('ALGUIEN')) {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Entendido. Ya te derivo con el contador Iván Pos.'] };
        }
        // Cualquier otro texto: derivar a Elina
        session.state = states_1.FSMState.FINALIZA;
        return { replies: ['Perfecto. Ahora te derivo con Elina Maidana 😊'] };
    }
    async handleNCPlanMenu(session, raw, conversationId, inboundMessageId) {
        if (raw === 'nc_plan_si') {
            session.state = states_1.FSMState.NC_PLAN_REQUISITOS;
            return { replies: [states_1.STATE_TEXTS[states_1.FSMState.NC_PLAN_REQUISITOS]] };
        }
        if (raw === 'nc_plan_dudas') {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Entendido. Ya te derivo con el contador Iván Pos.'] };
        }
        // Si no es una opción válida, mostrar menú de plan con texto
        const menuPayload = (0, interactiveMenu_1.buildNCPlanMenuInteractive)(session.id, states_1.STATE_TEXTS[states_1.FSMState.NC_PLAN_MENU]);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    handleNCPlanRequisitos(session, text) {
        const textUpper = text.trim().toUpperCase().replace(/\s+/g, ' ');
        // Detección tolerante de "HABLAR CON ALGUIEN"
        if (textUpper.includes('HABLAR') && textUpper.includes('ALGUIEN')) {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Entendido. Ya te derivo con el contador Iván Pos.'] };
        }
        // Cualquier otro texto: derivar a Elina
        session.state = states_1.FSMState.FINALIZA;
        return { replies: ['Perfecto. Ahora te derivo con Elina Maidana 😊'] };
    }
    async handleNCEstadoConsulta(session, text, conversationId, inboundMessageId) {
        // Si es una selección del menú (nuevos ids)
        if (text === 'nc_estado_mas24') {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Perfecto. Te derivo con el contador Iván Pos.'] };
        }
        if (text === 'nc_estado_menos24') {
            session.state = states_1.FSMState.FINALIZA;
            return { replies: ['Quedate tranquilo/a. Te vamos a responder en breve.'] };
        }
        // Si es texto libre (nombre y apellido), mostrar menú 2 opciones
        const menuPayload = (0, interactiveMenu_1.buildNCEstadoConsultaMenuInteractive)(session.id);
        return await this.enqueueInteractiveMenu(session.id, menuPayload, conversationId, inboundMessageId);
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.sessions.clear();
    }
}
exports.FSMSessionManager = FSMSessionManager;
