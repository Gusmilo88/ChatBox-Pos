export type Message = {
  id: string
  timestamp: string // ISO
  from: 'usuario' | 'operador' | 'sistema'
  text: string
  via?: 'whatsapp' | 'ia' | 'manual'
  aiSuggested?: boolean
  deliveryStatus?: 'pending' | 'sent' | 'failed'
}

export type ConversationDetail = {
  id: string
  phone: string
  name?: string
  isClient: boolean
  messages: Message[]
  needsReply: boolean
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

export type IncomingMessageRequest = {
  phone: string
  text: string
  via?: 'whatsapp' | 'ia' | 'manual'
}

export type OutboxMessage = {
  id: string
  conversationId: string
  phone: string
  text: string
  createdAt: string
  status: 'pending' | 'sent' | 'failed'
  tries: number
  nextAttemptAt?: string
  sentAt?: string
  remoteId?: string
  error?: string
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
