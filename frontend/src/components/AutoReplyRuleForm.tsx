import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/services/api'
import type { AutoReplyRule } from '@/types/autoReplies'

const DAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' }
]

interface AutoReplyRuleFormProps {
  rule?: AutoReplyRule | null
  onClose: () => void
  onSuccess: () => void
}

export function AutoReplyRuleForm({ rule, onClose, onSuccess }: AutoReplyRuleFormProps) {
  const [formData, setFormData] = useState<Partial<AutoReplyRule>>({
    name: '',
    enabled: true,
    type: 'keyword',
    priority: 0,
    keywords: [],
    matchType: 'any',
    response: '',
    schedule: {
      days: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '18:00',
      timezone: 'America/Argentina/Buenos_Aires'
    },
    scheduleResponse: '',
    isClientOnly: false,
    isLeadOnly: false
  })

  const [keywordInput, setKeywordInput] = useState('')

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name || '',
        enabled: rule.enabled ?? true,
        type: rule.type || 'keyword',
        priority: rule.priority || 0,
        keywords: rule.keywords || [],
        matchType: rule.matchType || 'any',
        response: rule.response || '',
        schedule: rule.schedule || {
          days: [1, 2, 3, 4, 5],
          startTime: '09:00',
          endTime: '18:00',
          timezone: 'America/Argentina/Buenos_Aires'
        },
        scheduleResponse: rule.scheduleResponse || '',
        isClientOnly: rule.isClientOnly || false,
        isLeadOnly: rule.isLeadOnly || false
      })
    }
  }, [rule])

  const createMutation = useMutation({
    mutationFn: (data: Omit<AutoReplyRule, 'id'>) => api.autoReplies.create(data),
    onSuccess: onSuccess
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AutoReplyRule>) => api.autoReplies.update(rule!.id!, data),
    onSuccess: onSuccess
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const submitData: Omit<AutoReplyRule, 'id'> = {
      name: formData.name!,
      enabled: formData.enabled ?? true,
      type: formData.type!,
      priority: formData.priority || 0
    }

    if (formData.type === 'keyword') {
      submitData.keywords = formData.keywords || []
      submitData.matchType = formData.matchType || 'any'
      submitData.response = formData.response || ''
    } else if (formData.type === 'schedule') {
      submitData.schedule = formData.schedule
      submitData.scheduleResponse = formData.scheduleResponse || ''
    }

    if (formData.isClientOnly) submitData.isClientOnly = true
    if (formData.isLeadOnly) submitData.isLeadOnly = true

    if (rule) {
      updateMutation.mutate(submitData)
    } else {
      createMutation.mutate(submitData)
    }
  }

  const addKeyword = () => {
    if (keywordInput.trim()) {
      setFormData({
        ...formData,
        keywords: [...(formData.keywords || []), keywordInput.trim()]
      })
      setKeywordInput('')
    }
  }

  const removeKeyword = (index: number) => {
    setFormData({
      ...formData,
      keywords: formData.keywords?.filter((_, i) => i !== index) || []
    })
  }

  const toggleDay = (day: number) => {
    const days = formData.schedule?.days || []
    if (days.includes(day)) {
      setFormData({
        ...formData,
        schedule: {
          ...formData.schedule!,
          days: days.filter(d => d !== day)
        }
      })
    } else {
      setFormData({
        ...formData,
        schedule: {
          ...formData.schedule!,
          days: [...days, day]
        }
      })
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div className="dark:bg-slate-800" style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease'
      }}>
        <div className="dark:border-slate-700" style={{
          padding: '24px 28px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
          color: 'white'
        }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>
            {rule ? 'Editar Regla' : 'Nueva Regla'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '8px',
              color: 'white',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '28px', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Nombre de la regla *
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Ej: Respuesta fuera de horario"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Tipo de regla *
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'keyword' })}
                className={`dark:bg-slate-700 dark:text-white dark:border-slate-600 ${formData.type === 'keyword' ? 'dark:bg-blue-900 dark:border-blue-700' : ''}`}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: `2px solid ${formData.type === 'keyword' ? '#3b82f6' : '#e5e7eb'}`,
                  backgroundColor: formData.type === 'keyword' ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: formData.type === 'keyword' ? '#1e40af' : '#374151',
                  transition: 'all 0.2s ease'
                }}
              >
                Palabras Clave
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'schedule' })}
                className={`dark:bg-slate-700 dark:text-white dark:border-slate-600 ${formData.type === 'schedule' ? 'dark:bg-blue-900 dark:border-blue-700' : ''}`}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: `2px solid ${formData.type === 'schedule' ? '#3b82f6' : '#e5e7eb'}`,
                  backgroundColor: formData.type === 'schedule' ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: formData.type === 'schedule' ? '#1e40af' : '#374151',
                  transition: 'all 0.2s ease'
                }}
              >
                Horario
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Prioridad (0-100)
            </label>
            <Input
              type="number"
              min="0"
              max="100"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
            />
            <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Mayor número = mayor prioridad
            </p>
          </div>

          {formData.type === 'keyword' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                  Palabras clave *
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addKeyword()
                      }
                    }}
                    placeholder="Escribe una palabra clave y presiona Enter"
                  />
                  <Button
                    type="button"
                    onClick={addKeyword}
                    style={{ backgroundColor: '#3b82f6', color: 'white' }}
                  >
                    Agregar
                  </Button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {formData.keywords?.map((keyword, index) => (
                    <span
                      key={index}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: '#eff6ff',
                        color: '#1e40af',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() => removeKeyword(index)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#1e40af',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                  Tipo de coincidencia
                </label>
                <select
                  value={formData.matchType}
                  onChange={(e) => setFormData({ ...formData, matchType: e.target.value as 'any' | 'all' })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px'
                  }}
                >
                  <option value="any">Cualquier palabra</option>
                  <option value="all">Todas las palabras</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                  Respuesta automática *
                </label>
                <textarea
                  value={formData.response}
                  onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                  required
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  placeholder="Escribe la respuesta que se enviará automáticamente..."
                />
              </div>
            </>
          )}

          {formData.type === 'schedule' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                  Días de la semana *
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {DAYS.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: `2px solid ${formData.schedule?.days.includes(day.value) ? '#3b82f6' : '#e5e7eb'}`,
                        backgroundColor: formData.schedule?.days.includes(day.value) ? '#eff6ff' : 'white',
                        color: formData.schedule?.days.includes(day.value) ? '#1e40af' : '#64748b',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500'
                      }}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                    Hora de inicio *
                  </label>
                  <Input
                    type="time"
                    value={formData.schedule?.startTime}
                    onChange={(e) => setFormData({
                      ...formData,
                      schedule: { ...formData.schedule!, startTime: e.target.value }
                    })}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                    Hora de fin *
                  </label>
                  <Input
                    type="time"
                    value={formData.schedule?.endTime}
                    onChange={(e) => setFormData({
                      ...formData,
                      schedule: { ...formData.schedule!, endTime: e.target.value }
                    })}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                  Respuesta fuera de horario *
                </label>
                <textarea
                  value={formData.scheduleResponse}
                  onChange={(e) => setFormData({ ...formData, scheduleResponse: e.target.value })}
                  required
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  placeholder="Escribe la respuesta que se enviará cuando esté fuera de horario..."
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
              Aplicar a
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isClientOnly || false}
                  onChange={(e) => setFormData({ ...formData, isClientOnly: e.target.checked, isLeadOnly: false })}
                />
                <span style={{ fontSize: '14px' }}>Solo clientes</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.isLeadOnly || false}
                  onChange={(e) => setFormData({ ...formData, isLeadOnly: e.target.checked, isClientOnly: false })}
                />
                <span style={{ fontSize: '14px' }}>Solo leads</span>
              </label>
            </div>
          </div>

          <div className="dark:border-slate-700" style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'flex-end',
            paddingTop: '24px',
            borderTop: '1px solid #e5e7eb',
            marginTop: '24px'
          }}>
            <Button
              type="button"
              onClick={onClose}
              className="dark:bg-slate-700 dark:text-gray-200 dark:hover:bg-slate-600"
              style={{
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e7eb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6'
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '10px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
                fontSize: '14px',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = '#2563eb'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = '#3b82f6'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)'
                }
              }}
            >
              {isLoading ? 'Guardando...' : (rule ? 'Actualizar' : 'Crear')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

