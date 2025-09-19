import cors from 'cors';
import type { RequestHandler } from 'express';
export declare function buildCors(): (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
export declare function secureHeaders(): (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare function limiter(): import("express-rate-limit").RateLimitRequestHandler;
export declare function requireApiKey(): RequestHandler;
//# sourceMappingURL=security.d.ts.map