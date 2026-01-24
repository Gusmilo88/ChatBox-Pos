export interface MessageRequest {
  from: string; // E.164 format
  text: string;
}

export interface MessageResponse {
  replies: string[];
}

export interface SessionData {
  name?: string;
  nombre?: string | null; // Nombre del cliente desde Firebase (puede ser null)
  email?: string;
  interest?: string;
  cuit?: string;
  cuit_raw?: string; // CUIT sin validar (raw input)
  cliente?: { nombre?: string; cuit?: string }; // Datos del cliente desde Firestore (cuando CUIT existe)
  _inboundMessageId?: string; // ID del mensaje entrante para idempotencia de menús
  _messageType?: string; // Tipo de mensaje (audio, image, document, etc.)
  lastMenuState?: string; // Último estado de menú mostrado (para audio)
  // Factura electrónica
  factura_raw_messages?: string[]; // Mensajes acumulados para parsear factura
  factura_fields?: {
    cuit_emisor?: string;
    concepto?: string;
    importe_total?: string;
    fecha_operacion?: string;
    receptor?: string;
  };
  factura_editing_field?: string; // Campo que se está editando actualmente
  factura_clean_text?: string; // Texto limpio para envío interno a Belén
}

export interface Session {
  id: string;
  state: string;
  data: SessionData;
  createdAt: Date;
  lastActivityAt: Date;
  ttl: number; // TTL en minutos
}
