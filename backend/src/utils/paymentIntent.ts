/**
 * Helper para detectar intención de pago de honorarios.
 * Normaliza texto y busca keywords relacionadas con pago/honorarios/biolibre.
 */

/**
 * Normaliza texto para matching: lower, quitar tildes, remover puntuación, colapsar espacios
 */
function normalizeForPayment(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let s = text.trim().toLowerCase();
  // Quitar tildes (ñ se mantiene)
  s = s
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u');
  // Remover signos de puntuación
  s = s.replace(/[.,;:!?¡¿'"+*=()[\]{}—–-]+/g, ' ');
  // Colapsar espacios
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Keywords que activan intención de pago de honorarios */
const PAYMENT_KEYWORDS = [
  'honorarios',
  'pagar honorarios',
  'pago honorarios',
  'abonarte',
  'pagarte',
  'link para pagarte',
  'biolibre',
  'bio libre',
  'pago servicio',
  'pago de servicios',
  'me mandas el link',
  'mandame el link',
  'asi te pago',
  'así te pago',
  'link de pago',
  'link para pagar',
  'como pago',
  'cómo pago',
  'donde pago',
  'dónde pago'
];

/**
 * Devuelve true si el texto indica intención de pago de honorarios.
 */
export function isPaymentIntent(text: string): boolean {
  const norm = normalizeForPayment(text);
  if (!norm) return false;

  // Buscar keywords
  return PAYMENT_KEYWORDS.some(keyword => norm.includes(keyword));
}

/**
 * Devuelve true si el texto es el comando MONTO (case-insensitive, trim).
 */
export function isMontoCommand(text: string): boolean {
  const norm = normalizeForPayment(text);
  return norm === 'monto';
}
