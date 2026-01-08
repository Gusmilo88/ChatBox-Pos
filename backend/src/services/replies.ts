/**
 * Respuestas centralizadas del bot PREMIUM
 * Todas las respuestas fijas del sistema
 */

export const REPLIES = {
  // Off-topic
  offTopicFirst: 'Solo puedo ayudarte con consultas relacionadas al estudio contable Pos & Asociados 😊',
  offTopicSecond: 'Cuando tengas una consulta contable, escribinos y te ayudamos 🙌',
  
  // CUIT
  askCuit: 'Para poder ayudarte necesito tu CUIT (11 dígitos) 😊',
  cuitInvalid: 'El CUIT debe tener 11 dígitos. Probá otra vez 😊',
  cuitNotFound: 'No encuentro ese CUIT en nuestra base. ¿Querés que Iván te contacte para darte el alta?',
  
  // Pago de honorarios
  paymentHonorarios: (nombre?: string) => {
    const saludo = nombre ? `Hola ${nombre} 👋\n\n` : '';
    return `${saludo}Para pagar tus honorarios ingresá a https://app.posyasociados.com/login con tu CUIT.\n\nAhí podés pagar por Bio Libre ✅`;
  },
  
  // Derivaciones
  handoffTo: (nombre: string) => {
    return `Te derivo con ${nombre} 😊\n\nTe van a responder por este mismo chat.\n\nSi querés volver al inicio, escribí 'inicio' o 'menu'.`;
  },
  
  // Handoff activo
  handoffActive: 'Ya te derivamos con el equipo. En breve te responderán 🙌',
  
  // Errores
  error: 'Lo siento, hubo un error. Por favor intentá de nuevo.',
  errorNoData: 'No tengo esa información disponible. Te derivo con el equipo para que te ayuden mejor.',
  
  // Saludo inicial PREMIUM (solo una vez por conversación)
  greetingInitial: (hasRoleOrCuit: boolean) => {
    const intro = '¡Hola! 👋 Soy el asistente virtual del Estudio Contable Pos & Asociados.\n\n';
    const capabilities = 'Puedo ayudarte con monotributo, facturación, VEP/ARBA, honorarios y derivación al equipo.\n\n';
    
    if (hasRoleOrCuit) {
      return intro + capabilities + '¿En qué te ayudo hoy? 😊';
    } else {
      return intro + capabilities + '¿Sos cliente? Si sí, pasame tu CUIT (11 dígitos) 😊';
    }
  },
  
  // Saludo para clientes identificados (no es el inicial)
  greeting: (nombre?: string) => {
    if (nombre) {
      return `¡Hola ${nombre}! 👋 ¿En qué te ayudo hoy? 😊`;
    }
    return '¡Hola! 👋 ¿En qué te ayudo hoy? 😊';
  },
  
  // Menú
  menu: 'Elegí una opción:\n\n1. Consultar mi estado general en ARCA e Ingresos Brutos\n2. Solicitar una factura electrónica\n3. Enviar las ventas del mes\n4. Agendar una reunión\n5. Hablar con Iván por otras consultas',
  
  // Cliente no encontrado
  clienteNotFound: 'No te encuentro en nuestra base de clientes. ¿Querés que Iván te contacte para darte el alta?',
} as const;

/**
 * Enmascarar CUIT para logs (mostrar solo primeros 2 y últimos 3 dígitos)
 */
export function maskCuit(cuit: string | null | undefined): string {
  if (!cuit) return '***';
  const cleaned = cuit.replace(/\D/g, '');
  if (cleaned.length < 11) return '***';
  return `${cleaned.slice(0, 2)}***${cleaned.slice(-3)}`;
}

/**
 * Enmascarar teléfono para logs (mostrar solo últimos 4 dígitos)
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '***';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return '***';
  return `***${cleaned.slice(-4)}`;
}

