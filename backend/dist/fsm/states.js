"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATE_TEXTS = exports.GlobalCommands = exports.FSMState = void 0;
var FSMState;
(function (FSMState) {
    FSMState["START"] = "START";
    FSMState["WAIT_CUIT"] = "WAIT_CUIT";
    FSMState["CLIENTE_MENU"] = "CLIENTE_MENU";
    FSMState["CLIENTE_ARCA"] = "CLIENTE_ARCA";
    FSMState["CLIENTE_FACTURA"] = "CLIENTE_FACTURA";
    FSMState["CLIENTE_VENTAS"] = "CLIENTE_VENTAS";
    FSMState["CLIENTE_REUNION"] = "CLIENTE_REUNION";
    FSMState["CLIENTE_IVAN"] = "CLIENTE_IVAN";
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
    [FSMState.START]: "¡Hola! 👋 Soy el asistente de POS & Asociados. Elegí una opción:\n\n1 Soy cliente\n2 Quiero ser cliente / Consultar servicios",
    [FSMState.WAIT_CUIT]: "Ese CUIT no parece válido. Probá otra vez (solo números).",
    [FSMState.CLIENTE_MENU]: "¡Hola! 👋 Soy el asistente de POS & Asociados. Elegí una opción:\n\n1. Consultar mi estado general en ARCA e Ingresos Brutos\n2. Solicitar una factura electrónica\n3. Enviar las ventas del mes\n4. Agendar una reunión\n5. Hablar con Iván por otras consultas",
    // Estados del flujo de cliente
    [FSMState.CLIENTE_ARCA]: "📊 Consulta de estado general\n\nPodés revisar en cualquier momento tu situación impositiva en ARCA e Ingresos Brutos a través de nuestra aplicación exclusiva.\n\n🔗 Ingresá con tu CUIT en este link:\nhttps://app.posyasociados.com/login\n\n🔄 Recordá que la información se actualiza todos los viernes a las 18:00 hs.\n\nSi necesitás ayuda para interpretar los datos o detectar alguna irregularidad, escribinos por acá y un asesor del estudio te asiste personalmente.\n\n1. Gracias, consulto en la App.\n2. Consultar a una persona.",
    [FSMState.CLIENTE_FACTURA]: "📄 Solicitud de Factura Electrónica\n\nPara emitir tu factura necesitamos que nos envíes:\n\n☑️ Tu CUIT\n☑️ Concepto (descripción del producto o servicio)\n☑️ Importe total.\n☑️ Fecha de la operación.\n☑️ Datos del receptor (CUIT o DNI)\n\n➡️ Una vez que tengamos la información, el estudio genera la factura y te la enviamos por este mismo chat o a tu mail.",
    [FSMState.CLIENTE_VENTAS]: "📋 Envío de Ventas Mensuales\n\nEs importante que nos envíes todas tus ventas para poder confeccionar correctamente tus declaraciones impositivas.\n\n☑️ Podés adjuntar directamente acá tu planilla de Excel o bien una foto de los comprobantes/tickets o resúmenes.\n☑️ Si no tenés la planilla, pedila escribiendo PLANILLA y te la enviamos al instante.\n\n⏰ Recordá: el envío debe hacerse antes del último día hábil de cada mes para evitar recargos o sanciones.",
    [FSMState.CLIENTE_REUNION]: "📅 Agendar una reunión\n\nElegí día y horario en nuestra agenda online:\n\n➡️ https://calendly.com/posyasociados/sincosto\n\n¡Gracias!",
    [FSMState.CLIENTE_IVAN]: "👤 Hablar con Iván\n\nPerfecto, en breve te contactaré con Iván.\n\n📞",
    [FSMState.NO_CLIENTE_NAME]: "Decime tu nombre y empresa.",
    [FSMState.NO_CLIENTE_EMAIL]: "Dejame tu email.",
    [FSMState.NO_CLIENTE_INTEREST]: "¿Qué te interesa? (alta cliente / honorarios / turno_consulta / otras_consultas)",
    [FSMState.HUMANO]: "Listo, te derivamos con el equipo. ¡Gracias! 🙌"
};
//# sourceMappingURL=states.js.map