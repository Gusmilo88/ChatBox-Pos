import { useQuery } from '@tanstack/react-query'
import { useFiltersStore } from '@/store/filters'
import { fetchConversations } from '@/services/api'
import { ConversationTable } from '@/components/ConversationTable'
import { ConversationFilters } from '@/components/ConversationFilters'
import { EmptyState } from '@/components/EmptyState'
import { AiStatusCard } from '@/components/AiStatusCard'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export function ConversationsPage() {
  const navigate = useNavigate()
  const { page, setPage, ...filters } = useFiltersStore()
  
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

  return (
    <div className="container">
      <div>
        <h1>Conversaciones</h1>
        <p className="subtitle">
          Gestioná las conversaciones de WhatsApp con clientes y leads
        </p>
      </div>

      {/* Tarjeta de estado de IA */}
      <div className="mb-6">
        <AiStatusCard />
      </div>

      <ConversationFilters
        exportData={conversationsData?.conversations}
        isLoading={isLoading}
        onExport={handleExport}
      />

      {isLoading && !conversationsData ? (
        <EmptyState
          type="loading"
          title="Cargando conversaciones..."
          description="Obteniendo la lista de conversaciones..."
        />
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
    </div>
  )
}
