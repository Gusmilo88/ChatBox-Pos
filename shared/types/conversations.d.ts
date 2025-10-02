export type ConversationListItem = {
    id: string;
    phone: string;
    name?: string;
    isClient: boolean;
    lastMessageAt: string;
    unreadCount: number;
    needsReply: boolean;
};
export type ConversationListResponse = {
    items: ConversationListItem[];
    page: number;
    pageSize: number;
    total: number;
};
export type Message = {
    id: string;
    ts: string;
    from: 'usuario' | 'operador' | 'sistema';
    text: string;
    via?: 'whatsapp' | 'ia' | 'manual';
    aiSuggested?: boolean;
};
export type ConversationDetail = {
    id: string;
    phone: string;
    name?: string;
    isClient: boolean;
    needsReply: boolean;
    messages: Message[];
};
export type IncomingMessageRequest = {
    phone: string;
    text: string;
    via?: 'whatsapp' | 'ia' | 'manual';
};
export type ReplyRequest = {
    text: string;
    idempotencyKey?: string;
};
export type LoginRequest = {
    email: string;
    password: string;
};
export type LoginResponse = {
    accessToken: string;
    refreshToken: string;
    user: {
        email: string;
        role: 'owner' | 'operador';
    };
};
export type OutboxMessage = {
    id: string;
    conversationId: string;
    phone: string;
    text: string;
    createdAt: string;
    status: 'pending' | 'sent' | 'failed';
    tries: number;
    idempotencyKey?: string;
};
//# sourceMappingURL=conversations.d.ts.map