"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATE_TEXTS = exports.FSMState = void 0;
var FSMState;
(function (FSMState) {
    FSMState["ROOT"] = "ROOT";
    FSMState["CLIENTE_PEDIR_CUIT"] = "CLIENTE_PEDIR_CUIT";
    FSMState["CLIENTE_MENU"] = "CLIENTE_MENU";
    FSMState["CLIENTE_ESTADO_GENERAL"] = "CLIENTE_ESTADO_GENERAL";
    FSMState["CLIENTE_FACTURA_PEDIR_DATOS"] = "CLIENTE_FACTURA_PEDIR_DATOS";
    FSMState["CLIENTE_FACTURA_CONFIRM"] = "CLIENTE_FACTURA_CONFIRM";
    FSMState["CLIENTE_FACTURA_EDIT_FIELD"] = "CLIENTE_FACTURA_EDIT_FIELD";
    FSMState["CLIENTE_VENTAS_INFO"] = "CLIENTE_VENTAS_INFO";
    FSMState["CLIENTE_REUNION"] = "CLIENTE_REUNION";
    FSMState["CLIENTE_HABLAR_CON_ALGUIEN"] = "CLIENTE_HABLAR_CON_ALGUIEN";
    FSMState["NOCLIENTE_MENU"] = "NOCLIENTE_MENU";
    FSMState["NC_ALTA_MENU"] = "NC_ALTA_MENU";
    FSMState["NC_ALTA_REQUISITOS"] = "NC_ALTA_REQUISITOS";
    FSMState["NC_PLAN_MENU"] = "NC_PLAN_MENU";
    FSMState["NC_PLAN_REQUISITOS"] = "NC_PLAN_REQUISITOS";
    FSMState["NC_ESTADO_CONSULTA"] = "NC_ESTADO_CONSULTA";
    FSMState["NC_DERIVA_IVAN_TEXTO"] = "NC_DERIVA_IVAN_TEXTO";
    FSMState["DERIVA_IVAN"] = "DERIVA_IVAN";
    FSMState["FINALIZA"] = "FINALIZA";
})(FSMState || (exports.FSMState = FSMState = {}));
exports.STATE_TEXTS = {
    [FSMState.ROOT]: '¡Hola! 👋 Soy el asistente de POS & Asociados. Elegí una opción',
    [FSMState.CLIENTE_PEDIR_CUIT]: 'Para identificarte como cliente y acceder a las opciones disponibles, ingresá tu CUIT sin guiones 👇',
    CUIT_NO_ENCONTRADO: `No encontramos el CUIT ingresado en nuestra base de clientes 📄.

🔎 Esto puede deberse a un error de tipeo o a que el número no fue ingresado correctamente.

👉 Por favor, verificá el CUIT y volvé a ingresarlo (sin puntos ni guiones).

Si el inconveniente continúa o necesitás ayuda, podés volver a escribirnos y lo revisamos juntos 🤝`,
    [FSMState.CLIENTE_ESTADO_GENERAL]: `📊 Consulta de estado general

Podés revisar en cualquier momento tu situación impositiva en
ARCA e Ingresos Brutos a través de nuestra aplicación exclusiva.

👉 Ingresá con tu CUIT en este link:
https://app.posyasociados.com/login

🔄 Recordá que la información se actualiza todos los viernes a las 18:00 hs.

Si necesitás ayuda para interpretar los datos o detectar alguna
irregularidad, escribinos por acá y un asesor del estudio te asiste personalmente.`,
    [FSMState.CLIENTE_FACTURA_PEDIR_DATOS]: `🧾 Solicitud de Factura Electrónica
Para emitir tu factura necesitamos que nos envíes:

📌 Tu CUIT
📌 Concepto (descripcion del producto o servicio)
📌 Importe total.
📌 Fecha de la operación.
📌 Datos del receptor (CUIT o DNI)

👉 Una vez que tengamos la información, el estudio genera la factura y te la enviamos por este mismo chat o a tu mail.

📌 Podés mandarme los datos en varios mensajes. Cuando termines, escribí *LISTO*.
Si preferís, escribí *HABLAR CON ALGUIEN*.`,
    [FSMState.CLIENTE_VENTAS_INFO]: `📋 Envío de Ventas Mensuales

Es importante que nos envíes todas tus ventas para poder confeccionar correctamente tus declaraciones impositivas.

☑️ Podés adjuntar directamente acá tu planilla de Excel o bien una foto de los comprobantes/tickets o resúmenes.
☑️ Si no tenés la planilla, pedila escribiendo *PLANILLA* y te la enviamos al instante.

⏰ Recordá: el envío debe hacerse antes del último día hábil de cada mes para evitar recargos o sanciones.

📌 Cuando termines de enviar todo, escribí *LISTO*.
Si preferís, escribí *HABLAR CON ALGUIEN*.`,
    PLANILLA_INSTRUCCIONES: `📦 Descargá la planilla desde este link:
https://docs.google.com/spreadsheets/d/1GtF4h7JzFCPo-ghlLbW2hSuJaEqXfbph/export?format=xlsx

📌 Completala y luego enviala por este chat.

Cuando termines de enviar todo, escribí *LISTO*.`,
    NC_ALTA_TEXTO_PLAN: `Alta en Monotributo / Ingresos Brutos

Nuestro servicio incluye:
✅ Alta en Monotributo o Ingresos Brutos
✅ Asesoramiento personalizado
✅ Gestión completa de trámites
✅ Acompañamiento permanente

👉 Te digo lo que necesito para empezar?`,
    [FSMState.CLIENTE_REUNION]: `📅 Agendar una reunión
Elegí día y horario en nuestra agenda online:
👉 https://calendly.com/posyasociados/sincosto

Gracias!`,
    [FSMState.NC_ALTA_REQUISITOS]: `Perfecto 🙌.
Lo que necesito para iniciar tu alta es:

📌 Tu CUIT
📌 Tu Clave Fiscal
📌 📸 Foto del DNI (frente y dorso)
📌 🤳 Selfie (preferentemente fondo claro, como una foto carnet)
📌 📝 Descripción de la tarea o actividad que vas a realizar
📌 ⚖️ Confirmar si trabajás en relación de dependencia (en blanco) o no
    para aplicarte beneficios.
📌 🏪 Confirmar si tenés un local a la calle

📌 Cuando termines de enviar todo, escribí *LISTO*.
Si preferís, escribí *HABLAR CON ALGUIEN*.`,
    [FSMState.NC_PLAN_MENU]: `Nuestro Plan para Monotributistas y emprendedores cuesta $29.500 mensuales
e incluye:

✅ Reporte inicial para detectar desvíos e intimaciones
✅ Liquidación mensual de Ingresos Brutos
✅ Emisión de facturas/boletas
✅ Control de pagos y categoría
✅ Acceso a nuestra app exclusiva 📲 con tu posición impositiva
   actualizada cada semana.

Además:
💻 Videollamada sin cargo
🤝 Acompañamiento permanente.

👉 ¿Te digo lo que necesito para empezar?`,
    [FSMState.NC_PLAN_REQUISITOS]: `Perfecto 🙌.
Lo que necesito para tu reporte inicial (sin cargo) es:

📌 Tu CUIT
📌 Tu Clave Fiscal

📌 Cuando termines de enviar todo, escribí *LISTO*.
Si preferís, escribí *HABLAR CON ALGUIEN*.`,
    [FSMState.NC_ESTADO_CONSULTA]: `📌 Estado de mi consulta

Para poder ubicar tu consulta, por favor escribí tu Nombre y Apellido completos ✍️.

⏳ Si la consulta se hizo dentro de las últimas 24 horas,
quedate tranquilo/a: la estamos procesando y te vamos a responder
lo antes posible.

Si ya pasó más tiempo, revisamos tu caso y te damos prioridad
en la respuesta.`,
    [FSMState.NC_DERIVA_IVAN_TEXTO]: 'Perfecto, en breve te contactaré con Iván ☎️.',
    [FSMState.DERIVA_IVAN]: 'Perfecto. Te derivo con el contador Iván Pos.',
    [FSMState.FINALIZA]: '',
    // Honorarios
    HONORARIOS_RESPUESTA: `Para pagar tus honorarios ingresá a:
https://app.posyasociados.com/login con tu CUIT.

Ahí podés pagar por Bio Libre ✅`,
    // Cierre de conversación (pool de 9 variantes)
    CIERRE_CONVERSACION_POOL: [
        'Genial 🙂 Si necesitás algo más, escribí *hola* y te muestro el menú.',
        'Listo 👍 Para otra consulta, escribí *hola*.',
        'Perfecto 😊 Si querés volver al menú, escribí *hola*.',
        'Dale 🙂 Cuando quieras, escribí *hola* y seguimos.',
        'Buenísimo 🙌 Si necesitás algo más, escribí *hola*.',
        'Ok 👌 Para ver el menú de nuevo, escribí *hola*.',
        'Gracias 🙂 Si te surge otra consulta, escribí *hola*.',
        'Todo listo ✅ Escribí *hola* si querés ver opciones.',
        'Perfecto 👍 Si necesitás ayuda con otra cosa, escribí *hola*.'
    ]
};
