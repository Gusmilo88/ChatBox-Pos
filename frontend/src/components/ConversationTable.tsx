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
import { LoadingSpinner } from '@/components/LoadingSpinner'
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

  if (isLoading && conversations.length === 0) {
    return (
      <div style={{ padding: '60px 20px' }}>
        <LoadingSpinner size="lg" text="Cargando conversaciones..." />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div>
        {/* Mostrar tabla con datos mientras carga más */}
        <div className="table-container conversation-table-scroll" style={{ 
          overflowX: 'auto', 
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 #f1f5f9'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'separate', 
            borderSpacing: '0 8px',
            marginTop: '-8px'
          }}>
            <thead>
              <tr>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Phone size={16} style={{ marginRight: '8px', color: '#64748b', verticalAlign: 'middle' }} />
                  Teléfono
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <User size={16} style={{ marginRight: '8px', color: '#64748b', verticalAlign: 'middle' }} />
                  Nombre
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</th>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Clock size={16} style={{ marginRight: '8px', color: '#64748b', verticalAlign: 'middle' }} />
                  Último mensaje
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <MessageSquare size={16} style={{ marginRight: '8px', color: '#64748b', verticalAlign: 'middle' }} />
                  No leídos
                </th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => (
                <tr
                  key={conversation.id}
                  onClick={() => handleRowClick(conversation.id)}
                  style={{
                    backgroundColor: conversation.unreadCount > 0 
                      ? (conversation.needsReply ? '#fef2f2' : '#f0f9ff')
                      : 'white',
                    borderLeft: conversation.needsReply ? '4px solid #dc2626' : conversation.unreadCount > 0 ? '4px solid #3b82f6' : '4px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    marginBottom: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = conversation.needsReply ? '#fee2e2' : '#e0f2fe'
                    e.currentTarget.style.transform = 'translateX(2px)'
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = conversation.unreadCount > 0 
                      ? (conversation.needsReply ? '#fef2f2' : '#f0f9ff')
                      : 'white'
                    e.currentTarget.style.transform = 'translateX(0)'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
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
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: conversation.isClient ? '#d1fae5' : '#fffbeb',
                      color: conversation.isClient ? '#065f46' : '#b45309',
                      border: `1px solid ${conversation.isClient ? '#a7f3d0' : '#fed7aa'}`
                    }}>
                      {conversation.isClient ? "Cliente" : "Lead"}
                    </span>
                  </td>
                  <td style={{ padding: '16px', fontSize: '13px', color: '#6b7280' }}>
                    {formatDateTime(conversation.lastMessageAt)}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    {conversation.unreadCount > 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        {conversation.unreadCount}
                      </span>
                    ) : (
                      <CheckCircle2 size={18} color="#10b981" style={{ verticalAlign: 'middle' }} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Spinner al final mientras carga más */}
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <LoadingSpinner size="sm" text="Cargando más conversaciones..." />
        </div>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <MessageSquare size={48} style={{ marginBottom: '16px', opacity: 0.3, color: '#9ca3af' }} />
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#6b7280', marginBottom: '8px' }}>
          No hay conversaciones
        </div>
        <div style={{ fontSize: '14px', color: '#9ca3af' }}>
          Aún no hay conversaciones para mostrar
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Tabla */}
      <div className="table-container conversation-table-scroll" style={{ 
        overflowX: 'auto', 
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 #f1f5f9'
      }}>
        <style>{`
          .conversation-table-scroll::-webkit-scrollbar {
            height: 8px;
          }
          .conversation-table-scroll::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 10px;
          }
          .conversation-table-scroll::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
          }
          .conversation-table-scroll::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          @media (max-width: 767px) {
            .conversation-table-scroll table {
              min-width: 600px;
            }
          }
        `}</style>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'separate', 
          borderSpacing: '0 8px',
          marginTop: '-8px'
        }}>
          <thead>
            <tr>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Phone size={16} style={{ marginRight: '8px', color: '#64748b', verticalAlign: 'middle' }} />
                Teléfono
              </th>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <User size={16} style={{ marginRight: '8px', color: '#64748b', verticalAlign: 'middle' }} />
                Nombre
              </th>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estado</th>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Clock size={16} style={{ marginRight: '8px', color: '#64748b', verticalAlign: 'middle' }} />
                Último mensaje
              </th>
              <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <MessageSquare size={16} style={{ marginRight: '8px', color: '#64748b', verticalAlign: 'middle' }} />
                No leídos
              </th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((conversation) => (
              <tr
                key={conversation.id}
                onClick={() => handleRowClick(conversation.id)}
                style={{
                  backgroundColor: conversation.unreadCount > 0 
                    ? (conversation.needsReply ? '#fef2f2' : '#f0f9ff')
                    : 'white',
                  borderLeft: conversation.needsReply ? '4px solid #dc2626' : conversation.unreadCount > 0 ? '4px solid #3b82f6' : '4px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  marginBottom: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = conversation.needsReply ? '#fee2e2' : '#e0f2fe'
                  e.currentTarget.style.transform = 'translateX(2px)'
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = conversation.unreadCount > 0 
                    ? (conversation.needsReply ? '#fef2f2' : '#f0f9ff')
                    : 'white'
                  e.currentTarget.style.transform = 'translateX(0)'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
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
                    padding: '4px 10px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: conversation.isClient ? '#d1fae5' : '#fffbeb',
                    color: conversation.isClient ? '#065f46' : '#b45309',
                    border: `1px solid ${conversation.isClient ? '#a7f3d0' : '#fed7aa'}`
                  }}>
                    {conversation.isClient ? "Cliente" : "Lead"}
                  </span>
                </td>
                <td style={{ padding: '16px', fontSize: '13px', color: '#6b7280' }}>
                  {formatDateTime(conversation.lastMessageAt)}
                </td>
                <td style={{ padding: '16px', textAlign: 'center' }}>
                  {conversation.unreadCount > 0 ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}>
                      {conversation.unreadCount}
                    </span>
                  ) : (
                    <CheckCircle2 size={18} color="#10b981" style={{ verticalAlign: 'middle' }} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: '24px', 
          padding: '16px 0',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ fontSize: '14px', color: 'white' }}>
            Mostrando {startItem} a {endItem} de {total} conversaciones
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: 'white',
                color: '#374151',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { if (page !== 1) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
              onMouseLeave={(e) => { if (page !== 1) e.currentTarget.style.backgroundColor = 'white' }}
            >
              <ChevronLeft size={16} />
              Anterior
            </button>
            
            <div style={{ display: 'flex', gap: '4px' }}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                if (pageNum > totalPages) return null
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    style={{
                      width: '36px',
                      height: '36px',
                      padding: '0',
                      borderRadius: '8px',
                      border: `1px solid ${pageNum === page ? '#3b82f6' : '#e5e7eb'}`,
                      backgroundColor: pageNum === page ? '#3b82f6' : 'white',
                      color: pageNum === page ? 'white' : '#374151',
                      fontWeight: pageNum === page ? '600' : '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => { if (pageNum !== page) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                    onMouseLeave={(e) => { if (pageNum !== page) e.currentTarget.style.backgroundColor = 'white' }}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                backgroundColor: 'white',
                color: '#374151',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { if (page !== totalPages) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
              onMouseLeave={(e) => { if (page !== totalPages) e.currentTarget.style.backgroundColor = 'white' }}
            >
              Siguiente
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
