import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Send, Phone, Video, MoreVertical, Smile, Paperclip, AlertCircle, MessageSquare, Mic, X } from 'lucide-react'
import { formatPhone, formatTime } from '@/utils/format'
import { maskPII } from '@/utils/mask'
import { replyConversation } from '@/services/http'
import type { ConversationDetail, Message } from '@/types/conversations'
import { EmojiPicker } from './EmojiPicker'
import { FilePicker } from './FilePicker'
import { AudioRecorder } from './AudioRecorder'
import { LoadingSpinner } from './LoadingSpinner'

// Plantillas de respuestas rápidas
const QUICK_REPLIES = [
  'Gracias por contactarnos',
  'Te paso con Iván',
  'Te paso con Belén',
  'En breve te respondo',
  'Perfecto, lo reviso y te aviso',
  '¿Necesitás algo más?',
  'Saludos',
  'Buen día'
]

function QuickReplyTemplates({ onSelect, disabled }: { onSelect: (template: string) => void; disabled: boolean }) {
  const [showTemplates, setShowTemplates] = useState(false)

  return (
    <div style={{ 
      padding: '8px 16px', 
      backgroundColor: '#f0f0f0', 
      borderTop: '1px solid #e0e0e0',
      position: 'relative'
    }}>
      <button
        onClick={() => setShowTemplates(!showTemplates)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: 'white',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#374151',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <MessageSquare size={14} />
        Respuestas rápidas
      </button>

      {showTemplates && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '16px',
          right: '16px',
          marginBottom: '8px',
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          padding: '8px',
          maxHeight: '200px',
          overflowY: 'auto',
          zIndex: 1000
        }}>
          {QUICK_REPLIES.map((template, index) => (
            <button
              key={index}
              onClick={() => {
                onSelect(template)
                setShowTemplates(false)
              }}
              disabled={disabled}
              style={{
                width: '100%',
                padding: '8px 12px',
                textAlign: 'left',
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: '4px',
                fontSize: '14px',
                color: '#111827',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {template}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ConversationDetailProps {
  conversation: ConversationDetail
  isLoading?: boolean
}

export function ConversationDetail({ conversation, isLoading }: ConversationDetailProps) {
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showFilePicker, setShowFilePicker] = useState(false)
  const [showAudioRecorder, setShowAudioRecorder] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [conversation.messages])

  const handleSendMessage = async (text?: string, file?: File, audioBlob?: Blob) => {
    const messageText = text || newMessage.trim()
    if ((!messageText && !file && !audioBlob) || isSending) return

    setIsSending(true)
    setSendError(null)
    setShowEmojiPicker(false)
    setShowFilePicker(false)
    setShowAudioRecorder(false)

    // OPTIMISTA: Agregar mensaje inmediatamente al chat
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      from: 'operador' as const,
      text: messageText || (file ? `📎 ${file.name}` : '🎤 Audio'),
      deliveryStatus: 'pending' as const,
      attachment: file ? { type: file.type, name: file.name } : undefined,
      audio: audioBlob ? true : undefined
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
      
      // Si hay archivo o audio, crear FormData
      if (file || audioBlob) {
        const formData = new FormData()
        if (file) {
          formData.append('file', file)
          formData.append('text', messageText || '')
        }
        if (audioBlob) {
          formData.append('audio', audioBlob, 'audio.webm')
          formData.append('text', messageText || '')
        }
        formData.append('idempotencyKey', idempotencyKey)
        
        // TODO: Implementar endpoint para archivos/audio
        // await replyConversationWithFile(conversation.id, formData)
        console.log('Enviando archivo/audio:', { file, audioBlob })
      } else {
        await replyConversation(conversation.id, {
          text: messageText,
          idempotencyKey
        })
      }

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

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji)
    inputRef.current?.focus()
  }

  const handleFileSelect = (file: File) => {
    handleSendMessage('', file)
  }

  const handleAudioComplete = (audioBlob: Blob) => {
    handleSendMessage('', undefined, audioBlob)
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
        <div className="whatsapp-messages" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
          <LoadingSpinner size="lg" text="Cargando mensajes..." />
        </div>
        <div className="whatsapp-input-container">
          <div className="whatsapp-input-wrapper">
            <div style={{ flex: 1, height: '40px', backgroundColor: '#f0f0f0', borderRadius: '21px' }} />
          </div>
        </div>
      </>
    )
  }

  // Agrupar mensajes por fecha
  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = []
    let currentDate = ''
    
    messages.forEach((message) => {
      const messageDate = new Date(message.timestamp).toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      
      if (messageDate !== currentDate) {
        currentDate = messageDate
        groups.push({ date: messageDate, messages: [] })
      }
      
      groups[groups.length - 1].messages.push(message)
    })
    
    return groups
  }

  const messageGroups = groupMessagesByDate(conversation.messages)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Área de mensajes */}
      <div className="whatsapp-messages" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {conversation.messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '40px',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            <MessageSquare size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
              No hay mensajes aún
            </div>
            <div style={{ fontSize: '14px', opacity: 0.8 }}>
              Comenzá la conversación enviando un mensaje
            </div>
          </div>
        ) : (
          messageGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Separador de fecha */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '16px 0',
              gap: '8px'
            }}>
              <div style={{
                height: '1px',
                flex: 1,
                backgroundColor: '#e5e7eb'
              }}></div>
              <span style={{
                padding: '4px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#6b7280',
                textTransform: 'capitalize'
              }}>
                {group.date}
              </span>
              <div style={{
                height: '1px',
                flex: 1,
                backgroundColor: '#e5e7eb'
              }}></div>
            </div>

            {/* Mensajes del día */}
            {group.messages.map((message) => {
              // Mensajes del bot/sistema van a la derecha (verde)
              // Mensajes del usuario van a la izquierda (blanco)
              // 'usuario' = mensaje entrante del cliente (izquierda, blanco)
              // 'system', 'sistema', 'operador' = mensaje del bot (derecha, verde)
              const isFromUs = message.from === 'system' || message.from === 'sistema' || message.from === 'operador'
              
              return (
                <div
                  key={message.id}
                  className={`whatsapp-message-wrapper ${
                    isFromUs ? 'whatsapp-message-outgoing' : 'whatsapp-message-incoming'
                  }`}
                >
                  <div className="whatsapp-message-bubble">
                    {/* Mostrar imagen si existe */}
                    {message.attachment && message.attachment.type?.startsWith('image/') && (
                      <div style={{
                        marginBottom: '8px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        maxWidth: '100%'
                      }}>
                        <img
                          src={message.attachment.url || '#'}
                          alt={message.attachment.name || 'Imagen'}
                          style={{
                            width: '100%',
                            maxWidth: '300px',
                            height: 'auto',
                            display: 'block'
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Mostrar audio si existe */}
                    {message.audio && (
                      <div style={{
                        marginBottom: '8px',
                        padding: '12px',
                        backgroundColor: isFromUs ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: isFromUs ? 'rgba(255,255,255,0.2)' : '#25d366',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}>
                          <Mic size={20} color={isFromUs ? 'white' : 'white'} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: isFromUs ? 'white' : '#111827',
                            marginBottom: '4px'
                          }}>
                            Mensaje de voz
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: isFromUs ? 'rgba(255,255,255,0.8)' : '#6b7280'
                          }}>
                            Toca para reproducir
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Mostrar texto si existe */}
                    {message.text && (
                      <div className="whatsapp-message-text">
                        {maskPII(message.text)}
                      </div>
                    )}
                    
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
                      {message.aiSuggested && (
                        <span style={{
                          fontSize: '10px',
                          color: '#8b5cf6',
                          fontWeight: '600',
                          marginLeft: '4px'
                        }}>
                          IA
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Plantillas de respuestas rápidas */}
      <QuickReplyTemplates 
        onSelect={(template) => setNewMessage(template)}
        disabled={isSending}
      />

      {/* Input de mensaje estilo WhatsApp */}
      <div className="whatsapp-input-container" style={{ position: 'relative' }}>
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        {/* File Picker */}
        {showFilePicker && (
          <FilePicker
            onSelect={handleFileSelect}
            onClose={() => setShowFilePicker(false)}
          />
        )}

        {/* Audio Recorder */}
        {showAudioRecorder && (
          <AudioRecorder
            onRecordComplete={handleAudioComplete}
            onCancel={() => setShowAudioRecorder(false)}
          />
        )}

        <div className="whatsapp-input-wrapper">
          <button
            className="whatsapp-input-icon"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker)
              setShowFilePicker(false)
              setShowAudioRecorder(false)
            }}
            style={{
              color: showEmojiPicker ? '#25d366' : '#54656f'
            }}
          >
            <Smile size={20} />
          </button>
          
          <input
            ref={inputRef}
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
            onFocus={() => {
              setShowEmojiPicker(false)
              setShowFilePicker(false)
              setShowAudioRecorder(false)
            }}
            disabled={isSending}
            className="whatsapp-input-field"
          />
          
          {!newMessage.trim() ? (
            <button
              className="whatsapp-input-icon"
              onClick={() => {
                setShowFilePicker(!showFilePicker)
                setShowEmojiPicker(false)
                setShowAudioRecorder(false)
              }}
              style={{
                color: showFilePicker ? '#25d366' : '#54656f'
              }}
            >
              <Paperclip size={20} />
            </button>
          ) : (
            <button
              className="whatsapp-input-icon"
              onClick={() => {
                setShowAudioRecorder(!showAudioRecorder)
                setShowEmojiPicker(false)
                setShowFilePicker(false)
              }}
              style={{
                color: showAudioRecorder ? '#25d366' : '#54656f'
              }}
            >
              <Mic size={20} />
            </button>
          )}
          
          <button 
            onClick={() => handleSendMessage()}
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
    </div>
  )
}
