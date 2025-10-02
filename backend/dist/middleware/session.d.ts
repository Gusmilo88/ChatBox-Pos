import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            user?: {
                adminId: string;
                email: string;
                role: 'owner' | 'operador';
            };
        }
    }
}
export declare function requireSession(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireRole(roles: string[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function createSessionCookie(token: string): string;
export declare function clearSessionCookie(): string;
//# sourceMappingURL=session.d.ts.map