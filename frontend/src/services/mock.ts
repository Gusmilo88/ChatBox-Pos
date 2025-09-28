import type { 
  ConversationListItem, 
  ConversationListResponse, 
  ConversationDetail, 
  Message,
  ConversationFilters 
} from '@/types/conversations'

// Generar datos mock
function generateMockConversations(): ConversationListItem[] {
  const conversations: ConversationListItem[] = []
  const names = [
    'Juan Pérez', 'María González', 'Carlos Rodríguez', 'Ana Martínez', 'Luis Fernández',
    'Laura Sánchez', 'Roberto López', 'Carmen García', 'Diego Martín', 'Sofia Herrera',
    'Miguel Torres', 'Isabel Ruiz', 'Fernando Jiménez', 'Patricia Moreno', 'Alejandro Díaz',
    'Elena Vázquez', 'Jorge Castro', 'Monica Flores', 'Ricardo Ortega', 'Silvia Ramos'
  ]
  
  const phones = [
    '+5491123456789', '+5491234567890', '+5491345678901', '+5491456789012', '+5491567890123',
    '+5491678901234', '+5491789012345', '+5491890123456', '+5491901234567', '+5492012345678',
    '+5492123456789', '+5492234567890', '+5492345678901', '+5492456789012', '+5492567890123',
    '+5492678901234', '+5492789012345', '+5492890123456', '+5492901234567', '+5493012345678'
  ]
  
  for (let i = 0; i < 100; i++) {
    const isClient = Math.random() > 0.4 // 60% clientes
    const hasName = Math.random() > 0.3 // 70% tienen nombre
    const needsReply = Math.random() > 0.8 // 20% necesitan respuesta
    const unreadCount = needsReply ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 3)
    
    // Fecha aleatoria en los últimos 30 días
    const lastMessageAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    
    conversations.push({
      id: `conv_${i.toString().padStart(3, '0')}`,
      phone: phones[i % phones.length],
      name: hasName ? names[i % names.length] : undefined,
      isClient,
      lastMessageAt,
      unreadCount,
      needsReply
    })
  }
  
  return conversations.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
}

function generateMockMessages(conversationId: string, phone: string, name?: string): Message[] {
  const messages: Message[] = []
  const messageCount = Math.floor(Math.random() * 70) + 10 // 10-80 mensajes
  
  // Mensajes de ejemplo
  const userMessages = [
    'Hola, necesito ayuda con mi cuenta',
    '¿Cuál es mi saldo actual?',
    'Quiero enviar mis ventas del mes',
    'Necesito una factura',
    '¿Cómo puedo contactar con Iván?',
    'Tengo una consulta sobre monotributo',
    'Mi CUIT es 20123456786',
    '¿Cuánto debo pagar?',
    'Quiero agendar una reunión',
    'Tengo problemas con mi clave fiscal'
  ]
  
  const botMessages = [
    'Hola 👋 soy el asistente del estudio. Si sos cliente, mandá tu CUIT (solo números). Si todavía no sos cliente, escribí quiero info.',
    'Perfecto ✅. ¿Qué necesitás?\n1. Ver saldo\n2. Recibir comprobantes\n3. Hablar con un humano\n4. Volver al inicio',
    'Tu saldo actual es de $15.230,50',
    'Aquí están tus últimos comprobantes...',
    'Te derivamos con el equipo. ¡Gracias! 🙌',
    'Decime tu nombre y empresa.',
    'Dejame tu email.',
    '¿Qué te interesa?\n1. Alta en Monotributo\n2. Plan Mensual\n3. Responsable Inscripto\n4. Estado de Consulta\n5. Otras consultas'
  ]
  
  let lastMessageTime = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
  
  for (let i = 0; i < messageCount; i++) {
    const isUser = Math.random() > 0.4 // 60% mensajes del usuario
    const messageType = isUser ? 'usuario' : Math.random() > 0.8 ? 'operador' : 'sistema'
    const via = isUser ? 'whatsapp' : messageType === 'operador' ? 'manual' : 'ia'
    const aiSuggested = via === 'ia' && Math.random() > 0.5
    
    const text = isUser 
      ? userMessages[Math.floor(Math.random() * userMessages.length)]
      : botMessages[Math.floor(Math.random() * botMessages.length)]
    
    // Intervalo entre mensajes: 1 minuto a 2 horas
    lastMessageTime = new Date(lastMessageTime.getTime() + Math.random() * 2 * 60 * 60 * 1000)
    
    messages.push({
      id: `msg_${conversationId}_${i}`,
      ts: lastMessageTime.toISOString(),
      from: messageType,
      text,
      via,
      aiSuggested
    })
  }
  
  return messages.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
}

// Datos mock globales
const mockConversations = generateMockConversations()

// Simular latencia de red
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function fetchConversations(filters: ConversationFilters): Promise<ConversationListResponse> {
  await delay(300 + Math.random() * 700) // 300-1000ms
  
  let filtered = [...mockConversations]
  
  // Aplicar filtros
  if (filters.query) {
    const query = filters.query.toLowerCase()
    filtered = filtered.filter(conv => 
      conv.phone.toLowerCase().includes(query) ||
      conv.name?.toLowerCase().includes(query)
    )
  }
  
  if (filters.from) {
    const fromDate = new Date(filters.from)
    filtered = filtered.filter(conv => new Date(conv.lastMessageAt) >= fromDate)
  }
  
  if (filters.to) {
    const toDate = new Date(filters.to)
    filtered = filtered.filter(conv => new Date(conv.lastMessageAt) <= toDate)
  }
  
  if (filters.isClient !== undefined) {
    filtered = filtered.filter(conv => conv.isClient === filters.isClient)
  }
  
  if (filters.needsReply !== undefined) {
    filtered = filtered.filter(conv => conv.needsReply === filters.needsReply)
  }
  
  // Paginación
  const pageSize = 25
  const startIndex = (filters.page - 1) * pageSize
  const endIndex = startIndex + pageSize
  
  return {
    items: filtered.slice(startIndex, endIndex),
    page: filters.page,
    pageSize,
    total: filtered.length
  }
}

export async function fetchConversationDetail(id: string): Promise<ConversationDetail | null> {
  await delay(200 + Math.random() * 500) // 200-700ms
  
  const conversation = mockConversations.find(conv => conv.id === id)
  if (!conversation) return null
  
  const messages = generateMockMessages(id, conversation.phone, conversation.name)
  
  return {
    id: conversation.id,
    phone: conversation.phone,
    name: conversation.name,
    isClient: conversation.isClient,
    messages,
    needsReply: conversation.needsReply
  }
}

// Simular errores ocasionalmente
export async function simulateNetworkError(): Promise<never> {
  await delay(1000)
  throw new Error('Error de conexión simulado')
}
