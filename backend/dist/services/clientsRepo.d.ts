export declare function existsByCuit(cuit: string): Promise<boolean>;
export declare function getSaldo(cuit: string): Promise<number | null>;
export declare function getUltimosComprobantes(cuit: string): Promise<string[]>;
export declare class ClientsRepository {
    private filePath;
    private clientes;
    constructor(filePath: string);
    private initializeFile;
    private createInitialFile;
    private loadClientes;
    existsByCuit(cuit: string): boolean;
    getSaldo(cuit: string): Promise<number | null>;
    getUltimosComprobantes(cuit: string): Promise<string[]>;
}
//# sourceMappingURL=clientsRepo.d.ts.map