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
  _inboundMessageId?: string; // ID del mensaje entrante para idempotencia de menús
}

export interface Session {
  id: string;
  state: string;
  data: SessionData;
  createdAt: Date;
  lastActivityAt: Date;
  ttl: number; // TTL en minutos
}
