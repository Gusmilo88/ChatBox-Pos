import logger from '../libs/logger'
import { config } from '../config/env'

/**
 * Operador disponible para derivación
 */
export interface Operator {
  name: string
  phone: string // Número de WhatsApp en formato E.164
  keywords: string[] // Palabras clave que activan la derivación
  priority: number // Prioridad (mayor = más importante)
  default?: boolean // Si es true, se usa cuando no hay match
}

/**
 * Resultado de la detección de derivación
 */
export interface DerivationResult {
  shouldDerive: boolean
  operator?: Operator
  reason?: string
}

/**
 * Obtener operadores configurados desde variables de entorno
 * Formato esperado en .env:
 * OPERATORS_CONFIG={"operators":[{"name":"Belén","phone":"+54911XXXX-XXXX","keywords":["factura","facturación","monotributo"],"priority":10},{"name":"María","phone":"+54911YYYY-YYYY","keywords":["turno","consulta","cita"],"priority":10},{"name":"Iván","phone":"+54911ZZZZ-ZZZZ","keywords":["urgente","importante","contador"],"priority":20,"default":true}]}
 */
function getOperators(): Operator[] {
  try {
    const operatorsConfig = config.operatorsConfig
    
    if (!operatorsConfig) {
      logger.warn('No hay operadores configurados, usando valores por defecto')
      return getDefaultOperators()
    }

    // Parsear JSON si es string
    let parsed: { operators: Operator[] }
    if (typeof operatorsConfig === 'string') {
      parsed = JSON.parse(operatorsConfig)
    } else {
      parsed = operatorsConfig as { operators: Operator[] }
    }

    if (!parsed.operators || !Array.isArray(parsed.operators)) {
      logger.warn('Formato inválido de operadores, usando valores por defecto')
      return getDefaultOperators()
    }

    // Validar y normalizar operadores
    const operators: Operator[] = parsed.operators
      .filter(op => op.name && op.phone && Array.isArray(op.keywords))
      .map(op => ({
        name: op.name.trim(),
        phone: normalizePhone(op.phone),
        keywords: op.keywords.map(k => k.toLowerCase().trim()),
        priority: op.priority || 10,
        default: op.default || false
      }))

    if (operators.length === 0) {
      logger.warn('No hay operadores válidos, usando valores por defecto')
      return getDefaultOperators()
    }

    logger.info('Operadores cargados', {
      count: operators.length,
      names: operators.map(op => op.name)
    })

    return operators
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('Error cargando operadores', { error: msg })
    return getDefaultOperators()
  }
}

/**
 * Operadores por defecto (se usarán hasta que se configuren)
 */
function getDefaultOperators(): Operator[] {
  return [
    {
      name: 'Iván',
      phone: config.ivanPhone || '',
      keywords: ['urgente', 'importante', 'contador', 'hablar con ivan', 'ivan'],
      priority: 20,
      default: true
    }
  ]
}

/**
 * Normalizar número de teléfono a formato E.164
 */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '')
  
  if (cleaned.startsWith('+')) {
    return cleaned
  }
  
  if (cleaned.startsWith('54')) {
    return '+' + cleaned
  }
  
  if (cleaned.startsWith('9')) {
    return '+54' + cleaned
  }
  
  if (/^\d+$/.test(cleaned)) {
    return '+549' + cleaned
  }
  
  return phone // Devolver original si no se puede normalizar
}

/**
 * Detectar si un mensaje debe derivarse y a quién
 * Analiza el texto del mensaje y determina el operador más apropiado
 */
export function detectDerivation(text: string, operators?: Operator[]): DerivationResult {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { shouldDerive: false }
  }

  const availableOperators = operators || getOperators()
  
  if (availableOperators.length === 0) {
    logger.warn('No hay operadores disponibles para derivación')
    return { shouldDerive: false }
  }

  // Normalizar texto (minúsculas, sin acentos)
  const normalizedText = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .trim()

  // Buscar matches por operador
  const matches: Array<{ operator: Operator; score: number; matchedKeywords: string[] }> = []

  for (const operator of availableOperators) {
    const matchedKeywords: string[] = []
    let score = 0

    for (const keyword of operator.keywords) {
      // Buscar palabra completa (no substring para evitar falsos positivos)
      const keywordNormalized = keyword
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      
      // Crear regex para buscar palabra completa
      const regex = new RegExp(`\\b${keywordNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      
      if (regex.test(normalizedText)) {
        matchedKeywords.push(keyword)
        score += operator.priority // Sumar prioridad del operador
      }
    }

    if (matchedKeywords.length > 0) {
      matches.push({
        operator,
        score: score + (matchedKeywords.length * 5), // Bonus por cantidad de matches
        matchedKeywords
      })
    }
  }

  // Si hay matches, usar el de mayor score
  if (matches.length > 0) {
    // Ordenar por score descendente
    matches.sort((a, b) => b.score - a.score)
    const bestMatch = matches[0]

    logger.info('Derivación detectada', {
      operator: bestMatch.operator.name,
      score: bestMatch.score,
      matchedKeywords: bestMatch.matchedKeywords,
      textPreview: text.substring(0, 50)
    })

    return {
      shouldDerive: true,
      operator: bestMatch.operator,
      reason: `Coincidencias: ${bestMatch.matchedKeywords.join(', ')}`
    }
  }

  // Si no hay matches, usar operador por defecto si existe
  const defaultOperator = availableOperators.find(op => op.default)
  if (defaultOperator) {
    logger.info('Usando operador por defecto', {
      operator: defaultOperator.name,
      textPreview: text.substring(0, 50)
    })

    return {
      shouldDerive: true,
      operator: defaultOperator,
      reason: 'Sin coincidencias específicas, usando operador por defecto'
    }
  }

  // No derivar si no hay match ni operador por defecto
  return { shouldDerive: false }
}

/**
 * Obtener operador por nombre
 */
export function getOperatorByName(name: string): Operator | null {
  const operators = getOperators()
  return operators.find(op => op.name.toLowerCase() === name.toLowerCase()) || null
}

/**
 * Obtener operador por número de teléfono
 */
export function getOperatorByPhone(phone: string): Operator | null {
  const operators = getOperators()
  const normalizedPhone = normalizePhone(phone)
  return operators.find(op => normalizePhone(op.phone) === normalizedPhone) || null
}

/**
 * Obtener todos los operadores configurados
 */
export function getAllOperators(): Operator[] {
  return getOperators()
}

