import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Plus, Edit2, Trash2, Clock, Hash, ToggleLeft, ToggleRight, AlertCircle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { api } from '@/services/api'
import type { AutoReplyRule } from '@/types/autoReplies'
import { AutoReplyRuleForm } from '@/components/AutoReplyRuleForm'
import { Link } from 'react-router-dom'

const DAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' }
]

export function AutoRepliesPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState<AutoReplyRule | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['autoReplies'],
    queryFn: () => api.autoReplies.list()
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.autoReplies.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autoReplies'] })
    }
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.autoReplies.update(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autoReplies'] })
    }
  })

  const handleEdit = (rule: AutoReplyRule) => {
    setEditingRule(rule)
    setShowForm(true)
  }

  const handleCreate = () => {
    setEditingRule(null)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingRule(null)
  }

  if (isLoading) {
    return (
      <div className="container" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <LoadingSpinner text="Cargando reglas..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
        <p style={{ color: '#ef4444', fontSize: '16px', fontWeight: '500' }}>
          Error al cargar reglas: {(error as Error).message}
        </p>
      </div>
    )
  }

  const rules = data?.rules || []

  return (
    <div className="container">
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        flexDirection: window.innerWidth < 768 ? 'column' : 'row',
        alignItems: window.innerWidth < 768 ? 'flex-start' : 'center',
        justifyContent: 'space-between', 
        marginBottom: '32px',
        gap: window.innerWidth < 768 ? '20px' : '0'
      }}>
        <div style={{ flex: 1 }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: 'white',
              textDecoration: 'none',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: '500',
              opacity: 0.9,
              transition: 'opacity 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.9'
            }}
          >
            <ArrowLeft size={16} />
            Volver al dashboard
          </Link>
          <h1 style={{ 
            fontSize: window.innerWidth < 768 ? '24px' : '32px', 
            fontWeight: '700', 
            margin: '0 0 8px 0',
            color: 'white',
            lineHeight: '1.2'
          }}>
            Respuestas Automáticas
          </h1>
          <p style={{ 
            color: 'rgba(255, 255, 255, 0.9)', 
            fontSize: window.innerWidth < 768 ? '14px' : '16px',
            margin: 0,
            fontWeight: '400'
          }}>
            Configura respuestas automáticas por horario o palabras clave
          </p>
        </div>
        <Button
          onClick={handleCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'white',
            color: '#3b82f6',
            border: 'none',
            padding: window.innerWidth < 768 ? '12px 20px' : '14px 24px',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: window.innerWidth < 768 ? '14px' : '15px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          <Plus size={20} />
          Nueva Regla
        </Button>
      </div>

      {showForm && (
        <AutoReplyRuleForm
          rule={editingRule}
          onClose={handleCloseForm}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['autoReplies'] })
            handleCloseForm()
          }}
        />
      )}

      {rules.length === 0 ? (
        <Card className="card" style={{ 
          padding: '60px 40px', 
          textAlign: 'center',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            <Hash size={40} color="white" />
          </div>
          <h2 className="dark:text-white" style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1e293b',
            margin: '0 0 12px 0'
          }}>
            No hay reglas configuradas
          </h2>
          <p className="dark:text-gray-300" style={{ 
            color: '#64748b', 
            fontSize: '16px', 
            marginBottom: '32px',
            maxWidth: '500px',
            margin: '0 auto 32px'
          }}>
            Crea tu primera regla de respuesta automática para mejorar la atención a tus clientes
          </p>
          <Button
            onClick={handleCreate}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '14px 28px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)'
              e.currentTarget.style.backgroundColor = '#2563eb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
              e.currentTarget.style.backgroundColor = '#3b82f6'
            }}
          >
            <Plus size={18} style={{ marginRight: '8px' }} />
            Crear primera regla
          </Button>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {rules.map((rule) => (
            <Card
              key={rule.id}
              className="card"
              style={{
                padding: '24px',
                border: `2px solid ${rule.enabled ? '#e5e7eb' : '#f3f4f6'}`,
                borderRadius: '16px',
                backgroundColor: rule.enabled ? 'white' : '#fafafa',
                boxShadow: rule.enabled 
                  ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  : '0 2px 4px -1px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: rule.enabled ? 1 : 0.7
              }}
              onMouseEnter={(e) => {
                if (rule.enabled) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(0, 0, 0, 0.15)'
                }
              }}
              onMouseLeave={(e) => {
                if (rule.enabled) {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      backgroundColor: rule.type === 'keyword' ? '#eff6ff' : '#ecfdf5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {rule.type === 'keyword' ? (
                        <Hash size={24} color="#3b82f6" />
                      ) : (
                        <Clock size={24} color="#10b981" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: '20px', 
                        fontWeight: '600',
                        color: rule.enabled ? '#1e293b' : '#94a3b8',
                        marginBottom: '6px'
                      }}>
                        {rule.name}
                      </h3>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: rule.type === 'keyword' ? '#dbeafe' : '#d1fae5',
                          color: rule.type === 'keyword' ? '#1e40af' : '#065f46',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {rule.type === 'keyword' ? 'Palabras Clave' : 'Horario'}
                        </span>
                        <span style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: '#f3f4f6',
                          color: '#6b7280'
                        }}>
                          Prioridad: {rule.priority}
                        </span>
                        {!rule.enabled && (
                          <span style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626'
                          }}>
                            Desactivada
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {rule.type === 'keyword' && (
                    <div className="dark:bg-slate-800 dark:border-slate-700" style={{ 
                      marginBottom: '16px',
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <p className="dark:text-gray-300" style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                        <strong className="dark:text-gray-200" style={{ color: '#475569' }}>Palabras clave:</strong> {rule.keywords?.join(', ') || 'N/A'}
                      </p>
                      <p className="dark:text-gray-300" style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b' }}>
                        <strong className="dark:text-gray-200" style={{ color: '#475569' }}>Coincidencia:</strong> {rule.matchType === 'all' ? 'Todas las palabras' : 'Cualquier palabra'}
                      </p>
                      <div className="dark:bg-slate-900 dark:border-slate-600" style={{
                        padding: '12px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <p className="dark:text-gray-200" style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
                          "{rule.response?.substring(0, 150)}{rule.response && rule.response.length > 150 ? '...' : ''}"
                        </p>
                      </div>
                    </div>
                  )}

                  {rule.type === 'schedule' && rule.schedule && (
                    <div className="dark:bg-slate-800 dark:border-slate-700" style={{ 
                      marginBottom: '16px',
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div>
                          <p className="dark:text-gray-300" style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                            <strong className="dark:text-gray-200" style={{ color: '#475569' }}>Días:</strong>
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {rule.schedule.days.map(d => {
                              const day = DAYS.find(day => day.value === d)
                              return day ? (
                                <span key={d} className="dark:bg-blue-900 dark:text-blue-200" style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  backgroundColor: '#eff6ff',
                                  color: '#1e40af'
                                }}>
                                  {day.label}
                                </span>
                              ) : null
                            })}
                          </div>
                        </div>
                        <div>
                          <p className="dark:text-gray-300" style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                            <strong className="dark:text-gray-200" style={{ color: '#475569' }}>Horario:</strong>
                          </p>
                          <p className="dark:text-gray-200" style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: '600' }}>
                            {rule.schedule.startTime} - {rule.schedule.endTime}
                          </p>
                        </div>
                      </div>
                      <div className="dark:bg-slate-900 dark:border-slate-600" style={{
                        padding: '12px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <p className="dark:text-gray-200" style={{ margin: 0, fontSize: '14px', color: '#475569', lineHeight: '1.6' }}>
                          "{rule.scheduleResponse?.substring(0, 150)}{rule.scheduleResponse && rule.scheduleResponse.length > 150 ? '...' : ''}"
                        </p>
                      </div>
                    </div>
                  )}

                  {(rule.isClientOnly || rule.isLeadOnly) && (
                    <p style={{ 
                      margin: '12px 0 0 0', 
                      fontSize: '12px', 
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#94a3b8'
                      }} />
                      {rule.isClientOnly && 'Solo clientes'}
                      {rule.isLeadOnly && 'Solo leads'}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => toggleMutation.mutate({ id: rule.id!, enabled: !rule.enabled })}
                    disabled={toggleMutation.isPending}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      color: rule.enabled ? '#10b981' : '#94a3b8',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = rule.enabled ? '#ecfdf5' : '#f3f4f6'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    title={rule.enabled ? 'Desactivar' : 'Activar'}
                  >
                    {rule.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                  <button
                    onClick={() => handleEdit(rule)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#3b82f6',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`¿Estás seguro de eliminar la regla "${rule.name}"?`)) {
                        deleteMutation.mutate(rule.id!)
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#ef4444',
                      borderRadius: '8px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef2f2'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
