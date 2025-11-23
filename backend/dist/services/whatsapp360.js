"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.send360Text = send360Text;
exports.is360dialogConfigured = is360dialogConfigured;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
/**
 * Cliente HTTP para 360dialog API
 */
let d360Client = null;
function getD360Client() {
    if (!d360Client) {
        const apiKey = process.env.D360_API_KEY;
        const baseURL = process.env.WHATSAPP_API_URL || 'https://waba-v2.360dialog.io';
        if (!apiKey) {
            logger_1.logger.warn('whatsapp360_client_no_key', {
                baseURL,
                message: 'D360_API_KEY no configurado, usará modo mock'
            });
        }
        d360Client = axios_1.default.create({
            baseURL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'D360-API-KEY': apiKey || ''
            }
        });
        // Interceptor para logging de requests
        d360Client.interceptors.request.use((config) => {
            logger_1.logger.debug('whatsapp360_request', {
                method: config.method,
                url: config.url,
                hasApiKey: !!apiKey
            });
            return config;
        }, (error) => {
            logger_1.logger.error('whatsapp360_request_error', { error: error.message });
            return Promise.reject(error);
        });
        // Interceptor para logging de responses
        d360Client.interceptors.response.use((response) => {
            logger_1.logger.debug('whatsapp360_response', {
                status: response.status,
                url: response.config.url
            });
            return response;
        }, (error) => {
            logger_1.logger.error('whatsapp360_response_error', {
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url
            });
            return Promise.reject(error);
        });
    }
    return d360Client;
}
/**
 * Envía un mensaje de texto a través de 360dialog API
 * @param to Número de teléfono (formato internacional: +541151093439)
 * @param text Texto del mensaje a enviar
 * @returns Promise con resultado del envío
 */
async function send360Text(to, text) {
    try {
        // Validar parámetros de entrada
        if (!to || !text) {
            throw new Error('Número de teléfono y texto son requeridos');
        }
        // Validar formato del número (debe empezar con +)
        if (!to.startsWith('+')) {
            throw new Error('El número debe incluir código de país (ej: +541151093439)');
        }
        // Obtener API key
        const apiKey = process.env.D360_API_KEY;
        const baseURL = process.env.WHATSAPP_API_URL || 'https://waba-v2.360dialog.io';
        // Si no hay API key, usar modo mock
        if (!apiKey || apiKey.trim() === '') {
            logger_1.logger.warn('whatsapp360_mock_mode', {
                reason: 'D360_API_KEY no definido',
                to: to.replace(/\d(?=\d{4})/g, '*'), // Enmascarar número
                textLength: text.length
            });
            return {
                success: true,
                mock: true,
                status: 'sent',
                messageId: `mock_360_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
        }
        // Preparar payload para 360dialog API
        // Formato según documentación 360dialog v2:
        // https://docs.360dialog.com/whatsapp-api/whatsapp-api/messages
        const payload = {
            to: to,
            type: 'text',
            text: {
                body: text
            }
        };
        logger_1.logger.info('whatsapp360_sending_message', {
            to: to.replace(/\d(?=\d{4})/g, '*'), // Enmascarar número
            textLength: text.length,
            apiKeyPreview: apiKey.slice(-4), // Solo últimos 4 caracteres
            baseURL
        });
        // Realizar llamada a 360dialog API
        const client = getD360Client();
        const response = await client.post('/v1/messages', payload);
        // Verificar si la respuesta es exitosa
        if (response.status >= 200 && response.status < 300) {
            const d360Response = response.data;
            logger_1.logger.info('whatsapp360_message_sent', {
                messageId: d360Response.messages?.[0]?.id,
                to: to.replace(/\d(?=\d{4})/g, '*'),
                status: response.status,
                apiStatus: d360Response.meta?.api_status
            });
            return {
                success: true,
                messageId: d360Response.messages?.[0]?.id,
                status: 'sent'
            };
        }
        else {
            logger_1.logger.error('whatsapp360_api_error', {
                status: response.status,
                statusText: response.statusText,
                responseBody: response.data,
                to: to.replace(/\d(?=\d{4})/g, '*')
            });
            return {
                success: false,
                status: 'failed',
                error: `360dialog API Error ${response.status}: ${response.statusText}`,
                messageId: undefined
            };
        }
    }
    catch (error) {
        // Manejo de errores de axios
        if (axios_1.default.isAxiosError(error)) {
            logger_1.logger.error('whatsapp360_axios_error', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseData: error.response?.data,
                to: to.replace(/\d(?=\d{4})/g, '*'),
                textLength: text.length
            });
            return {
                success: false,
                status: 'failed',
                error: `360dialog API Error ${error.response?.status || 'network'}: ${error.message}`,
                messageId: undefined
            };
        }
        logger_1.logger.error('whatsapp360_send_error', {
            error: error instanceof Error ? error.message : 'Error desconocido',
            to: to.replace(/\d(?=\d{4})/g, '*'),
            textLength: text.length
        });
        return {
            success: false,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Error interno',
            messageId: undefined
        };
    }
}
/**
 * Valida si el servicio 360dialog está configurado correctamente
 * @returns true si está configurado, false si está en modo mock
 */
function is360dialogConfigured() {
    const apiKey = process.env.D360_API_KEY;
    const baseURL = process.env.WHATSAPP_API_URL || 'https://waba-v2.360dialog.io';
    return !!(apiKey && apiKey.trim() !== '');
}
