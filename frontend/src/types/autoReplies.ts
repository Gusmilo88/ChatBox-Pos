export interface AutoReplyRule {
  id?: string
  name: string
  enabled: boolean
  type: 'keyword' | 'schedule'
  priority: number
  // Campos para tipo 'keyword'
  keywords?: string[]
  matchType?: 'any' | 'all'
  response?: string
  // Campos para tipo 'schedule'
  schedule?: {
    days: number[] // 0 = domingo, 1 = lunes, ..., 6 = sábado
    startTime: string // Formato "HH:mm"
    endTime: string // Formato "HH:mm"
    timezone?: string
  }
  scheduleResponse?: string
  // Filtros
  isClientOnly?: boolean
  isLeadOnly?: boolean
  // Metadata
  createdAt?: string
  updatedAt?: string
}

