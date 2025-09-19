export enum FSMState {
  START = 'START',
  WAIT_CUIT = 'WAIT_CUIT',
  CLIENTE_MENU = 'CLIENTE_MENU',
  NO_CLIENTE_NAME = 'NO_CLIENTE_NAME',
  NO_CLIENTE_EMAIL = 'NO_CLIENTE_EMAIL',
  NO_CLIENTE_INTEREST = 'NO_CLIENTE_INTEREST',
  HUMANO = 'HUMANO'
}

export enum GlobalCommands {
  MENU = 'menu',
  VOLVER = 'volver',
  HUMANO = 'humano'
}

export const STATE_TEXTS = {
  [FSMState.START]: "Hola 👋 soy el asistente del estudio.\nSi sos cliente, mandá tu CUIT (solo números).\nSi todavía no sos cliente, escribí quiero info.",
  [FSMState.WAIT_CUIT]: "Ese CUIT no parece válido. Probá otra vez (solo números).",
  [FSMState.CLIENTE_MENU]: "Perfecto ✅. ¿Qué necesitás?\n\n• Ver saldo\n• Recibir comprobantes\n• Hablar con un humano\n• Volver al inicio",
  [FSMState.NO_CLIENTE_NAME]: "Decime tu nombre y empresa.",
  [FSMState.NO_CLIENTE_EMAIL]: "Dejame tu email.",
  [FSMState.NO_CLIENTE_INTEREST]: "¿Qué te interesa? (alta cliente / honorarios / turno_consulta / otras_consultas)",
  [FSMState.HUMANO]: "Listo, te derivamos con el equipo. ¡Gracias! 🙌"
} as const;
