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
import type { AutoReplyRule } from '@/types/autoReplies'

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
  },

      // Estadísticas de conversaciones
      stats: {
        getConversations: async (): Promise<any> => {
          const { getConversationStats } = await import('./http')
          return getConversationStats()
        },
        getAdvanced: async (): Promise<any> => {
          const { getAdvancedAnalytics } = await import('./http')
          return getAdvancedAnalytics()
        }
      },

  // Respuestas automáticas
  autoReplies: {
    list: async (): Promise<{ rules: AutoReplyRule[] }> => {
      const response = await fetch('/api/auto-replies', {
        credentials: 'include'
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al obtener reglas' }))
        throw new Error(errorData.error || 'Error al obtener reglas')
      }
      return response.json()
    },
    get: async (id: string): Promise<AutoReplyRule> => {
      const response = await fetch(`/api/auto-replies/${id}`, {
        credentials: 'include'
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al obtener regla' }))
        throw new Error(errorData.error || 'Error al obtener regla')
      }
      return response.json()
    },
    create: async (rule: Omit<AutoReplyRule, 'id'>): Promise<AutoReplyRule> => {
      const response = await fetch('/api/auto-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(rule)
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al crear regla' }))
        throw new Error(errorData.error || 'Error al crear regla')
      }
      return response.json()
    },
    update: async (id: string, rule: Partial<AutoReplyRule>): Promise<AutoReplyRule> => {
      const response = await fetch(`/api/auto-replies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(rule)
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al actualizar regla' }))
        throw new Error(errorData.error || 'Error al actualizar regla')
      }
      return response.json()
    },
    delete: async (id: string): Promise<void> => {
      const response = await fetch(`/api/auto-replies/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al eliminar regla' }))
        throw new Error(errorData.error || 'Error al eliminar regla')
      }
    }
  }
}

// Re-exportar para compatibilidad
export const fetchConversations = api.conversations.list
export const fetchConversationDetail = api.conversations.get
export const replyConversation = api.conversations.reply
