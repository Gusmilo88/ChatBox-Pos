import { User, Phone, Calendar, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react'
import { formatPhone } from '@/utils/format'

interface ContactInfoProps {
  phone: string
  name?: string
  isClient: boolean
  lastMessageAt: string
  unreadCount: number
  needsReply: boolean
  onClose: () => void
}

export function ContactInfo({ 
  phone, 
  name, 
  isClient, 
  lastMessageAt, 
  unreadCount, 
  needsReply,
  onClose 
}: ContactInfoProps) {
  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '320px',
      height: '100vh',
      backgroundColor: 'white',
      boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.15)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideIn 0.3s ease'
    }}>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
      
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: '#111827',
          margin: 0
        }}>
          Información del contacto
        </h3>
        <button
          onClick={onClose}
          style={{
            padding: '8px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderRadius: '8px',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px'
      }}>
        {/* Avatar y nombre */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px',
          paddingBottom: '24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: isClient ? '#10b981' : '#8b5cf6',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            fontWeight: '700',
            margin: '0 auto 16px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            {name ? name.charAt(0).toUpperCase() : phone.slice(-1)}
          </div>
          <h4 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: '#111827',
            margin: '0 0 8px'
          }}>
            {name || 'Sin nombre'}
          </h4>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: '600',
            backgroundColor: isClient ? '#d1fae5' : '#ede9fe',
            color: isClient ? '#059669' : '#7c3aed'
          }}>
            {isClient ? <CheckCircle2 size={14} /> : <User size={14} />}
            {isClient ? 'Cliente' : 'Lead'}
          </div>
        </div>

        {/* Información */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Teléfono */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: '#3b82f6',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Phone size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                Teléfono
              </div>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#111827'
              }}>
                {formatPhone(phone)}
              </div>
            </div>
          </div>

          {/* Último mensaje */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Calendar size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                marginBottom: '4px'
              }}>
                Último mensaje
              </div>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#111827'
              }}>
                {formatDate(lastMessageAt)}
              </div>
            </div>
          </div>

          {/* Mensajes no leídos */}
          {unreadCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#3b82f6',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <MessageSquare size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  marginBottom: '4px'
                }}>
                  Mensajes no leídos
                </div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#3b82f6'
                }}>
                  {unreadCount}
                </div>
              </div>
            </div>
          )}

          {/* Necesita respuesta */}
          {needsReply && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              backgroundColor: '#fef2f2',
              borderRadius: '8px',
              border: '1px solid #fecaca'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#ef4444',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertCircle size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#dc2626'
                }}>
                  Necesita respuesta urgente
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

