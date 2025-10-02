/**
 * Interfaz para drivers de WhatsApp
 * Permite intercambiar entre diferentes implementaciones (mock, cloud, etc.)
 */
export interface WhatsAppSendResult {
    ok: boolean;
    remoteId?: string;
    error?: string;
}
export interface WhatsAppDriver {
    sendText(args: {
        phone: string;
        text: string;
        idempotencyKey?: string;
    }): Promise<WhatsAppSendResult>;
}
export type DriverType = 'mock' | 'cloud' | 'local';
//# sourceMappingURL=whatsappDriver.d.ts.map