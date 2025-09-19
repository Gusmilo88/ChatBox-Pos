/**
 * Valida un CUIT usando el algoritmo de AFIP
 * @param cuit - CUIT a validar (solo números)
 * @returns true si es válido, false si no
 */
export function validarCUIT(cuit: string): boolean {
  // Remover espacios y caracteres no numéricos
  const cleanCuit = cuit.replace(/\D/g, '');
  
  // Debe tener exactamente 11 dígitos
  if (cleanCuit.length !== 11) {
    return false;
  }
  
  // Convertir a array de números
  const digits = cleanCuit.split('').map(Number);
  
  // Algoritmo de validación AFIP
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * multipliers[i];
  }
  
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? remainder : 11 - remainder;
  
  return checkDigit === digits[10];
}
