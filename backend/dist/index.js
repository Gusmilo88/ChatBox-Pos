"use strict";
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
const webhook360_1 = __importDefault(require("./routes/webhook360"));
const wa360_test_1 = __importDefault(require("./routes/wa360_test"));
const aiStats_1 = __importDefault(require("./routes/aiStats"));
const stats_1 = __importDefault(require("./routes/stats"));
const autoReplies_1 = __importDefault(require("./routes/autoReplies"));
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
// 360dialog: webhook (raw body)
app.use('/api/webhook/whatsapp', express_1.default.raw({ type: 'application/json' }), webhook360_1.default);
// Rutas protegidas por sesión
app.use('/api/conversations', session_1.requireSession, conversations_1.default);
app.use('/api/whatsapp', session_1.requireSession, whatsapp_1.default);
app.use('/api/ai', aiStats_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/auto-replies', session_1.requireSession, autoReplies_1.default);
// Rutas protegidas por API key
app.use('/api/wa360/test', (0, security_1.requireApiKey)(), wa360_test_1.default);
// 404 catch-all (SIN '*')
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// Error handler
app.use((err, req, res, _next) => {
    const msg = err?.message ?? String(err);
    logger_1.default?.error?.('Unhandled error', { message: msg, stack: err?.stack });
    res.status(500).json({ error: 'internal_error' });
});
app.listen(PORT, () => {
    logger_1.default?.info?.(`Server listening on http://localhost:${PORT}`);
    logger_1.default?.info?.('360dialog webhook mounted at /api/webhook/whatsapp');
    logger_1.default?.info?.('360dialog test mounted at /api/wa360/test');
});
