"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/env");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
// Si tu logger es default export:
const logger_1 = __importDefault(require("./libs/logger"));
// Si no, usá console como fallback:
// const logger = console as any;
const health_1 = __importDefault(require("./routes/health"));
const simulate_1 = __importDefault(require("./routes/simulate"));
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 3001);
const CORS_ORIGIN = process.env.CORS_ORIGIN || true;
// Middlewares globales (SIN '*')
app.use((0, cors_1.default)({ origin: CORS_ORIGIN, credentials: true }));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Rutas
app.use('/health', health_1.default); // GET /health → { ok: true }
app.use('/api', simulate_1.default); // POST /api/simulate/message
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