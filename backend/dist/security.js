"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCors = buildCors;
exports.secureHeaders = secureHeaders;
exports.limiter = limiter;
exports.requireApiKey = requireApiKey;
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
function buildCors() {
    const list = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    return (0, cors_1.default)({
        origin: (origin, cb) => {
            if (!origin)
                return cb(null, true); // curl / local
            if (list.length === 0 || list.includes(origin))
                return cb(null, true);
            return cb(new Error('Origin not allowed by CORS'));
        },
        credentials: true,
    });
}
function secureHeaders() {
    return (0, helmet_1.default)({
        contentSecurityPolicy: false, // SPA local
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    });
}
function limiter() {
    const windowMs = Number(process.env.RATE_WINDOW_MS || 60000);
    const max = Number(process.env.RATE_MAX || 60);
    return (0, express_rate_limit_1.default)({ windowMs, max, standardHeaders: true, legacyHeaders: false });
}
function requireApiKey() {
    const protect = process.env.PROTECT_API === '1';
    const key = process.env.API_KEY || '';
    return (req, res, next) => {
        if (!protect)
            return next();
        const k = req.header('x-api-key') || '';
        if (k && key && k === key)
            return next();
        return res.status(401).json({ error: 'unauthorized' });
    };
}
//# sourceMappingURL=security.js.map