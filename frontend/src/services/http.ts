import type { 
  ConversationListResponse, 
  ConversationDetail, 
  ConversationFilters 
} from '@/types/conversations'

// Stubs para cuando conectemos al backend real
export const http = {
  conversations: {
    list: async (filters: ConversationFilters): Promise<ConversationListResponse> => {
      // TODO: Implementar fetch real al backend
      const params = new URLSearchParams()
      
      if (filters.query) params.set('query', filters.query)
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)
      if (filters.page) params.set('page', filters.page.toString())
      if (filters.isClient !== undefined) params.set('isClient', filters.isClient.toString())
      if (filters.needsReply !== undefined) params.set('needsReply', filters.needsReply.toString())
      
      const response = await fetch(`/api/conversations?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          // TODO: Agregar API key cuando sea necesario
          // 'x-api-key': process.env.REACT_APP_API_KEY
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response.json()
    },
    
    get: async (id: string): Promise<ConversationDetail | null> => {
      // TODO: Implementar fetch real al backend
      const response = await fetch(`/api/conversations/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          // TODO: Agregar API key cuando sea necesario
          // 'x-api-key': process.env.REACT_APP_API_KEY
        }
      })
      
      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response.json()
    }
  }
}
