"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATE_TEXTS = exports.GlobalCommands = exports.FSMState = void 0;
var FSMState;
(function (FSMState) {
    FSMState["START"] = "START";
    FSMState["WAIT_CUIT"] = "WAIT_CUIT";
    FSMState["CLIENTE_MENU"] = "CLIENTE_MENU";
    FSMState["NO_CLIENTE_NAME"] = "NO_CLIENTE_NAME";
    FSMState["NO_CLIENTE_EMAIL"] = "NO_CLIENTE_EMAIL";
    FSMState["NO_CLIENTE_INTEREST"] = "NO_CLIENTE_INTEREST";
    FSMState["HUMANO"] = "HUMANO";
})(FSMState || (exports.FSMState = FSMState = {}));
var GlobalCommands;
(function (GlobalCommands) {
    GlobalCommands["MENU"] = "menu";
    GlobalCommands["VOLVER"] = "volver";
    GlobalCommands["HUMANO"] = "humano";
})(GlobalCommands || (exports.GlobalCommands = GlobalCommands = {}));
exports.STATE_TEXTS = {
    [FSMState.START]: "Hola 👋 soy el asistente del estudio.\nSi sos cliente, mandá tu CUIT (solo números).\nSi todavía no sos cliente, escribí quiero info.",
    [FSMState.WAIT_CUIT]: "Ese CUIT no parece válido. Probá otra vez (solo números).",
    [FSMState.CLIENTE_MENU]: "Perfecto ✅. ¿Qué necesitás?\n\n• Ver saldo\n• Recibir comprobantes\n• Hablar con un humano\n• Volver al inicio",
    [FSMState.NO_CLIENTE_NAME]: "Decime tu nombre y empresa.",
    [FSMState.NO_CLIENTE_EMAIL]: "Dejame tu email.",
    [FSMState.NO_CLIENTE_INTEREST]: "¿Qué te interesa? (alta cliente / honorarios / turno_consulta / otras_consultas)",
    [FSMState.HUMANO]: "Listo, te derivamos con el equipo. ¡Gracias! 🙌"
};
//# sourceMappingURL=states.js.map