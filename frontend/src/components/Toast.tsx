import { CheckCircle, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
  onClose: () => void
}

export function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 10)

    // Auto-cerrar después de la duración
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Esperar a que termine la animación
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const typeStyles = {
    success: {
      bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      iconBg: 'rgba(255, 255, 255, 0.2)',
      border: 'rgba(16, 185, 129, 0.3)',
      shadow: '0 10px 25px -5px rgba(16, 185, 129, 0.3)'
    },
    error: {
      bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      iconBg: 'rgba(255, 255, 255, 0.2)',
      border: 'rgba(239, 68, 68, 0.3)',
      shadow: '0 10px 25px -5px rgba(239, 68, 68, 0.3)'
    },
    info: {
      bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      iconBg: 'rgba(255, 255, 255, 0.2)',
      border: 'rgba(59, 130, 246, 0.3)',
      shadow: '0 10px 25px -5px rgba(59, 130, 246, 0.3)'
    }
  }

  const styles = typeStyles[type]

  return (
    <div
      style={{
        transform: isVisible ? 'translateX(0)' : 'translateX(400px)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        minWidth: '320px',
        maxWidth: '480px'
      }}
    >
      <div
        className="dark:bg-slate-800"
        style={{
          background: styles.bg,
          borderRadius: '16px',
          padding: '16px 20px',
          boxShadow: styles.shadow,
          border: `2px solid ${styles.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          color: 'white',
          animation: 'slideInRight 0.3s ease'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: styles.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <CheckCircle size={24} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: '600',
              color: 'white',
              lineHeight: '1.4'
            }}
          >
            {message}
          </p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(onClose, 300)
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '8px',
            color: 'white',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
          }}
        >
          <X size={18} />
        </button>
      </div>
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type?: 'success' | 'error' | 'info' }>
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <>
      {toasts.map((toast, index) => {
        // El más reciente va abajo, los anteriores arriba
        const reverseIndex = toasts.length - 1 - index
        return (
          <div
            key={toast.id}
            style={{
              position: 'fixed',
              bottom: `${24 + reverseIndex * 80}px`,
              right: '24px',
              zIndex: 3000 + index
            }}
          >
            <Toast
              message={toast.message}
              type={toast.type || 'success'}
              onClose={() => onRemove(toast.id)}
            />
          </div>
        )
      })}
    </>
  )
}

