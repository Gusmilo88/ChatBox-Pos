"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FSMSessionManager = void 0;
const states_1 = require("./states");
const cuit_1 = require("../utils/cuit");
const logger_1 = __importDefault(require("../libs/logger"));
const ai_1 = require("../services/ai");
const clientsRepo_1 = require("../services/clientsRepo");
class FSMSessionManager {
    formatARS(n) {
        return n.toLocaleString('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 2
        });
    }
    constructor() {
        this.sessions = new Map();
        // Limpieza automática cada 5 minutos
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 5 * 60 * 1000);
    }
    cleanupExpiredSessions() {
        const now = new Date();
        const expiredSessions = [];
        for (const [sessionId, session] of this.sessions.entries()) {
            const sessionAge = (now.getTime() - session.lastActivityAt.getTime()) / (1000 * 60);
            if (sessionAge > session.ttl) {
                expiredSessions.push(sessionId);
            }
        }
        expiredSessions.forEach(sessionId => {
            this.sessions.delete(sessionId);
            logger_1.default.info(`Sesión expirada eliminada: ${sessionId}`);
        });
        if (expiredSessions.length > 0) {
            logger_1.default.info(`Limpieza completada: ${expiredSessions.length} sesiones eliminadas`);
        }
    }
    getOrCreateSession(from) {
        let session = this.sessions.get(from);
        if (!session) {
            session = {
                id: from,
                state: states_1.FSMState.START,
                data: {},
                createdAt: new Date(),
                lastActivityAt: new Date(),
                ttl: 30 // 30 minutos
            };
            this.sessions.set(from, session);
            logger_1.default.info(`Nueva sesión creada: ${from}`);
        }
        else {
            session.lastActivityAt = new Date();
        }
        return session;
    }
    handleGlobalCommands(text, session) {
        const msg = text.trim().toLowerCase();
        // Comandos globales que SIEMPRE resetean a START
        if (['menu', 'inicio', 'volver', 'start'].includes(msg)) {
            session.state = states_1.FSMState.START;
            session.data = {};
            logger_1.default.info(`Sesión ${session.id} reseteada a START por comando global: ${msg}`);
            return [states_1.STATE_TEXTS[states_1.FSMState.START]];
        }
        // Comando humano (no resetea, solo deriva)
        if (msg === 'humano') {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a humano`);
            return [states_1.STATE_TEXTS[states_1.FSMState.HUMANO]];
        }
        return null;
    }
    async processMessage(from, text) {
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
        logger_1.default.info(`Transición de estado: ${session.id} -> ${session.state}`);
        return { session, replies: result };
    }
    async processState(session, text) {
        switch (session.state) {
            case states_1.FSMState.START:
                return await this.handleStart(session, text);
            case states_1.FSMState.WAIT_CUIT:
                return await this.handleWaitCuit(session, text);
            case states_1.FSMState.CLIENTE_MENU:
                return await this.handleClienteMenu(session, text);
            case states_1.FSMState.CLIENTE_ARCA:
                return this.handleClienteArca(session, text);
            case states_1.FSMState.CLIENTE_FACTURA:
                return this.handleClienteFactura(session, text);
            case states_1.FSMState.CLIENTE_VENTAS:
                return this.handleClienteVentas(session, text);
            case states_1.FSMState.CLIENTE_REUNION:
                return this.handleClienteReunion(session, text);
            case states_1.FSMState.CLIENTE_IVAN:
                return this.handleClienteIvan(session, text);
            case states_1.FSMState.NO_CLIENTE_NAME:
                return this.handleNoClienteName(session, text);
            case states_1.FSMState.NO_CLIENTE_EMAIL:
                return this.handleNoClienteEmail(session, text);
            case states_1.FSMState.NO_CLIENTE_INTEREST:
                return await this.handleNoClienteInterest(session, text);
            case states_1.FSMState.HUMANO:
                return [states_1.STATE_TEXTS[states_1.FSMState.HUMANO]];
            default:
                session.state = states_1.FSMState.START;
                return [states_1.STATE_TEXTS[states_1.FSMState.START]];
        }
    }
    async handleStart(session, text) {
        const lowerText = text.toLowerCase().trim();
        // Manejar saludos
        if (['hola', 'holi', 'holis', 'buenos días', 'buenas tardes', 'buenas noches', 'saludos'].includes(lowerText)) {
            return [states_1.STATE_TEXTS[states_1.FSMState.START]];
        }
        // Opción 1: Soy cliente
        if (lowerText === '1' || lowerText.includes('soy cliente') || lowerText.includes('cliente')) {
            return ["Perfecto! Para continuar, necesito tu CUIT (solo números)."];
        }
        // Opción 2: Quiero ser cliente / Consultar servicios
        if (lowerText === '2' || lowerText.includes('quiero ser cliente') || lowerText.includes('consultar servicios') || lowerText.includes('quiero info')) {
            session.state = states_1.FSMState.NO_CLIENTE_NAME;
            return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_NAME]];
        }
        // Asumir que es un CUIT (si ya eligió ser cliente)
        if ((0, cuit_1.validarCUIT)(text)) {
            // Verificar si el CUIT existe en la base de datos
            try {
                logger_1.default.info(`Verificando CUIT: ${text}`);
                const isClient = await (0, clientsRepo_1.existsByCuit)(text);
                logger_1.default.info(`Resultado verificación CUIT ${text}: ${isClient}`);
                if (isClient) {
                    session.data.cuit = text;
                    session.state = states_1.FSMState.CLIENTE_MENU;
                    return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU]];
                }
                else {
                    session.state = states_1.FSMState.NO_CLIENTE_NAME;
                    return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
                }
            }
            catch (error) {
                logger_1.default.error('Error verificando cliente:', error);
                session.state = states_1.FSMState.NO_CLIENTE_NAME;
                return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
            }
        }
        else {
            session.state = states_1.FSMState.WAIT_CUIT;
            return [states_1.STATE_TEXTS[states_1.FSMState.WAIT_CUIT]];
        }
    }
    async handleWaitCuit(session, text) {
        if ((0, cuit_1.validarCUIT)(text)) {
            // Verificar si el CUIT existe en la base de datos
            try {
                logger_1.default.info(`Verificando CUIT (WaitCuit): ${text}`);
                const isClient = await (0, clientsRepo_1.existsByCuit)(text);
                logger_1.default.info(`Resultado verificación CUIT (WaitCuit) ${text}: ${isClient}`);
                if (isClient) {
                    session.data.cuit = text;
                    session.state = states_1.FSMState.CLIENTE_MENU;
                    return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU]];
                }
                else {
                    session.state = states_1.FSMState.NO_CLIENTE_NAME;
                    return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
                }
            }
            catch (error) {
                logger_1.default.error('Error verificando cliente:', error);
                session.state = states_1.FSMState.NO_CLIENTE_NAME;
                return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
            }
        }
        else {
            return [states_1.STATE_TEXTS[states_1.FSMState.WAIT_CUIT]];
        }
    }
    async handleClienteMenu(session, text) {
        const raw = text.trim().toLowerCase();
        // Opción 1: Consultar ARCA e Ingresos Brutos
        if (raw === '1' || raw.includes('arca') || raw.includes('ingresos brutos') || raw.includes('estado')) {
            session.state = states_1.FSMState.CLIENTE_ARCA;
            return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_ARCA]];
        }
        // Opción 2: Solicitar factura electrónica
        if (raw === '2' || raw.includes('factura') || raw.includes('facturación')) {
            session.state = states_1.FSMState.CLIENTE_FACTURA;
            return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_FACTURA]];
        }
        // Opción 3: Enviar ventas del mes
        if (raw === '3' || raw.includes('ventas') || raw.includes('venta') || raw.includes('planilla')) {
            session.state = states_1.FSMState.CLIENTE_VENTAS;
            return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_VENTAS]];
        }
        // Opción 4: Agendar reunión
        if (raw === '4' || raw.includes('reunión') || raw.includes('agendar') || raw.includes('cita')) {
            session.state = states_1.FSMState.CLIENTE_REUNION;
            return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_REUNION]];
        }
        // Opción 5: Hablar con Iván
        if (raw === '5' || raw.includes('iván') || raw.includes('ivan') || raw.includes('hablar') || raw.includes('consulta')) {
            session.state = states_1.FSMState.CLIENTE_IVAN;
            return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_IVAN]];
        }
        // Si no coincide con ninguna opción, mostrar el menú nuevamente
        return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU]];
    }
    handleNoClienteName(session, text) {
        session.data.name = text;
        session.state = states_1.FSMState.NO_CLIENTE_EMAIL;
        return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_EMAIL]];
    }
    handleNoClienteEmail(session, text) {
        // Validación básica de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text)) {
            return ['Por favor, ingresá un email válido.'];
        }
        session.data.email = text;
        session.state = states_1.FSMState.NO_CLIENTE_INTEREST;
        return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_INTEREST]];
    }
    async handleNoClienteInterest(session, text) {
        const validInterests = ['alta cliente', 'honorarios', 'turno_consulta', 'otras_consultas'];
        const lowerText = text.toLowerCase().trim();
        if (!validInterests.includes(lowerText)) {
            return ['Por favor, elegí una de las opciones: alta cliente / honorarios / turno_consulta / otras_consultas'];
        }
        session.data.interest = lowerText;
        // Si es "otras_consultas", usar IA
        if (lowerText === 'otras_consultas') {
            try {
                const aiContext = {
                    role: 'no_cliente',
                    interest: 'otras_consultas',
                    lastUserText: text
                };
                const aiResponse = await (0, ai_1.aiReply)(aiContext);
                return [aiResponse + " ¿Querés que te derive con el equipo?"];
            }
            catch (error) {
                logger_1.default.error('Error en IA para no-cliente:', error);
                session.state = states_1.FSMState.HUMANO;
                return [states_1.STATE_TEXTS[states_1.FSMState.HUMANO]];
            }
        }
        // Para otros intereses, mantener flujo actual
        session.state = states_1.FSMState.HUMANO;
        // TODO: Guardar lead en leadsRepo
        logger_1.default.info(`Lead completado: ${JSON.stringify(session.data)}`);
        return [states_1.STATE_TEXTS[states_1.FSMState.HUMANO]];
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
    // Handlers para los nuevos estados de cliente
    handleClienteArca(session, text) {
        const raw = text.trim().toLowerCase();
        if (raw === '1' || raw.includes('gracias') || raw.includes('consulta') || raw.includes('app')) {
            return ["¡Perfecto! 🎉 Cualquier duda que tengas, no dudes en consultarnos."];
        }
        if (raw === '2' || raw.includes('persona') || raw.includes('asesor') || raw.includes('ayuda')) {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Belén Maidana (1131134588)`);
            return ["Te derivamos con Belén Maidana (1131134588) para que te asista personalmente. ¡Gracias!"];
        }
        return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_ARCA]];
    }
    handleClienteFactura(session, text) {
        // Si el usuario envía información de factura, derivar a Belén
        session.state = states_1.FSMState.HUMANO;
        logger_1.default.info(`Sesión ${session.id} derivada a Belén Maidana (1131134588) para factura`);
        return ["Recibimos tu solicitud de factura. Te derivamos con Belén Maidana (1131134588) para procesarla. ¡Gracias!"];
    }
    handleClienteVentas(session, text) {
        const raw = text.trim().toLowerCase();
        if (raw === 'planilla' || raw.includes('planilla')) {
            return ["📋 Te envío la planilla. Podés completarla en tu celu o imprimirla y completarla a mano, siguiendo estas instrucciones:\n\n☑️ Ingresá la fecha de cada operación (día y mes).\n☑️ Colocá el monto exacto de la venta en pesos.\n☑️ Cliente: escribí el CUIT o DNI. Si no lo tenés, poné Consumidor Final.\n☑️ Detalle: agregá una breve descripción (ejemplo: 'servicio de pintura', 'venta de velas').\n☑️ El campo % sobre el total se calcula solo, no lo modifiques.\n☑️ Revisá que el Monto total a facturar arriba coincida con lo que recibiste en tus cuentas bancarias.\n☑️ Una vez completada, podés enviarnos la planilla directamente por WhatsApp con el botón que figura en ella o adjuntándola acá con una foto."];
        }
        // Si envía archivo o información de ventas, derivar a Belén
        session.state = states_1.FSMState.HUMANO;
        logger_1.default.info(`Sesión ${session.id} derivada a Belén Maidana (1131134588) para ventas`);
        return ["Recibimos tu información de ventas. Te derivamos con Belén Maidana (1131134588) para procesarla. ¡Gracias!"];
    }
    handleClienteReunion(session, text) {
        // Siempre mostrar el mensaje de reunión
        return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_REUNION]];
    }
    handleClienteIvan(session, text) {
        // Siempre derivar a Iván (sin número por ahora)
        session.state = states_1.FSMState.HUMANO;
        logger_1.default.info(`Sesión ${session.id} derivada a Iván`);
        return ["Te derivamos con Iván. Te contactará a la brevedad. ¡Gracias!"];
    }
}
exports.FSMSessionManager = FSMSessionManager;
//# sourceMappingURL=engine.js.map