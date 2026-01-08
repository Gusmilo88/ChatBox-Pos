/**
 * Gestor de handoff interno
 * Maneja la derivación de conversaciones a operadores (Elina, Belén, Iván)
 * El cliente SIEMPRE ve el número del BOT, nunca números personales
 */

import logger from '../libs/logger'
import { collections } from '../firebase'
import { forwardToOperator } from './operatorForwarding'
import { getOperatorByName, type Operator } from './autoDerivation'
import { enqueueOutbox } from './conversations'

/**
 * Estados de handoff
 */
export type HandoffStatus = 'HANDOFF_ACTIVE' | 'HANDOFF_CLOSED' | 'IA_ACTIVE'

/**
 * Operadores disponibles con sus nombres formateados
 */
const OPERATOR_NAMES: Record<string, string> = {
  elina: 'Elina – POS & Asociados',
  belen: 'Belén – POS & Asociados',
  ivan: 'Iván – POS & Asociados',
  IA: 'IA – POS & Asociados'
}

/**
 * Mensajes premium para notificar al cliente sobre el handoff
 */
function getHandoffMessage(operatorName: string): string {
  const name = OPERATOR_NAMES[operatorName.toLowerCase()] || operatorName
  const emoji = operatorName.toLowerCase() === 'ivan' ? '👨‍💼' : '👩‍💼'
  return `Perfecto, te va a atender ${name} ${emoji}.`
}

/**
 * Realizar handoff a un operador
 */
export async function performHandoff(
  conversationId: string,
  clientPhone: string,
  clientName: string | null,
  messageText: string,
  assignedTo: 'elina' | 'belen' | 'ivan'
): Promise<void> {
  try {
    // Obtener operador
    const operatorName = assignedTo === 'elina' ? 'Elina' : assignedTo === 'belen' ? 'Belén' : 'Iván'
    const operator = getOperatorByName(operatorName)

    if (!operator) {
      logger.error('handoff_operator_not_found', { assignedTo, operatorName })
      throw new Error(`Operador ${operatorName} no encontrado`)
    }

    // VALIDACIÓN CRÍTICA: Verificar que operatorPhone no esté vacío
    if (!operator.phone || operator.phone.trim() === '') {
      logger.warn('operator_missing_phone', {
        conversationId,
        assignedTo,
        operatorName: operator.name
      })
      // NO hacer handoff, NO setear handoffTo, NO silenciar IA
      // Limpiar handoffTo si estaba seteado
      await collections.conversations().doc(conversationId).update({
        handoffTo: null,
        updatedAt: new Date()
      })
      throw new Error(`Operador ${operatorName} no tiene teléfono configurado`)
    }

    // Enviar mensaje al cliente indicando el responsable
    const handoffMessage = getHandoffMessage(assignedTo)
    await enqueueOutbox(conversationId, clientPhone, handoffMessage)

    // Setear estado de conversación
    await collections.conversations().doc(conversationId).update({
      handoffStatus: 'HANDOFF_ACTIVE' as HandoffStatus,
      assignedTo: operator.phone,
      assignedToName: operator.name,
      assignedAt: new Date(),
      updatedAt: new Date()
    })

    // Reenviar mensaje al operador
    await forwardToOperator(
      conversationId,
      clientPhone,
      clientName,
      messageText,
      operator
    )

    logger.info('handoff_performed', {
      conversationId,
      assignedTo,
      operatorName: operator.name,
      clientPhone: clientPhone.substring(0, 10) + '***'
    })
  } catch (error) {
    const errorMsg = (error instanceof Error) ? error.message : String(error)
    logger.error('handoff_error', {
      conversationId,
      assignedTo,
      error: errorMsg
    })
    throw error
  }
}

/**
 * Cerrar handoff y volver a IA
 */
export async function closeHandoff(
  conversationId: string,
  clientPhone: string
): Promise<void> {
  try {
    // Actualizar estado
    await collections.conversations().doc(conversationId).update({
      handoffStatus: 'HANDOFF_CLOSED' as HandoffStatus,
      updatedAt: new Date()
    })

    // Mensaje de cierre
    const closeMessage = 'Gracias por contactarnos. Si necesitás algo más, escribime 👋'
    await enqueueOutbox(conversationId, clientPhone, closeMessage)

    logger.info('handoff_closed', {
      conversationId,
      clientPhone: clientPhone.substring(0, 10) + '***'
    })
  } catch (error) {
    const errorMsg = (error instanceof Error) ? error.message : String(error)
    logger.error('handoff_close_error', {
      conversationId,
      error: errorMsg
    })
    throw error
  }
}

/**
 * Verificar si una conversación está en handoff activo
 */
export async function isHandoffActive(conversationId: string): Promise<boolean> {
  try {
    const conversationDoc = await collections.conversations().doc(conversationId).get()
    if (!conversationDoc.exists) {
      return false
    }

    const data = conversationDoc.data()
    return data?.handoffStatus === 'HANDOFF_ACTIVE'
  } catch (error) {
    logger.error('handoff_check_error', {
      conversationId,
      error: (error as Error)?.message
    })
    return false
  }
}

