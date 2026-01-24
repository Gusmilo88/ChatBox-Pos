/**
 * Pool de frases humanas aleatorias para derivaciones
 * NO incluir: "Dale, lo veo…"
 */

export type NombrePersona = 'Iván Pos' | 'Belén Maidana' | 'Elina Maidana';

const FRASES_DERIVACION: Array<(nombre: NombrePersona) => string> = [
  (nombre) => `Entendido 🙂 ahora te derivo con ${nombre}.`,
  (nombre) => `Perfecto 🙌 te va a atender ${nombre}.`,
  (nombre) => `Muy bien 😊 ya te pongo en contacto con ${nombre}.`,
  (nombre) => `Listo 👌 te derivo con ${nombre}.`,
  (nombre) => `Dale 🙂 en un momento te atiende ${nombre}.`,
  (nombre) => `Excelente 🙌 te comunico con ${nombre}.`,
  (nombre) => `Perfecto 😄 ya te contacto con ${nombre}.`,
  (nombre) => `Perfecto 🙌 te derivo con ${nombre}.`,
  (nombre) => `Entendido 🙂 te derivo con ${nombre}.`
];

/**
 * Obtiene una frase aleatoria para derivación
 */
export function getFraseDerivacion(nombre: NombrePersona): string {
  const randomIndex = Math.floor(Math.random() * FRASES_DERIVACION.length);
  return FRASES_DERIVACION[randomIndex](nombre);
}
