import { useQuery } from '@tanstack/react-query'
import { useFiltersStore } from '@/store/filters'
import { fetchConversations } from '@/services/api'
import { ConversationTable } from '@/components/ConversationTable'
import { ConversationFilters } from '@/components/ConversationFilters'
import { EmptyState } from '@/components/EmptyState'
import { AiStatusCard } from '@/components/AiStatusCard'
import { StatsCard } from '@/components/StatsCard'
import { Tabs } from '@/components/Tabs'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { MessageSquare, BarChart3, LogOut } from 'lucide-react'

export function ConversationsPage() {
  const navigate = useNavigate()
  const { page, setPage, ...filters } = useFiltersStore()
  const [activeTab, setActiveTab] = useState<'conversations' | 'stats'>('conversations')
  const { logout } = useAuth()
  
  const {
    data: conversationsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['conversations', filters, page],
    queryFn: () => fetchConversations({ ...filters, page }),
    staleTime: 30000, // 30 segundos
    refetchInterval: 60000, // Refetch cada minuto
  })

  // Notificaciones de mensajes nuevos
  useEffect(() => {
    // Solicitar permiso para notificaciones
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Verificar mensajes que necesitan respuesta
    if (conversationsData?.conversations) {
      const needsReply = conversationsData.conversations.filter(c => c.needsReply)
      const unreadCount = conversationsData.conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)

      if (needsReply.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
        // Solo notificar si hay mensajes nuevos (no spam)
        const lastNotification = localStorage.getItem('lastNotification')
        const now = Date.now()
        
        if (!lastNotification || (now - parseInt(lastNotification)) > 30000) { // 30 segundos entre notificaciones
          new Notification('Mensajes que necesitan respuesta', {
            body: `${needsReply.length} conversación${needsReply.length > 1 ? 'es' : ''} necesita${needsReply.length > 1 ? 'n' : ''} respuesta`,
            icon: '/vite.svg',
            tag: 'needs-reply',
            requireInteraction: false
          })
          localStorage.setItem('lastNotification', now.toString())
        }
      }

      // Actualizar título de la página con contador
      if (unreadCount > 0) {
        document.title = `(${unreadCount}) Conversaciones - POS & Asociados`
      } else {
        document.title = 'Conversaciones - POS & Asociados'
      }
    }

    return () => {
      document.title = 'Conversaciones - POS & Asociados'
    }
  }, [conversationsData])

  const handleConversationClick = (id: string) => {
    navigate(`/c/${id}`)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleExport = (data: any[]) => {
    console.log('Exportado:', data.length, 'conversaciones')
  }

  // Sincronizar filtros con URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlQuery = urlParams.get('query') || ''
    const urlFrom = urlParams.get('from') || ''
    const urlTo = urlParams.get('to') || ''
    const urlIsClient = urlParams.get('isClient')
    const urlNeedsReply = urlParams.get('needsReply')
    
    if (urlQuery !== filters.query || 
        urlFrom !== filters.from || 
        urlTo !== filters.to ||
        (urlIsClient ? urlIsClient === 'true' : undefined) !== filters.isClient ||
        (urlNeedsReply ? urlNeedsReply === 'true' : undefined) !== filters.needsReply) {
      
      const store = useFiltersStore.getState()
      if (urlQuery !== store.query) store.setQuery(urlQuery)
      if (urlFrom !== store.from) store.setFrom(urlFrom)
      if (urlTo !== store.to) store.setTo(urlTo)
      if ((urlIsClient ? urlIsClient === 'true' : undefined) !== store.isClient) {
        store.setIsClient(urlIsClient ? urlIsClient === 'true' : undefined)
      }
      if ((urlNeedsReply ? urlNeedsReply === 'true' : undefined) !== store.needsReply) {
        store.setNeedsReply(urlNeedsReply ? urlNeedsReply === 'true' : undefined)
      }
    }
  }, [])

  // Actualizar URL cuando cambien los filtros
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.query) params.set('query', filters.query)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.isClient !== undefined) params.set('isClient', filters.isClient.toString())
    if (filters.needsReply !== undefined) params.set('needsReply', filters.needsReply.toString())
    
    const newUrl = params.toString() ? `?${params.toString()}` : '/'
    window.history.replaceState({}, '', newUrl)
  }, [filters])

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <EmptyState
          type="error"
          title="Error de conexión"
          description="No se pudo cargar la lista de conversaciones. Verificá tu conexión e intentá de nuevo."
          action={{
            label: "Reintentar",
            onClick: () => refetch()
          }}
        />
      </div>
    )
  }

  const hasResults = conversationsData && conversationsData.conversations.length > 0

  const tabs = [
    {
      id: 'conversations',
      label: 'Conversaciones',
      icon: <MessageSquare size={18} />
    },
    {
      id: 'stats',
      label: 'Estadísticas',
      icon: <BarChart3 size={18} />
    }
  ]

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ flex: 1 }}>
          <h1>Dashboard de Estudio Pos & Asociados</h1>
          <p className="subtitle">
            Gestioná las conversaciones de WhatsApp con clientes y leads
          </p>
        </div>
        <div style={{ marginLeft: '24px', flexShrink: 0, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <ThemeToggle />
          <button
            onClick={logout}
            className="logout-button"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              background: '#ef4444',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              fontWeight: '600',
              fontSize: '14px',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#dc2626'
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ef4444'
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)'
            }}
            title="Cerrar sesión"
          >
            <LogOut size={18} />
            Salir
          </button>
        </div>
      </div>

      {/* Tarjeta de estado de IA - Siempre visible */}
      <div className="mb-6">
        <AiStatusCard />
      </div>

      {/* Sistema de pestañas */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as 'conversations' | 'stats')}
      >
        {activeTab === 'conversations' ? (
          <>
            <ConversationFilters
              exportData={conversationsData?.conversations}
              isLoading={isLoading}
              onExport={handleExport}
            />

            {isLoading && !conversationsData ? (
              <LoadingSpinner size="lg" text="Cargando conversaciones..." />
            ) : !hasResults ? (
              <EmptyState
                type="no-results"
                title="Sin resultados"
                description="No se encontraron conversaciones con los filtros aplicados. Intentá ajustar los criterios de búsqueda."
                action={{
                  label: "Limpiar filtros",
                  onClick: () => {
                    const store = useFiltersStore.getState()
                    store.reset()
                  }
                }}
              />
            ) : (
              <ConversationTable
                conversations={conversationsData!.conversations}
                total={conversationsData!.total}
                page={conversationsData!.page}
                pageSize={conversationsData!.pageSize}
                onPageChange={handlePageChange}
                onConversationClick={handleConversationClick}
                isLoading={isLoading}
              />
            )}
          </>
        ) : (
          <StatsCard />
        )}
      </Tabs>
    </div>
  )
}
