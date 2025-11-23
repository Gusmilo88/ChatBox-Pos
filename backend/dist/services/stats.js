"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversationStats = getConversationStats;
const firebase_1 = require("../firebase");
const logger_1 = __importDefault(require("../libs/logger"));
/**
 * Obtiene estadísticas generales de conversaciones
 */
async function getConversationStats() {
    try {
        const db = (0, firebase_1.getDb)();
        const now = new Date();
        // Fechas para filtros
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Domingo de esta semana
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        // Obtener todas las conversaciones
        const allSnapshot = await firebase_1.collections.conversations().get();
        let total = 0;
        let clients = 0;
        let leads = 0;
        let needsReply = 0;
        let today = 0;
        let thisWeek = 0;
        let thisMonth = 0;
        allSnapshot.forEach(doc => {
            const data = doc.data();
            total++;
            // Clientes vs Leads
            if (data.isClient === true) {
                clients++;
            }
            else {
                leads++;
            }
            // Necesitan respuesta
            if (data.needsReply === true) {
                needsReply++;
            }
            // Filtrar por fecha
            const lastMessageAt = data.lastMessageAt?.toDate?.() || data.lastMessageAt;
            if (lastMessageAt) {
                const messageDate = lastMessageAt instanceof Date ? lastMessageAt : new Date(lastMessageAt);
                if (messageDate >= startOfToday) {
                    today++;
                }
                if (messageDate >= startOfWeek) {
                    thisWeek++;
                }
                if (messageDate >= startOfMonth) {
                    thisMonth++;
                }
            }
        });
        return {
            total,
            clients,
            leads,
            needsReply,
            today,
            thisWeek,
            thisMonth
        };
    }
    catch (error) {
        const msg = error?.message ?? String(error);
        logger_1.default.error('Error getting conversation stats:', msg);
        // Devolver valores por defecto en caso de error
        return {
            total: 0,
            clients: 0,
            leads: 0,
            needsReply: 0,
            today: 0,
            thisWeek: 0,
            thisMonth: 0
        };
    }
}
