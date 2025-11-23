"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCors = buildCors;
exports.secureHeaders = secureHeaders;
exports.globalRateLimit = globalRateLimit;
exports.messageRateLimit = messageRateLimit;
exports.requireAuth = requireAuth;
exports.requireApiKey = requireApiKey;
exports.requireRole = requireRole;
exports.validateInput = validateInput;
exports.validateQuery = validateQuery;
exports.auditLog = auditLog;
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const logger_1 = __importDefault(require("../libs/logger"));
const firebase_1 = require("../firebase");
const env_1 = require("../config/env");
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const DASHBOARD_API_KEY = process.env.DASHBOARD_API_KEY || '';
// CORS estricto
function buildCors() {
    const allowedOrigins = [env_1.config.corsOrigin, env_1.config.dashboardOrigin]
        .filter(Boolean)
        .map(s => s.trim());
    return (0, cors_1.default)({
        origin: (origin, callback) => {
            // Permitir requests sin origin (mobile apps, Postman, etc.)
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            logger_1.default.warn('cors_blocked', { origin, allowedOrigins });
            return callback(new Error('Origin not allowed by CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
    });
}
// Helmet con configuración completa
function secureHeaders() {
    return (0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"]
            }
        },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        hsts: {
            maxAge: 15552000, // 6 meses
            includeSubDomains: true,
            preload: true
        },
        noSniff: true,
        xssFilter: true
    });
}
// Rate limiting global
function globalRateLimit() {
    const windowMs = Number(process.env.RATE_WINDOW_MS || 60000); // 1 minuto
    const max = Number(process.env.RATE_MAX || 60); // 60 requests por minuto
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        // Usar keyGenerator por defecto que maneja IPv6 correctamente
        handler: (req, res) => {
            logger_1.default.warn('rate_limit_exceeded', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path
            });
            res.status(429).json({ error: 'Too many requests' });
        }
    });
}
// Rate limiting específico para mensajes
function messageRateLimit() {
    return (0, express_rate_limit_1.default)({
        windowMs: 60000, // 1 minuto
        max: 10, // 10 mensajes por minuto por IP
        standardHeaders: true,
        legacyHeaders: false,
        // Usar keyGenerator por defecto que maneja IPv6 correctamente
        handler: (req, res) => {
            logger_1.default.warn('message_rate_limit_exceeded', {
                ip: req.ip,
                phone: req.body?.phone || req.params?.id
            });
            res.status(429).json({ error: 'Too many messages' });
        }
    });
}
// Middleware de autenticación JWT
function requireAuth() {
    return async (req, res, next) => {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Token de acceso requerido' });
            }
            const token = authHeader.substring(7);
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            // Verificar que el usuario aún existe
            const adminDoc = await firebase_1.collections.admins().doc(decoded.userId).get();
            if (!adminDoc.exists) {
                return res.status(401).json({ error: 'Usuario no encontrado' });
            }
            const adminData = adminDoc.data();
            req.user = {
                adminId: adminDoc.id,
                email: adminData?.email ?? 'unknown@local',
                role: adminData?.role ?? 'operador'
            };
            next();
        }
        catch (error) {
            const msg = (error instanceof Error) ? error.message : String(error);
            logger_1.default.error('auth_middleware_failed', { error: msg });
            return res.status(401).json({ error: 'Token inválido' });
        }
    };
}
// Middleware para API Key adicional
function requireApiKey() {
    return (req, res, next) => {
        if (!DASHBOARD_API_KEY) {
            return next(); // Si no hay API key configurada, permitir
        }
        const apiKey = req.header('x-api-key');
        if (!apiKey || apiKey !== DASHBOARD_API_KEY) {
            logger_1.default.warn('invalid_api_key', {
                ip: req.ip,
                path: req.path,
                providedKey: apiKey ? '***' + apiKey.slice(-4) : 'none'
            });
            return res.status(401).json({ error: 'API key inválida' });
        }
        next();
    };
}
// Middleware para roles
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        if (!roles.includes(req.user.role)) {
            logger_1.default.warn('insufficient_role', {
                userId: req.user.adminId,
                userRole: req.user.role,
                requiredRoles: roles
            });
            return res.status(403).json({ error: 'Permisos insuficientes' });
        }
        next();
    };
}
// Middleware de validación de entrada
function validateInput(schema) {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                logger_1.default.warn('validation_failed', {
                    path: req.path,
                    errors: result.error.errors
                });
                return res.status(400).json({
                    error: 'Datos inválidos',
                    details: result.error.errors
                });
            }
            req.body = result.data;
            next();
        }
        catch (error) {
            const msg = error?.message ?? String(error);
            logger_1.default.error('validation_middleware_error', { error: msg });
            return res.status(500).json({ error: 'Error de validación' });
        }
    };
}
// Middleware de validación de query parameters
function validateQuery(schema) {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.query);
            if (!result.success) {
                logger_1.default.warn('validation_failed', {
                    path: req.path,
                    errors: result.error.errors
                });
                return res.status(400).json({
                    error: 'Datos inválidos',
                    details: result.error.errors
                });
            }
            req.query = result.data;
            next();
        }
        catch (error) {
            const msg = error?.message ?? String(error);
            logger_1.default.error('validation_middleware_error', { error: msg });
            return res.status(500).json({ error: 'Error de validación' });
        }
    };
}
// Middleware de logging de auditoría
function auditLog(action) {
    return async (req, res, next) => {
        const originalSend = res.send;
        res.send = function (data) {
            // Log después de que se envía la respuesta
            if (req.user) {
                firebase_1.collections.audit().add({
                    action,
                    userId: req.user.adminId,
                    email: req.user.email,
                    timestamp: new Date(),
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    path: req.path,
                    method: req.method,
                    statusCode: res.statusCode
                }).catch(err => {
                    const msg = (err instanceof Error) ? err.message : String(err);
                    logger_1.default.error('audit_log_failed', { error: msg });
                });
            }
            return originalSend.call(this, data);
        };
        next();
    };
}
