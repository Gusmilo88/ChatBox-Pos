import { MessageSquare, Wifi, WifiOff, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  type: 'no-results' | 'no-connection' | 'loading' | 'error'
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ type, title, description, action }: EmptyStateProps) {
  const getIcon = () => {
    switch (type) {
      case 'no-results':
        return (
          <div className="relative">
            <div 
              className="absolute inset-0 rounded-full opacity-20"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                filter: 'blur(20px)',
                transform: 'scale(1.2)'
              }}
            />
            <div 
              className="relative flex items-center justify-center w-20 h-20 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)'
              }}
            >
              <Search className="h-10 w-10 text-white" strokeWidth={2} />
            </div>
          </div>
        )
      case 'no-connection':
        return (
          <div className="relative">
            <div 
              className="absolute inset-0 rounded-full opacity-20"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)',
                filter: 'blur(20px)',
                transform: 'scale(1.2)'
              }}
            />
            <div 
              className="relative flex items-center justify-center w-20 h-20 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)',
                boxShadow: '0 10px 40px rgba(239, 68, 68, 0.3)'
              }}
            >
              <WifiOff className="h-10 w-10 text-white" strokeWidth={2} />
            </div>
          </div>
        )
      case 'loading':
        return (
          <div className="h-20 w-20 rounded-full border-4 border-transparent border-t-primary animate-spin" 
               style={{
                 background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                 borderImage: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) 1'
               }}
          />
        )
      case 'error':
        return (
          <div className="relative">
            <div 
              className="absolute inset-0 rounded-full opacity-20"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                filter: 'blur(20px)',
                transform: 'scale(1.2)'
              }}
            />
            <div 
              className="relative flex items-center justify-center w-20 h-20 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: '0 10px 40px rgba(239, 68, 68, 0.3)'
              }}
            >
              <Wifi className="h-10 w-10 text-white" strokeWidth={2} />
            </div>
          </div>
        )
      default:
        return (
          <div className="relative">
            <div 
              className="absolute inset-0 rounded-full opacity-20"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                filter: 'blur(20px)',
                transform: 'scale(1.2)'
              }}
            />
            <div 
              className="relative flex items-center justify-center w-20 h-20 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)'
              }}
            >
              <MessageSquare className="h-10 w-10 text-white" strokeWidth={2} />
            </div>
          </div>
        )
    }
  }

  return (
    <div className="w-full flex items-center justify-center py-16 px-4">
      <Card 
        className="w-full max-w-lg mx-auto border-0 shadow-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(249, 250, 251, 0.98) 100%)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
          <div 
            className="mb-8 transform transition-all duration-500 hover:scale-105"
            style={{
              animation: 'fadeInUp 0.6s ease-out'
            }}
          >
            {getIcon()}
          </div>
          <h3 
            className="text-2xl font-bold mb-3"
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.02em'
            }}
          >
            {title}
          </h3>
          <p 
            className="text-base mb-8 leading-relaxed max-w-md"
            style={{
              color: '#64748b',
              lineHeight: '1.6'
            }}
          >
            {description}
          </p>
          {action && (
            <Button 
              onClick={action.onClick} 
              className="px-8 py-6 h-auto text-base font-semibold rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                border: 'none',
                color: 'white',
                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)'
              }}
            >
              {action.label}
            </Button>
          )}
        </CardContent>
      </Card>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
