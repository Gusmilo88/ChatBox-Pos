import { Request, Response } from 'express';
import { z } from 'zod';
/**
 * Rutas de prueba para 360dialog WhatsApp API
 *
 * TODO: Si todo funciona correctamente con 360dialog:
 * - Reemplazar referencia en src/index.ts para cambiar la ruta base:
 *   app.use('/api/whatsapp', requireApiKey(), wa360TestRouter);
 * - O mantener ambas implementaciones y usar un flag de configuración
 *
 * Todas las rutas están protegidas por x-api-key header.
 */
declare const router: import("express-serve-static-core").Router;
export declare const sendTestMessageSchema: z.ZodObject<{
    to: z.ZodString;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
    to: string;
}, {
    text: string;
    to: string;
}>;
export declare const handleTestSend: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export default router;
//# sourceMappingURL=wa360_test.d.ts.map