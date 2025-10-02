import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Send, Phone, Video, MoreVertical, Smile, Paperclip, AlertCircle } from 'lucide-react'
import { formatPhone, formatTime } from '@/utils/format'
import { maskPII } from '@/utils/mask'
import { replyConversation } from '@/services/http'
import type { ConversationDetail, Message } from '@/types/conversations'

interface ConversationDetailProps {
  conversation: ConversationDetail
  isLoading?: boolean
}

export function ConversationDetail({ conversation, isLoading }: ConversationDetailProps) {
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversation.messages])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return

    const messageText = newMessage.trim()
    setIsSending(true)
    setSendError(null)

    // OPTIMISTA: Agregar mensaje inmediatamente al chat
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      from: 'operador' as const,
      text: messageText,
      deliveryStatus: 'pending' as const
    }

    // Actualizar la conversación con el mensaje optimista
    conversation.messages.push(optimisticMessage)
    
    // Limpiar input inmediatamente
    setNewMessage('')
    
    // Scroll hacia abajo para ver el mensaje
    setTimeout(scrollToBottom, 100)

    try {
      // Generar idempotency key único
      const idempotencyKey = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      await replyConversation(conversation.id, {
        text: messageText,
        idempotencyKey
      })

      // Actualizar estado del mensaje a "enviado"
      const messageIndex = conversation.messages.findIndex(m => m.id === optimisticMessage.id)
      if (messageIndex !== -1) {
        conversation.messages[messageIndex].deliveryStatus = 'sent'
      }
      
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      setSendError(error instanceof Error ? error.message : 'Error al enviar mensaje')
      
      // Actualizar estado del mensaje a "fallido"
      const messageIndex = conversation.messages.findIndex(m => m.id === optimisticMessage.id)
      if (messageIndex !== -1) {
        conversation.messages[messageIndex].deliveryStatus = 'failed'
      }
    } finally {
      setIsSending(false)
    }
  }

  const formatMessageTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    } catch {
      return 'Invalid Date'
    }
  }

  const getInitials = (name?: string, phone?: string) => {
    if (name) {
      return name.charAt(0).toUpperCase()
    }
    if (phone) {
      return phone.slice(-1)
    }
    return '?'
  }

  if (isLoading) {
    return (
      <>
        <div className="whatsapp-messages">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="whatsapp-message-wrapper">
              <div className="whatsapp-message-bubble">
                <div className="h-4 bg-gray-300 animate-pulse rounded w-32 mb-2" />
                <div className="h-3 bg-gray-300 animate-pulse rounded w-16" />
              </div>
            </div>
          ))}
        </div>
        <div className="whatsapp-input-container">
          <div className="whatsapp-input-wrapper">
            <div className="h-8 bg-gray-300 animate-pulse rounded w-full" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Área de mensajes */}
      <div className="whatsapp-messages">
        {conversation.messages.map((message) => {
          const isFromUs = message.from === 'system' || message.from === 'operador'
          
          return (
            <div
              key={message.id}
              className={`whatsapp-message-wrapper ${
                isFromUs ? 'whatsapp-message-outgoing' : 'whatsapp-message-incoming'
              }`}
            >
              <div className="whatsapp-message-bubble">
                <div className="whatsapp-message-text">
                  {maskPII(message.text)}
                </div>
                <div className="whatsapp-message-meta">
                  <span className="whatsapp-message-time">
                    {formatMessageTime(message.timestamp)}
                  </span>
                  {isFromUs && (
                    <span className={`whatsapp-message-status ${
                      message.deliveryStatus === 'sent' ? 'read' : 
                      message.deliveryStatus === 'failed' ? 'failed' : 'pending'
                    }`}>
                      {message.deliveryStatus === 'sent' ? '✓✓' : 
                       message.deliveryStatus === 'failed' ? '✗' : '⏳'}
                    </span>
                  )}
                  {!isFromUs && (
                    <span className="whatsapp-ai-badge">IA</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensaje estilo WhatsApp */}
      <div className="whatsapp-input-container">
        <div className="whatsapp-input-wrapper">
          <button className="whatsapp-input-icon">
            <Smile size={20} />
          </button>
          <input
            type="text"
            placeholder="Escribir mensaje..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            disabled={isSending}
            className="whatsapp-input-field"
          />
          <button className="whatsapp-input-icon">
            <Paperclip size={20} />
          </button>
          <button 
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
            className="whatsapp-send-button"
          >
            {isSending ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
        {sendError && (
          <div style={{
            color: '#dc2626',
            fontSize: '12px',
            textAlign: 'center',
            marginTop: '6px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}>
            <AlertCircle size={12} />
            {sendError}
          </div>
        )}
      </div>
    </>
  )
}
