"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
// Crear directorio de logs si no existe
const logDir = path_1.default.join(process.cwd(), 'logs');
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'chatbot-backend' },
    transports: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'app.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        })
    ]
});
exports.default = logger;
//# sourceMappingURL=logger.js.map