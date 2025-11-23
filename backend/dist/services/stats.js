"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversationStats = getConversationStats;
exports.getAdvancedAnalytics = getAdvancedAnalytics;
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
/**
 * Obtiene analytics avanzados con gráficos y métricas detalladas
 */
async function getAdvancedAnalytics() {
    try {
        const db = (0, firebase_1.getDb)();
        const now = new Date();
        // Fechas para filtros
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        // Obtener todas las conversaciones
        const allConversationsSnapshot = await firebase_1.collections.conversations().get();
        // Inicializar estructuras de datos
        const conversationsByDayMap = new Map();
        const conversationsByHourMap = new Map();
        const responseTimes = [];
        const responseTimesToday = [];
        const responseTimesThisWeek = [];
        const responseTimesThisMonth = [];
        const messageCounts = { incoming: 0, outgoing: 0 };
        const botUsageCounts = { ai: 0, fsm: 0 };
        const conversationMessageCounts = new Map();
        // Procesar cada conversación (limitar a 1000 para evitar timeout)
        const maxConversations = 1000;
        const conversationsToProcess = allConversationsSnapshot.docs.slice(0, maxConversations);
        logger_1.default.info('Processing analytics', {
            totalConversations: allConversationsSnapshot.size,
            processing: conversationsToProcess.length
        });
        for (const convDoc of conversationsToProcess) {
            const convData = convDoc.data();
            const conversationId = convDoc.id;
            // Obtener mensajes de esta conversación
            let messagesSnapshot;
            try {
                messagesSnapshot = await convDoc.ref.collection('messages')
                    .orderBy('ts', 'asc')
                    .get();
            }
            catch (error) {
                // Si falla, intentar sin ordenar
                messagesSnapshot = await convDoc.ref.collection('messages').get();
            }
            const messages = messagesSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    from: data.from || 'usuario',
                    via: data.via,
                    text: data.text || data.message || '',
                    timestamp: data.ts?.toDate?.() || data.timestamp?.toDate?.() || new Date()
                };
            }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            // Contar mensajes por conversación
            const msgCount = messages.length;
            conversationMessageCounts.set(conversationId, {
                phone: convData.phone || '',
                name: convData.name || null,
                count: msgCount,
                isClient: convData.isClient || false
            });
            // Procesar cada mensaje
            let lastIncomingMessageTime = null;
            for (const msg of messages) {
                const msgDate = msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp);
                const isIncoming = msg.from === 'usuario';
                const isOutgoing = msg.from === 'system' || msg.from === 'sistema' || msg.from === 'operador';
                // Distribución de mensajes
                if (isIncoming) {
                    messageCounts.incoming++;
                    lastIncomingMessageTime = msgDate;
                }
                else if (isOutgoing) {
                    messageCounts.outgoing++;
                    // Calcular tiempo de respuesta
                    if (lastIncomingMessageTime) {
                        const responseTime = (msgDate.getTime() - lastIncomingMessageTime.getTime()) / (1000 * 60); // en minutos
                        if (responseTime > 0 && responseTime < 10080) { // Menos de 7 días
                            responseTimes.push(responseTime);
                            if (msgDate >= startOfToday) {
                                responseTimesToday.push(responseTime);
                            }
                            if (msgDate >= startOfWeek) {
                                responseTimesThisWeek.push(responseTime);
                            }
                            if (msgDate >= startOfMonth) {
                                responseTimesThisMonth.push(responseTime);
                            }
                        }
                    }
                }
                // Uso de IA vs FSM
                if (isOutgoing && msg.via) {
                    if (msg.via === 'ai') {
                        botUsageCounts.ai++;
                    }
                    else if (msg.via === 'fsm') {
                        botUsageCounts.fsm++;
                    }
                }
                // Conversaciones por hora
                if (msgDate >= thirtyDaysAgo) {
                    const hour = msgDate.getHours();
                    conversationsByHourMap.set(hour, (conversationsByHourMap.get(hour) || 0) + 1);
                }
            }
            // Conversaciones por día (basado en lastMessageAt)
            if (convData.lastMessageAt) {
                const lastMsgDate = convData.lastMessageAt.toDate?.() || new Date(convData.lastMessageAt);
                if (lastMsgDate >= thirtyDaysAgo) {
                    const dateKey = lastMsgDate.toISOString().split('T')[0];
                    const current = conversationsByDayMap.get(dateKey) || { count: 0, clients: 0, leads: 0 };
                    current.count++;
                    if (convData.isClient) {
                        current.clients++;
                    }
                    else {
                        current.leads++;
                    }
                    conversationsByDayMap.set(dateKey, current);
                }
            }
        }
        // Construir array de conversaciones por día (últimos 30 días)
        const conversationsByDay = [];
        for (let i = 29; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            const data = conversationsByDayMap.get(dateKey) || { count: 0, clients: 0, leads: 0 };
            conversationsByDay.push({
                date: dateKey,
                ...data
            });
        }
        // Construir array de conversaciones por hora
        const conversationsByHour = [];
        for (let hour = 0; hour < 24; hour++) {
            conversationsByHour.push({
                hour,
                count: conversationsByHourMap.get(hour) || 0
            });
        }
        // Calcular tiempos promedio de respuesta
        const calculateAverage = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        // Top 10 conversaciones más activas
        const topConversations = Array.from(conversationMessageCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map(c => ({
            phone: c.phone,
            name: c.name,
            messageCount: c.count,
            isClient: c.isClient
        }));
        return {
            conversationsByDay,
            conversationsByHour,
            averageResponseTime: calculateAverage(responseTimes),
            responseTimeByPeriod: {
                today: calculateAverage(responseTimesToday),
                thisWeek: calculateAverage(responseTimesThisWeek),
                thisMonth: calculateAverage(responseTimesThisMonth)
            },
            messageDistribution: messageCounts,
            botUsage: botUsageCounts,
            topConversations
        };
    }
    catch (error) {
        const msg = error?.message ?? String(error);
        logger_1.default.error('Error getting advanced analytics:', msg);
        // Devolver valores por defecto
        return {
            conversationsByDay: [],
            conversationsByHour: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
            averageResponseTime: 0,
            responseTimeByPeriod: {
                today: 0,
                thisWeek: 0,
                thisMonth: 0
            },
            messageDistribution: { incoming: 0, outgoing: 0 },
            botUsage: { ai: 0, fsm: 0 },
            topConversations: []
        };
    }
}
