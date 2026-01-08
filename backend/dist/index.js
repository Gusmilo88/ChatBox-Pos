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
require("./config/env");
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const logger_1 = __importDefault(require("./libs/logger"));
const security_1 = require("./middleware/security");
const session_1 = require("./middleware/session");
const health_1 = __importDefault(require("./routes/health"));
const simulate_1 = __importDefault(require("./routes/simulate"));
const whatsapp_1 = __importDefault(require("./routes/whatsapp"));
const conversations_1 = __importDefault(require("./routes/conversations"));
const auth_1 = __importDefault(require("./routes/auth"));
const webhook_1 = __importDefault(require("./routes/webhook"));
const aiStats_1 = __importDefault(require("./routes/aiStats"));
const stats_1 = __importDefault(require("./routes/stats"));
const autoReplies_1 = __importDefault(require("./routes/autoReplies"));
const simulator_1 = __importDefault(require("./routes/simulator"));
const app = (0, express_1.default)();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 4000);
app.use((0, security_1.secureHeaders)());
app.use((0, security_1.buildCors)());
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '200kb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '200kb' }));
app.use((0, security_1.globalRateLimit)());
// Rutas públicas
app.use('/health', health_1.default);
app.use('/api/health', health_1.default);
// Autenticación (pública)
app.use('/auth', auth_1.default);
// Simulación (pública, para testing)
app.use('/api/simulate', simulate_1.default);
app.use('/api/simulator', simulator_1.default);
// Meta WhatsApp: webhook (raw body)
app.use('/api/webhook/whatsapp', express_1.default.raw({ type: 'application/json' }), webhook_1.default);
// Rutas protegidas por sesión
app.use('/api/conversations', session_1.requireSession, conversations_1.default);
app.use('/api/whatsapp', session_1.requireSession, whatsapp_1.default);
app.use('/api/ai', aiStats_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/auto-replies', session_1.requireSession, autoReplies_1.default);
// 404 catch-all (SIN '*')
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// Error handler
app.use((err, req, res, _next) => {
    const msg = err?.message ?? String(err);
    logger_1.default?.error?.('Unhandled error', { message: msg, stack: err?.stack });
    res.status(500).json({ error: 'internal_error' });
});
app.listen(PORT, async () => {
    logger_1.default?.info?.(`Server listening on http://localhost:${PORT}`);
    logger_1.default?.info?.('Meta WhatsApp webhook mounted at /api/webhook/whatsapp');
    // Iniciar outbox worker automáticamente
    if (process.env.START_OUTBOX_WORKER !== 'false') {
        try {
            const { OutboxWorker } = await Promise.resolve().then(() => __importStar(require('./worker/outbox')));
            const { config } = await Promise.resolve().then(() => __importStar(require('./config/env')));
            const worker = new OutboxWorker();
            setInterval(async () => {
                try {
                    await worker.runBatchOnce();
                }
                catch (error) {
                    logger_1.default?.error?.('Outbox worker error', { error: error?.message });
                }
            }, config.outboxPollIntervalMs);
            logger_1.default?.info?.('Outbox worker iniciado automáticamente', {
                pollInterval: config.outboxPollIntervalMs,
                driver: config.whatsappDriver
            });
        }
        catch (error) {
            logger_1.default?.warn?.('No se pudo iniciar outbox worker automáticamente', {
                error: error?.message
            });
        }
    }
});
