import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import { formatDateTime, formatDate, formatTime } from './format'
import type { ConversationListItem, ConversationDetail, Message } from '@/types/conversations'

/**
 * Genera un nombre de archivo con timestamp
 */
export function generateFilename(prefix: string, extension: string): string {
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '')
  return `${prefix}_${timestamp}.${extension}`
}

/**
 * Exporta conversaciones a PDF
 */
export function exportConversationsToPDF(conversations: ConversationListItem[]): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const lineHeight = 7
  let yPos = margin

  // Título
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Reporte de Conversaciones', margin, yPos)
  yPos += lineHeight * 2

  // Información del reporte
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Fecha de exportación: ${formatDateTime(new Date().toISOString())}`, margin, yPos)
  yPos += lineHeight
  doc.text(`Total de conversaciones: ${conversations.length}`, margin, yPos)
  yPos += lineHeight * 2

  // Encabezados de tabla
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  const headers = ['Teléfono', 'Nombre', 'Cliente', 'Último Mensaje', 'No Leídos', 'Requiere Respuesta']
  const colWidths = [35, 40, 20, 40, 20, 30]
  let xPos = margin

  headers.forEach((header, index) => {
    doc.text(header, xPos, yPos)
    xPos += colWidths[index]
  })
  yPos += lineHeight * 1.5

  // Línea separadora
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += lineHeight

  // Datos
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  conversations.forEach((conv, index) => {
    // Verificar si necesitamos una nueva página
    if (yPos > pageHeight - margin - lineHeight * 3) {
      doc.addPage()
      yPos = margin
    }

    xPos = margin
    const rowData = [
      conv.phone,
      conv.name || 'Sin nombre',
      conv.isClient ? 'Sí' : 'No',
      formatDateTime(conv.lastMessageAt),
      String(conv.unreadCount),
      conv.needsReply ? 'Sí' : 'No'
    ]

    rowData.forEach((data, colIndex) => {
      const text = String(data).substring(0, 30) // Limitar longitud
      doc.text(text, xPos, yPos)
      xPos += colWidths[colIndex]
    })

    yPos += lineHeight * 1.2

    // Línea separadora entre filas
    if (index < conversations.length - 1) {
      doc.setLineWidth(0.1)
      doc.line(margin, yPos - lineHeight * 0.3, pageWidth - margin, yPos - lineHeight * 0.3)
    }
  })

  // Pie de página
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Página ${i} de ${totalPages} - Estudio Pos & Asociados`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Descargar
  doc.save(generateFilename('conversaciones', 'pdf'))
}

/**
 * Exporta conversaciones a Excel
 */
export function exportConversationsToExcel(conversations: ConversationListItem[]): void {
  const data = conversations.map(conv => ({
    'Teléfono': conv.phone,
    'Nombre': conv.name || '',
    'Es Cliente': conv.isClient ? 'Sí' : 'No',
    'Último Mensaje (ISO)': conv.lastMessageAt,
    'Último Mensaje': formatDateTime(conv.lastMessageAt),
    'Mensaje No Leídos': conv.unreadCount,
    'Requiere Respuesta': conv.needsReply ? 'Sí' : 'No',
    'Preview Mensaje': conv.lastMessage || ''
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Conversaciones')

  // Ajustar ancho de columnas
  const colWidths = [
    { wch: 20 }, // Teléfono
    { wch: 25 }, // Nombre
    { wch: 12 }, // Es Cliente
    { wch: 25 }, // Último Mensaje (ISO)
    { wch: 25 }, // Último Mensaje
    { wch: 15 }, // Mensaje No Leídos
    { wch: 18 }, // Requiere Respuesta
    { wch: 50 }  // Preview Mensaje
  ]
  worksheet['!cols'] = colWidths

  XLSX.writeFile(workbook, generateFilename('conversaciones', 'xlsx'))
}

/**
 * Exporta una conversación completa con todos sus mensajes a PDF
 */
export function exportConversationDetailToPDF(conversation: ConversationDetail): void {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const lineHeight = 7
  let yPos = margin

  // Título
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Conversación Completa', margin, yPos)
  yPos += lineHeight * 2

  // Información del contacto
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Información del Contacto', margin, yPos)
  yPos += lineHeight * 1.5

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Teléfono: ${conversation.phone}`, margin, yPos)
  yPos += lineHeight
  doc.text(`Nombre: ${conversation.name || 'Sin nombre'}`, margin, yPos)
  yPos += lineHeight
  doc.text(`Es Cliente: ${conversation.isClient ? 'Sí' : 'No'}`, margin, yPos)
  yPos += lineHeight
  doc.text(`Requiere Respuesta: ${conversation.needsReply ? 'Sí' : 'No'}`, margin, yPos)
  yPos += lineHeight * 2

  // Mensajes
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(`Mensajes (${conversation.messages.length})`, margin, yPos)
  yPos += lineHeight * 1.5

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  // Agrupar mensajes por fecha
  const messagesByDate = conversation.messages.reduce((acc, msg) => {
    const date = formatDate(msg.timestamp)
    if (!acc[date]) acc[date] = []
    acc[date].push(msg)
    return acc
  }, {} as Record<string, Message[]>)

  Object.entries(messagesByDate).forEach(([date, messages]) => {
    // Verificar si necesitamos una nueva página
    if (yPos > pageHeight - margin - lineHeight * 5) {
      doc.addPage()
      yPos = margin
    }

    // Fecha
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(`📅 ${date}`, margin, yPos)
    yPos += lineHeight * 1.5

    messages.forEach(msg => {
      // Verificar si necesitamos una nueva página
      if (yPos > pageHeight - margin - lineHeight * 3) {
        doc.addPage()
        yPos = margin
      }

      const isFromUser = msg.from === 'usuario'
      const sender = isFromUser ? 'Usuario' : 'Bot/Sistema'
      const time = formatTime(msg.timestamp)

      // Remitente y hora
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(`${sender} - ${time}`, margin + 5, yPos)
      yPos += lineHeight

      // Mensaje
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const textLines = doc.splitTextToSize(msg.text || '(sin texto)', pageWidth - margin * 2 - 10)
      textLines.forEach((line: string) => {
        if (yPos > pageHeight - margin - lineHeight) {
          doc.addPage()
          yPos = margin
        }
        doc.text(line, margin + 5, yPos)
        yPos += lineHeight
      })

      // Indicador de IA si aplica
      if (msg.aiSuggested) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text('🤖 Respuesta generada por IA', margin + 5, yPos)
        yPos += lineHeight
      }

      yPos += lineHeight * 0.5
    })

    yPos += lineHeight
  })

  // Pie de página
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Página ${i} de ${totalPages} - Estudio Pos & Asociados`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Descargar
  const filename = `conversacion_${conversation.phone.replace(/[^0-9]/g, '')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

/**
 * Exporta una conversación completa con todos sus mensajes a Excel
 */
export function exportConversationDetailToExcel(conversation: ConversationDetail): void {
  const data = conversation.messages.map(msg => ({
    'Fecha': formatDate(msg.timestamp),
    'Hora': formatTime(msg.timestamp),
    'Remitente': msg.from === 'usuario' ? 'Usuario' : 'Bot/Sistema',
    'Mensaje': msg.text || '',
    'Via': msg.via || '',
    'IA Sugerida': msg.aiSuggested ? 'Sí' : 'No',
    'Estado Entrega': msg.deliveryStatus || ''
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  
  // Agregar hoja de información
  const infoData = [
    ['Teléfono', conversation.phone],
    ['Nombre', conversation.name || 'Sin nombre'],
    ['Es Cliente', conversation.isClient ? 'Sí' : 'No'],
    ['Requiere Respuesta', conversation.needsReply ? 'Sí' : 'No'],
    ['Total Mensajes', conversation.messages.length],
    ['Fecha Exportación', formatDateTime(new Date().toISOString())]
  ]
  const infoSheet = XLSX.utils.aoa_to_sheet([['Información del Contacto'], ...infoData])
  XLSX.utils.book_append_sheet(workbook, infoSheet, 'Información')
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mensajes')

  // Ajustar ancho de columnas
  const colWidths = [
    { wch: 12 }, // Fecha
    { wch: 10 }, // Hora
    { wch: 15 }, // Remitente
    { wch: 60 }, // Mensaje
    { wch: 12 }, // Via
    { wch: 12 }, // IA Sugerida
    { wch: 15 }  // Estado Entrega
  ]
  worksheet['!cols'] = colWidths

  const filename = `conversacion_${conversation.phone.replace(/[^0-9]/g, '')}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, filename)
}

