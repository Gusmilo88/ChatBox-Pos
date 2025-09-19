export declare enum FSMState {
    START = "START",
    WAIT_CUIT = "WAIT_CUIT",
    CLIENTE_MENU = "CLIENTE_MENU",
    NO_CLIENTE_NAME = "NO_CLIENTE_NAME",
    NO_CLIENTE_EMAIL = "NO_CLIENTE_EMAIL",
    NO_CLIENTE_INTEREST = "NO_CLIENTE_INTEREST",
    HUMANO = "HUMANO"
}
export declare enum GlobalCommands {
    MENU = "menu",
    VOLVER = "volver",
    HUMANO = "humano"
}
export declare const STATE_TEXTS: {
    readonly START: "Hola 👋 soy el asistente del estudio.\nSi sos cliente, mandá tu CUIT (solo números).\nSi todavía no sos cliente, escribí quiero info.";
    readonly WAIT_CUIT: "Ese CUIT no parece válido. Probá otra vez (solo números).";
    readonly CLIENTE_MENU: "Perfecto ✅. ¿Qué necesitás?\n\n• Ver saldo\n• Recibir comprobantes\n• Hablar con un humano\n• Volver al inicio";
    readonly NO_CLIENTE_NAME: "Decime tu nombre y empresa.";
    readonly NO_CLIENTE_EMAIL: "Dejame tu email.";
    readonly NO_CLIENTE_INTEREST: "¿Qué te interesa? (alta cliente / honorarios / turno_consulta / otras_consultas)";
    readonly HUMANO: "Listo, te derivamos con el equipo. ¡Gracias! 🙌";
};
//# sourceMappingURL=states.d.ts.map