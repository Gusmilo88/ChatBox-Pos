/**
 * Formatea un número como monto en pesos argentinos.
 * Formato: miles con punto, decimales con coma.
 * Ejemplos: 541148 -> "$541.148", 541148.5 -> "$541.148,50"
 */
export function formatARS(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0';
  }

  const num = Number(value);
  
  // Separar parte entera y decimal
  const partes = num.toFixed(2).split('.');
  const parteEntera = partes[0];
  const parteDecimal = partes[1];

  // Formatear parte entera con puntos para miles
  const parteEnteraFormateada = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  // Si los decimales son "00", omitirlos
  if (parteDecimal === '00') {
    return `$${parteEnteraFormateada}`;
  }

  return `$${parteEnteraFormateada},${parteDecimal}`;
}
