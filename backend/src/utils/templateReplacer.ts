/**
 * Utilidades para reemplazar placeholders en mensajes
 * Evita que aparezcan {{NOMBRE}} sin reemplazar
 */

import logger from '../libs/logger';

/**
 * Reemplaza {{NOMBRE}} en un texto con el nombre real
 * Si no hay nombre, lo elimina o usa "Hola 👋" sin nombre
 */
export function replaceNamePlaceholder(
  text: string,
  nombre?: string | null,
  displayName?: string | null
): string {
  // Guard: Si el texto contiene placeholders sin reemplazar, fallback seguro
  if (text.includes('{{') || text.includes('}}')) {
    // Intentar reemplazar
    let replaced = text;
    
    // Prioridad: nombre (Firebase) > displayName (WhatsApp profile)
    const realName = nombre || displayName || null;
    
    if (realName && realName.trim().length > 0) {
      replaced = replaced.replace(/\{\{NOMBRE\}\}/g, realName.trim());
    } else {
      // Si no hay nombre, eliminar el placeholder y ajustar el texto
      // Ejemplo: "Hola {{NOMBRE}} 👋" -> "Hola 👋"
      replaced = replaced.replace(/\{\{NOMBRE\}\}\s*/g, '');
      // Limpiar espacios dobles
      replaced = replaced.replace(/\s+/g, ' ').trim();
    }
    
    // Verificar que no queden placeholders
    if (replaced.includes('{{') || replaced.includes('}}')) {
      logger.warn('template_placeholder_not_replaced', {
        originalText: text.substring(0, 100),
        hasNombre: !!nombre,
        hasDisplayName: !!displayName
      });
      // Fallback: eliminar todo lo que esté entre {{ y }}
      replaced = replaced.replace(/\{\{[^}]+\}\}/g, '');
      replaced = replaced.replace(/\s+/g, ' ').trim();
    }
    
    logger.info('template_name_replaced', {
      hadPlaceholder: text.includes('{{NOMBRE}}'),
      usedName: realName || 'none',
      finalTextPreview: replaced.substring(0, 50)
    });
    
    return replaced;
  }
  
  // Si no hay placeholders, devolver tal cual
  return text;
}

/**
 * Valida que un texto no tenga placeholders sin reemplazar
 */
export function hasUnreplacedPlaceholders(text: string): boolean {
  return text.includes('{{') || text.includes('}}');
}
