import type { 
  ConversationListResponse, 
  ConversationDetail, 
  ConversationFilters 
} from '@/types/conversations'
import { fetchConversations as mockFetchConversations, fetchConversationDetail as mockFetchConversationDetail } from './mock'

// Adaptador que hoy usa mocks, mañana puede apuntar a HTTP/Firestore
export const api = {
  conversations: {
    list: async (filters: ConversationFilters): Promise<ConversationListResponse> => {
      // TODO: Reemplazar con fetch real cuando esté listo el backend
      return mockFetchConversations(filters)
    },
    
    get: async (id: string): Promise<ConversationDetail | null> => {
      // TODO: Reemplazar con fetch real cuando esté listo el backend
      return mockFetchConversationDetail(id)
    }
  }
}

// Re-exportar para compatibilidad
export const fetchConversations = api.conversations.list
export const fetchConversationDetail = api.conversations.get
