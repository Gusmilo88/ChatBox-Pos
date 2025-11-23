/**
 * Sistema de respuestas automáticas por horario y palabras clave
 */

import logger from '../libs/logger'

export interface AutoReplyRule {
  id: string
  name: string
  enabled: boolean
  type: 'keyword' | 'schedule'
  // Para tipo 'keyword'
  keywords?: string[] // Palabras clave que deben aparecer en el mensaje
  matchType?: 'any' | 'all' // 'any' = cualquier palabra, 'all' = todas las palabras
  response?: string // Respuesta automática
  // Para tipo 'schedule'
  schedule?: {
    days: number[] // 0 = domingo, 1 = lunes, ..., 6 = sábado
    startTime: string // Formato "HH:mm" (ej: "09:00")
    endTime: string // Formato "HH:mm" (ej: "18:00")
    timezone?: string // Por defecto "America/Argentina/Buenos_Aires"
  }
  scheduleResponse?: string // Respuesta cuando está fuera de horario
  // Configuración adicional
  priority: number // Mayor número = mayor prioridad
  isClientOnly?: boolean // Solo aplicar a clientes
  isLeadOnly?: boolean // Solo aplicar a leads
}

/**
 * Verifica si una regla de horario aplica en este momento
 */
function isScheduleActive(rule: AutoReplyRule): boolean {
  if (rule.type !== 'schedule' || !rule.schedule) {
    return false
  }

  const timezone = rule.schedule.timezone || 'America/Argentina/Buenos_Aires'
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
  const currentDay = now.getDay()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  // Verificar si el día actual está en la lista de días
  if (!rule.schedule.days.includes(currentDay)) {
    return false
  }

  // Verificar si la hora actual está dentro del rango
  return currentTime >= rule.schedule.startTime && currentTime <= rule.schedule.endTime
}

/**
 * Verifica si una regla de palabras clave aplica al mensaje
 */
function matchesKeywords(rule: AutoReplyRule, text: string): boolean {
  if (rule.type !== 'keyword' || !rule.keywords || rule.keywords.length === 0) {
    return false
  }

  const textLower = text.toLowerCase()
  const keywordsLower = rule.keywords.map(k => k.toLowerCase())

  if (rule.matchType === 'all') {
    // Todas las palabras deben estar presentes
    return keywordsLower.every(keyword => textLower.includes(keyword))
  } else {
    // Cualquier palabra debe estar presente
    return keywordsLower.some(keyword => textLower.includes(keyword))
  }
}

/**
 * Obtiene todas las reglas de respuestas automáticas desde Firebase
 */
export async function getAutoReplyRules(): Promise<AutoReplyRule[]> {
  try {
    const { collections } = await import('../firebase')
    const rulesSnapshot = await collections.autoReplyRules()
      .where('enabled', '==', true)
      .get()

    const rules: AutoReplyRule[] = []
    rulesSnapshot.forEach(doc => {
      const data = doc.data()
      rules.push({
        id: doc.id,
        ...data
      } as AutoReplyRule)
    })

    // Ordenar por prioridad (mayor primero)
    return rules.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('Error obteniendo reglas de respuestas automáticas', { error: msg })
    return []
  }
}

/**
 * Busca una respuesta automática que aplique al mensaje
 * Retorna null si no hay ninguna regla que aplique
 */
export async function findAutoReply(
  text: string,
  isClient: boolean,
  currentTime?: Date
): Promise<string | null> {
  try {
    const rules = await getAutoReplyRules()

    // Ordenar por prioridad (mayor primero)
    const sortedRules = rules.sort((a, b) => b.priority - a.priority)

    for (const rule of sortedRules) {
      if (!rule.enabled) continue

      // Verificar filtros de cliente/lead
      if (rule.isClientOnly && !isClient) continue
      if (rule.isLeadOnly && isClient) continue

      // Verificar tipo de regla
      if (rule.type === 'schedule') {
        // Si está fuera de horario, retornar respuesta
        if (!isScheduleActive(rule) && rule.scheduleResponse) {
          logger.info('Auto-reply activado por horario', {
            ruleId: rule.id,
            ruleName: rule.name,
            isClient
          })
          return rule.scheduleResponse
        }
      } else if (rule.type === 'keyword') {
        // Si coincide con las palabras clave, retornar respuesta
        if (matchesKeywords(rule, text) && rule.response) {
          logger.info('Auto-reply activado por palabras clave', {
            ruleId: rule.id,
            ruleName: rule.name,
            keywords: rule.keywords,
            isClient
          })
          return rule.response
        }
      }
    }

    return null
  } catch (error) {
    const msg = (error instanceof Error) ? error.message : String(error)
    logger.error('Error buscando auto-reply', { error: msg })
    return null
  }
}

