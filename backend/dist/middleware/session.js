"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSession = requireSession;
exports.requireRole = requireRole;
exports.createSessionCookie = createSessionCookie;
exports.clearSessionCookie = clearSessionCookie;
const env_1 = require("../config/env");
const auth_1 = require("../services/auth");
const logger_1 = __importDefault(require("../libs/logger"));
// Middleware para validar sesión desde cookie
function requireSession(req, res, next) {
    try {
        const token = req.cookies?.[env_1.config.sessionCookieName];
        logger_1.default.debug('session_check', {
            path: req.path,
            hasCookies: !!req.cookies,
            cookieName: env_1.config.sessionCookieName,
            hasToken: !!token,
            tokenLength: token?.length || 0
        });
        if (!token) {
            logger_1.default.warn('session_missing', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent'),
                cookies: Object.keys(req.cookies || {})
            });
            return res.status(401).json({ error: 'No autenticado' });
        }
        // Verificar token de sesión
        const user = (0, auth_1.verifySessionToken)(token);
        // Establecer usuario en request
        req.user = user;
        next();
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.warn('session_invalid', {
            ip: req.ip,
            path: req.path,
            error: msg
        });
        return res.status(401).json({ error: 'Sesión inválida' });
    }
}
// Middleware para roles específicos
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        if (!roles.includes(req.user.role)) {
            logger_1.default.warn('insufficient_role', {
                adminId: req.user.adminId,
                userRole: req.user.role,
                requiredRoles: roles,
                path: req.path
            });
            return res.status(403).json({ error: 'Permisos insuficientes' });
        }
        next();
    };
}
// Crear cookie de sesión
function createSessionCookie(token) {
    // Sesión persistente: sin Max-Age, la cookie expira solo cuando se cierra el navegador
    // O usar un Max-Age muy grande (10 años) para que nunca expire automáticamente
    const maxAge = 10 * 365 * 24 * 60 * 60; // 10 años en segundos (prácticamente infinito)
    // En desarrollo local, no usar Secure ni SameSite=Strict
    const isProduction = process.env.NODE_ENV === 'production';
    const secureFlag = isProduction ? 'Secure' : '';
    const sameSiteFlag = isProduction ? 'SameSite=Strict' : 'SameSite=Lax';
    return `${env_1.config.sessionCookieName}=${token}; HttpOnly; ${secureFlag}; ${sameSiteFlag}; Max-Age=${maxAge}; Path=/`;
}
// Limpiar cookie de sesión
function clearSessionCookie() {
    const isProduction = process.env.NODE_ENV === 'production';
    const secureFlag = isProduction ? 'Secure' : '';
    const sameSiteFlag = isProduction ? 'SameSite=Strict' : 'SameSite=Lax';
    return `${env_1.config.sessionCookieName}=; HttpOnly; ${secureFlag}; ${sameSiteFlag}; Max-Age=0; Path=/`;
}
