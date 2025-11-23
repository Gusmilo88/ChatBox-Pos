import type { 
  ConversationListResponse, 
  ConversationDetail, 
  ConversationFilters 
} from '@/types/conversations'
import { 
  getConversations as httpGetConversations, 
  getConversationDetail as httpGetConversationDetail,
  replyConversation as httpReplyConversation,
  getAiStats,
  getAiLimit,
  setAiLimit
} from './http'

// Adaptador que usa HTTP real
export const api = {
  conversations: {
    list: async (filters: ConversationFilters): Promise<ConversationListResponse> => {
      return httpGetConversations(filters)
    },
    
    get: async (id: string): Promise<ConversationDetail | null> => {
      return httpGetConversationDetail(id)
    },

    reply: async (id: string, text: string): Promise<void> => {
      return httpReplyConversation(id, { text })
    }
  },

  // Estadísticas de IA
  ai: {
    getStats: getAiStats,
    getLimit: getAiLimit,
    setLimit: setAiLimit
  }
}

// Re-exportar para compatibilidad
export const fetchConversations = api.conversations.list
export const fetchConversationDetail = api.conversations.get
export const replyConversation = api.conversations.reply
