export interface Cliente {
    cuit: string;
    nombre: string;
    email: string;
    saldo: number;
    id_xubio: string;
    last_doc_date: string;
}
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