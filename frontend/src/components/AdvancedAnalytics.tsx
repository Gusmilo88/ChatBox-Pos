import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { api } from '@/services/api'
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'
import { Clock, MessageSquare, TrendingUp, Users, Zap, Activity, AlertCircle } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'

const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  accent: '#8b5cf6',
  danger: '#ef4444',
  warning: '#f59e0b'
}

// Componente wrapper para gráficos que espera a que el DOM esté listo
function ChartWrapper({ 
  children, 
  height 
}: { 
  children: React.ReactNode
  height: number 
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Esperar a que el componente esté completamente montado
    const timer = setTimeout(() => setMounted(true), 150)
    return () => clearTimeout(timer)
  }, [])

  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: `${height}px`,
        color: '#6b7280'
      }}>
        <LoadingSpinner text="Cargando gráfico..." />
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      {children}
    </div>
  )
}

export function AdvancedAnalytics() {
  const [isComponentReady, setIsComponentReady] = useState(false)

  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['advanced-analytics'],
    queryFn: async () => {
      // Agregar timeout de 30 segundos
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: La solicitud tardó demasiado')), 30000)
      )
      const dataPromise = api.stats.getAdvanced()
      return Promise.race([dataPromise, timeoutPromise]) as Promise<any>
    },
    staleTime: 60000, // 1 minuto
    refetchInterval: 300000, // 5 minutos
    retry: 1, // Solo reintentar una vez
    retryDelay: 2000
  })

  // Asegurar que el componente esté completamente montado antes de renderizar gráficos
  useEffect(() => {
    // Esperar a que el componente esté montado y React esté listo
    const timer = setTimeout(() => setIsComponentReady(true), 250)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div style={{ 
        padding: '60px 24px', 
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid #e5e7eb'
      }}>
        <LoadingSpinner text="Cargando analytics..." />
        <p style={{ 
          marginTop: '16px',
          fontSize: '14px',
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          Esto puede tardar unos segundos, por favor esperá...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid #e5e7eb'
      }}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
        <p style={{ color: '#ef4444', fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          Error al cargar analytics
        </p>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          {(error as Error).message || 'No se pudieron cargar los datos. Intentá recargar la página.'}
        </p>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div style={{ 
        padding: '60px 24px', 
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid #e5e7eb'
      }}>
        <LoadingSpinner text="Cargando analytics..." />
        <p style={{ 
          marginTop: '16px',
          fontSize: '14px',
          color: '#6b7280',
          fontStyle: 'italic'
        }}>
          Esto puede tardar unos segundos, por favor esperá...
        </p>
      </div>
    )
  }

  // Validar y preparar datos de forma segura
  const conversationsByDay = (analytics?.conversationsByDay || []).map((item: any) => {
    try {
      const date = item.date ? new Date(item.date) : new Date()
      return {
        date: date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' }),
        count: Number(item.count) || 0,
        clients: Number(item.clients) || 0,
        leads: Number(item.leads) || 0
      }
    } catch {
      return { date: '', count: 0, clients: 0, leads: 0 }
    }
  }).filter(item => item.date) // Filtrar items inválidos

  const conversationsByHour = (analytics?.conversationsByHour || []).map((item: any) => ({
    hour: Number(item.hour) || 0,
    count: Number(item.count) || 0
  })).filter(item => item.hour >= 0 && item.hour < 24)

  // Datos para gráfico de distribución de mensajes
  const messageDistributionData = [
    { name: 'Entrantes', value: Number(analytics?.messageDistribution?.incoming) || 0, color: COLORS.primary },
    { name: 'Salientes', value: Number(analytics?.messageDistribution?.outgoing) || 0, color: COLORS.secondary }
  ].filter(item => item.value > 0)

  // Datos para gráfico de uso de bot
  const botUsageData = [
    { name: 'IA', value: Number(analytics?.botUsage?.ai) || 0, color: COLORS.accent },
    { name: 'FSM', value: Number(analytics?.botUsage?.fsm) || 0, color: COLORS.warning }
  ].filter(item => item.value > 0)

  // Validar que haya al menos algunos datos
  const hasValidData = conversationsByDay.length > 0 || 
                       conversationsByHour.length > 0 || 
                       messageDistributionData.length > 0 || 
                       botUsageData.length > 0 ||
                       (analytics?.topConversations && analytics.topConversations.length > 0)

  if (!hasValidData) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '1px solid #e5e7eb'
      }}>
        <AlertCircle size={48} color="#f59e0b" style={{ marginBottom: '16px' }} />
        <p style={{ color: '#f59e0b', fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
          No hay datos disponibles
        </p>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Aún no hay suficientes datos para mostrar analytics. Los gráficos aparecerán cuando haya más actividad.
        </p>
      </div>
    )
  }


  // Formatear tiempo de respuesta
  const formatResponseTime = (minutes: number) => {
    if (minutes < 1) return `${Math.round(minutes * 60)}s`
    if (minutes < 60) return `${Math.round(minutes)}min`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h ${mins}min`
  }

  return (
    <div style={{ 
      padding: '24px', 
      backgroundColor: 'white', 
      borderRadius: '16px', 
      border: '1px solid #e5e7eb',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }}>
      <style>{`
        .dark .advanced-analytics-card {
          background: #1e293b !important;
          border-color: #334155 !important;
        }
        .dark .advanced-analytics-title {
          color: #f1f5f9 !important;
        }
        .dark .advanced-analytics-text {
          color: #cbd5e1 !important;
        }
        .dark .advanced-analytics-label {
          color: #94a3b8 !important;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 className="advanced-analytics-title" style={{ 
          fontSize: '28px', 
          fontWeight: '700', 
          color: '#111827',
          marginBottom: '8px',
          margin: '0 0 8px 0'
        }}>
          Analytics Avanzados
        </h2>
        <p className="advanced-analytics-text" style={{ 
          fontSize: '14px', 
          color: '#6b7280',
          margin: '0 0 16px 0',
          lineHeight: '1.6'
        }}>
          Métricas detalladas y gráficos de rendimiento
        </p>
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#eff6ff',
          borderRadius: '12px',
          border: '1px solid #bfdbfe',
          marginBottom: '8px'
        }}>
          <p className="advanced-analytics-text" style={{ 
            fontSize: '14px', 
            color: '#1e40af',
            margin: 0,
            lineHeight: '1.6'
          }}>
            <strong style={{ color: '#1e3a8a' }}>¿Qué estás viendo?</strong> Esta sección te muestra información detallada sobre cómo funciona tu sistema de atención al cliente. Aquí podés ver cuántas conversaciones tenés, cuánto tardás en responder, qué tan activo está tu bot, y mucho más. Todo está explicado de forma simple para que puedas entenderlo fácilmente.
          </p>
        </div>
      </div>

      {/* Métricas principales */}
      <div style={{ marginBottom: '24px' }}>
        <h3 className="advanced-analytics-title" style={{ 
          fontSize: '20px', 
          fontWeight: '600', 
          color: '#111827',
          marginBottom: '8px'
        }}>
          ⏱️ Tiempos de Respuesta
        </h3>
        <p className="advanced-analytics-text" style={{ 
          fontSize: '13px', 
          color: '#6b7280',
          marginBottom: '16px',
          lineHeight: '1.5'
        }}>
          Estos números muestran cuánto tiempo promedio tardás en responder a tus clientes. <strong>Mientras más bajo sea el número, mejor.</strong> Por ejemplo, si dice "5min" significa que en promedio respondés en 5 minutos. Esto te ayuda a saber si estás siendo rápido o si necesitás mejorar.
        </p>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <MetricCard
            icon={Clock}
            label="Tiempo promedio de respuesta"
            value={formatResponseTime(analytics.averageResponseTime || 0)}
            color={COLORS.primary}
            description="El tiempo promedio que tardás en responder desde que un cliente envía un mensaje hasta que le respondés."
          />
          <MetricCard
            icon={Zap}
            label="Respuesta hoy"
            value={formatResponseTime(analytics.responseTimeByPeriod?.today || 0)}
            color={COLORS.secondary}
            description="El tiempo promedio de respuesta solo de hoy. Te muestra cómo estás respondiendo en este momento."
          />
          <MetricCard
            icon={TrendingUp}
            label="Respuesta esta semana"
            value={formatResponseTime(analytics.responseTimeByPeriod?.thisWeek || 0)}
            color={COLORS.accent}
            description="El tiempo promedio de respuesta de toda esta semana. Te da una idea de cómo fue tu rendimiento semanal."
          />
          <MetricCard
            icon={Activity}
            label="Respuesta este mes"
            value={formatResponseTime(analytics.responseTimeByPeriod?.thisMonth || 0)}
            color={COLORS.warning}
            description="El tiempo promedio de respuesta de todo este mes. Te muestra tu rendimiento general del mes."
          />
        </div>
      </div>

      {/* Gráfico de conversaciones por día */}
      {conversationsByDay.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 className="advanced-analytics-title" style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#111827',
            marginBottom: '8px'
          }}>
            📊 Conversaciones por día (últimos 30 días)
          </h3>
          <p className="advanced-analytics-text" style={{ 
            fontSize: '13px', 
            color: '#6b7280',
            marginBottom: '16px',
            lineHeight: '1.5'
          }}>
            Este gráfico muestra cuántas conversaciones tuviste cada día en el último mes. <strong>La línea azul</strong> muestra el total de conversaciones, <strong>la línea verde</strong> son clientes (personas que ya trabajan con vos), y <strong>la línea morada</strong> son leads (personas interesadas que aún no son clientes). Podés ver qué días fueron más activos y cómo va cambiando tu actividad.
          </p>
          <div style={{ 
            padding: '20px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            minHeight: '300px',
            width: '100%'
          }}>
            {isComponentReady && conversationsByDay.length > 0 ? (
              <ChartWrapper height={300}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={conversationsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke={COLORS.primary} 
                    strokeWidth={2}
                    name="Total"
                    dot={{ fill: COLORS.primary, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="clients" 
                    stroke={COLORS.secondary} 
                    strokeWidth={2}
                    name="Clientes"
                    dot={{ fill: COLORS.secondary, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    stroke={COLORS.accent} 
                    strokeWidth={2}
                    name="Leads"
                    dot={{ fill: COLORS.accent, r: 4 }}
                  />
                  </LineChart>
                </ResponsiveContainer>
              </ChartWrapper>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '300px',
                color: '#6b7280'
              }}>
                No hay datos disponibles
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gráficos en grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Conversaciones por hora */}
        {conversationsByHour.length > 0 && (
          <div>
            <h3 className="advanced-analytics-title" style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#111827',
              marginBottom: '8px'
            }}>
              🕐 Actividad por hora del día
            </h3>
            <p className="advanced-analytics-text" style={{ 
              fontSize: '13px', 
              color: '#6b7280',
              marginBottom: '16px',
              lineHeight: '1.5'
            }}>
              Este gráfico te muestra a qué horas del día recibís más mensajes. Las barras más altas indican horas con más actividad. <strong>Esto te ayuda a saber cuándo tus clientes están más activos</strong> y cuándo deberías estar más atento para responder rápido.
            </p>
            <div style={{ 
              padding: '20px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              minHeight: '250px',
              width: '100%'
            }}>
              {isComponentReady && conversationsByHour.length > 0 ? (
                <ChartWrapper height={250}>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={conversationsByHour}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="hour" 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      style={{ fontSize: '12px' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '250px',
                  color: '#6b7280'
                }}>
                  No hay datos disponibles
                </div>
              )}
            </div>
          </div>
        )}

        {/* Distribución de mensajes */}
        {messageDistributionData.length > 0 && (
          <div>
            <h3 className="advanced-analytics-title" style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#111827',
              marginBottom: '8px'
            }}>
              💬 Distribución de mensajes
            </h3>
            <p className="advanced-analytics-text" style={{ 
              fontSize: '13px', 
              color: '#6b7280',
              marginBottom: '16px',
              lineHeight: '1.5'
            }}>
              Este gráfico circular muestra la proporción entre mensajes que recibís (entrantes) y mensajes que envías (salientes). <strong>Te ayuda a entender el balance de la conversación:</strong> si recibís muchos mensajes pero respondés pocos, o si hay un buen equilibrio entre lo que recibís y lo que respondés.
            </p>
            <div style={{ 
              padding: '20px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              minHeight: '250px',
              width: '100%'
            }}>
              {isComponentReady && messageDistributionData.length > 0 ? (
                <ChartWrapper height={250}>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={messageDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {messageDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartWrapper>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '250px',
                    color: '#6b7280'
                  }}>
                    No hay datos disponibles
                  </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Uso de bot y top conversaciones */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px'
      }}>
        {/* Uso de bot */}
        {botUsageData.length > 0 && (
          <div>
            <h3 className="advanced-analytics-title" style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#111827',
              marginBottom: '8px'
            }}>
              🤖 Uso de Bot (IA vs FSM)
            </h3>
            <p className="advanced-analytics-text" style={{ 
              fontSize: '13px', 
              color: '#6b7280',
              marginBottom: '16px',
              lineHeight: '1.5'
            }}>
              Este gráfico muestra qué tipo de respuesta está usando tu bot. <strong>IA (Inteligencia Artificial)</strong> significa que el bot está usando inteligencia artificial para responder de forma más natural y contextual. <strong>FSM (Máquina de Estados Finitos)</strong> significa que está usando respuestas predefinidas. <strong>Mientras más IA uses, más inteligente y personalizado será el bot.</strong>
            </p>
            <div style={{ 
              padding: '20px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              minHeight: '200px',
              width: '100%'
            }}>
              {isComponentReady && botUsageData.length > 0 ? (
                <ChartWrapper height={200}>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={botUsageData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {botUsageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartWrapper>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '200px',
                    color: '#6b7280'
                  }}>
                    No hay datos disponibles
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Top conversaciones */}
        <div>
          <h3 className="advanced-analytics-title" style={{ 
            fontSize: '18px', 
            fontWeight: '600', 
            color: '#111827',
            marginBottom: '8px'
          }}>
            🔝 Conversaciones más activas
          </h3>
          <p className="advanced-analytics-text" style={{ 
            fontSize: '13px', 
            color: '#6b7280',
            marginBottom: '16px',
            lineHeight: '1.5'
          }}>
            Esta lista muestra las 10 conversaciones con más mensajes. <strong>Te ayuda a identificar a tus clientes o leads más activos,</strong> aquellos con quienes tenés más intercambio. Podés ver si son clientes (ya trabajan con vos) o leads (personas interesadas). El número muestra cuántos mensajes tiene esa conversación.
          </p>
          <div style={{ 
            padding: '20px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            {analytics.topConversations && analytics.topConversations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analytics.topConversations.map((conv: any, index: number) => (
                  <div 
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '4px'
                      }}>
                        {conv.name || conv.phone}
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {conv.isClient ? (
                          <>
                            <Users size={12} />
                            Cliente
                          </>
                        ) : (
                          <>
                            <TrendingUp size={12} />
                            Lead
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: COLORS.primary + '20',
                      borderRadius: '8px'
                    }}>
                      <MessageSquare size={14} color={COLORS.primary} />
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: COLORS.primary
                      }}>
                        {conv.messageCount}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="advanced-analytics-text" style={{ 
                textAlign: 'center', 
                color: '#6b7280',
                margin: '20px 0'
              }}>
                No hay datos disponibles
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  color,
  description
}: { 
  icon: any
  label: string
  value: string
  color: string
  description?: string
}) {
  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '12px',
      border: `2px solid ${color}20`,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        marginBottom: '12px'
      }}>
        <div style={{
          padding: '10px',
          borderRadius: '10px',
          background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
          boxShadow: `0 4px 12px ${color}40`
        }}>
          <Icon size={20} color="white" />
        </div>
        <div className="advanced-analytics-label" style={{ 
          fontSize: '12px', 
          fontWeight: '600',
          color: '#6b7280'
        }}>
          {label}
        </div>
      </div>
      <div style={{ 
        fontSize: '24px', 
        fontWeight: '700',
        color: color,
        marginBottom: description ? '8px' : '0'
      }}>
        {value}
      </div>
      {description && (
        <p style={{ 
          fontSize: '11px', 
          color: '#9ca3af',
          margin: 0,
          lineHeight: '1.4'
        }}>
          {description}
        </p>
      )}
    </div>
  )
}

