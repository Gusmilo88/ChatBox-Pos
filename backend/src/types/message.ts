export interface MessageRequest {
  from: string; // E.164 format
  text: string;
}

export interface MessageResponse {
  replies: string[];
}

export interface SessionData {
  name?: string;
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
