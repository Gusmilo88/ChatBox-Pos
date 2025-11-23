import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'
import { Users, MessageSquare, AlertCircle, TrendingUp, Calendar, Info } from 'lucide-react'

export function StatsCard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['conversation-stats'],
    queryFn: () => api.stats.getConversations(),
    staleTime: 30000,
    refetchInterval: 60000
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: '120px', backgroundColor: '#e5e7eb', borderRadius: '8px' }}></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      label: 'Total',
      value: stats.total,
      icon: MessageSquare,
      iconBg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      valueColor: '#3b82f6',
      cardBg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(255, 255, 255, 0.9) 100%)',
      borderColor: 'rgba(59, 130, 246, 0.3)'
    },
    {
      label: 'Clientes',
      value: stats.clients,
      icon: Users,
      iconBg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      valueColor: '#10b981',
      cardBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(255, 255, 255, 0.9) 100%)',
      borderColor: 'rgba(16, 185, 129, 0.3)'
    },
    {
      label: 'Leads',
      value: stats.leads,
      icon: TrendingUp,
      iconBg: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
      valueColor: '#8b5cf6',
      cardBg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(255, 255, 255, 0.9) 100%)',
      borderColor: 'rgba(139, 92, 246, 0.3)',
      tooltip: 'Leads: personas que no son clientes pero mostraron interés'
    },
    {
      label: 'Necesitan respuesta',
      value: stats.needsReply,
      icon: AlertCircle,
      iconBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      valueColor: '#ef4444',
      cardBg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(255, 255, 255, 0.9) 100%)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      urgent: stats.needsReply > 0
    }
  ]

  const timeStats = [
    { label: 'Hoy', value: stats.today, icon: Calendar },
    { label: 'Esta semana', value: stats.thisWeek, icon: Calendar },
    { label: 'Este mes', value: stats.thisMonth, icon: TrendingUp }
  ]

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (min-width: 768px) {
          .stats-grid-responsive {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
      <div style={{ 
        padding: '24px', 
        backgroundColor: 'white', 
        borderRadius: '16px', 
        border: '1px solid #e5e7eb',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          marginBottom: '24px',
          gap: '16px'
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              color: '#111827',
              marginBottom: '4px',
              lineHeight: '1.2',
              margin: 0
            }}>
              Estadísticas
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: '#6b7280',
              margin: 0
            }}>
              Resumen de conversaciones y actividad
            </p>
          </div>
          {stats.needsReply > 0 && (
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
              border: '2px solid #fca5a5',
              alignSelf: 'flex-start'
            }}>
              <AlertCircle size={18} color="#dc2626" />
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#dc2626'
              }}>
                {stats.needsReply} pendiente{stats.needsReply > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Tarjetas principales - Grid responsive */}
        <div 
          className="stats-grid-responsive"
          style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px',
            marginBottom: '32px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {statCards.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div
                key={index}
                style={{ 
                  padding: '20px',
                  borderRadius: '16px',
                  border: `2px solid ${stat.borderColor}`,
                  background: stat.cardBg,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s ease',
                  width: '100%',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
                title={stat.tooltip}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <div style={{ 
                    padding: '12px',
                    borderRadius: '12px',
                    background: stat.iconBg,
                    boxShadow: `0 4px 14px 0 ${stat.valueColor}40`
                  }}>
                    <Icon size={24} color="white" />
                  </div>
                  {stat.urgent && (
                    <div style={{ 
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: stat.valueColor,
                      boxShadow: `0 0 8px ${stat.valueColor}`,
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }}></div>
                  )}
                </div>
                <div style={{ 
                  fontSize: '36px',
                  fontWeight: '700',
                  color: stat.valueColor,
                  marginBottom: '8px',
                  lineHeight: '1'
                }}>
                  {stat.value}
                </div>
                <div style={{ 
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: stat.tooltip ? '8px' : '0'
                }}>
                  {stat.label}
                </div>
                {stat.tooltip && (
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                    marginTop: '8px'
                  }}>
                    <Info size={14} color="#9ca3af" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ 
                      fontSize: '12px',
                      color: '#6b7280',
                      lineHeight: '1.4'
                    }}>
                      {stat.tooltip}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Estadísticas por tiempo */}
        <div style={{ 
          paddingTop: '24px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px'
          }}>
            <div style={{ 
              padding: '8px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
            }}>
              <Calendar size={18} color="white" />
            </div>
            <h3 style={{ 
              fontSize: '16px',
              fontWeight: '700',
              color: '#111827',
              margin: 0
            }}>
              Actividad
            </h3>
          </div>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px'
          }}>
            {timeStats.map((timeStat, index) => {
              const Icon = timeStat.icon
              const isToday = index === 0
              return (
                <div 
                  key={index} 
                  style={{ 
                    textAlign: 'center',
                    padding: '16px',
                    borderRadius: '12px',
                    background: isToday 
                      ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)'
                      : 'rgba(249, 250, 251, 0.8)',
                    border: isToday ? '2px solid rgba(59, 130, 246, 0.2)' : '1px solid #e5e7eb',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px'
                  }}>
                    <div style={{ 
                      padding: '8px',
                      borderRadius: '8px',
                      background: isToday 
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : 'rgba(107, 114, 128, 0.1)'
                    }}>
                      <Icon size={16} color={isToday ? "white" : "#6b7280"} />
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: '28px',
                    fontWeight: '700',
                    color: isToday ? '#3b82f6' : '#111827',
                    marginBottom: '4px',
                    lineHeight: '1'
                  }}>
                    {timeStat.value}
                  </div>
                  <div style={{ 
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280'
                  }}>
                    {timeStat.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
