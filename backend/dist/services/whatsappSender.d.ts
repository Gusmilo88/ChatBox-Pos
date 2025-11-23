interface WhatsAppMessageResponse {
    success: boolean;
    messageId?: string;
    status?: 'sent' | 'failed' | 'mock';
    error?: string;
    mock?: boolean;
}
/**
 * Envía un mensaje de texto a través de WhatsApp Cloud API
 * @param to Número de teléfono del destinatario (formato internacional: +541151093439)
 * @param text Texto del mensaje a enviar
 * @returns Promise con resultado del envío
 */
export declare function sendWhatsAppMessage(to: string, text: string): Promise<WhatsAppMessageResponse>;
/**
 * Valida si el servicio WhatsApp está configurado correctamente
 * @returns true si está configurado, false si está en modo mock
 */
export declare function isWhatsAppConfigured(): boolean;
export {};
//# sourceMappingURL=whatsappSender.d.ts.map