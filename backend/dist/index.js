"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/env");
const express_1 = __importDefault(require("express"));
// Si tu logger es default export:
const logger_1 = __importDefault(require("./libs/logger"));
// Si no, usá console como fallback:
// const logger = console as any;
const security_1 = require("./security");
const health_1 = __importDefault(require("./routes/health"));
const simulate_1 = __importDefault(require("./routes/simulate"));
const whatsapp_1 = __importDefault(require("./routes/whatsapp"));
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 3001);
// Middlewares de seguridad (SOLO UNA VEZ y antes de las rutas)
app.use((0, security_1.secureHeaders)());
app.use((0, security_1.buildCors)());
app.use(express_1.default.json({ limit: '200kb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '200kb' }));
app.use((0, security_1.limiter)());
// Rutas
app.use('/health', health_1.default); // GET /health → { ok: true }
app.use('/webhook/whatsapp', express_1.default.raw({ type: 'application/json' }), whatsapp_1.default); // WhatsApp webhook (raw body)
app.use('/api', (0, security_1.requireApiKey)(), simulate_1.default); // POST /api/simulate/message (protegido)
// 404 catch-all (SIN '*')
app.use((req, res) => {
    return res.status(404).json({ error: 'Not found' });
});
// Error handler
app.use((err, req, res, _next) => {
    logger_1.default?.error?.('Unhandled error', { message: err?.message, stack: err?.stack });
    res.status(500).json({ error: 'internal_error' });
});
app.listen(PORT, () => {
    logger_1.default?.info?.(`Server listening on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map