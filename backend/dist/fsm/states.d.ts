export declare enum FSMState {
    START = "START",
    WAIT_CUIT = "WAIT_CUIT",
    CLIENTE_MENU = "CLIENTE_MENU",
    CLIENTE_ARCA = "CLIENTE_ARCA",
    CLIENTE_FACTURA = "CLIENTE_FACTURA",
    CLIENTE_VENTAS = "CLIENTE_VENTAS",
    CLIENTE_REUNION = "CLIENTE_REUNION",
    CLIENTE_IVAN = "CLIENTE_IVAN",
    NO_CLIENTE_NAME = "NO_CLIENTE_NAME",
    NO_CLIENTE_EMAIL = "NO_CLIENTE_EMAIL",
    NO_CLIENTE_INTEREST = "NO_CLIENTE_INTEREST",
    NO_CLIENTE_ALTA = "NO_CLIENTE_ALTA",
    NO_CLIENTE_ALTA_REQS = "NO_CLIENTE_ALTA_REQS",
    NO_CLIENTE_PLAN = "NO_CLIENTE_PLAN",
    NO_CLIENTE_RESPONSABLE = "NO_CLIENTE_RESPONSABLE",
    NO_CLIENTE_CONSULTA = "NO_CLIENTE_CONSULTA",
    HUMANO = "HUMANO"
}
export declare enum GlobalCommands {
    MENU = "menu",
    VOLVER = "volver",
    HUMANO = "humano"
}
export declare const STATE_TEXTS: {
    readonly START: "¡Hola! 👋 Soy el asistente de POS & Asociados. Elegí una opción:\n\n1 Soy cliente\n2 Quiero ser cliente / Consultar servicios";
    readonly WAIT_CUIT: "Ese CUIT no parece válido. Probá otra vez (solo números).";
    readonly CLIENTE_MENU: "¡Hola! 👋 Soy el asistente de POS & Asociados. Elegí una opción:\n\n1. Consultar mi estado general en ARCA e Ingresos Brutos\n2. Solicitar una factura electrónica\n3. Enviar las ventas del mes\n4. Agendar una reunión\n5. Hablar con Iván por otras consultas";
    readonly CLIENTE_ARCA: "📊 Consulta de estado general\n\nPodés revisar en cualquier momento tu situación impositiva en ARCA e Ingresos Brutos a través de nuestra aplicación exclusiva.\n\n🔗 Ingresá con tu CUIT en este link:\nhttps://app.posyasociados.com/login\n\n🔄 Recordá que la información se actualiza todos los viernes a las 18:00 hs.\n\nSi necesitás ayuda para interpretar los datos o detectar alguna irregularidad, escribinos por acá y un asesor del estudio te asiste personalmente.\n\n1. Gracias, consulto en la App.\n2. Consultar a una persona.";
    readonly CLIENTE_FACTURA: "📄 Solicitud de Factura Electrónica\n\nPara emitir tu factura necesitamos que nos envíes:\n\n☑️ Tu CUIT\n☑️ Concepto (descripción del producto o servicio)\n☑️ Importe total.\n☑️ Fecha de la operación.\n☑️ Datos del receptor (CUIT o DNI)\n\n➡️ Una vez que tengamos la información, el estudio genera la factura y te la enviamos por este mismo chat o a tu mail.";
    readonly CLIENTE_VENTAS: "📋 Envío de Ventas Mensuales\n\nEs importante que nos envíes todas tus ventas para poder confeccionar correctamente tus declaraciones impositivas.\n\n☑️ Podés adjuntar directamente acá tu planilla de Excel o bien una foto de los comprobantes/tickets o resúmenes.\n☑️ Si no tenés la planilla, pedila escribiendo PLANILLA y te la enviamos al instante.\n\n⏰ Recordá: el envío debe hacerse antes del último día hábil de cada mes para evitar recargos o sanciones.";
    readonly CLIENTE_REUNION: "📅 Agendar una reunión\n\nElegí día y horario en nuestra agenda online:\n\n➡️ https://calendly.com/posyasociados/sincosto\n\n¡Gracias!";
    readonly CLIENTE_IVAN: "Perfecto, en breve te contactaré con Iván.📞";
    readonly NO_CLIENTE_NAME: "Decime tu nombre y empresa.";
    readonly NO_CLIENTE_EMAIL: "Dejame tu email.";
    readonly NO_CLIENTE_INTEREST: "¿Qué te interesa?\n\n1. Alta en Monotributo / Ingresos Brutos\n2. Ya soy monotributista, quiero conocer sobre el Plan Mensual\n3. Soy Responsable Inscripto, quiero mas info sobre los servicios\n4. Estado de mi Consulta\n5. Hablar con un profesional, tengo otras dudas y/o consultas";
    readonly NO_CLIENTE_ALTA: "📋 **Alta en Monotributo / Ingresos Brutos**\n\nNuestro Plan para Monotributistas y emprendedores cuesta **$29.500** mensuales e incluye:\n\n✅ Alta en Monotributo e Ingresos Brutos\n✅ Liquidación mensual\n✅ Emisión de facturas/boletas\n✅ Control de pagos y categoría\n✅ Acceso a nuestra app exclusiva con tu posición impositiva actualizada cada semana.\n\n**Además:**\n📅 Reporte inicial en el día\n💻 Videollamada sin cargo\n🤝 Acompañamiento permanente.\n\n➡️ ¿Te digo lo que necesito para empezar?\n\n1- Sí, quiero el alta ahora, ¿qué necesitas?\n2- Prefiero hablar con alguien, tengo dudas.";
    readonly NO_CLIENTE_PLAN: "📊 **Ya soy monotributista, quiero conocer sobre el Plan Mensual**\n\nNuestro Plan para Monotributistas y emprendedores cuesta **$29.500** mensuales e incluye:\n\n✅ Reporte inicial para detectar desvios e intimaciones\n✅ Liquidación mensual de Ingresos Brutos\n✅ Emisión de facturas/boletas\n✅ Control de pagos y categoría\n✅ Acceso a nuestra app exclusiva con tu posición impositiva actualizada cada semana\n\n**Además:**\n💻 Videollamada sin cargo\n🤝 Acompañamiento permanente\n\n➡️ ¿Te digo lo que necesito para empezar?\n\n1- Sí, quiero el reporte ahora para conocer cómo está todo.\n2- Prefiero hablar con alguien, tengo dudas.";
    readonly NO_CLIENTE_RESPONSABLE: "🏢 **Soy Responsable Inscripto, quiero mas info sobre los servicios**\n\nPerfecto, en breve te contactaré con Iván 📞.";
    readonly NO_CLIENTE_CONSULTA: "📌 **Estado de mi Consulta**\n\nPara poder ubicar tu consulta, por favor escribí tu Nombre y Apellido completos ✍️.\n\nSi la consulta se hizo dentro de las últimas 24 horas, quedate tranquilo/a: la estamos procesando y te vamos a responder lo antes posible.\nSi ya pasó más tiempo, revisamos tu caso y te damos prioridad en la respuesta.";
    readonly HUMANO: "Listo, te derivamos con el equipo. ¡Gracias! 🙌";
};
//# sourceMappingURL=states.d.ts.map