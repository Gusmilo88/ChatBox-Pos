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
  hablarVolverState?: string; // Estado al que volver desde "Hablar con alguien" (Volver)
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
  pendingHonorariosMonto?: boolean; // Flag para responder monto después de validar CUIT
  // Consulta libre (RI y Otro tipo de cliente)
  consulta_libre_text?: string; // Texto acumulado de la consulta (string con saltos)
  consulta_libre_textCount?: number; // Contador de mensajes de texto enviados
  consulta_libre_media?: Array<{
    type: string; // 'audio' | 'voice' | 'image' | 'document' | 'video' | 'file'
    mediaId?: string; // ID del media en WhatsApp
    mimeType?: string; // MIME type si está disponible
    messageId?: string; // ID del mensaje
    ts: Date; // Timestamp de recepción
  }>;
  consultaLibreLastAckAtByState?: { [stateKey: string]: number }; // Timestamps en ms del último ACK por estado (para throttling)
}

export interface Session {
  id: string;
  state: string;
  data: SessionData;
  createdAt: Date;
  lastActivityAt: Date;
  ttl: number; // TTL en minutos
}
