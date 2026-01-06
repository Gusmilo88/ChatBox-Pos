import { createBrowserRouter } from 'react-router-dom'
import { ConversationsPage } from '@/pages/ConversationsPage'
import { ConversationDetailPage } from '@/pages/ConversationDetailPage'
import { LoginPage } from '@/pages/LoginPage'
import { AutoRepliesPage } from '@/pages/AutoRepliesPage'
import { SimulatorPage } from '@/pages/SimulatorPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import TestChat from './TestChat'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/test',
    element: <TestChat />,
  },
  {
    path: '/simulator',
    element: <SimulatorPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute><ConversationsPage /></ProtectedRoute>,
  },
  {
    path: '/c/:id',
    element: <ProtectedRoute><ConversationDetailPage /></ProtectedRoute>,
  },
  {
    path: '/auto-replies',
    element: <ProtectedRoute><AutoRepliesPage /></ProtectedRoute>,
  },
])
