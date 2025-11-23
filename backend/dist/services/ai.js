"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiReply = aiReply;
const openai_1 = __importDefault(require("openai"));
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../libs/logger"));
const truncate_1 = require("../utils/truncate");
// Cliente OpenAI
const client = new openai_1.default({
    apiKey: env_1.default.openaiApiKey
});
async function aiReply(ctx) {
    // Si no hay API key → fallback corto
    if (!env_1.default.openaiApiKey) {
        logger_1.default.info('IA fallback: No API key available', {
            role: ctx.role,
            hasKey: false
        });
        if (ctx.role === 'no_cliente') {
            return "Contame brevemente qué necesitás y te derivo con el equipo. También puedo tomarte tus datos para coordinar.";
        }
        else {
            return "Para temas de cuenta, saldo o comprobantes te derivo con el equipo. ¿Querés que te contacten?";
        }
    }
    try {
        // Construir system prompt
        const systemPrompt = `Sos un asistente de un estudio contable. Escribí en español rioplatense usando 'vos'. Sé claro y breve (máx. 4 líneas).
No inventes datos de clientes, saldos ni comprobantes. Para temas contables específicos, recomendá hablar con Iván del estudio.
Si el usuario no es cliente, orientá a captar datos y proponer contacto.
Nunca prometas acciones automáticas externas; ofrecé derivar al equipo.`;
        // Prefix dinámico según role
        let contextPrefix = '';
        if (ctx.role === 'cliente') {
            contextPrefix = 'El usuario es cliente autenticado (CUIT presente).';
        }
        else {
            contextPrefix = `El usuario no es cliente (lead). Su interés es: ${ctx.interest || 'no especificado'}.`;
        }
        // Construir mensajes
        const messages = [
            {
                role: 'system',
                content: `${systemPrompt}\n\n${contextPrefix}`
            }
        ];
        // Agregar historial si existe (máximo 3 mensajes recientes)
        if (ctx.history && ctx.history.length > 0) {
            const recentHistory = ctx.history.slice(-3);
            for (const msg of recentHistory) {
                messages.push({
                    role: msg.from === 'user' ? 'user' : 'assistant',
                    content: msg.text
                });
            }
        }
        // Agregar último mensaje del usuario
        if (ctx.lastUserText) {
            messages.push({
                role: 'user',
                content: ctx.lastUserText
            });
        }
        // Log de la llamada a IA
        logger_1.default.info('Llamada a IA', {
            role: ctx.role,
            interest: ctx.interest,
            hasKey: !!env_1.default.openaiApiKey,
            tokensMax: env_1.default.aiMaxTokens
        });
        // Llamar a OpenAI
        const completion = await client.chat.completions.create({
            model: env_1.default.openaiModel,
            messages,
            max_tokens: env_1.default.aiMaxTokens,
            temperature: env_1.default.aiTemperature
        });
        const response = completion.choices[0]?.message?.content || '';
        // Truncar respuesta a 600 caracteres máximo
        const truncatedResponse = (0, truncate_1.truncateText)(response, 600);
        logger_1.default.info('Respuesta de IA generada', {
            originalLength: response.length,
            truncatedLength: truncatedResponse.length
        });
        return truncatedResponse;
    }
    catch (error) {
        logger_1.default.error('Error en llamada a IA:', error);
        // Fallback en caso de error
        if (ctx.role === 'no_cliente') {
            return "Contame brevemente qué necesitás y te derivo con el equipo. También puedo tomarte tus datos para coordinar.";
        }
        else {
            return "Para temas de cuenta, saldo o comprobantes te derivo con el equipo. ¿Querés que te contacten?";
        }
    }
}
