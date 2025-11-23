import { Request, Response } from 'express';
/**
 * Rutas webhook para 360dialog WhatsApp Business API
 *
 * TODO: Si todo funciona correctamente con 360dialog:
 * - Reemplazar referencia en src/index.ts línea 35:
 *   app.use('/api/webhook/whatsapp', express.raw({ type: 'application/json' }), webhook360Router);
 * - Eliminar o deprecar src/routes/whatsapp.ts si ya no se usa Meta Cloud API
 *
 * Variables de entorno requeridas:
 * - WHATSAPP_VERIFY_TOKEN: Token para verificación del webhook
 */
declare const router: import("express-serve-static-core").Router;
/**
 * GET /api/webhook/whatsapp
 * Verificación del webhook (handshake inicial de 360dialog/Meta)
 *
 * Query params esperados:
 * - hub.mode: debe ser 'subscribe'
 * - hub.verify_token: debe coincidir con WHATSAPP_VERIFY_TOKEN
 * - hub.challenge: string aleatorio que debemos retornar
 */
export declare function handle360WebhookVerify(req: Request, res: Response): void;
/**
 * POST /api/webhook/whatsapp
 * Recibe eventos de mensajes entrantes de 360dialog
 *
 * IMPORTANTE: Responde rápidamente (200 OK) y procesa de forma asíncrona
 * para no bloquear el ciclo de eventos y cumplir con el timeout de 360dialog.
 */
export declare function handle360WebhookMessage(req: Request, res: Response): Promise<void>;
export default router;
//# sourceMappingURL=webhook360.d.ts.map