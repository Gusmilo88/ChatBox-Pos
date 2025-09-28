import { useState, useRef, useEffect } from 'react'
import { Send, Phone, User, MessageSquare, Bot, UserCheck, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const getMessageIcon = (from: Message['from']) => {
    switch (from) {
      case 'usuario':
        return <User className="h-4 w-4" />
      case 'operador':
        return <UserCheck className="h-4 w-4" />
      case 'sistema':
        return <Bot className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getMessageColor = (from: Message['from']) => {
    switch (from) {
      case 'usuario':
        return 'bg-blue-500 text-white'
      case 'operador':
        return 'bg-green-500 text-white'
      case 'sistema':
        return 'bg-gray-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getMessageAlignment = (from: Message['from']) => {
    return from === 'usuario' ? 'justify-end' : 'justify-start'
  }

  const handleSendMessage = () => {
    // TODO: Implementar envío de mensajes cuando esté listo
    console.log('Enviar mensaje:', newMessage)
    setNewMessage('')
  }

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-6 bg-muted animate-pulse rounded w-32" />
              <div className="h-4 bg-muted animate-pulse rounded w-24" />
            </div>
            <div className="h-8 bg-muted animate-pulse rounded w-20" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 space-y-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-16" />
                  <div className="h-16 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="chat-container">
      {/* Header de WhatsApp */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar">
            {conversation.name ? conversation.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="chat-contact-info">
            <div className="chat-contact-name">
              {conversation.name || formatPhone(conversation.phone)}
            </div>
            <div className="chat-contact-status">
              {conversation.isClient ? 'Cliente' : 'No Cliente'}
            </div>
          </div>
        </div>
        {conversation.needsReply && (
          <div className="chat-urgent-badge">
            <AlertCircle className="icon" />
            Requiere respuesta
          </div>
        )}
      </div>

      {/* Área de mensajes */}
      <div className="chat-messages">
        {conversation.messages.map((message) => (
          <div
            key={message.id}
            className={`message-wrapper ${message.from === 'usuario' ? 'message-user' : 'message-system'}`}
          >
            <div className="message-bubble">
              <div className="message-text">
                {maskPII(message.text)}
              </div>
              <div className="message-meta">
                <span className="message-time">{formatTime(message.ts)}</span>
                {message.from === 'usuario' && <span className="message-status">✓✓</span>}
              </div>
            </div>
            <div className="message-avatar">
              {message.from === 'usuario' ? 'Tú' : 
               message.from === 'operador' ? 'Op' : 
               'IA'}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />

      </div>

      {/* Input de mensaje estilo WhatsApp */}
      <div className="chat-input-container">
        <div className="chat-input">
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
            className="chat-input-field"
          />
          <button 
            onClick={handleSendMessage}
            disabled
            className="chat-send-button"
          >
            <Send className="icon" />
          </button>
        </div>
        <div className="chat-input-hint">
          Función de envío de mensajes próximamente
        </div>
      </div>
    </div>
  )
}
