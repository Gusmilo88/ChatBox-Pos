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

// Estadísticas de IA
export async function getAiStats(): Promise<any> {
  const data = await apiRequest<{ ok: boolean; data: any }>('/api/ai/stats')
  return data.data
}

export async function getAiLimit(): Promise<number> {
  const data = await apiRequest<{ ok: boolean; data: { monthlyLimitUsd: number } }>('/api/ai/limit')
  return data.data.monthlyLimitUsd
}

export async function setAiLimit(limitUsd: number): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/ai/limit', {
    method: 'POST',
    body: JSON.stringify({ monthlyLimitUsd: limitUsd })
  })
}

// Estadísticas de conversaciones
export async function getConversationStats(): Promise<any> {
  const data = await apiRequest<{ ok: boolean; data: any }>('/api/stats/conversations')
  return data.data
}

// Autenticación via cookies HttpOnly