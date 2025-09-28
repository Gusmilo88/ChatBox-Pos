export type Message = {
  id: string
  ts: string // ISO
  from: 'usuario' | 'operador' | 'sistema'
  text: string
  via?: 'whatsapp' | 'ia' | 'manual'
  aiSuggested?: boolean
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
  unreadCount: number
  needsReply: boolean
}

export type ConversationListResponse = {
  items: ConversationListItem[]
  page: number
  pageSize: number
  total: number
}

export type ConversationFilters = {
  query: string
  from: string
  to: string
  page: number
  isClient?: boolean
  needsReply?: boolean
}

export type ExportData = {
  phone: string
  name?: string
  isClient: boolean
  lastMessageAt: string
  unreadCount: number
  needsReply: boolean
}
