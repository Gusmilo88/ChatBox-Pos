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
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{formatPhone(conversation.phone)}</span>
            </div>
            {conversation.name && (
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{conversation.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={conversation.isClient ? "default" : "secondary"}>
              {conversation.isClient ? "Cliente" : "No Cliente"}
            </Badge>
            {conversation.needsReply && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                Requiere respuesta
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {conversation.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${getMessageAlignment(message.from)}`}
            >
              <div className="flex gap-3 max-w-[80%]">
                {message.from !== 'usuario' && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getMessageColor(message.from)} flex-shrink-0`}>
                    {getMessageIcon(message.from)}
                  </div>
                )}
                
                <div className={`space-y-1 ${message.from === 'usuario' ? 'order-1' : ''}`}>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{message.from === 'usuario' ? 'Tú' : message.from === 'operador' ? 'Operador' : 'Sistema'}</span>
                    <span>•</span>
                    <span>{formatTime(message.ts)}</span>
                    {message.via && (
                      <>
                        <span>•</span>
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {message.via === 'whatsapp' ? 'WhatsApp' : message.via === 'ia' ? 'IA' : 'Manual'}
                        </Badge>
                      </>
                    )}
                    {message.aiSuggested && (
                      <Badge variant="secondary" className="text-xs px-1 py-0 bg-blue-100 text-blue-700">
                        Sugerido por IA
                      </Badge>
                    )}
                  </div>
                  
                  <div className={`p-3 rounded-lg ${
                    message.from === 'usuario' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-muted'
                  }`}>
                    <p className="whitespace-pre-wrap text-sm">
                      {maskPII(message.text)}
                    </p>
                  </div>
                </div>
                
                {message.from === 'usuario' && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getMessageColor(message.from)} flex-shrink-0`}>
                    {getMessageIcon(message.from)}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input de mensaje */}
        <div className="flex gap-2 pt-4 border-t">
          <Input
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
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage}
            disabled
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Función de envío de mensajes próximamente
        </p>
      </CardContent>
    </Card>
  )
}
