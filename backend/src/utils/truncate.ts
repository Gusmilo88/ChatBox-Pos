/**
 * Trunca un texto a una longitud máxima, agregando "..." si es necesario
 * @param text - Texto a truncar
 * @param maxLength - Longitud máxima (default: 600)
 * @returns Texto truncado
 */
export function truncateText(text: string, maxLength: number = 600): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Buscar el último espacio antes del límite para no cortar palabras
  const truncated = text.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) { // Si el último espacio está cerca del final
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}
