import { useState } from 'react'
import { ChevronLeft, ChevronRight, MessageSquare, Phone, User, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPhone, formatDateTime } from '@/utils/format'
import { maskPII } from '@/utils/mask'
import type { ConversationListItem } from '@/types/conversations'

interface ConversationTableProps {
  conversations: ConversationListItem[]
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onConversationClick: (id: string) => void
  isLoading?: boolean
}

export function ConversationTable({
  conversations,
  total,
  page,
  pageSize,
  onPageChange,
  onConversationClick,
  isLoading
}: ConversationTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  
  const totalPages = Math.ceil(total / pageSize)
  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  const handleRowClick = (id: string) => {
    onConversationClick(id)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teléfono</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último mensaje</TableHead>
                <TableHead>No leídos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Tabla */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>
                <Phone className="icon" />
                Teléfono
              </th>
              <th>
                <User className="icon" />
                Nombre
              </th>
              <th>Estado</th>
              <th>
                <Clock className="icon" />
                Último mensaje
              </th>
              <th>
                <MessageSquare className="icon" />
                No leídos
              </th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((conversation) => (
              <tr
                key={conversation.id}
                className={conversation.needsReply ? 'urgent' : ''}
                onClick={() => handleRowClick(conversation.id)}
                onMouseEnter={() => setHoveredRow(conversation.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td className="font-medium">
                  <div className="flex items-center gap-2">
                    {formatPhone(conversation.phone)}
                    {conversation.needsReply && (
                      <span className="badge badge-urgente">
                        Urgente
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  {conversation.name ? (
                    <span className="font-medium">{conversation.name}</span>
                  ) : (
                    <span className="text-gray-400 italic">Sin nombre</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${conversation.isClient ? "badge-cliente" : "badge-no-cliente"}`}>
                    {conversation.isClient ? "Cliente" : "No Cliente"}
                  </span>
                </td>
                <td className="text-sm text-gray-600">
                  {formatDateTime(conversation.lastMessageAt)}
                </td>
                <td>
                  {conversation.unreadCount > 0 ? (
                    <span className="badge badge-unread">
                      {conversation.unreadCount}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            Mostrando {startItem} a {endItem} de {total} conversaciones
          </div>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="icon" />
              Anterior
            </button>
            
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                if (pageNum > totalPages) return null
                
                return (
                  <button
                    key={pageNum}
                    className={`pagination-btn ${pageNum === page ? "active" : ""}`}
                    onClick={() => handlePageChange(pageNum)}
                    style={{ width: '32px', height: '32px', padding: '0' }}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            >
              Siguiente
              <ChevronRight className="icon" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
