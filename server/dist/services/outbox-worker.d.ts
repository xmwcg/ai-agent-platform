export declare class OutboxWorker {
    static start(): void;
    static stop(): void;
    private static poll;
    private static processEvent;
    private static handlePaymentConfirmed;
    private static handleRefundConfirmed;
    private static handleCreditsReversed;
    private static handleOrderExpired;
    private static sleep;
}
//# sourceMappingURL=outbox-worker.d.ts.map