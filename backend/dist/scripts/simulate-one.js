"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../libs/logger"));
const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const API_KEY = process.env.API_KEY || 'tu-api-key-super-secreta-123';
async function simulateMessage() {
    try {
        const phone = process.argv[2] || '+5491151093439';
        const text = process.argv[3] || 'Hola, necesito ayuda';
        logger_1.default.info('Simulating incoming message...', { phone, text });
        const response = await axios_1.default.post(`${API_BASE}/api/simulate/incoming`, {
            phone,
            text,
            via: 'manual'
        }, {
            headers: {
                'x-api-key': API_KEY,
                'Content-Type': 'application/json'
            }
        });
        logger_1.default.info('Message simulated successfully', {
            conversationId: response.data.conversationId,
            status: response.status
        });
        console.log('✅ Mensaje simulado exitosamente');
        console.log(`📱 Teléfono: ${phone}`);
        console.log(`💬 Texto: ${text}`);
        console.log(`🆔 ID Conversación: ${response.data.conversationId}`);
    }
    catch (error) {
        logger_1.default.error('Simulation failed', {
            error: error.message,
            response: error.response?.data
        });
        console.error('❌ Error al simular mensaje:');
        console.error(error.response?.data || error.message);
        process.exit(1);
    }
}
if (require.main === module) {
    simulateMessage();
}
//# sourceMappingURL=simulate-one.js.map