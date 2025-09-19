export type AiContext = {
    role: 'cliente' | 'no_cliente';
    interest?: 'alta_cliente' | 'honorarios' | 'turno_consulta' | 'otras_consultas';
    cuit?: string;
    nombre?: string;
    lastUserText?: string;
    history?: Array<{
        from: 'user' | 'bot';
        text: string;
    }>;
};
export declare function aiReply(ctx: AiContext): Promise<string>;
//# sourceMappingURL=ai.d.ts.map