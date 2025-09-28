import { MessageSquare, Wifi, WifiOff } from 'lucide-react'
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
        return <MessageSquare className="h-12 w-12 text-muted-foreground" />
      case 'no-connection':
        return <WifiOff className="h-12 w-12 text-muted-foreground" />
      case 'loading':
        return (
          <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
        )
      case 'error':
        return <Wifi className="h-12 w-12 text-destructive" />
      default:
        return <MessageSquare className="h-12 w-12 text-muted-foreground" />
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="mb-4">
          {getIcon()}
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6">{description}</p>
        {action && (
          <Button onClick={action.onClick} variant="outline">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
