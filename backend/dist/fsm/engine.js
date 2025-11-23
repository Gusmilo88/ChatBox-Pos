"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FSMSessionManager = void 0;
const states_1 = require("./states");
const cuit_1 = require("../utils/cuit");
const logger_1 = __importDefault(require("../libs/logger"));
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
        // Si está en cualquier estado de cliente y dice "hola", volver al menú del cliente si tiene CUIT
        // PERO NO si ya está en START (para evitar loops)
        const isGreeting = ['hola', 'holi', 'holis', 'buenos días', 'buenas tardes', 'buenas noches', 'saludos'].includes(msg);
        if (session.state !== states_1.FSMState.START && [states_1.FSMState.HUMANO, states_1.FSMState.CLIENTE_REUNION, states_1.FSMState.CLIENTE_ARCA, states_1.FSMState.CLIENTE_FACTURA, states_1.FSMState.CLIENTE_VENTAS, states_1.FSMState.CLIENTE_IVAN].includes(session.state) && isGreeting) {
            if (session.data.cuit) {
                session.state = states_1.FSMState.CLIENTE_MENU;
                logger_1.default.info(`Sesión ${session.id} volvió al menú del cliente desde ${session.state}`);
                return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU]];
            }
            else {
                session.state = states_1.FSMState.START;
                session.data = {};
                logger_1.default.info(`Sesión ${session.id} reseteada a START desde ${session.state}`);
                return [states_1.STATE_TEXTS[states_1.FSMState.START]];
            }
        }
        // Si está en cualquier estado y dice algo que no es comando específico, volver al inicio
        // PERO NO en estados que manejan opciones 1/2/3/4/5
        if ([states_1.FSMState.HUMANO, states_1.FSMState.CLIENTE_REUNION, states_1.FSMState.CLIENTE_ARCA, states_1.FSMState.CLIENTE_FACTURA, states_1.FSMState.CLIENTE_VENTAS, states_1.FSMState.CLIENTE_IVAN, states_1.FSMState.NO_CLIENTE_RESPONSABLE].includes(session.state)) {
            // Si es texto corto (1-2 caracteres) o no es comando específico, volver al inicio
            if (text.length <= 2 || !['1', '2', '3', '4', '5', 'menu', 'inicio', 'volver', 'start', 'humano'].includes(msg)) {
                session.state = states_1.FSMState.START;
                session.data = {};
                logger_1.default.info(`Sesión ${session.id} reseteada a START desde ${session.state} por texto: ${text}`);
                return [states_1.STATE_TEXTS[states_1.FSMState.START]];
            }
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
            case states_1.FSMState.NO_CLIENTE_ALTA:
                return this.handleNoClienteAlta(session, text);
            case states_1.FSMState.NO_CLIENTE_ALTA_REQS:
                return this.handleNoClienteAltaReqs(session, text);
            case states_1.FSMState.NO_CLIENTE_PLAN:
                return this.handleNoClientePlan(session, text);
            case states_1.FSMState.NO_CLIENTE_RESPONSABLE:
                return this.handleNoClienteResponsable(session, text);
            case states_1.FSMState.NO_CLIENTE_CONSULTA:
                return this.handleNoClienteConsulta(session, text);
            case states_1.FSMState.HUMANO:
                return [states_1.STATE_TEXTS[states_1.FSMState.HUMANO]];
            default:
                session.state = states_1.FSMState.START;
                return [states_1.STATE_TEXTS[states_1.FSMState.START]];
        }
    }
    async handleStart(session, text) {
        const lowerText = text.toLowerCase().trim();
        // Si es un CUIT válido, verificar si existe en la base de datos
        if ((0, cuit_1.validarCUIT)(text)) {
            try {
                logger_1.default.info(`Verificando CUIT: ${text}`);
                const isClient = await (0, clientsRepo_1.existsByCuit)(text);
                logger_1.default.info(`Resultado verificación CUIT ${text}: ${isClient}`);
                if (isClient) {
                    session.data.cuit = text;
                    // Obtener nombre del cliente desde la misma fuente que verifica existsByCuit
                    try {
                        const { getDb } = await Promise.resolve().then(() => __importStar(require('../firebase')));
                        const db = getDb();
                        const snapshot = await db.collection('clientes').where('cuit', '==', text).limit(1).get();
                        const nombre = snapshot.empty ? null : snapshot.docs[0].data().nombre;
                        if (!nombre) {
                            session.state = states_1.FSMState.NO_CLIENTE_NAME;
                            return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
                        }
                        session.state = states_1.FSMState.CLIENTE_MENU;
                        return [`¡Hola ${nombre}! 👋 Soy el asistente 🤖 de POS & Asociados. Elegí una opción:\n\n1. Consultar mi estado general en ARCA e Ingresos Brutos\n2. Solicitar una factura electrónica\n3. Enviar las ventas del mes\n4. Agendar una reunión\n5. Hablar con Iván por otras consultas`];
                    }
                    catch (error) {
                        logger_1.default.error('Error obteniendo nombre del cliente:', error);
                        session.state = states_1.FSMState.NO_CLIENTE_NAME;
                        return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
                    }
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
        // Opción 1: Soy cliente
        if (lowerText === '1' || lowerText.includes('soy cliente') || lowerText.includes('cliente')) {
            return ["Perfecto! Para continuar, necesito tu CUIT (solo números)."];
        }
        // Opción 2: Quiero ser cliente / Consultar servicios
        if (lowerText === '2' || lowerText.includes('quiero ser cliente') || lowerText.includes('consultar servicios') || lowerText.includes('quiero info')) {
            session.state = states_1.FSMState.NO_CLIENTE_INTEREST;
            return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_INTEREST]];
        }
        // Para CUALQUIER otro texto (hola, abc, etc.), mostrar el menú inicial
        return [states_1.STATE_TEXTS[states_1.FSMState.START]];
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
                    // Obtener nombre del cliente desde la misma fuente que verifica existsByCuit
                    try {
                        const { getDb } = await Promise.resolve().then(() => __importStar(require('../firebase')));
                        const db = getDb();
                        const snapshot = await db.collection('clientes').where('cuit', '==', text).limit(1).get();
                        const nombre = snapshot.empty ? null : snapshot.docs[0].data().nombre;
                        if (!nombre) {
                            session.state = states_1.FSMState.NO_CLIENTE_NAME;
                            return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
                        }
                        session.state = states_1.FSMState.CLIENTE_MENU;
                        return [`¡Hola ${nombre}! 👋 Soy el asistente 🤖 de POS & Asociados. Elegí una opción:\n\n1. Consultar mi estado general en ARCA e Ingresos Brutos\n2. Solicitar una factura electrónica\n3. Enviar las ventas del mes\n4. Agendar una reunión\n5. Hablar con Iván por otras consultas`];
                    }
                    catch (error) {
                        logger_1.default.error('Error obteniendo nombre del cliente:', error);
                        session.state = states_1.FSMState.NO_CLIENTE_NAME;
                        return ['No te encuentro en nuestra base de clientes. Decime tu nombre y empresa.'];
                    }
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
        const lowerText = text.toLowerCase().trim();
        // Opción 1: Alta en Monotributo / Ingresos Brutos
        if (lowerText === '1' || lowerText.includes('alta') || lowerText.includes('monotributo')) {
            session.state = states_1.FSMState.NO_CLIENTE_ALTA;
            session.data.interest = 'alta_monotributo';
            return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_ALTA]];
        }
        // Opción 2: Ya soy monotributista, quiero conocer sobre el Plan Mensual
        if (lowerText === '2' || lowerText.includes('plan mensual') || lowerText.includes('monotributista')) {
            session.state = states_1.FSMState.NO_CLIENTE_PLAN;
            session.data.interest = 'plan_mensual';
            return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_PLAN]];
        }
        // Opción 3: Soy Responsable Inscripto, quiero mas info sobre los servicios
        if (lowerText === '3' || lowerText.includes('responsable inscripto') || lowerText.includes('responsable')) {
            session.state = states_1.FSMState.NO_CLIENTE_RESPONSABLE;
            session.data.interest = 'responsable_inscripto';
            return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_RESPONSABLE]];
        }
        // Opción 4: Estado de mi Consulta
        if (lowerText === '4' || lowerText.includes('estado') || lowerText.includes('consulta')) {
            session.state = states_1.FSMState.NO_CLIENTE_CONSULTA;
            session.data.interest = 'estado_consulta';
            return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_CONSULTA]];
        }
        // Opción 5: Hablar con un profesional, tengo otras dudas y/o consultas
        if (lowerText === '5' || lowerText.includes('profesional') || lowerText.includes('dudas') || lowerText.includes('consultas')) {
            session.state = states_1.FSMState.HUMANO;
            session.data.interest = 'otras_consultas';
            logger_1.default.info(`Lead completado: ${JSON.stringify(session.data)}`);
            return ["Perfecto, en breve te contactaré con Iván ☎."];
        }
        // Si no coincide con ninguna opción, mostrar el menú nuevamente
        return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_INTEREST]];
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
    // Handlers para los estados de no-cliente
    handleNoClienteAlta(session, text) {
        const lowerText = text.toLowerCase().trim();
        if (lowerText === '1') {
            // Cambiar a un estado intermedio para manejar la segunda respuesta
            session.state = states_1.FSMState.NO_CLIENTE_ALTA_REQS;
            return ["🤝 Perfecto 🙌\n\nLo que necesito para iniciar tu alta es:\n\n✅ Tu CUIT\n✅ Tu Clave Fiscal\n📸 Foto del DNI (frente y dorso)\n🤳 Selfie (preferentemente fondo claro, como una foto carnet)\n📝 Descripción de la tarea o actividad que vas a realizar\n⚖️ Confirmar si trabajás en relación de dependencia (en blanco) o no para aplicarte beneficios.\n🏪 Confirmar si tenés un local a la calle\n\n🔒 Si preferis hablar con alguien, respondé 1."];
        }
        // Cualquier otra cosa va a Iván
        session.state = states_1.FSMState.HUMANO;
        logger_1.default.info(`Sesión ${session.id} derivada a Iván Pos para alta`);
        return ["🧑‍🤝‍🧑 Hablar con alguien\n\nPerfecto, en breve te contactaré con Iván 📞."];
    }
    handleNoClienteAltaReqs(session, text) {
        const lowerText = text.toLowerCase().trim();
        if (lowerText === '1') {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Iván Pos para alta`);
            return ["🧑‍🤝‍🧑 Hablar con alguien\n\nPerfecto, en breve te contactaré con Iván 📞."];
        }
        // Cualquier otra cosa va a Elina
        session.state = states_1.FSMState.HUMANO;
        logger_1.default.info(`Sesión ${session.id} derivada a Elina Maidana (1124567087) para alta`);
        return ["🧑‍🤝‍🧑 Hablar con alguien\n\nTe derivamos con Elina Maidana (1124567087) para que te asista con tu alta. ¡Gracias!"];
    }
    handleNoClientePlan(session, text) {
        const lowerText = text.toLowerCase().trim();
        if (lowerText === '1' || lowerText.includes('si') || lowerText.includes('quiero') || lowerText.includes('empezar') || lowerText.includes('reporte')) {
            return ["🤝 Perfecto\n\nLo que necesito para tu reporte inicial (sin cargo) es:\n\n✅ Tu CUIT\n✅ Tu Clave Fiscal\n\n🔒 Si preferis hablar con alguien, respondé 2."];
        }
        if (lowerText === '2') {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Iván Pos para plan mensual`);
            return ["🧑‍🤝‍🧑 Hablar con alguien\n\nPerfecto, en breve te contactaré con Iván 📞."];
        }
        // Cualquier otra cosa va a Elina
        session.state = states_1.FSMState.HUMANO;
        logger_1.default.info(`Sesión ${session.id} derivada a Elina Maidana (1124567087) para plan mensual`);
        return ["🧑‍🤝‍🧑 Hablar con alguien\n\nTe derivamos con Elina Maidana (1124567087) para que te asista con tu plan mensual. ¡Gracias!"];
    }
    handleNoClienteResponsable(session, text) {
        // Siempre derivar a Iván para Responsable Inscripto
        session.state = states_1.FSMState.HUMANO;
        logger_1.default.info(`Sesión ${session.id} derivada a Iván Pos para Responsable Inscripto`);
        return ["Te derivamos con Iván Pos. Te contactará a la brevedad. ¡Gracias!"];
    }
    handleNoClienteConsulta(session, text) {
        // Si envía nombre completo, derivar a Iván
        if (text.trim().length > 5) {
            const nombre = text.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Iván Pos para consulta: ${nombre}`);
            return [`${nombre} te derivamos con Iván Pos para revisar tu consulta. Te contactará a la brevedad. ¡Gracias!`];
        }
        return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_CONSULTA]];
    }
}
exports.FSMSessionManager = FSMSessionManager;
