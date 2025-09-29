import { createBrowserRouter } from 'react-router-dom'
import { ConversationsPage } from '@/pages/ConversationsPage'
import { ConversationDetailPage } from '@/pages/ConversationDetailPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute><ConversationsPage /></ProtectedRoute>,
  },
  {
    path: '/c/:id',
    element: <ProtectedRoute><ConversationDetailPage /></ProtectedRoute>,
  },
])
