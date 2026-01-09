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
}

export interface Session {
  id: string;
  state: string;
  data: SessionData;
  createdAt: Date;
  lastActivityAt: Date;
  ttl: number; // TTL en minutos
}
