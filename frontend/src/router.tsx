import { createBrowserRouter } from 'react-router-dom'
import { ConversationsPage } from '@/pages/ConversationsPage'
import { ConversationDetailPage } from '@/pages/ConversationDetailPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ConversationsPage />,
  },
  {
    path: '/c/:id',
    element: <ConversationDetailPage />,
  },
])
