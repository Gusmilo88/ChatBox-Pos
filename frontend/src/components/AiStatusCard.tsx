import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useState } from 'react'
import { Sparkles, DollarSign, Zap, AlertTriangle, Edit2, Check, X } from 'lucide-react'

export function AiStatusCard() {
  const queryClient = useQueryClient()
  const [isEditingLimit, setIsEditingLimit] = useState(false)
  const [newLimit, setNewLimit] = useState<string>('')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['ai-stats'],
    queryFn: () => api.ai.getStats(),
    staleTime: 30000,
    refetchInterval: 60000
  })

  const { data: currentLimit } = useQuery({
    queryKey: ['ai-limit'],
    queryFn: () => api.ai.getLimit(),
    staleTime: 300000
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
      <div style={{ 
        padding: '24px', 
        backgroundColor: 'white', 
        borderRadius: '16px', 
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
          <div style={{ height: '24px', backgroundColor: '#e5e7eb', borderRadius: '4px', width: '25%', marginBottom: '16px' }}></div>
          <div style={{ height: '120px', backgroundColor: '#e5e7eb', borderRadius: '8px' }}></div>
        </div>
      </div>
    )
  }

  const percentage = stats.limitUsd > 0 
    ? Math.min((stats.totalCostUsd / stats.limitUsd) * 100, 100) 
    : 0

  const isEnabled = !stats.isLimitExceeded
  const progressColor = percentage >= 100 
    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
    : percentage >= 80 
    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)'

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
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
      `}</style>
      <div style={{ 
        padding: '24px', 
        backgroundColor: 'white', 
        borderRadius: '16px', 
        border: '1px solid #e5e7eb',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        width: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Efecto de gradiente sutil en el fondo */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #8b5cf6 0%, #3b82f6 50%, #8b5cf6 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s ease-in-out infinite'
        }}></div>

        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '24px',
          paddingTop: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '12px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              boxShadow: '0 4px 14px 0 rgba(139, 92, 246, 0.4)'
            }}>
              <Sparkles size={24} color="white" />
            </div>
            <div>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '700', 
                color: '#111827',
                margin: 0,
                lineHeight: '1.2'
              }}>
                Estado de IA
              </h2>
              <p style={{ 
                fontSize: '13px', 
                color: '#6b7280',
                margin: '2px 0 0 0'
              }}>
                Control de uso y costos
              </p>
            </div>
          </div>
          
          {/* Badge de estado */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '9999px',
            background: isEnabled 
              ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
              : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            border: `2px solid ${isEnabled ? '#10b981' : '#ef4444'}`,
            boxShadow: `0 2px 8px ${isEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isEnabled ? '#10b981' : '#ef4444',
              boxShadow: `0 0 8px ${isEnabled ? '#10b981' : '#ef4444'}`,
              animation: isEnabled ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
            }}></div>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: isEnabled ? '#065f46' : '#991b1b'
            }}>
              {isEnabled ? 'Habilitada' : 'Deshabilitada'}
            </span>
          </div>
        </div>

        {/* Grid de métricas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Costo del mes */}
          <div style={{
            padding: '20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(255, 255, 255, 0.9) 100%)',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 12px -2px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                padding: '10px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.4)'
              }}>
                <DollarSign size={20} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Costo del mes
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981', lineHeight: '1' }}>
                  ${stats.totalCostUsd.toFixed(4)}
                </div>
              </div>
            </div>
          </div>

          {/* Uso */}
          <div style={{
            padding: '20px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(255, 255, 255, 0.9) 100%)',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 12px -2px rgba(0, 0, 0, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
          }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                padding: '10px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.4)'
              }}>
                <Zap size={20} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Uso
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6', lineHeight: '1' }}>
                  {stats.usageCount}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  {stats.totalTokens.toLocaleString()} tokens
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra de progreso premium */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
              Progreso del límite
            </span>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: '700', 
              color: percentage >= 80 ? '#ef4444' : '#10b981'
            }}>
              {percentage.toFixed(1)}%
            </span>
          </div>
          
          <div style={{
            width: '100%',
            height: '12px',
            backgroundColor: '#e5e7eb',
            borderRadius: '9999px',
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
            position: 'relative'
          }}>
            <div
              style={{
                height: '100%',
                borderRadius: '9999px',
                background: progressColor,
                width: `${percentage}%`,
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 0 12px ${percentage >= 100 ? 'rgba(239, 68, 68, 0.5)' : percentage >= 80 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(16, 185, 129, 0.5)'}`,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                animation: 'shimmer 2s infinite'
              }}></div>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginTop: '8px'
          }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              ${stats.totalCostUsd.toFixed(4)} de ${stats.limitUsd} USD
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '600' }}>
              Restante: ${(stats.limitUsd - stats.totalCostUsd).toFixed(4)} USD
            </span>
          </div>
        </div>

        {/* Límite mensual */}
        <div style={{
          paddingTop: '20px',
          borderTop: '2px solid #e5e7eb'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} color="#6b7280" />
              <label style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151'
              }}>
                Límite mensual (USD)
              </label>
            </div>
            
            {!isEditingLimit ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ 
                  fontSize: '18px', 
                  fontWeight: '700', 
                  color: '#111827',
                  padding: '8px 16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  ${currentLimit || stats.limitUsd}
                </span>
                <button
                  onClick={handleEditLimit}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <Edit2 size={16} />
                  Editar
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <DollarSign 
                    size={18} 
                    color="#9ca3af" 
                    style={{ 
                      position: 'absolute', 
                      left: '12px', 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none'
                    }} 
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newLimit}
                    onChange={(e) => setNewLimit(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleSaveLimit()
                      if (e.key === 'Escape') {
                        setIsEditingLimit(false)
                        setNewLimit('')
                      }
                    }}
                    style={{
                      padding: '8px 16px 8px 40px',
                      fontSize: '16px',
                      fontWeight: '600',
                      borderRadius: '8px',
                      border: '2px solid #3b82f6',
                      backgroundColor: 'white',
                      color: '#111827',
                      width: '120px',
                      outline: 'none',
                      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                    }}
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleSaveLimit}
                  disabled={updateLimitMutation.isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    background: updateLimitMutation.isPending 
                      ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    cursor: updateLimitMutation.isPending ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!updateLimitMutation.isPending) {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!updateLimitMutation.isPending) {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }
                  }}
                >
                  <Check size={16} />
                  Guardar
                </button>
                <button
                  onClick={() => {
                    setIsEditingLimit(false)
                    setNewLimit('')
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fef2f2'
                    e.currentTarget.style.borderColor = '#fca5a5'
                    e.currentTarget.style.color = '#dc2626'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white'
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.color = '#374151'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <X size={16} />
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Alertas premium */}
        {!isEnabled && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            border: '2px solid #fca5a5',
            boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <div style={{
              padding: '8px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              flexShrink: 0
            }}>
              <AlertTriangle size={20} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#991b1b', marginBottom: '4px' }}>
                IA Deshabilitada
              </div>
              <div style={{ fontSize: '13px', color: '#7f1d1d', lineHeight: '1.5' }}>
                Se superó el límite mensual de ${stats.limitUsd} USD. El bot usará respuestas predefinidas hasta que se reinicie el contador el próximo mes.
              </div>
            </div>
          </div>
        )}

        {isEnabled && percentage >= 80 && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '2px solid #fcd34d',
            boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <div style={{
              padding: '8px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              flexShrink: 0
            }}>
              <AlertTriangle size={20} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#92400e', marginBottom: '4px' }}>
                Cerca del límite
              </div>
              <div style={{ fontSize: '13px', color: '#78350f', lineHeight: '1.5' }}>
                Estás al {percentage.toFixed(1)}% del límite mensual. La IA se deshabilitará automáticamente al alcanzar ${stats.limitUsd} USD.
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

