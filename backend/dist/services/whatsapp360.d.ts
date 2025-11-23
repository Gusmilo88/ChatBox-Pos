/**
 * Servicio para enviar mensajes a través de 360dialog WhatsApp Business API
 *
 * TODO: reemplazar referencia en routes/webhook360.ts y routes/wa360_test.ts
 * si todo funciona correctamente con 360dialog.
 *
 * Variables de entorno requeridas:
 * - D360_API_KEY: Token de API de 360dialog
 * - WHATSAPP_API_URL: URL base de la API (default: https://waba-v2.360dialog.io)
 */
interface WhatsApp360MessageResponse {
    success: boolean;
    messageId?: string;
    status?: 'sent' | 'failed' | 'mock';
    error?: string;
    mock?: boolean;
}
/**
 * Envía un mensaje de texto a través de 360dialog API
 * @param to Número de teléfono (formato internacional: +541151093439)
 * @param text Texto del mensaje a enviar
 * @returns Promise con resultado del envío
 */
export declare function send360Text(to: string, text: string): Promise<WhatsApp360MessageResponse>;
/**
 * Valida si el servicio 360dialog está configurado correctamente
 * @returns true si está configurado, false si está en modo mock
 */
export declare function is360dialogConfigured(): boolean;
export {};
//# sourceMappingURL=whatsapp360.d.ts.map