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
exports.aiReply = aiReply;
const openai_1 = __importDefault(require("openai"));
const env_1 = __importDefault(require("../config/env"));
const logger_1 = __importDefault(require("../libs/logger"));
const truncate_1 = require("../utils/truncate");
const aiCostTracker_1 = require("./aiCostTracker");
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
    // Verificar si se puede usar IA (límite mensual)
    const canUse = await (0, aiCostTracker_1.canUseAi)();
    if (!canUse) {
        logger_1.default.warn('IA deshabilitada: límite mensual superado');
        // Fallback al bot predefinido
        if (ctx.role === 'no_cliente') {
            return "Contame brevemente qué necesitás y te derivo con el equipo. También puedo tomarte tus datos para coordinar.";
        }
        else {
            return "Para temas de cuenta, saldo o comprobantes te derivo con el equipo. ¿Querés que te contacten?";
        }
    }
    try {
        // Obtener datos del cliente desde Firebase si es cliente
        let clienteInfo = '';
        if (ctx.role === 'cliente' && ctx.cuit) {
            try {
                const { getDoc } = await Promise.resolve().then(() => __importStar(require('./clientsRepo')));
                const cliente = await getDoc(ctx.cuit);
                if (cliente) {
                    // Construir información completa del cliente desde Firebase
                    const clienteData = [];
                    clienteData.push(`Nombre: ${cliente.nombre || 'No disponible'}`);
                    clienteData.push(`CUIT: ${ctx.cuit}`);
                    // Agregar información adicional si está disponible (sin datos sensibles)
                    if (cliente.categoria_monotributo) {
                        clienteData.push(`Categoría Monotributo: ${cliente.categoria_monotributo}`);
                    }
                    if (cliente.ingresos_brutos) {
                        clienteData.push(`Ingresos Brutos: ${cliente.ingresos_brutos}`);
                    }
                    if (cliente.estado) {
                        clienteData.push(`Estado: ${cliente.estado}`);
                    }
                    clienteInfo = `\n\nINFORMACIÓN DEL CLIENTE DESDE BASE DE DATOS (NO INVENTES NADA, SOLO USA ESTO):\n${clienteData.join('\n')}\n\nIMPORTANTE: NO tienes acceso a saldos, vencimientos, ni comprobantes específicos. Si preguntan por eso, decí que deben consultar en la app (https://app.posyasociados.com/login) o hablar con Iván.`;
                }
            }
            catch (error) {
                logger_1.default.debug('Error obteniendo datos del cliente para IA', { error: error?.message });
            }
        }
        // Construir system prompt
        const systemPrompt = `Sos un asistente de un estudio contable llamado "POS & Asociados". Escribí en español rioplatense usando 'vos'. Sé claro y breve (máx. 4 líneas).

REGLAS ESTRICTAS:
- SOLO respondé preguntas relacionadas con servicios contables, impositivos, facturación, declaraciones, monotributo, ingresos brutos, ARCA, o temas del estudio.
- Si te preguntan sobre temas NO relacionados (deportes, entretenimiento, política, etc.), respondé: "Solo puedo ayudarte con temas contables e impositivos. Si tenés alguna consulta sobre nuestros servicios, te puedo ayudar. Si no, te derivo con el equipo."
- NO inventes datos de clientes, saldos, vencimientos ni comprobantes. Si es cliente y pregunta por saldos/vencimientos, decí que consulte en la app (https://app.posyasociados.com/login) o hable con Iván.
- Para temas contables específicos, recomendá hablar con Iván del estudio.
- Si el usuario no es cliente, orientá a captar datos y proponer contacto.
- Nunca prometas acciones automáticas externas; ofrecé derivar al equipo.
- Guiate por el flujo del bot predefinido: si el cliente quiere consultar ARCA, facturas, ventas, reuniones, o hablar con Iván, orientalo hacia esas opciones.`;
        // Prefix dinámico según role
        let contextPrefix = '';
        if (ctx.role === 'cliente') {
            contextPrefix = `El usuario es cliente autenticado (CUIT: ${ctx.cuit || 'no disponible'}).${clienteInfo}`;
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
        // Obtener tokens usados
        const promptTokens = completion.usage?.prompt_tokens || 0;
        const completionTokens = completion.usage?.completion_tokens || 0;
        const totalTokens = completion.usage?.total_tokens || 0;
        // Calcular costo
        const cost = (0, aiCostTracker_1.calculateCost)(env_1.default.openaiModel, promptTokens, completionTokens);
        // Registrar uso (async, no esperamos)
        (0, aiCostTracker_1.recordAiUsage)({
            timestamp: new Date(),
            tokensUsed: {
                prompt: promptTokens,
                completion: completionTokens,
                total: totalTokens
            },
            costUsd: cost,
            model: env_1.default.openaiModel,
            role: ctx.role,
            conversationId: ctx.conversationId
        }).catch(err => {
            logger_1.default.error('Error registrando uso de IA:', err);
        });
        // Truncar respuesta a 600 caracteres máximo
        const truncatedResponse = (0, truncate_1.truncateText)(response, 600);
        logger_1.default.info('Respuesta de IA generada', {
            originalLength: response.length,
            truncatedLength: truncatedResponse.length,
            tokens: totalTokens,
            cost: cost.toFixed(6)
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
