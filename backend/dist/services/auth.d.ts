export interface AuthUser {
    adminId: string;
    email: string;
    role: 'owner' | 'operador';
}
export interface AdminDoc {
    email: string;
    passwordHash: string;
    role: 'owner' | 'operador';
    createdAt: Date;
    lastLoginAt?: Date;
    isActive: boolean;
}
export declare function login(email: string, password: string): Promise<AuthUser>;
export declare function createSessionToken(user: AuthUser): string;
export declare function verifySessionToken(token: string): AuthUser;
export declare function createAdmin(email: string, password: string, role?: 'owner' | 'operador'): Promise<string>;
export declare function migratePasswords(): Promise<{
    migrated: number;
    errors: string[];
}>;
//# sourceMappingURL=auth.d.ts.map