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
const templateReplacer_1 = require("../utils/templateReplacer");
const logger_1 = __importDefault(require("../libs/logger"));
const clientsRepo_1 = require("../services/clientsRepo");
const firebase_1 = require("../firebase");
class FSMSessionManager {
    formatARS(n) {
        return n.toLocaleString('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 2
        });
    }
    /**
     * Helper para enviar menú interactivo o fallback a texto
     */
    async sendMenuInteractiveOrText(phone, nombre, displayName) {
        const menuText = (0, templateReplacer_1.replaceNamePlaceholder)(states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU], nombre, displayName);
        // Guard: verificar que no queden placeholders
        if ((0, templateReplacer_1.hasUnreplacedPlaceholders)(menuText)) {
            logger_1.default.error('template_placeholder_remaining', {
                phone,
                originalText: states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU].substring(0, 50)
            });
            const safeText = menuText.replace(/\{\{[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim();
            return [safeText || 'Hola 👋\n¿Con qué tema te ayudamos?'];
        }
        logger_1.default.info('template_name_ok', {
            phone,
            usedName: nombre || displayName || 'none',
            hasPlaceholder: false
        });
        // UPGRADE PRO: Intentar enviar menú interactivo
        try {
            const { sendMainMenu } = await Promise.resolve().then(() => __importStar(require('../services/interactiveMenu')));
            const interactiveResult = await sendMainMenu(phone, nombre || displayName);
            if (interactiveResult.sent) {
                logger_1.default.info('interactive_menu_sent', {
                    phone,
                    hasNombre: !!(nombre || displayName)
                });
                // Si se envió interactivo, no devolver texto (ya se envió)
                return [];
            }
            else {
                // Fallback a texto
                logger_1.default.info('interactive_menu_fallback_text', {
                    phone,
                    reason: interactiveResult.error || 'not_supported'
                });
                return [interactiveResult.fallbackText || menuText];
            }
        }
        catch (error) {
            logger_1.default.warn('interactive_menu_error_fallback', {
                phone,
                error: error?.message
            });
            // Fallback a texto si falla
            return [menuText];
        }
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
        // CLIENTE_ARCA maneja sus propias opciones 1/2, así que no lo incluimos aquí
        if ([states_1.FSMState.HUMANO, states_1.FSMState.CLIENTE_REUNION, states_1.FSMState.CLIENTE_FACTURA, states_1.FSMState.CLIENTE_VENTAS, states_1.FSMState.CLIENTE_IVAN, states_1.FSMState.NO_CLIENTE_RESPONSABLE].includes(session.state)) {
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
        // GUARD: Verificar si hay handoff activo (desde Firestore)
        // Si handoffTo está activo, solo permitir comandos globales o silenciar
        try {
            const conversationDoc = await firebase_1.collections.conversations()
                .where('phone', '==', from)
                .limit(1)
                .get();
            if (!conversationDoc.empty) {
                const conversationData = conversationDoc.docs[0].data();
                const handoffTo = conversationData?.handoffTo;
                if (handoffTo) {
                    // Handoff activo: solo permitir comandos globales o mensaje único
                    const msg = text.trim().toLowerCase();
                    const isGlobalCommand = ['menu', 'inicio', 'volver', 'start', 'reset', 'fin'].includes(msg);
                    if (isGlobalCommand) {
                        // Si es "fin", cerrar handoff
                        if (msg === 'fin') {
                            await firebase_1.collections.conversations().doc(conversationDoc.docs[0].id).update({
                                handoffTo: null,
                                handoffStatus: 'IA_ACTIVE',
                                updatedAt: new Date()
                            });
                            session.state = states_1.FSMState.START;
                            session.data = {};
                            logger_1.default.info('handoff_closed_by_user', { phone: from, conversationId: conversationDoc.docs[0].id });
                            return { session, replies: [states_1.STATE_TEXTS[states_1.FSMState.START]] };
                        }
                        // Otros comandos globales: resetear y continuar
                        session.state = states_1.FSMState.START;
                        session.data = {};
                        await firebase_1.collections.conversations().doc(conversationDoc.docs[0].id).update({
                            handoffTo: null,
                            handoffStatus: 'IA_ACTIVE',
                            updatedAt: new Date()
                        });
                        logger_1.default.info('handoff_reset_by_global_command', { phone: from, command: msg });
                        return { session, replies: [states_1.STATE_TEXTS[states_1.FSMState.START]] };
                    }
                    // Si no es comando global, silenciar (no responder)
                    logger_1.default.info('handoff_active_silencing_fsm', {
                        phone: from,
                        handoffTo,
                        textPreview: text.substring(0, 50)
                    });
                    return { session, replies: [] }; // Silencio total
                }
            }
        }
        catch (error) {
            logger_1.default.debug('Error verificando handoff en FSM', { error: error?.message });
            // Continuar si falla la verificación
        }
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
                return await this.handleClienteArca(session, text);
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
            case states_1.FSMState.NO_CLIENTE_CUIT:
                return await this.handleNoClienteCuit(session, text);
            case states_1.FSMState.HUMANO:
                return [states_1.STATE_TEXTS[states_1.FSMState.HUMANO]];
            default:
                session.state = states_1.FSMState.START;
                return [states_1.STATE_TEXTS[states_1.FSMState.START]];
        }
    }
    async handleStart(session, text) {
        // ESTADO 0 - INICIO ABSOLUTO
        // Si es un CUIT válido, verificar si existe en la base de datos
        if ((0, cuit_1.validarCUIT)(text)) {
            try {
                logger_1.default.info(`Verificando CUIT: ${text}`);
                const isClient = await (0, clientsRepo_1.existsByCuit)(text);
                logger_1.default.info(`Resultado verificación CUIT ${text}: ${isClient}`);
                if (isClient) {
                    // CUIT válido y CLIENTE → pasar a MENU
                    session.data.cuit = text;
                    try {
                        const { getDb } = await Promise.resolve().then(() => __importStar(require('../firebase')));
                        const db = getDb();
                        const snapshot = await db.collection('clientes').where('cuit', '==', text).limit(1).get();
                        const nombre = snapshot.empty ? null : snapshot.docs[0].data().nombre;
                        session.data.nombre = nombre || null;
                        session.state = states_1.FSMState.CLIENTE_MENU;
                        // Obtener displayName desde conversación si no hay nombre en Firebase
                        let displayName = null;
                        try {
                            const conversationDoc = await firebase_1.collections.conversations()
                                .where('phone', '==', session.id)
                                .limit(1)
                                .get();
                            if (!conversationDoc.empty) {
                                displayName = conversationDoc.docs[0].data()?.name || null;
                            }
                        }
                        catch (error) {
                            logger_1.default.debug('Error obteniendo displayName', { error: error?.message });
                        }
                        // Reemplazar placeholder con nombre real (o sin nombre si no hay)
                        const menuText = (0, templateReplacer_1.replaceNamePlaceholder)(states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU], session.data.nombre || null, displayName);
                        // Guard: verificar que no queden placeholders
                        if ((0, templateReplacer_1.hasUnreplacedPlaceholders)(menuText)) {
                            logger_1.default.error('template_placeholder_remaining', {
                                phone: session.id,
                                originalText: states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU].substring(0, 50)
                            });
                            // Fallback seguro: eliminar placeholder
                            const safeText = menuText.replace(/\{\{[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim();
                            return [safeText || 'Hola 👋\n¿Con qué tema te ayudamos?'];
                        }
                        logger_1.default.info('template_name_ok', {
                            phone: session.id,
                            usedName: session.data.nombre || displayName || 'none',
                            hasPlaceholder: false
                        });
                        return [menuText];
                    }
                    catch (error) {
                        logger_1.default.error('Error obteniendo nombre del cliente:', error);
                        session.data.nombre = null;
                        session.state = states_1.FSMState.CLIENTE_MENU;
                        // Obtener displayName desde conversación
                        let displayName = null;
                        try {
                            const conversationDoc = await firebase_1.collections.conversations()
                                .where('phone', '==', session.id)
                                .limit(1)
                                .get();
                            if (!conversationDoc.empty) {
                                displayName = conversationDoc.docs[0].data()?.name || null;
                            }
                        }
                        catch (error) {
                            logger_1.default.debug('Error obteniendo displayName', { error: error?.message });
                        }
                        // Reemplazar placeholder (sin nombre si no hay)
                        const menuText = (0, templateReplacer_1.replaceNamePlaceholder)(states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU], null, displayName);
                        // Guard: verificar que no queden placeholders
                        if ((0, templateReplacer_1.hasUnreplacedPlaceholders)(menuText)) {
                            logger_1.default.error('template_placeholder_remaining', {
                                phone: session.id
                            });
                            const safeText = menuText.replace(/\{\{[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim();
                            return [safeText || 'Hola 👋\n¿Con qué tema te ayudamos?'];
                        }
                        return [menuText];
                    }
                }
                else {
                    // CUIT válido pero NO CLIENTE → ofrecer opciones
                    const cuitLimpio = (0, cuit_1.limpiarCuit)(text);
                    session.data.cuit = cuitLimpio;
                    session.state = states_1.FSMState.NO_CLIENTE_CUIT;
                    logger_1.default.info('cuit_valid_not_client', {
                        cuit: cuitLimpio.substring(0, 2) + '***' + cuitLimpio.substring(8),
                        phone: session.id
                    });
                    return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_CUIT]];
                }
            }
            catch (error) {
                logger_1.default.error('Error verificando cliente:', error);
                // En caso de error, pedir CUIT nuevamente
                return [states_1.STATE_TEXTS[states_1.FSMState.START]];
            }
        }
        else {
            // CUIT inválido → pedir CUIT válido
            session.state = states_1.FSMState.WAIT_CUIT;
            logger_1.default.info('cuit_invalid', {
                inputLength: text.length,
                phone: session.id
            });
            return [states_1.STATE_TEXTS[states_1.FSMState.WAIT_CUIT]];
        }
    }
    async handleWaitCuit(session, text) {
        // ESTADO 1 - VALIDACIÓN DE CUIT
        if ((0, cuit_1.validarCUIT)(text)) {
            // CUIT válido, verificar si es cliente
            try {
                logger_1.default.info(`Verificando CUIT (WaitCuit): ${text}`);
                const isClient = await (0, clientsRepo_1.existsByCuit)(text);
                logger_1.default.info(`Resultado verificación CUIT (WaitCuit) ${text}: ${isClient}`);
                if (isClient) {
                    // CUIT válido y CLIENTE → pasar a MENU
                    session.data.cuit = text;
                    try {
                        const { getDb } = await Promise.resolve().then(() => __importStar(require('../firebase')));
                        const db = getDb();
                        const snapshot = await db.collection('clientes').where('cuit', '==', text).limit(1).get();
                        const nombre = snapshot.empty ? null : snapshot.docs[0].data().nombre;
                        session.data.nombre = nombre || null;
                        session.state = states_1.FSMState.CLIENTE_MENU;
                        // Obtener displayName desde conversación si no hay nombre en Firebase
                        let displayName = null;
                        try {
                            const conversationDoc = await firebase_1.collections.conversations()
                                .where('phone', '==', session.id)
                                .limit(1)
                                .get();
                            if (!conversationDoc.empty) {
                                displayName = conversationDoc.docs[0].data()?.name || null;
                            }
                        }
                        catch (error) {
                            logger_1.default.debug('Error obteniendo displayName', { error: error?.message });
                        }
                        // Enviar menú interactivo o texto
                        return await this.sendMenuInteractiveOrText(session.id, session.data.nombre || null, displayName);
                    }
                    catch (error) {
                        logger_1.default.error('Error obteniendo nombre del cliente:', error);
                        session.data.nombre = null;
                        session.state = states_1.FSMState.CLIENTE_MENU;
                        // Obtener displayName desde conversación
                        let displayName = null;
                        try {
                            const conversationDoc = await firebase_1.collections.conversations()
                                .where('phone', '==', session.id)
                                .limit(1)
                                .get();
                            if (!conversationDoc.empty) {
                                displayName = conversationDoc.docs[0].data()?.name || null;
                            }
                        }
                        catch (error) {
                            logger_1.default.debug('Error obteniendo displayName', { error: error?.message });
                        }
                        // Reemplazar placeholder (sin nombre si no hay)
                        const menuText = (0, templateReplacer_1.replaceNamePlaceholder)(states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU], null, displayName);
                        // Guard: verificar que no queden placeholders
                        if ((0, templateReplacer_1.hasUnreplacedPlaceholders)(menuText)) {
                            logger_1.default.error('template_placeholder_remaining', {
                                phone: session.id
                            });
                            const safeText = menuText.replace(/\{\{[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim();
                            return [safeText || 'Hola 👋\n¿Con qué tema te ayudamos?'];
                        }
                        return [menuText];
                    }
                }
                else {
                    // CUIT válido pero NO CLIENTE → ofrecer opciones
                    const cuitLimpio = (0, cuit_1.limpiarCuit)(text);
                    session.data.cuit = cuitLimpio;
                    session.state = states_1.FSMState.NO_CLIENTE_CUIT;
                    logger_1.default.info('cuit_valid_not_client', {
                        cuit: cuitLimpio.substring(0, 2) + '***' + cuitLimpio.substring(8),
                        phone: session.id
                    });
                    return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_CUIT]];
                }
            }
            catch (error) {
                logger_1.default.error('Error verificando cliente:', error);
                return [states_1.STATE_TEXTS[states_1.FSMState.WAIT_CUIT]];
            }
        }
        else {
            // CUIT inválido → permanecer en WAIT_CUIT
            logger_1.default.info('cuit_invalid', {
                inputLength: text.length,
                phone: session.id
            });
            return [states_1.STATE_TEXTS[states_1.FSMState.WAIT_CUIT]];
        }
    }
    async handleClienteMenu(session, text) {
        // ESTADO 2 - MENÚ PRINCIPAL (SOLO CLIENTES)
        const raw = text.trim().toLowerCase();
        const { REPLIES } = await Promise.resolve().then(() => __importStar(require('../services/replies')));
        // OPCIÓN 1 — FACTURACIÓN / COMPROBANTES → BELÉN
        if (raw === '1' || raw.includes('facturación') || raw.includes('factura') || raw.includes('comprobantes') ||
            raw.includes('monotributo') || raw.includes('vep monotributo') || raw.includes('deuda') ||
            raw.includes('planes de pago') || raw.includes('cuotas caídas')) {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Belén (facturación/comprobantes)`);
            return [REPLIES.handoffBelen];
        }
        // OPCIÓN 2 — PAGOS / VEP / DEUDAS → ELINA
        if (raw === '2' || raw.includes('pagos') || raw.includes('vep') || raw.includes('deudas') ||
            raw.includes('vep ingresos brutos') || raw.includes('qr ingresos brutos') || raw.includes('pagos arca') ||
            raw.includes('siradig')) {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Elina (pagos/VEP/deudas)`);
            return [REPLIES.handoffElina];
        }
        // OPCIÓN 3 — PAGAR HONORARIOS (AUTOGESTIÓN, NO DERIVA)
        // Esta opción se maneja en botReply.ts con paymentHandler, pero aquí devolvemos el mensaje fijo
        if (raw === '3' || raw.includes('pagar honorarios') || raw.includes('honorarios')) {
            const nombre = session.data.nombre || 'cliente';
            session.state = states_1.FSMState.HUMANO; // Marcar como finalizado
            return [REPLIES.paymentHonorarios(nombre)];
        }
        // OPCIÓN 4 — DATOS REGISTRALES → ELINA
        if (raw === '4' || raw.includes('datos registrales') || raw.includes('domicilio') || raw.includes('datos registrales')) {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Elina (datos registrales)`);
            return [REPLIES.handoffElina];
        }
        // OPCIÓN 5 — SUELDOS / EMPLEADA DOMÉSTICA → ELINA
        if (raw === '5' || raw.includes('sueldos') || raw.includes('empleada doméstica') || raw.includes('casas particulares') ||
            raw.includes('recibo de sueldo')) {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Elina (sueldos/empleada doméstica)`);
            return [REPLIES.handoffElina];
        }
        // OPCIÓN 6 — CONSULTAS GENERALES → IVÁN
        if (raw === '6' || raw.includes('consultas generales') || raw.includes('consulta general')) {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Iván (consultas generales)`);
            return [REPLIES.handoffIvan];
        }
        // OPCIÓN 7 — HABLAR CON EL ESTUDIO → IVÁN
        if (raw === '7' || raw.includes('hablar con el estudio') || raw.includes('hablar con') || raw.includes('estudio')) {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Iván (hablar con el estudio)`);
            return [REPLIES.handoffIvan];
        }
        // Si no coincide con ninguna opción, mostrar el menú nuevamente
        // Obtener displayName desde conversación
        let displayName = null;
        try {
            const conversationDoc = await firebase_1.collections.conversations()
                .where('phone', '==', session.id)
                .limit(1)
                .get();
            if (!conversationDoc.empty) {
                displayName = conversationDoc.docs[0].data()?.name || null;
            }
        }
        catch (error) {
            logger_1.default.debug('Error obteniendo displayName', { error: error?.message });
        }
        const menuText = (0, templateReplacer_1.replaceNamePlaceholder)(states_1.STATE_TEXTS[states_1.FSMState.CLIENTE_MENU], session.data.nombre || null, displayName);
        // Guard: verificar que no queden placeholders
        if ((0, templateReplacer_1.hasUnreplacedPlaceholders)(menuText)) {
            logger_1.default.error('template_placeholder_remaining', { phone: session.id });
            const safeText = menuText.replace(/\{\{[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim();
            return [safeText || 'Hola 👋\n¿Con qué tema te ayudamos?'];
        }
        return [menuText];
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
    async handleClienteArca(session, text) {
        const raw = text.trim().toLowerCase();
        if (raw === '1' || raw.includes('gracias') || raw.includes('consulta') || raw.includes('app')) {
            // Obtener nombre del cliente para personalizar la respuesta
            let nombreCliente = 'cliente';
            if (session.data.cuit) {
                try {
                    const { getDb } = await Promise.resolve().then(() => __importStar(require('../firebase')));
                    const db = getDb();
                    const snapshot = await db.collection('clientes').where('cuit', '==', session.data.cuit).limit(1).get();
                    if (!snapshot.empty) {
                        nombreCliente = snapshot.docs[0].data().nombre || 'cliente';
                    }
                }
                catch (error) {
                    logger_1.default.error('Error obteniendo nombre del cliente en ARCA:', error);
                }
            }
            // Volver al menú del cliente después de la respuesta
            session.state = states_1.FSMState.CLIENTE_MENU;
            return [`De nada ${nombreCliente}, cualquier cosa que necesites acá estoy 🤖`];
        }
        if (raw === '2' || raw.includes('persona') || raw.includes('asesor') || raw.includes('ayuda')) {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info(`Sesión ${session.id} derivada a Belén Maidana (1131134588)`);
            return ["Perfecto, ya te derivo con Belén Maidana 🤖"];
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
    async handleNoClienteCuit(session, text) {
        // CUIT válido pero NO CLIENTE - ofrecer opciones
        const raw = text.trim().toLowerCase();
        // Opción 1: Hablar con Iván
        if (raw === '1' || raw.includes('ivan') || raw.includes('hablar')) {
            session.state = states_1.FSMState.HUMANO;
            logger_1.default.info('no_cliente_cuit_option_ivan', {
                phone: session.id,
                cuit: session.data.cuit ? session.data.cuit.substring(0, 2) + '***' : 'none'
            });
            // Guardar handoffTo en Firestore
            try {
                const conversationDoc = await firebase_1.collections.conversations()
                    .where('phone', '==', session.id)
                    .limit(1)
                    .get();
                if (!conversationDoc.empty) {
                    await firebase_1.collections.conversations().doc(conversationDoc.docs[0].id).update({
                        handoffTo: 'ivan',
                        handoffStatus: 'HANDOFF_ACTIVE',
                        updatedAt: new Date()
                    });
                }
            }
            catch (error) {
                logger_1.default.debug('Error guardando handoffTo', { error: error?.message });
            }
            const { REPLIES } = await Promise.resolve().then(() => __importStar(require('../services/replies')));
            return [REPLIES.handoffIvan];
        }
        // Opción 2: Ingresar otro CUIT
        if (raw === '2' || raw.includes('otro') || raw.includes('cuit')) {
            session.data.cuit = undefined; // Limpiar CUIT guardado
            session.state = states_1.FSMState.WAIT_CUIT;
            logger_1.default.info('no_cliente_cuit_option_retry', {
                phone: session.id
            });
            return [states_1.STATE_TEXTS[states_1.FSMState.WAIT_CUIT]];
        }
        // Si no coincide, mostrar opciones nuevamente
        return [states_1.STATE_TEXTS[states_1.FSMState.NO_CLIENTE_CUIT]];
    }
}
exports.FSMSessionManager = FSMSessionManager;
