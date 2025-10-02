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
        if (!token) {
            logger_1.default.warn('session_missing', {
                ip: req.ip,
                path: req.path,
                userAgent: req.get('User-Agent')
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
        logger_1.default.warn('session_invalid', {
            ip: req.ip,
            path: req.path,
            error: error.message
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
    const maxAge = env_1.config.sessionTTLMinutes * 60; // convertir a segundos
    return `${env_1.config.sessionCookieName}=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`;
}
// Limpiar cookie de sesión
function clearSessionCookie() {
    return `${env_1.config.sessionCookieName}=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`;
}
//# sourceMappingURL=session.js.map