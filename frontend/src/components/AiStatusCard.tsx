import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useState } from 'react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Alert } from './ui/alert'

export function AiStatusCard() {
  const queryClient = useQueryClient()
  const [isEditingLimit, setIsEditingLimit] = useState(false)
  const [newLimit, setNewLimit] = useState<string>('')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['ai-stats'],
    queryFn: () => api.ai.getStats(),
    staleTime: 30000, // 30 segundos
    refetchInterval: 60000 // Refetch cada minuto
  })

  const { data: currentLimit } = useQuery({
    queryKey: ['ai-limit'],
    queryFn: () => api.ai.getLimit(),
    staleTime: 300000 // 5 minutos
  })

  const updateLimitMutation = useMutation({
    mutationFn: (limit: number) => api.ai.setLimit(limit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-limit'] })
      queryClient.invalidateQueries({ queryKey: ['ai-stats'] })
      setIsEditingLimit(false)
      setNewLimit('')
    }
  })

  if (isLoading || !stats) {
    return (
      <Card className="p-6 bg-white border border-gray-200 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>
      </Card>
    )
  }

  const percentage = stats.limitUsd > 0 
    ? Math.min((stats.totalCostUsd / stats.limitUsd) * 100, 100) 
    : 0

  const isEnabled = !stats.isLimitExceeded
  const statusColor = isEnabled ? 'text-green-600' : 'text-red-600'
  const statusBg = isEnabled ? 'bg-green-100' : 'bg-red-100'
  const statusText = isEnabled ? 'Habilitada' : 'Deshabilitada'

  const handleSaveLimit = () => {
    const limit = parseFloat(newLimit)
    if (isNaN(limit) || limit < 0) {
      alert('Por favor ingresá un número válido mayor o igual a 0')
      return
    }
    updateLimitMutation.mutate(limit)
  }

  const handleEditLimit = () => {
    setNewLimit(currentLimit?.toString() || '50')
    setIsEditingLimit(true)
  }

  return (
    <Card className="p-6 bg-white border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold" style={{ color: '#ffffff' }}>Estado de IA</h2>
        <div className="flex items-center gap-2">
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: isEnabled ? '#16a34a' : '#dc2626'
            }}
          ></div>
          <span 
            className="text-sm font-medium"
            style={{ color: isEnabled ? '#16a34a' : '#dc2626' }}
          >
            {statusText}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Uso del mes */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm" style={{ color: '#ffffff' }}>Costo del mes</span>
            <span className="text-lg font-semibold" style={{ color: '#16a34a' }}>
              ${stats.totalCostUsd.toFixed(4)} USD
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${
                percentage >= 100 ? 'bg-red-500' : 
                percentage >= 80 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs" style={{ color: '#ffffff' }}>
              {stats.usageCount} usos • {stats.totalTokens.toLocaleString()} tokens
            </span>
            <span className="text-xs" style={{ color: '#ffffff' }}>
              Límite: ${stats.limitUsd} USD
            </span>
          </div>
        </div>

        {/* Límite mensual */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <Label htmlFor="limit" className="font-medium" style={{ color: '#ffffff' }}>Límite mensual (USD)</Label>
            {!isEditingLimit ? (
              <button
                onClick={handleEditLimit}
                style={{
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white'
                }}
              >
                Editar
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <Input
                  id="limit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  className="w-24"
                  style={{ borderColor: '#d1d5db', color: '#111827' }}
                />
                <button
                  onClick={handleSaveLimit}
                  disabled={updateLimitMutation.isPending}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    borderRadius: '0.375rem',
                    border: 'none',
                    backgroundColor: updateLimitMutation.isPending ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    cursor: updateLimitMutation.isPending ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!updateLimitMutation.isPending) {
                      e.currentTarget.style.backgroundColor = '#1d4ed8'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!updateLimitMutation.isPending) {
                      e.currentTarget.style.backgroundColor = '#2563eb'
                    }
                  }}
                >
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setIsEditingLimit(false)
                    setNewLimit('')
                  }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    borderRadius: '0.375rem',
                    border: '1px solid #d1d5db',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white'
                  }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Alerta si está deshabilitada */}
        {!isEnabled && (
          <Alert className="mt-4 bg-red-50 border border-red-200 text-red-800">
            <p className="text-sm">
              ⚠️ La IA está deshabilitada porque se superó el límite mensual de ${stats.limitUsd} USD.
              El bot usará respuestas predefinidas hasta que se reinicie el contador el próximo mes.
            </p>
          </Alert>
        )}

        {/* Alerta si está cerca del límite */}
        {isEnabled && percentage >= 80 && (
          <Alert className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800">
            <p className="text-sm">
              ⚠️ Estás cerca del límite mensual ({percentage.toFixed(1)}% usado).
              La IA se deshabilitará automáticamente al alcanzar ${stats.limitUsd} USD.
            </p>
          </Alert>
        )}
      </div>
    </Card>
  )
}

