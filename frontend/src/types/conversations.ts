export type Message = {
  id: string
  timestamp: string // ISO
  from: 'usuario' | 'operador' | 'sistema' | 'system'
  text: string
  via?: 'whatsapp' | 'ia' | 'manual'
  aiSuggested?: boolean
  deliveryStatus?: 'pending' | 'sent' | 'failed'
  attachment?: {
    type: string
    name: string
    url?: string
  }
  audio?: boolean
}

export type ConversationDetail = {
  id: string
  phone: string
  name?: string
  isClient: boolean
  messages: Message[]
  needsReply: boolean
  assignedTo?: string // Email del operador asignado
}

export type ConversationListItem = {
  id: string
  phone: string // E.164
  name?: string
  isClient: boolean
  lastMessageAt: string // ISO
  lastMessage?: string
  unreadCount: number
  needsReply: boolean
  assignedTo?: string // Email del operador asignado
}

export type ConversationListResponse = {
  conversations: ConversationListItem[]
  page: number
  pageSize: number
  total: number
  hasMore?: boolean
}

export type ConversationFilters = {
  query: string
  from: string
  to: string
  page: number
  isClient?: boolean
  needsReply?: boolean
}

export type ReplyRequest = {
  text: string
  idempotencyKey?: string
}

export type ExportData = {
  phone: string
  name?: string
  isClient: boolean
  lastMessageAt: string
  unreadCount: number
  needsReply: boolean
}
