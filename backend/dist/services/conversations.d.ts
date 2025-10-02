import type { ConversationListResponse, ConversationDetail, IncomingMessageRequest, ReplyRequest } from '../types/conversations';
export declare function listConversations(params: {
    query?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    isClient?: boolean;
    needsReply?: boolean;
}): Promise<ConversationListResponse>;
export declare function getConversationById(id: string): Promise<ConversationDetail>;
export declare function simulateIncoming(request: IncomingMessageRequest): Promise<{
    conversationId: string;
}>;
export declare function enqueueReply(conversationId: string, request: ReplyRequest): Promise<void>;
/**
 * Helper para agregar mensaje del operador a una conversación
 */
export declare function appendOperatorMessage(conversationId: string, text: string): Promise<string>;
/**
 * Helper para encolar mensaje en outbox
 */
export declare function enqueueOutbox(conversationId: string, phone: string, text: string, idempotencyKey?: string): Promise<string>;
/**
 * Helper para marcar estado de entrega de un mensaje
 */
export declare function markMessageDelivery(conversationId: string, messageId: string, status: 'sent' | 'failed'): Promise<void>;
//# sourceMappingURL=conversations.d.ts.map