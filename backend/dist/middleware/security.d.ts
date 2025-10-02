import cors from 'cors';
import type { Request, Response, NextFunction } from 'express';
export declare function buildCors(): (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
export declare function secureHeaders(): (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare function globalRateLimit(): import("express-rate-limit").RateLimitRequestHandler;
export declare function messageRateLimit(): import("express-rate-limit").RateLimitRequestHandler;
export declare function requireAuth(): (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare function requireApiKey(): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare function requireRole(roles: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function validateInput(schema: any): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function validateQuery(schema: any): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function auditLog(action: string): (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=security.d.ts.map