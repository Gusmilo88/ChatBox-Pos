import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ size = 'md', text, fullScreen = false }: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 20,
    md: 32,
    lg: 48
  }

  const spinnerSize = sizeMap[size]

  const spinner = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: fullScreen ? '60px 20px' : '40px 20px'
    }}>
      <div style={{
        position: 'relative',
        width: `${spinnerSize}px`,
        height: `${spinnerSize}px`
      }}>
        {/* Círculo exterior animado */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          border: `3px solid #e5e7eb`,
          borderTop: `3px solid #25d366`,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        
        {/* Círculo interior más pequeño */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${spinnerSize * 0.6}px`,
          height: `${spinnerSize * 0.6}px`,
          border: `2px solid #e5e7eb`,
          borderRight: `2px solid #075e54`,
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite reverse'
        }}></div>
      </div>
      
      {text && (
        <div style={{
          fontSize: '14px',
          color: '#6b7280',
          fontWeight: '500',
          textAlign: 'center'
        }}>
          {text}
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )

  if (fullScreen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {spinner}
      </div>
    )
  }

  return spinner
}

