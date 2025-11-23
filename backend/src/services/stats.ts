import { getDb, collections, Timestamp } from '../firebase';
import logger from '../libs/logger';

export interface ConversationStats {
  total: number;
  clients: number;
  leads: number; // Leads = personas que no son clientes pero mostraron interés
  needsReply: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
}

/**
 * Obtiene estadísticas generales de conversaciones
 */
export async function getConversationStats(): Promise<ConversationStats> {
  try {
    const db = getDb();
    const now = new Date();
    
    // Fechas para filtros
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Domingo de esta semana
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Obtener todas las conversaciones
    const allSnapshot = await collections.conversations().get();
    
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
      } else {
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
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('Error getting conversation stats:', msg);
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

