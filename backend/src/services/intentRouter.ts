/**
 * Módulo de routing por intención
 * Determina qué acción tomar basándose en el mensaje del usuario
 */

import logger from '../libs/logger'

/**
 * Tipo de acción a realizar
 */
export type ActionType = 'AUTO_RESOLVE' | 'HANDOFF'

/**
 * Operador asignado
 */
export type AssignedTo = 'IA' | 'elina' | 'belen' | 'ivan'

/**
 * Tipo de pago
 */
export type PaymentType = 'honorarios' | 'monotributo' | 'deuda_generica' | null

/**
 * Resultado del routing
 */
export interface RoutingResult {
  action: ActionType
  assignedTo: AssignedTo
  needsCuit: boolean
  paymentType: PaymentType
  intent?: string // Intención detectada (para logging)
}

/**
 * Palabras clave para cada operador
 */
const OPERATOR_KEYWORDS = {
  elina: [
    'ingresos brutos',
    'ingresosbrutos',
    'vep',
    'qr',
    'cambios registrales',
    'arca',
    'afip',
    'domicilio',
    'actividad',
    'datos',
    'siradig',
    'deducciones',
    'ganancias',
    'empleada domestica',
    'casas particulares',
    'liquidaciones',
    'liquidacion'
  ],
  belen: [
    'factura',
    'facturacion',
    'facturar',
    'emitir factura',
    'comprobante',
    'monotributo',
    'deuda monotributo',
    'pago monotributo',
    'planes de pago',
    'plan de pago',
    'cuota caida',
    'rehabilitacion',
    'rehabilitar'
  ],
  ivan: [
    'alta',
    'baja',
    'altas',
    'bajas',
    'consulta compleja',
    'consultas complejas',
    'otra consulta',
    'otras consultas',
    'duda',
    'dudas',
    'hablar con ivan',
    'ivan'
  ]
}

/**
 * Palabras clave para pagos
 */
const PAYMENT_KEYWORDS = {
  honorarios: [
    'pagar honorarios',
    'honorarios',
    'pago honorarios',
    'deuda honorarios',
    'debo honorarios',
    'adeudo honorarios'
  ],
  monotributo: [
    'pagar monotributo',
    'monotributo',
    'pago monotributo',
    'deuda monotributo',
    'debo monotributo',
    'adeudo monotributo',
    'vencimiento monotributo'
  ],
  deuda_generica: [
    'pagar',
    'pago',
    'deuda',
    'debo',
    'adeudo',
    'vencimiento',
    'cuota',
    'cuotas',
    'pagar deuda',
    'pago deuda'
  ]
}

/**
 * Limpiar y normalizar texto para búsqueda
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .trim()
}

/**
 * Detectar tipo de pago en el mensaje
 */
function detectPaymentType(text: string): PaymentType {
  const normalized = normalizeText(text)

  // Buscar honorarios primero (más específico)
  if (PAYMENT_KEYWORDS.honorarios.some(keyword => normalized.includes(keyword))) {
    return 'honorarios'
  }

  // Buscar monotributo
  if (PAYMENT_KEYWORDS.monotributo.some(keyword => normalized.includes(keyword))) {
    return 'monotributo'
  }

  // Buscar deuda genérica
  if (PAYMENT_KEYWORDS.deuda_generica.some(keyword => normalized.includes(keyword))) {
    return 'deuda_generica'
  }

  return null
}

/**
 * Detectar operador basándose en palabras clave
 */
function detectOperator(text: string): AssignedTo | null {
  const normalized = normalizeText(text)

  // Buscar matches por operador (en orden de prioridad)
  const matches: Array<{ operator: AssignedTo; score: number }> = []

  // Elina
  const elinaMatches = OPERATOR_KEYWORDS.elina.filter(keyword => normalized.includes(keyword)).length
  if (elinaMatches > 0) {
    matches.push({ operator: 'elina', score: elinaMatches })
  }

  // Belén
  const belenMatches = OPERATOR_KEYWORDS.belen.filter(keyword => normalized.includes(keyword)).length
  if (belenMatches > 0) {
    matches.push({ operator: 'belen', score: belenMatches })
  }

  // Iván (menos específico, pero tiene palabras clave)
  const ivanMatches = OPERATOR_KEYWORDS.ivan.filter(keyword => normalized.includes(keyword)).length
  if (ivanMatches > 0) {
    matches.push({ operator: 'ivan', score: ivanMatches })
  }

  // Si hay matches, usar el de mayor score
  if (matches.length > 0) {
    matches.sort((a, b) => b.score - a.score)
    return matches[0].operator
  }

  return null
}

/**
 * Determinar si se puede resolver automáticamente (sin derivar)
 */
function canAutoResolve(text: string, paymentType: PaymentType | null): boolean {
  // Si es un pago, se puede resolver automáticamente con CUIT + Firestore + link
  if (paymentType) {
    return true
  }

  // Consultas simples de montos
  const normalized = normalizeText(text)
  const simpleQueries = [
    'cuanto debo',
    'cuanto adeudo',
    'monto',
    'saldo',
    'deuda',
    'consulta monto',
    'ver monto'
  ]

  if (simpleQueries.some(query => normalized.includes(query))) {
    return true
  }

  // Acceso a la app / cómo pagar
  const appQueries = [
    'como pagar',
    'donde pago',
    'link',
    'app',
    'aplicacion',
    'entrar',
    'acceso'
  ]

  if (appQueries.some(query => normalized.includes(query))) {
    return true
  }

  return false
}

/**
 * Router principal: analiza el mensaje y determina la acción
 */
export function routeIntent(
  text: string,
  hasCuit: boolean = false
): RoutingResult {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      action: 'HANDOFF',
      assignedTo: 'ivan',
      needsCuit: false,
      paymentType: null,
      intent: 'mensaje_vacio'
    }
  }

  // Detectar tipo de pago
  const paymentType = detectPaymentType(text)

  // Si es un pago, puede resolverse automáticamente
  if (paymentType) {
    const needsCuit = !hasCuit
    const action: ActionType = needsCuit ? 'AUTO_RESOLVE' : 'AUTO_RESOLVE'

    logger.info('intent_routing_payment', {
      paymentType,
      needsCuit,
      textPreview: text.substring(0, 50)
    })

    return {
      action,
      assignedTo: 'IA',
      needsCuit,
      paymentType,
      intent: `pago_${paymentType}`
    }
  }

  // Detectar operador
  const operator = detectOperator(text)

  // Si se puede resolver automáticamente, no derivar
  if (canAutoResolve(text, null)) {
    logger.info('intent_routing_auto_resolve', {
      textPreview: text.substring(0, 50)
    })

    return {
      action: 'AUTO_RESOLVE',
      assignedTo: 'IA',
      needsCuit: !hasCuit,
      paymentType: null,
      intent: 'consulta_simple'
    }
  }

  // Si hay operador detectado, derivar
  if (operator) {
    logger.info('intent_routing_handoff', {
      operator,
      textPreview: text.substring(0, 50)
    })

    return {
      action: 'HANDOFF',
      assignedTo: operator,
      needsCuit: false,
      paymentType: null,
      intent: `handoff_${operator}`
    }
  }

  // Si hay duda entre Elina y Belén, hacer 1 pregunta
  // (esto se maneja en el handler, no aquí)

  // Por defecto, derivar a Iván
  logger.info('intent_routing_default', {
    textPreview: text.substring(0, 50)
  })

  return {
    action: 'HANDOFF',
    assignedTo: 'ivan',
    needsCuit: false,
    paymentType: null,
    intent: 'handoff_default_ivan'
  }
}

