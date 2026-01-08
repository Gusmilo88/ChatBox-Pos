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
const express_1 = require("express");
const zod_1 = require("zod");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("../services/auth");
const session_1 = require("../middleware/session");
const security_1 = require("../middleware/security");
const logger_1 = __importDefault(require("../libs/logger"));
const router = (0, express_1.Router)();
// Rate limiting para login
const loginRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 intentos por IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger_1.default.warn('login_rate_limit_exceeded', {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(429).json({ error: 'Demasiados intentos de login. Intenta nuevamente en 15 minutos.' });
    }
});
// Esquemas de validación
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Email inválido'),
    password: zod_1.z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});
// POST /auth/login - Iniciar sesión
router.post('/login', loginRateLimit, (0, security_1.validateInput)(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;
        // TEMPORAL: Login hardcodeado para testing
        if (email === 'admin@test.com' && password === 'password123') {
            const user = {
                adminId: 'temp-admin-id',
                email: 'admin@test.com',
                role: 'owner'
            };
            // Crear token de sesión
            const sessionToken = (0, auth_1.createSessionToken)(user);
            // Establecer cookie
            res.setHeader('Set-Cookie', (0, session_1.createSessionCookie)(sessionToken));
            logger_1.default.info('login_success', {
                adminId: user.adminId,
                email: user.email,
                role: user.role,
                ip: req.ip
            });
            res.json({
                ok: true,
                user: {
                    email: user.email,
                    role: user.role
                }
            });
            return;
        }
        // Autenticar usuario (Firebase - deshabilitado temporalmente)
        // const user = await login(email, password)
        logger_1.default.warn('login_failed_invalid_credentials', {
            email: req.body.email,
            ip: req.ip
        });
        res.status(401).json({ error: 'Credenciales inválidas' });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.warn('login_failed', {
            email: req.body.email,
            ip: req.ip,
            error: msg
        });
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// POST /auth/logout - Cerrar sesión
router.post('/logout', session_1.requireSession, async (req, res) => {
    try {
        logger_1.default.info('user_logged_out', {
            adminId: req.user.adminId,
            email: req.user.email,
            ip: req.ip
        });
        // Limpiar cookie
        res.setHeader('Set-Cookie', (0, session_1.clearSessionCookie)());
        res.json({ ok: true });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('logout_failed', { error: msg });
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// GET /auth/me - Obtener información del usuario actual
router.get('/me', session_1.requireSession, async (req, res) => {
    try {
        res.json({
            email: req.user.email,
            role: req.user.role
        });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_getting_user_info', { error: msg });
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
// GET /auth/operators - Listar operadores disponibles (solo para owners)
router.get('/operators', session_1.requireSession, async (req, res) => {
    try {
        // Solo owners pueden ver la lista de operadores
        if (req.user?.role !== 'owner') {
            return res.status(403).json({ error: 'No autorizado' });
        }
        const { collections } = await Promise.resolve().then(() => __importStar(require('../firebase')));
        const operatorsSnapshot = await collections.admins()
            .where('role', '==', 'operador')
            .where('isActive', '==', true)
            .get();
        const operators = operatorsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email,
                name: data.name || data.email.split('@')[0],
                role: data.role
            };
        });
        res.json({ operators });
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_listing_operators', { error: msg });
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});
exports.default = router;
