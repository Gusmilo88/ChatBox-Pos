/**
 * Formatea un teléfono E.164 a formato legible
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return phone || 'Sin teléfono'
  
  // Remover el + si existe
  const clean = phone.replace('+', '')
  
  // Argentina: +54 9 11 XXXX-XXXX
  if (clean.startsWith('549')) {
    const area = clean.slice(3, 5)
    const number = clean.slice(5)
    if (number.length === 8) {
      return `+54 9 ${area} ${number.slice(0, 4)}-${number.slice(4)}`
    }
  }
  
  // Formato genérico
  if (clean.length >= 10) {
    return `+${clean.slice(0, clean.length - 8)} ${clean.slice(clean.length - 8, clean.length - 4)}-${clean.slice(clean.length - 4)}`
  }
  
  return phone
}

/**
 * Formatea una fecha ISO a formato local legible
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/**
 * Formatea una fecha ISO a formato de fecha corta
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/**
 * Formatea una fecha ISO a formato de hora
 */
export function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Genera un nombre de archivo CSV con timestamp
 */
export function generateCsvFilename(prefix: string = 'export'): string {
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '')
  return `${prefix}_${timestamp}.csv`
}

/**
 * Convierte datos a formato CSV
 */
export function arrayToCsv(data: Record<string, any>[]): string {
  if (!data.length) return ''
  
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Escapar comillas y envolver en comillas si contiene comas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value ?? ''
      }).join(',')
    )
  ].join('\n')
  
  return csvContent
}

/**
 * Descarga un archivo CSV
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
