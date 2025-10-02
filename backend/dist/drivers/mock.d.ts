import { WhatsAppDriver, WhatsAppSendResult } from './whatsappDriver';
/**
 * Driver mock para WhatsApp
 * Simula el envío de mensajes con latencia y logging
 */
export declare class MockWhatsAppDriver implements WhatsAppDriver {
    sendText(args: {
        phone: string;
        text: string;
        idempotencyKey?: string;
    }): Promise<WhatsAppSendResult>;
}
//# sourceMappingURL=mock.d.ts.map