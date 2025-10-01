import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Send, Phone, Video, MoreVertical, Smile, Paperclip } from 'lucide-react'
import { formatPhone, formatTime } from '@/utils/format'
import { maskPII } from '@/utils/mask'
import type { ConversationDetail, Message } from '@/types/conversations'

interface ConversationDetailProps {
  conversation: ConversationDetail
  isLoading?: boolean
}

export function ConversationDetail({ conversation, isLoading }: ConversationDetailProps) {
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversation.messages])

  const handleSendMessage = () => {
    // TODO: Implementar envío de mensajes cuando esté listo
    console.log('Enviar mensaje:', newMessage)
    setNewMessage('')
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
                    <span className="whatsapp-message-status read">✓✓</span>
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
            placeholder="Escribir mensaje... (próximamente)"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            disabled
            className="whatsapp-input-field"
          />
          <button className="whatsapp-input-icon">
            <Paperclip size={20} />
          </button>
          <button 
            onClick={handleSendMessage}
            disabled
            className="whatsapp-send-button"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="whatsapp-input-hint">
          Función de envío de mensajes próximamente
        </div>
      </div>
    </>
  )
}
