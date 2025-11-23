import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, AlertCircle, Video, Phone, MoreVertical, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConversationDetail } from '@/components/ConversationDetail'
import { EmptyState } from '@/components/EmptyState'
import { ContactInfo } from '@/components/ContactInfo'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { fetchConversationDetail } from '@/services/api'

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showContactInfo, setShowContactInfo] = useState(false)
  
  const {
    data: conversation,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => fetchConversationDetail(id!),
    enabled: !!id,
    staleTime: 30000, // 30 segundos
    refetchInterval: 30000 // Refetch cada 30 segundos para nuevos mensajes
  })

  const handleBack = () => {
    navigate(-1)
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-4">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </div>
        
        <EmptyState
          type="error"
          title="Error al cargar la conversación"
          description="No se pudo cargar la conversación. Verificá que el ID sea correcto e intentá de nuevo."
          action={{
            label: "Reintentar",
            onClick: () => refetch()
          }}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="whatsapp-chat-container">
        <div className="whatsapp-header">
          <button
            onClick={handleBack}
            className="whatsapp-back-btn"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="whatsapp-avatar">?</div>
          <div className="whatsapp-contact-info">
            <div className="whatsapp-contact-name">Cargando...</div>
            <div className="whatsapp-contact-status">Obteniendo conversación</div>
          </div>
        </div>
        <LoadingSpinner size="lg" text="Cargando conversación..." />
      </div>
    )
  }
  
  if (!conversation) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-4">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </div>
        
        <div className="h-full">
          <ConversationDetail
            conversation={{
              id: id || '',
              phone: '',
              isClient: false,
              messages: [],
              needsReply: false
            }}
            isLoading={true}
          />
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-4">
          <Button variant="ghost" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
        </div>
        
        <EmptyState
          type="no-results"
          title="Conversación no encontrada"
          description="La conversación que buscás no existe o fue eliminada."
          action={{
            label: "Ver todas las conversaciones",
            onClick: () => navigate('/')
          }}
        />
      </div>
    )
  }

  return (
    <div className="whatsapp-chat-container">
      {/* Botón volver integrado en el header */}
      <div className="whatsapp-header">
        <button
          onClick={handleBack}
          className="whatsapp-back-btn"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="whatsapp-avatar">
          {conversation.name ? conversation.name.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="whatsapp-contact-info">
          <div className="whatsapp-contact-name">
            {conversation.name || conversation.phone}
          </div>
          <div className="whatsapp-contact-status">
            {conversation.isClient ? 'Cliente' : 'No Cliente'}
          </div>
        </div>
        <div className="whatsapp-header-actions">
          <button 
            className="whatsapp-header-icon"
            onClick={() => setShowContactInfo(!showContactInfo)}
            style={{
              backgroundColor: showContactInfo ? 'rgba(59, 130, 246, 0.1)' : 'transparent'
            }}
            title="Información del contacto"
          >
            <Info size={20} />
          </button>
          <button className="whatsapp-header-icon" title="Llamar">
            <Phone size={20} />
          </button>
          <button className="whatsapp-header-icon" title="Más opciones">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>
      
      {/* Chat */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ConversationDetail
          conversation={conversation}
          isLoading={false}
        />
      </div>

      {/* Panel de información del contacto */}
      {showContactInfo && conversation && (
        <ContactInfo
          phone={conversation.phone}
          name={conversation.name}
          isClient={conversation.isClient}
          lastMessageAt={conversation.messages[conversation.messages.length - 1]?.timestamp || new Date().toISOString()}
          unreadCount={0} // TODO: obtener de la lista de conversaciones
          needsReply={conversation.needsReply}
          onClose={() => setShowContactInfo(false)}
        />
      )}
    </div>
  )
}
