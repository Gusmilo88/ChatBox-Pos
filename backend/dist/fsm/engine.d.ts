import { Session } from '../types/message';
export declare class FSMSessionManager {
    private sessions;
    private cleanupInterval;
    private formatARS;
    constructor();
    private cleanupExpiredSessions;
    private getOrCreateSession;
    private handleGlobalCommands;
    processMessage(from: string, text: string): Promise<{
        session: Session;
        replies: string[];
    }>;
    private processState;
    private handleStart;
    private handleWaitCuit;
    private handleClienteMenu;
    private handleNoClienteName;
    private handleNoClienteEmail;
    private handleNoClienteInterest;
    destroy(): void;
}
//# sourceMappingURL=engine.d.ts.map