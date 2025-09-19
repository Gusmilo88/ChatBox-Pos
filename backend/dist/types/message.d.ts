export interface MessageRequest {
    from: string;
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
    ttl: number;
}
//# sourceMappingURL=message.d.ts.map