import { useState } from 'react'
import { Search, Calendar, Download, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useFiltersStore } from '@/store/filters'
import { formatDateTime, arrayToCsv, downloadCsv, generateCsvFilename } from '@/utils/format'
import type { ConversationListItem } from '@/types/conversations'

interface ConversationFiltersProps {
  onExport?: (data: ConversationListItem[]) => void
  exportData?: ConversationListItem[]
  isLoading?: boolean
}

export function ConversationFilters({ onExport, exportData, isLoading }: ConversationFiltersProps) {
  const {
    query,
    from,
    to,
    isClient,
    needsReply,
    setQuery,
    setFrom,
    setTo,
    setIsClient,
    setNeedsReply,
    reset
  } = useFiltersStore()

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!exportData || exportData.length === 0) return
    
    setIsExporting(true)
    try {
      const csvData = exportData.map(item => ({
        telefono: item.phone,
        nombre: item.name || '',
        esCliente: item.isClient ? 'Sí' : 'No',
        ultimoMensajeISO: item.lastMessageAt,
        ultimoMensaje: formatDateTime(item.lastMessageAt),
        noLeidos: item.unreadCount,
        requiereRespuesta: item.needsReply ? 'Sí' : 'No'
      }))
      
      const csvContent = arrayToCsv(csvData)
      downloadCsv(csvContent, generateCsvFilename('conversaciones'))
      
      onExport?.(exportData)
    } catch (error) {
      console.error('Error exportando CSV:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const hasActiveFilters = query || from || to || isClient !== undefined || needsReply !== undefined

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Filter className="icon" />
          Filtros
        </div>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={reset}
            >
              <X className="icon" />
              Limpiar
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? 'Simple' : 'Avanzado'}
          </button>
        </div>
      </div>
      <div>
        {/* Búsqueda básica */}
        <div className="filters-section">
          <div className="input-with-icon">
            <Search className="input-icon" />
            <input
              type="text"
              placeholder="Buscar por teléfono o nombre..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={!exportData || exportData.length === 0 || isExporting}
            className="btn btn-primary"
          >
            <Download className="icon" />
            {isExporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>

        {/* Filtros avanzados */}
        {showAdvanced && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px' }}>
            {/* Rango de fechas */}
            <div>
              <label className="font-medium mb-2 block">Desde</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="font-medium mb-2 block">Hasta</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="input"
              />
            </div>

            {/* Estado cliente */}
            <div>
              <label className="font-medium mb-2 block">Estado</label>
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${isClient === undefined ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setIsClient(undefined)}
                >
                  Todos
                </button>
                <button
                  className={`btn btn-sm ${isClient === true ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setIsClient(true)}
                >
                  Cliente
                </button>
                <button
                  className={`btn btn-sm ${isClient === false ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setIsClient(false)}
                >
                  No Cliente
                </button>
              </div>
            </div>

            {/* Requiere respuesta */}
            <div>
              <label className="font-medium mb-2 block">Respuesta</label>
              <div className="flex gap-2">
                <button
                  className={`btn btn-sm ${needsReply === undefined ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setNeedsReply(undefined)}
                >
                  Todos
                </button>
                <button
                  className={`btn btn-sm ${needsReply === true ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setNeedsReply(true)}
                >
                  Requiere
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filtros activos */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {query && (
              <Badge variant="secondary" className="gap-1">
                Búsqueda: {query}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setQuery('')} />
              </Badge>
            )}
            {from && (
              <Badge variant="secondary" className="gap-1">
                Desde: {from}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setFrom('')} />
              </Badge>
            )}
            {to && (
              <Badge variant="secondary" className="gap-1">
                Hasta: {to}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setTo('')} />
              </Badge>
            )}
            {isClient !== undefined && (
              <Badge variant="secondary" className="gap-1">
                {isClient ? 'Cliente' : 'No Cliente'}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setIsClient(undefined)} />
              </Badge>
            )}
            {needsReply !== undefined && (
              <Badge variant="secondary" className="gap-1">
                Requiere Respuesta
                <X className="h-3 w-3 cursor-pointer" onClick={() => setNeedsReply(undefined)} />
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
