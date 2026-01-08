import { limpiarCuit, validarCUIT } from '../utils/cuit';
import logger from '../libs/logger';

/**
 * Detecta si un mensaje es off-topic (no relacionado con temas contables)
 */
export function isOffTopic(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const textLower = text.toLowerCase().trim();
  
  // Palabras clave contables/impositivas (si contiene alguna, NO es off-topic)
  const contableKeywords = [
    'cuit', 'monotributo', 'ingresos brutos', 'arca', 'afip', 'factura', 'facturación',
    'comprobante', 'pago', 'deuda', 'saldo', 'honorarios', 'vep', 'qr', 'domicilio',
    'siradig', 'ganancias', 'recibo', 'sueldo', 'empleada', 'doméstica', 'casas particulares',
    'plan de pago', 'cuota', 'rehabilitar', 'alta', 'baja', 'cliente', 'estudio contable',
    'pos y asociados', 'pos & asociados', 'contador', 'contable', 'impositivo', 'declaración',
    'ventas', 'reunión', 'consulta', 'servicio', 'precio', 'costo', 'tarifa', 'categoría',
    'responsable inscripto', 'ri', 'iva', 'impuesto', 'tributo', 'liquidación', 'boleta',
    'hablar con', 'derivar', 'elina', 'belén', 'belen', 'iván', 'ivan'
  ];

  // Si contiene alguna palabra clave contable, NO es off-topic
  const hasContableKeyword = contableKeywords.some(keyword => 
    textLower.includes(keyword)
  );

  if (hasContableKeyword) {
    return false;
  }

  // Palabras clave off-topic (si contiene alguna, es off-topic)
  const offTopicKeywords = [
    'messi', 'fútbol', 'futbol', 'deporte', 'receta', 'cocina', 'comida', 'restaurante',
    'película', 'pelicula', 'cine', 'música', 'musica', 'canción', 'cancion',
    'política', 'politica', 'presidente', 'gobierno', 'elección', 'eleccion',
    'clima', 'tiempo', 'lluvia', 'sol', 'temperatura',
    'chiste', 'broma', 'chiste', 'joke',
    'amor', 'novia', 'novio', 'pareja', 'matrimonio',
    'viaje', 'vacaciones', 'turismo', 'hotel',
    'auto', 'coche', 'carro', 'vehículo', 'vehiculo',
    'noticia', 'noticias', 'diario', 'periódico', 'periodico'
  ];

  // Si contiene palabra clave off-topic, es off-topic
  const hasOffTopicKeyword = offTopicKeywords.some(keyword => 
    textLower.includes(keyword)
  );

  return hasOffTopicKeyword;
}

/**
 * Extrae CUIT del texto (formato XX-XXXXXXXX-X o solo números)
 */
export function extractCUIT(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Buscar patrón CUIT: XX-XXXXXXXX-X o solo números (11 dígitos)
  const cuitMatch = text.match(/\b\d{2}[-]?\d{8}[-]?\d{1}\b/);
  
  if (cuitMatch) {
    const cuitLimpio = limpiarCuit(cuitMatch[0]);
    // Validar que tenga 11 dígitos
    if (cuitLimpio.length === 11) {
      return cuitLimpio;
    }
  }

  return null;
}

/**
 * Determina si se debe pedir CUIT al usuario
 */
export function shouldAskForCUIT(
  conversationState: {
    role?: 'cliente' | 'no_cliente' | null;
    cuit?: string | null;
  },
  text: string,
  messageCount?: number // Número de mensajes en la conversación
): boolean {
  // Si ya tiene CUIT, no pedir
  if (conversationState.cuit) {
    return false;
  }

  const textLower = text.toLowerCase().trim();

  // Indicadores de que es cliente o pregunta de cliente
  const clienteIndicators = [
    'soy cliente', 'soy un cliente', 'soy tu cliente',
    'saldo', 'comprobante', 'factura', 'pago', 'deuda', 'vep', 'qr',
    'arca', 'ingresos brutos', 'monotributo', 'honorarios',
    'mi cuenta', 'mi estado', 'mi situación', 'mi saldo', 'mi deuda'
  ];

  const isClienteQuery = clienteIndicators.some(indicator => 
    textLower.includes(indicator)
  );

  // Si menciona ser cliente o pregunta algo de cliente, SIEMPRE pedir CUIT
  if (isClienteQuery) {
    return true;
  }

  // Si es saludo simple, no pedir CUIT todavía (esperar siguiente mensaje)
  const isSimpleGreeting = ['hola', 'holi', 'holis', 'buenos días', 'buenas tardes', 'buenas noches', 'hi', 'hello'].includes(textLower);
  if (isSimpleGreeting) {
    return false;
  }

  // Si es el primer o segundo mensaje y no está identificado, pedir CUIT
  // (solo si el mensaje tiene contenido sustancial)
  if (messageCount !== undefined && messageCount <= 2 && textLower.length >= 10) {
    return true;
  }

  // Por defecto, no pedir (se pedirá en el flujo principal si corresponde)
  return false;
}

/**
 * Routing por keywords: determina a qué staff derivar
 */
export type StaffMember = 'elina' | 'belen' | 'ivan' | null;

export function routeToStaff(text: string): { staff: StaffMember; reason: string } {
  if (!text || typeof text !== 'string') {
    return { staff: null, reason: 'no_text' };
  }

  const textLower = text.toLowerCase().trim();

  // Detectar mención directa de nombre
  if (textLower.includes('elina')) {
    return { staff: 'elina', reason: 'mentioned_directly' };
  }
  if (textLower.includes('belén') || textLower.includes('belen')) {
    return { staff: 'belen', reason: 'mentioned_directly' };
  }
  if (textLower.includes('iván') || textLower.includes('ivan')) {
    return { staff: 'ivan', reason: 'mentioned_directly' };
  }

  // Keywords para ELINA (según especificación)
  const elinaKeywords = [
    'ingresos brutos', 'ingresosbrutos', 'vep', 'qr',
    'arba', 'rentas', 'planes de pago', 'plan de pago',
    'arca', 'domicilio', 'datos registrales', 'siradig', 'ganancias',
    'recibo de sueldo', 'recibo sueldo', 'empleada doméstica', 'empleada domestica',
    'casas particulares', 'casa particular'
  ];

  const matchesElina = elinaKeywords.some(keyword => textLower.includes(keyword));

  if (matchesElina) {
    return { staff: 'elina', reason: 'keyword_match' };
  }

  // Keywords para BELEN (según especificación)
  const belenKeywords = [
    'monotributo', 'deuda monotributo',
    'factura', 'facturas', 'emisión', 'emision', 'emitir', 'comprobante',
    'afip', 'iva',
    'cuota caída', 'cuota caida', 'rehabilitar plan'
    // NO incluir: "pago" genérico (solo si es monotributo específico)
  ];

  const matchesBelen = belenKeywords.some(keyword => textLower.includes(keyword));

  if (matchesBelen) {
    return { staff: 'belen', reason: 'keyword_match' };
  }

  // Keywords para IVAN (según especificación) - solo si menciona explícitamente
  const ivanKeywords = [
    'hablar con ivan', 'hablar con iván', 'hablar con contador', 'hablar con humano',
    'situaciones complejas', 'situación compleja', 'caso complejo',
    'familia', 'asesoramiento', 'asesorar',
    'temas personales', 'tema personal',
    'alta', 'baja', 'darme de alta', 'darme de baja',
    'consulta compleja', 'consultas complejas'
  ];

  const matchesIvan = ivanKeywords.some(keyword => textLower.includes(keyword));

  if (matchesIvan) {
    return { staff: 'ivan', reason: 'keyword_match' };
  }

  // NO hacer handoff por defecto - solo si hay match claro
  return { staff: null, reason: 'no_match' };
}

/**
 * Obtiene el nombre amigable del staff member
 */
export function getStaffName(staff: StaffMember): string {
  switch (staff) {
    case 'elina':
      return 'Elina';
    case 'belen':
      return 'Belén';
    case 'ivan':
      return 'Iván';
    default:
      return 'el equipo';
  }
}

