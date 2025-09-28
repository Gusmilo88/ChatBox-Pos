import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConversationDetail } from '@/components/ConversationDetail'
import { EmptyState } from '@/components/EmptyState'
import { fetchConversationDetail } from '@/services/api'

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
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
      <div className="container mx-auto p-6 h-screen">
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Botón volver */}
      <div style={{ padding: '16px 20px', background: '#202c33', borderBottom: '1px solid #2a3942' }}>
        <button
          onClick={handleBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <ArrowLeft className="icon" />
          Volver
        </button>
      </div>
      
      {/* Chat */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ConversationDetail
          conversation={conversation}
          isLoading={false}
        />
      </div>
    </div>
  )
}
