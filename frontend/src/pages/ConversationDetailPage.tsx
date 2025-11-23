import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, AlertCircle, Video, Phone, MoreVertical, Info, Download, FileText, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConversationDetail } from '@/components/ConversationDetail'
import { EmptyState } from '@/components/EmptyState'
import { ContactInfo } from '@/components/ContactInfo'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { fetchConversationDetail } from '@/services/api'
import { useNotifications } from '@/hooks/useNotifications'
import { exportConversationDetailToPDF, exportConversationDetailToExcel } from '@/utils/export'

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const { showNotification } = useNotifications()
  const lastMessageCountRef = useRef<number>(0)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])
  
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

  // Notificar nuevos mensajes en esta conversación (solo si la ventana está oculta)
  useEffect(() => {
    if (conversation?.messages) {
      const currentCount = conversation.messages.length
      const lastCount = lastMessageCountRef.current
      
      // Si hay nuevos mensajes (del usuario, no del operador)
      if (currentCount > lastCount && lastCount > 0) {
        const newMessages = conversation.messages.slice(lastCount)
        const userMessages = newMessages.filter(m => m.from === 'usuario')
        
        if (userMessages.length > 0 && document.hidden) {
          // Solo notificar si la ventana está oculta
          const lastMessage = userMessages[userMessages.length - 1]
          const name = conversation.name || conversation.phone
          
          showNotification(
            name,
            lastMessage.text.length > 60 
              ? lastMessage.text.substring(0, 60) + '...' 
              : lastMessage.text,
            `conv-${conversation.id}`,
            '/vite.svg'
          )
        }
      }
      
      lastMessageCountRef.current = currentCount
    }
  }, [conversation, showNotification])

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
        <div className="whatsapp-header-actions" style={{ position: 'relative' }}>
          <div ref={exportMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button 
              className="whatsapp-header-icon"
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="Exportar conversación"
            >
              <Download size={20} />
            </button>
            
            {showExportMenu && conversation && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                zIndex: 1000,
                minWidth: '180px',
                overflow: 'hidden'
              }}>
                <button
                  onClick={() => {
                    exportConversationDetailToPDF(conversation)
                    setShowExportMenu(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FileText size={18} />
                  <span>Exportar PDF</span>
                </button>
                <button
                  onClick={() => {
                    exportConversationDetailToExcel(conversation)
                    setShowExportMenu(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151',
                    transition: 'background-color 0.2s',
                    borderTop: '1px solid #e5e7eb'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FileSpreadsheet size={18} />
                  <span>Exportar Excel</span>
                </button>
              </div>
            )}
          </div>
          
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
