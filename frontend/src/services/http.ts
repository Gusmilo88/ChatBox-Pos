import type { 
  ConversationListResponse, 
  ConversationDetail, 
  ReplyRequest 
} from '@/types/conversations'

const API_BASE = import.meta.env.VITE_API_BASE || ''

// Helper para hacer requests
async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Incluir cookies en todas las requests
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return response.json()
}

export async function getConversations(params: {
  query?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  isClient?: boolean
  needsReply?: boolean
}): Promise<ConversationListResponse> {
  const searchParams = new URLSearchParams()
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  const endpoint = `/api/conversations${queryString ? `?${queryString}` : ''}`
  
  return apiRequest<ConversationListResponse>(endpoint)
}

export async function getConversationDetail(id: string): Promise<ConversationDetail> {
  return apiRequest<ConversationDetail>(`/api/conversations/${id}`)
}

export async function replyConversation(id: string, request: ReplyRequest): Promise<void> {
  await apiRequest(`/api/conversations/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify(request)
  })
}

// Autenticación via cookies HttpOnly