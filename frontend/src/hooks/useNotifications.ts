import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface NotificationState {
  lastUnreadCount: number
  lastNeedsReplyCount: number
  lastNotificationTime: number
  notifiedConversations: Set<string>
}

const NOTIFICATION_COOLDOWN = 10000 // 10 segundos entre notificaciones
const MIN_NOTIFICATION_INTERVAL = 5000 // 5 segundos mínimo

export function useNotifications() {
  const queryClient = useQueryClient()
  const stateRef = useRef<NotificationState>({
    lastUnreadCount: 0,
    lastNeedsReplyCount: 0,
    lastNotificationTime: 0,
    notifiedConversations: new Set()
  })

  // Solicitar permiso para notificaciones al montar
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {
        // Silenciar error si el usuario cancela
      })
    }
  }, [])

  // Función para mostrar notificación
  const showNotification = (
    title: string,
    body: string,
    tag?: string,
    icon?: string
  ) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return
    }

    const now = Date.now()
    const state = stateRef.current

    // Verificar cooldown
    if (now - state.lastNotificationTime < MIN_NOTIFICATION_INTERVAL) {
      return
    }

    // Cerrar notificación anterior con el mismo tag
    if (tag) {
      // Las notificaciones con el mismo tag se reemplazan automáticamente
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: icon || '/vite.svg',
        tag: tag || 'default',
        requireInteraction: false,
        silent: false,
        badge: '/vite.svg'
      })

      // Auto-cerrar después de 5 segundos
      setTimeout(() => {
        notification.close()
      }, 5000)

      // Actualizar tiempo de última notificación
      state.lastNotificationTime = now

      // Reproducir sonido de notificación (opcional)
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZijcIG2m98OSfTQ8OUKjj8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUrgc7y2Yo3CBtpvfDkn00PDlCo4/C2YxwGOJHX8sx5LAUkd8fw3ZBAC')
        audio.volume = 0.3
        audio.play().catch(() => {
          // Silenciar error si no se puede reproducir
        })
      } catch {
        // Silenciar error de audio
      }
    } catch (error) {
      console.error('Error mostrando notificación:', error)
    }
  }

  // Función para verificar y notificar nuevos mensajes
  const checkNewMessages = (conversations: any[]) => {
    if (!conversations || conversations.length === 0) return

    const state = stateRef.current
    const now = Date.now()

    // Verificar cooldown global
    if (now - state.lastNotificationTime < NOTIFICATION_COOLDOWN) {
      return
    }

    // Contar mensajes no leídos y conversaciones que necesitan respuesta
    const unreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
    const needsReply = conversations.filter(c => c.needsReply && (c.unreadCount || 0) > 0)

    // Detectar nuevos mensajes no leídos
    if (unreadCount > state.lastUnreadCount) {
      const newUnread = unreadCount - state.lastUnreadCount
      
      // Encontrar conversaciones con nuevos mensajes
      const newConversations = conversations.filter(c => {
        const hasUnread = (c.unreadCount || 0) > 0
        const wasNotified = state.notifiedConversations.has(c.id)
        return hasUnread && !wasNotified
      })

      if (newConversations.length > 0) {
        // Notificar sobre nuevas conversaciones
        newConversations.forEach(conv => {
          state.notifiedConversations.add(conv.id)
          
          const name = conv.name || conv.phone
          const message = conv.lastMessage || 'Nuevo mensaje'
          const preview = message.length > 50 ? message.substring(0, 50) + '...' : message
          
          showNotification(
            name,
            preview,
            `conv-${conv.id}`,
            '/vite.svg'
          )
        })
      } else if (newUnread > 0) {
        // Notificación genérica si hay muchos mensajes nuevos
        showNotification(
          'Nuevos mensajes',
          `${newUnread} mensaje${newUnread > 1 ? 's' : ''} nuevo${newUnread > 1 ? 's' : ''}`,
          'new-messages',
          '/vite.svg'
        )
      }

      state.lastUnreadCount = unreadCount
    }

    // Detectar conversaciones que necesitan respuesta urgente
    if (needsReply.length > state.lastNeedsReplyCount) {
      const newNeedsReply = needsReply.length - state.lastNeedsReplyCount
      
      if (newNeedsReply > 0) {
        showNotification(
          'Atención requerida',
          `${newNeedsReply} conversación${newNeedsReply > 1 ? 'es' : ''} necesita${newNeedsReply > 1 ? 'n' : ''} respuesta urgente`,
          'needs-reply',
          '/vite.svg'
        )
      }

      state.lastNeedsReplyCount = needsReply.length
    }

    // Actualizar título de la página con contador
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) Dashboard - Estudio Pos & Asociados`
    } else {
      document.title = 'Dashboard - Estudio Pos & Asociados'
    }
  }

  // Limpiar conversaciones notificadas que ya no tienen mensajes no leídos
  const cleanupNotifiedConversations = (conversations: any[]) => {
    const state = stateRef.current
    const activeIds = new Set(conversations.map(c => c.id))
    
    // Remover IDs de conversaciones que ya no existen o ya no tienen mensajes no leídos
    state.notifiedConversations.forEach(id => {
      const conv = conversations.find(c => c.id === id)
      if (!conv || (conv.unreadCount || 0) === 0) {
        state.notifiedConversations.delete(id)
      }
    })
  }

  return {
    checkNewMessages,
    cleanupNotifiedConversations,
    showNotification
  }
}

