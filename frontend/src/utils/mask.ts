/**
 * Enmascara datos sensibles como CUIT, teléfonos, etc.
 */
export function maskPII(text: string): string {
  if (!text) return text
  
  // CUIT: 11 dígitos consecutivos
  let masked = text.replace(/\b\d{11}\b/g, (match) => {
    return match.slice(0, 3) + '***' + match.slice(-2)
  })
  
  // Teléfonos: +549XXXXXXXXX
  masked = masked.replace(/\+\d{10,15}/g, (match) => {
    return match.slice(0, 4) + '***' + match.slice(-2)
  })
  
  // DNI: 7-8 dígitos consecutivos
  masked = masked.replace(/\b\d{7,8}\b/g, (match) => {
    return match.slice(0, 2) + '***' + match.slice(-2)
  })
  
  return masked
}

/**
 * Verifica si un texto contiene datos sensibles
 */
export function containsPII(text: string): boolean {
  return /\b\d{11}\b/.test(text) || // CUIT
         /\+\d{10,15}/.test(text) || // Teléfono
         /\b\d{7,8}\b/.test(text) // DNI
}
