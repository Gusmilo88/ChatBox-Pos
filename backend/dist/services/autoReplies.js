"use strict";
/**
 * Sistema de respuestas automáticas por horario y palabras clave
 */
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
exports.getAutoReplyRules = getAutoReplyRules;
exports.findAutoReply = findAutoReply;
const logger_1 = __importDefault(require("../libs/logger"));
/**
 * Verifica si una regla de horario aplica en este momento
 */
function isScheduleActive(rule) {
    if (rule.type !== 'schedule' || !rule.schedule) {
        return false;
    }
    const timezone = rule.schedule.timezone || 'America/Argentina/Buenos_Aires';
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
    const currentDay = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    // Verificar si el día actual está en la lista de días
    if (!rule.schedule.days.includes(currentDay)) {
        return false;
    }
    // Verificar si la hora actual está dentro del rango
    return currentTime >= rule.schedule.startTime && currentTime <= rule.schedule.endTime;
}
/**
 * Verifica si una regla de palabras clave aplica al mensaje
 */
function matchesKeywords(rule, text) {
    if (rule.type !== 'keyword' || !rule.keywords || rule.keywords.length === 0) {
        return false;
    }
    const textLower = text.toLowerCase();
    const keywordsLower = rule.keywords.map(k => k.toLowerCase());
    if (rule.matchType === 'all') {
        // Todas las palabras deben estar presentes
        return keywordsLower.every(keyword => textLower.includes(keyword));
    }
    else {
        // Cualquier palabra debe estar presente
        return keywordsLower.some(keyword => textLower.includes(keyword));
    }
}
/**
 * Obtiene todas las reglas de respuestas automáticas desde Firebase
 */
async function getAutoReplyRules() {
    try {
        const { collections } = await Promise.resolve().then(() => __importStar(require('../firebase')));
        const rulesSnapshot = await collections.autoReplyRules()
            .where('enabled', '==', true)
            .get();
        const rules = [];
        rulesSnapshot.forEach(doc => {
            const data = doc.data();
            rules.push({
                id: doc.id,
                ...data
            });
        });
        // Ordenar por prioridad (mayor primero)
        return rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('Error obteniendo reglas de respuestas automáticas', { error: msg });
        return [];
    }
}
/**
 * Busca una respuesta automática que aplique al mensaje
 * Retorna null si no hay ninguna regla que aplique
 */
async function findAutoReply(text, isClient, currentTime) {
    try {
        const rules = await getAutoReplyRules();
        // Ordenar por prioridad (mayor primero)
        const sortedRules = rules.sort((a, b) => b.priority - a.priority);
        for (const rule of sortedRules) {
            if (!rule.enabled)
                continue;
            // Verificar filtros de cliente/lead
            if (rule.isClientOnly && !isClient)
                continue;
            if (rule.isLeadOnly && isClient)
                continue;
            // Verificar tipo de regla
            if (rule.type === 'schedule') {
                // Si está fuera de horario, retornar respuesta
                if (!isScheduleActive(rule) && rule.scheduleResponse) {
                    logger_1.default.info('Auto-reply activado por horario', {
                        ruleId: rule.id,
                        ruleName: rule.name,
                        isClient
                    });
                    return rule.scheduleResponse;
                }
            }
            else if (rule.type === 'keyword') {
                // Si coincide con las palabras clave, retornar respuesta
                if (matchesKeywords(rule, text) && rule.response) {
                    logger_1.default.info('Auto-reply activado por palabras clave', {
                        ruleId: rule.id,
                        ruleName: rule.name,
                        keywords: rule.keywords,
                        isClient
                    });
                    return rule.response;
                }
            }
        }
        return null;
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('Error buscando auto-reply', { error: msg });
        return null;
    }
}
