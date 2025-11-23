import 'dotenv/config';
declare class OutboxWorker {
    private driver;
    private isRunning;
    private intervalId?;
    constructor();
    start(): Promise<void>;
    stop(): Promise<void>;
    private processBatch;
    private processMessage;
    private findExistingSentMessage;
    private updateConversationMessageStatus;
    private getBackoffDelay;
}
export { OutboxWorker };
//# sourceMappingURL=outbox.d.ts.map