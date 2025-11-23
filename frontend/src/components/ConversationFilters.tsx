import { useState, useEffect, useRef } from 'react'
import { Search, Calendar, Download, Filter, X, FileText, FileSpreadsheet, File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useFiltersStore } from '@/store/filters'
import { formatDateTime, arrayToCsv, downloadCsv, generateCsvFilename } from '@/utils/format'
import { exportConversationsToPDF, exportConversationsToExcel } from '@/utils/export'
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
  const [showExportMenu, setShowExportMenu] = useState(false)
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

  const handleExportCSV = async () => {
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
      setShowExportMenu(false)
    }
  }

  const handleExportPDF = async () => {
    if (!exportData || exportData.length === 0) return
    
    setIsExporting(true)
    try {
      exportConversationsToPDF(exportData)
      onExport?.(exportData)
    } catch (error) {
      console.error('Error exportando PDF:', error)
    } finally {
      setIsExporting(false)
      setShowExportMenu(false)
    }
  }

  const handleExportExcel = async () => {
    if (!exportData || exportData.length === 0) return
    
    setIsExporting(true)
    try {
      exportConversationsToExcel(exportData)
      onExport?.(exportData)
    } catch (error) {
      console.error('Error exportando Excel:', error)
    } finally {
      setIsExporting(false)
      setShowExportMenu(false)
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
          <div ref={exportMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!exportData || exportData.length === 0 || isExporting}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Download className="icon" />
              {isExporting ? 'Exportando...' : 'Exportar'}
            </button>
            
            {showExportMenu && !isExporting && (
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
                  onClick={handleExportCSV}
                  disabled={!exportData || exportData.length === 0}
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
                  <File size={18} />
                  <span>Exportar CSV</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={!exportData || exportData.length === 0}
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
                  <FileText size={18} />
                  <span>Exportar PDF</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={!exportData || exportData.length === 0}
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
