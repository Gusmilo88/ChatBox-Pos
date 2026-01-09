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
  cuitInvalid: 'El CUIT ingresado no es válido. Escribilo sin puntos ni guiones, por favor.',
  cuitValidNotClient: 'No encontramos tu CUIT en nuestra base de clientes.\n\nSi querés, te conecto con Iván para darte de alta o ayudarte.\n\nEscribí 1 para hablar con Iván, o 2 para ingresar otro CUIT.',
  
  // Pago de honorarios
  paymentHonorarios: (nombre?: string) => {
    const saludo = nombre ? `Hola ${nombre} 👋\n\n` : '';
    return `${saludo}Para pagar tus honorarios ingresá a https://app.posyasociados.com/login con tu CUIT.\n\nAhí podés pagar por Bio Libre ✅`;
  },
  
  // Derivaciones específicas (FSM)
  handoffBelen: 'Perfecto 😊\n\nTe derivo con Belén, que se encarga de facturación en el estudio.\nEn breve te va a responder.',
  handoffElina: 'Bien 👍\n\nEste tema lo maneja Elina en el estudio.\nYa te derivo, en breve te responde.',
  handoffIvan: 'Perfecto 😊\n\nTe derivo con Iván para ayudarte con la consulta.\nEn breve te va a responder.',
  
  // Derivaciones genéricas
  handoffTo: (nombre: string) => {
    return `Te derivo con ${nombre} 😊\n\nTe van a responder por este mismo chat.\n\nSi querés volver al inicio, escribí 'inicio' o 'menu'.`;
  },
  
  // Handoff activo
  handoffActive: 'Ya te derivamos con el equipo. En breve te responderán 🙌',
  
  // Audios
  audioNotSupported: 'Gracias por el mensaje 😊\n\nPor el momento no puedo escuchar audios.\n\n¿Podés escribirme tu consulta así te ayudo mejor?',
  
  // Fallback controlado (para IA)
  fallbackMenu: 'No hay problema 😊\n\nDecime si necesitás ayuda con facturación, pagos o una consulta general.',
  
  // Errores
  error: 'Lo siento, hubo un error. Por favor intentá de nuevo.',
  errorNoData: 'No tengo esa información disponible. Te derivo con el equipo para que te ayuden mejor.',
  
  // No cliente - derivación a Iván
  noClienteDerivacion: 'Gracias. Veo que todavía no sos cliente del estudio.\n\nTe derivo con Iván para que pueda ayudarte.\nEn breve te va a responder.',
  
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

