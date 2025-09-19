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
const ai_1 = require("../services/ai");
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
                return this.handleStart(session, text);
            case states_1.FSMState.WAIT_CUIT:
                return this.handleWaitCuit(session, text);
            case states_1.FSMState.CLIENTE_MENU:
                return await this.handleClienteMenu(session, text);
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
    handleStart(session, text) {
        const lowerText = text.toLowerCase().trim();
        if (lowerText === 'quiero info') {
            session.state = states_1.FSMState.NO_CLIENTE_NAME;
            return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_NAME]];
        }
        // Asumir que es un CUIT
        if ((0, cuit_1.validarCUIT)(text)) {
            session.data.cuit = text;
            session.state = states_1.FSMState.CLIENTE_MENU;
            return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU]];
        }
        else {
            session.state = states_1.FSMState.WAIT_CUIT;
            return [states_1.STATE_TEXTS[states_1.FSMState.WAIT_CUIT]];
        }
    }
    handleWaitCuit(session, text) {
        if ((0, cuit_1.validarCUIT)(text)) {
            session.data.cuit = text;
            session.state = states_1.FSMState.CLIENTE_MENU;
            return [states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU]];
        }
        else {
            return [states_1.STATE_TEXTS[states_1.FSMState.WAIT_CUIT]];
        }
    }
    async handleClienteMenu(session, text) {
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
                const clientsRepo = new (await Promise.resolve().then(() => __importStar(require('../services/clientsRepo')))).ClientsRepository('./data/base_noclientes.xlsx');
                const monto = await clientsRepo.getSaldo(cuit) ?? 0;
                const montoFormateado = this.formatARS(monto);
                return [`Tu saldo al día es ARS ${montoFormateado}. Si ves algo raro, decime y te derivamos con el equipo.`];
            }
            catch (error) {
                logger_1.default.error('Error obteniendo saldo:', error);
                return ['Error obteniendo tu saldo. Te derivamos con el equipo.'];
            }
        }
        if (isComp) {
            const cuit = session.data.cuit;
            if (!cuit) {
                return ['No tengo tu CUIT registrado. Volvé al inicio.'];
            }
            try {
                const clientsRepo = new (await Promise.resolve().then(() => __importStar(require('../services/clientsRepo')))).ClientsRepository('./data/base_noclientes.xlsx');
                const items = await clientsRepo.getUltimosComprobantes(cuit);
                if (items.length === 0) {
                    return ['Por ahora no encuentro comprobantes recientes. ¿Querés que te los envíe por mail o te derivamos con el equipo?'];
                }
                const lista = items.slice(0, 3).map(item => `• ${item}`).join('\n');
                return [`Últimos comprobantes:\n${lista}\n¿Querés que te los reenviemos por mail?`];
            }
            catch (error) {
                logger_1.default.error('Error obteniendo comprobantes:', error);
                return ['Error obteniendo tus comprobantes. Te derivamos con el equipo.'];
            }
        }
        if (isHum) {
            session.state = states_1.FSMState.HUMANO;
            return ['Listo, te derivamos con el equipo. ¡Gracias! 🙌'];
        }
        if (isInicio) {
            session.state = states_1.FSMState.START;
            session.data = {};
            return [states_1.STATE_TEXTS[states_1.FSMState.START]];
        }
        // Si no coincide con ninguna opción, re-mostrar menú
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
}
exports.FSMSessionManager = FSMSessionManager;
//# sourceMappingURL=engine.js.map