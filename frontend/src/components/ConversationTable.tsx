import { useState } from 'react'
import { ChevronLeft, ChevronRight, MessageSquare, Phone, User, Clock, CheckCircle2, Circle } from 'lucide-react'
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
      <div className="table-container conversation-table-scroll">
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
                onMouseEnter={(e) => {
                  setHoveredRow(conversation.id)
                  e.currentTarget.style.backgroundColor = conversation.needsReply ? '#fee2e2' : '#e0f2fe'
                  e.currentTarget.style.transform = 'translateX(2px)'
                }}
                onMouseLeave={(e) => {
                  setHoveredRow(null)
                  e.currentTarget.style.backgroundColor = conversation.unreadCount > 0 
                    ? (conversation.needsReply ? '#fef2f2' : '#f0f9ff')
                    : 'white'
                  e.currentTarget.style.transform = 'translateX(0)'
                }}
                style={{
                  backgroundColor: conversation.unreadCount > 0 
                    ? (conversation.needsReply ? '#fef2f2' : '#f0f9ff')
                    : 'white',
                  borderLeft: conversation.needsReply ? '4px solid #dc2626' : conversation.unreadCount > 0 ? '4px solid #3b82f6' : '4px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                <td style={{ padding: '16px', fontWeight: '500' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      color: conversation.unreadCount > 0 ? '#111827' : '#6b7280'
                    }}>
                      {conversation.unreadCount > 0 ? (
                        <Circle size={8} fill="#3b82f6" color="#3b82f6" />
                      ) : (
                        <CheckCircle2 size={8} color="#10b981" />
                      )}
                      <span style={{ fontWeight: conversation.unreadCount > 0 ? '600' : '500' }}>
                        {formatPhone(conversation.phone)}
                      </span>
                    </div>
                    {conversation.needsReply && (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fca5a5'
                      }}>
                        Urgente
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {conversation.name ? (
                      <span style={{ 
                        fontWeight: '600', 
                        color: '#111827',
                        fontSize: '14px'
                      }}>
                        {conversation.name}
                      </span>
                    ) : (
                      <span style={{ 
                        color: '#9ca3af', 
                        fontStyle: 'italic',
                        fontSize: '14px'
                      }}>
                        Sin nombre
                      </span>
                    )}
                    {conversation.lastMessage && (
                      <span style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '200px'
                      }}>
                        {conversation.lastMessage}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '16px' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: conversation.isClient ? '#d1fae5' : '#fef3c7',
                    color: conversation.isClient ? '#059669' : '#d97706',
                    border: `1px solid ${conversation.isClient ? '#6ee7b7' : '#fcd34d'}`
                  }}>
                    {conversation.isClient ? "Cliente" : "Lead"}
                  </span>
                </td>
                <td style={{ padding: '16px', fontSize: '13px', color: '#6b7280' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>{formatDateTime(conversation.lastMessageAt)}</span>
                    {conversation.unreadCount > 0 && (
                      <span style={{
                        fontSize: '11px',
                        color: '#3b82f6',
                        fontWeight: '600'
                      }}>
                        {conversation.unreadCount} nuevo{conversation.unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '16px', textAlign: 'center' }}>
                  {conversation.unreadCount > 0 ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '24px',
                      height: '24px',
                      padding: '0 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                    }}>
                      {conversation.unreadCount}
                    </span>
                  ) : (
                    <CheckCircle2 size={16} color="#10b981" style={{ opacity: 0.5 }} />
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
          <div className="pagination-info-white">
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
