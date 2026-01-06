import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, AlertCircle, Video, Phone, MoreVertical, Info, Download, FileText, FileSpreadsheet, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConversationDetail } from '@/components/ConversationDetail'
import { EmptyState } from '@/components/EmptyState'
import { ContactInfo } from '@/components/ContactInfo'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { fetchConversationDetail } from '@/services/api'
import { assignConversation, getOperators } from '@/services/http'
import { useNotifications } from '@/hooks/useNotifications'
import { useAuth } from '@/hooks/useAuth'
import { exportConversationDetailToPDF, exportConversationDetailToExcel } from '@/utils/export'

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showAssignMenu, setShowAssignMenu] = useState(false)
  const { showNotification } = useNotifications()
  const lastMessageCountRef = useRef<number>(0)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const assignMenuRef = useRef<HTMLDivElement>(null)
  
  const isOwner = user?.role === 'owner'

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
      if (assignMenuRef.current && !assignMenuRef.current.contains(event.target as Node)) {
        setShowAssignMenu(false)
      }
    }

    if (showExportMenu || showAssignMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu, showAssignMenu])
  
  // Cargar operadores si es owner
  const { data: operatorsData } = useQuery({
    queryKey: ['operators'],
    queryFn: getOperators,
    enabled: isOwner,
    staleTime: 5 * 60 * 1000 // 5 minutos
  })
  
  // Mutación para asignar conversación
  const assignMutation = useMutation({
    mutationFn: ({ assignedTo, notifyClient }: { assignedTo: string | null; notifyClient: boolean }) =>
      assignConversation(id!, assignedTo, notifyClient),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', id] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setShowAssignMenu(false)
      showNotification('Éxito', 'Conversación asignada correctamente', 'assign-success')
    },
    onError: (error: Error) => {
      showNotification('Error', error.message || 'Error al asignar conversación', 'assign-error', undefined, 'error')
    }
  })
  
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
            {conversation.assignedTo && (
              <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>
                • Asignado a {conversation.assignedTo.split('@')[0]}
              </span>
            )}
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
          
          {/* Botón de asignar (solo para owners) */}
          {isOwner && (
            <div ref={assignMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button 
                className="whatsapp-header-icon"
                onClick={() => setShowAssignMenu(!showAssignMenu)}
                style={{
                  backgroundColor: showAssignMenu ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  color: conversation.assignedTo ? '#10b981' : undefined
                }}
                title="Asignar conversación"
              >
                {conversation.assignedTo ? <Users size={20} /> : <UserPlus size={20} />}
              </button>
              
              {showAssignMenu && (
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
                  minWidth: '220px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  <div style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280',
                    borderBottom: '1px solid #e5e7eb',
                    textTransform: 'uppercase'
                  }}>
                    Asignar a:
                  </div>
                  
                  <button
                    onClick={() => {
                      assignMutation.mutate({ assignedTo: null, notifyClient: false })
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      textAlign: 'left',
                      border: 'none',
                      background: conversation.assignedTo ? 'transparent' : '#f3f4f6',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: '#374151',
                      transition: 'background-color 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = conversation.assignedTo ? 'transparent' : '#f3f4f6'}
                    disabled={assignMutation.isPending}
                  >
                    <span>Sin asignar</span>
                  </button>
                  
                  {operatorsData?.operators.map((operator) => (
                    <button
                      key={operator.id}
                      onClick={() => {
                        assignMutation.mutate({ assignedTo: operator.email, notifyClient: true })
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        textAlign: 'left',
                        border: 'none',
                        background: conversation.assignedTo === operator.email ? '#f3f4f6' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#374151',
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        borderTop: '1px solid #e5e7eb'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = conversation.assignedTo === operator.email ? '#f3f4f6' : 'transparent'}
                      disabled={assignMutation.isPending}
                    >
                      <Users size={16} style={{ color: conversation.assignedTo === operator.email ? '#10b981' : '#9ca3af' }} />
                      <span>{operator.name}</span>
                      {conversation.assignedTo === operator.email && (
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#10b981' }}>✓</span>
                      )}
                    </button>
                  ))}
                  
                  {assignMutation.isPending && (
                    <div style={{
                      padding: '12px',
                      textAlign: 'center',
                      fontSize: '12px',
                      color: '#6b7280',
                      borderTop: '1px solid #e5e7eb'
                    }}>
                      Asignando...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
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
