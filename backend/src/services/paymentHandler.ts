/**
 * Handler de pagos por app (Bio Libre)
 * Maneja el flujo completo de pago: pedir CUIT, validar, buscar cliente, determinar monto, enviar link
 */

import logger from '../libs/logger'
import { getClienteByCuit } from './clientsRepo'
import { limpiarCuit } from '../utils/cuit'
import { REPLIES, maskCuit } from './replies'

/**
 * Resultado del handler de pago
 */
export interface PaymentHandlerResult {
  success: boolean
  message: string
  needsCuit?: boolean
  cuit?: string
  cliente?: {
    nombre: string
    deuda_honorarios?: number
    monto_monotributo?: number
    deuda?: number
  }
}

/**
 * Formatear monto en pesos argentinos
 */
function formatMonto(monto: number | undefined | null): string {
  if (monto === undefined || monto === null || isNaN(monto)) {
    return '$0,00'
  }
  return monto.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/**
 * Determinar monto según tipo de pago
 */
function getMontoForPaymentType(
  cliente: { deuda_honorarios?: number; monto_monotributo?: number; deuda?: number },
  paymentType: 'honorarios' | 'monotributo' | 'deuda_generica'
): number {
  switch (paymentType) {
    case 'honorarios':
      return cliente.deuda_honorarios ?? 0
    case 'monotributo':
      // Si pregunta por deuda, usar deuda; si no, usar monto_monotributo
      return cliente.deuda ?? cliente.monto_monotributo ?? 0
    case 'deuda_generica':
      // Para deuda genérica, priorizar deuda_honorarios, luego deuda, luego monto_monotributo
      return cliente.deuda_honorarios ?? cliente.deuda ?? cliente.monto_monotributo ?? 0
    default:
      return 0
  }
}

/**
 * Handler principal de pago
 */
export async function handlePayment(
  text: string,
  cuitInput: string | null | undefined,
  paymentType: 'honorarios' | 'monotributo' | 'deuda_generica'
): Promise<PaymentHandlerResult> {
  try {
    // A) Si NO dio CUIT, pedirlo
    if (!cuitInput || cuitInput.trim().length === 0) {
      logger.info('payment_handler_needs_cuit', { 
        paymentType,
        cuit: '***'
      })
      return {
        success: false,
        message: REPLIES.askCuit,
        needsCuit: true
      }
    }

    // B) Validar CUIT
    const cuitLimpio = limpiarCuit(cuitInput)
    if (cuitLimpio.length !== 11) {
      logger.info('payment_handler_invalid_cuit', { 
        cuit: maskCuit(cuitInput)
      })
      return {
        success: false,
        message: REPLIES.cuitInvalid,
        needsCuit: true
      }
    }

    // C) Buscar en Firestore
    const cliente = await getClienteByCuit(cuitLimpio)

    // D) Si NO EXISTE cliente
    if (!cliente || !cliente.exists) {
      logger.info('payment_handler_cliente_not_found', { 
        cuit: maskCuit(cuitLimpio)
      })
      return {
        success: false,
        message: REPLIES.cuitNotFound,
        needsCuit: false,
        cuit: cuitLimpio
      }
    }

    // E) Si EXISTE cliente y es pago de HONORARIOS (respuesta específica)
    const clienteData = cliente.data!
    const nombre = clienteData.nombre || undefined

    if (paymentType === 'honorarios') {
      // Respuesta PREMIUM específica para honorarios (sin monto, sin inventar datos)
      const message = REPLIES.paymentHonorarios(nombre)
      
      logger.info('payment_handler_honorarios_success', {
        cuit: maskCuit(cuitLimpio),
        nombre: nombre ? '***' : 'no_name',
        paymentType
      })
      
      return {
        success: true,
        message,
        needsCuit: false,
        cuit: cuitLimpio,
        cliente: {
          nombre: nombre || 'cliente',
          deuda_honorarios: clienteData.deuda_honorarios,
          monto_monotributo: clienteData.monto_monotributo,
          deuda: clienteData.deuda
        }
      }
    }

    // Para monotributo o deuda genérica, mantener flujo original
    let message = `Listo, ${nombre || 'cliente'} ✅ ya encontré tus datos.\n\n`

    // 2) Determinar monto
    const monto = getMontoForPaymentType(clienteData, paymentType)

    // 3) Informar monto
    if (monto > 0) {
      message += `Monto informado: ${formatMonto(monto)}.\n\n`
    } else {
      message += `Por el momento no figura un monto cargado para eso. Si querés, lo revisamos y te confirmamos.\n\n`
    }

    // 4) Indicar que NO hay que descargar nada
    message += `No hace falta descargar nada ✅ Entrás desde el navegador con tu CUIT.\n\n`

    // 5) Enviar link fijo
    message += `https://app.posyasociados.com/login\n\n`

    // 6) Indicar forma de pago (Bio Libre)
    message += `Ahí podés pagar por Bio Libre.\n\n`

    // 7) Cierre
    message += `Si querés, cuando lo hagas avisame y lo verificamos 👋`

    logger.info('payment_handler_success', {
      cuit: maskCuit(cuitLimpio),
      nombre: nombre ? '***' : 'no_name',
      paymentType,
      monto
    })

    return {
      success: true,
      message,
      needsCuit: false,
      cuit: cuitLimpio,
        cliente: {
          nombre: nombre || 'cliente',
          deuda_honorarios: clienteData.deuda_honorarios,
          monto_monotributo: clienteData.monto_monotributo,
          deuda: clienteData.deuda
        }
    }
  } catch (error) {
    const errorMsg = (error instanceof Error) ? error.message : String(error)
    logger.error('payment_handler_error', {
      error: errorMsg,
      cuitInput,
      paymentType
    })

    return {
      success: false,
      message: 'Hubo un error al procesar tu solicitud. ¿Querés que Iván te contacte?',
      needsCuit: false
    }
  }
}

/**
 * Preguntar aclaratoria una vez si el tipo de pago es genérico
 */
export function askPaymentTypeClarification(): PaymentHandlerResult {
  return {
    success: false,
    message: '¿Querés pagar honorarios o monotributo?',
    needsCuit: false
  }
}

