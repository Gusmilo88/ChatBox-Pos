/**
 * Helper para detectar "HABLAR CON ALGUIEN" y variantes con typos.
 * Sin IA; matching controlado para evitar falsos positivos.
 *
 * 10 tests manuales:
 * TRUE:  "Hablar con alguien" | "habla alguien" | "hablas con alguien" | "ablar con alguien"
 *        "hablar cn alguie"   | "hablar con algien" | "quiero hablar con alguien"
 *        "kiero hablar con alguien" | "nesecito hablar con alguien"
 * FALSE: "hablé con alguien" | "alguien" (solo, sin verbo)
 */

/**
 * Normaliza para matching: lower, quitar tildes, remover puntuación, colapsar espacios
 */
function normalizeForHandoff(text: string): string {
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

/** Substrings explícitos que activan el handoff */
const EXPLICIT_PHRASES = [
  'hablar con alguien',
  'habla con alguien',
  'habla alguien',
  'hablas con alguien',
  'abla alguien',
  'hablar con alg', // prefijo: alguien, alguein, alguie, alguen, algn, etc.
];

/** Variantes fuzzy de "alguien" (typos) */
const ALGUIEN_VARIANTS = [
  'alguien',
  'alguie',
  'alguen',
  'algn',
  'alguin',
  'alguein',
  'algun',
  'algien',
];

/** Verbos que piden hablar (evita "hablé" en pasado: "hable" no está) */
const VERB_ROOTS = ['hablar', 'habla', 'hablas', 'ablar', 'abla'];

/** Partículas "con" (typos "cn", "ocn") */
const CON_VARIANTS = ['con', 'cn', 'ocn'];

/**
 * Devuelve true si el texto pide razonablemente "hablar con alguien".
 * Incluye variantes con typos. Exige verbo de pedido para evitar falsos positivos.
 */
export function isHandoffToHuman(text: string): boolean {
  const norm = normalizeForHandoff(text);
  if (!norm) return false;

  // A) Substrings explícitos
  for (const phrase of EXPLICIT_PHRASES) {
    if (norm.includes(phrase)) return true;
  }

  // B) Fuzzy: (hablar|habla|abla) + (con|cn) + (alguien-like)
  const hasVerb = VERB_ROOTS.some((v) => norm.includes(v));
  const hasCon = CON_VARIANTS.some((c) => norm.includes(c));
  const hasAlguien = ALGUIEN_VARIANTS.some((a) => norm.includes(a));

  if (hasVerb && hasCon && hasAlguien) return true;

  return false;
}
