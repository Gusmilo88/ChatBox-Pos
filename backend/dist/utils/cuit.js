"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.limpiarCuit = limpiarCuit;
exports.validarCUIT = validarCUIT;
/**
 * Normaliza y limpia un CUIT: trim, remover espacios internos, puntos, guiones, solo números
 * @param cuit - CUIT a limpiar (puede venir con formato: "20.338.385.316", "20-338-385-316", "20 338 385 316", etc.)
 * @returns CUIT limpio (solo números, 11 dígitos)
 *
 * Ejemplos:
 * - "20.338.385.316" -> "20338385316"
 * - "20-338-385-316" -> "20338385316"
 * - "20 338 385 316" -> "20338385316"
 * - "  20338385316  " -> "20338385316"
 */
function limpiarCuit(cuit) {
    if (!cuit || typeof cuit !== 'string') {
        return '';
    }
    // 1. Trim (remover espacios al inicio y final)
    let normalized = cuit.trim();
    // 2. Remover todos los caracteres no numéricos (espacios, puntos, guiones, etc.)
    normalized = normalized.replace(/\D/g, '');
    return normalized;
}
/**
 * Valida un CUIT usando el algoritmo de AFIP
 * @param cuit - CUIT a validar (solo números)
 * @returns true si es válido, false si no
 */
function validarCUIT(cuit) {
    // Remover espacios y caracteres no numéricos
    const cleanCuit = limpiarCuit(cuit);
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
