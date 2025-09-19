export interface Lead {
    created_at: string;
    phone_e164: string;
    full_name: string;
    cuit?: string;
    email: string;
    city?: string;
    company?: string;
    interest: string;
    source: string;
    utm_campaign?: string;
    consent_ts: string;
    stage: string;
    assigned_to: string;
    last_msg_at: string;
    last_msg_text: string;
    notes?: string;
    tag1?: string;
    tag2?: string;
}
export declare class LeadsRepository {
    private filePath;
    constructor(filePath: string);
    private ensureFileExists;
    private createInitialFile;
    saveLead(phone: string, fullName: string, email: string, interest: string, cuit?: string): Promise<void>;
}
//# sourceMappingURL=leadsRepo.d.ts.map