/**
 * Menú interactivo de WhatsApp (Interactive List Message)
 * Nuevo árbol POS & Asociados
 */

import logger from '../libs/logger';
import { maskPhone } from './replies';

/**
 * Payload de Interactive List Message para Cloud API
 */
export type InteractivePayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'list';
    header?: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: {
      button: string;
      sections: Array<{
        title?: string;
        rows: Array<{
          id: string;
          title: string;
          description: string;
        }>;
      }>;
    };
  };
};

/**
 * Valida que todos los row.title tengan longitud <= 24 caracteres
 * Loggea warnings si algún título excede el límite
 */
function validateRowTitles(payload: InteractivePayload, menuName: string): void {
  const MAX_TITLE_LENGTH = 24;
  const allRows: Array<{ id: string; title: string }> = [];
  
  payload.interactive.action.sections.forEach((section, sectionIdx) => {
    section.rows.forEach((row) => {
      allRows.push({ id: row.id, title: row.title });
    });
  });

  allRows.forEach((row) => {
    if (row.title.length > MAX_TITLE_LENGTH) {
      logger.warn('interactive_menu_title_too_long', {
        menuName,
        rowId: row.id,
        title: row.title,
        length: row.title.length,
        maxLength: MAX_TITLE_LENGTH
      });
    }
  });
}

/**
 * Construye el menú ROOT (inicial)
 */
export function buildRootMenuInteractive(phone: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: '¡Hola! 👋 Soy el asistente de POS & Asociados. Elegí una opción'
      },
      action: {
        button: 'Elegir opción',
        sections: [
          {
            rows: [
              {
                id: 'root_cliente',
                title: 'Soy Cliente',
                description: 'Necesito realizar una consulta o pedido'
              },
              {
                id: 'root_nocliente',
                title: 'Quiero ser cliente',
                description: 'Consultar servicios'
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildRootMenuInteractive');
  return payload;
}

/**
 * Construye el menú CLIENTE_TIPO_SELECTOR (filtro antes de pedir CUIT)
 */
export function buildClienteTipoSelectorMenuInteractive(phone: string, bodyText: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: bodyText
      },
      action: {
        button: 'Elegir opción',
        sections: [
          {
            rows: [
              {
                id: 'cli_tipo_monotributo',
                title: 'Monotributista',
                description: ''
              },
              {
                id: 'cli_tipo_ri',
                title: 'Responsable Inscripto',
                description: 'Sociedades'
              },
              {
                id: 'cli_tipo_otro',
                title: 'Otro tipo de cliente',
                description: ''
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildClienteTipoSelectorMenuInteractive');
  return payload;
}

/**
 * Construye el menú CLIENTE_MENU con saludo personalizado
 */
export function buildClienteMenuInteractive(phone: string, nombreCliente?: string | null): InteractivePayload {
  const bodyText = nombreCliente && nombreCliente.trim().length > 0
    ? `Hola 👋 ${nombreCliente.trim()}. Elegí una opción.`
    : 'Hola 👋. Elegí una opción.';
  
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: bodyText
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            rows: [
              {
                id: 'cli_estado',
                title: 'Consultar estado ARCA',
                description: 'Estado general en ARCA e Ingresos Brutos'
              },
              {
                id: 'cli_factura',
                title: 'Solicitar factura',
                description: 'Factura electrónica'
              },
              {
                id: 'cli_ventas',
                title: 'Enviar ventas',
                description: 'Ventas del mes'
              },
              {
                id: 'cli_constancias_arca',
                title: 'Constancias ARCA',
                description: 'Solicitar constancias actualizadas'
              },
              {
                id: 'cli_vep_qr_deuda',
                title: 'VEP/QR deuda',
                description: 'Monotributo / Ingresos Brutos'
              },
              {
                id: 'cli_reunion',
                title: 'Agendar reunion',
                description: ''
              },
              {
                id: 'cli_ivan',
                title: 'Hablar con Ivan',
                description: 'Otras consultas'
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildClienteMenuInteractive');
  return payload;
}

/**
 * Construye el menú CLIENTE_ESTADO_GENERAL con texto largo en body + menú 2 opciones
 */
export function buildClienteEstadoMenuInteractive(phone: string, bodyText: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: bodyText
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            rows: [
              {
                id: 'cli_estado_ok',
                title: 'Gracias. Consulto app',
                description: ''
              },
              {
                id: 'cli_estado_hablar',
                title: 'Hablar con alguien',
                description: ''
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildClienteEstadoMenuInteractive');
  return payload;
}

/**
 * Construye el menú NOCLIENTE_MENU
 */
export function buildNoClienteMenuInteractive(phone: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: 'Bienvenido/a!! Elegí una opción'
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            rows: [
              {
                id: 'nc_alta',
                title: 'Alta Monotributo',
                description: 'Alta en Monotributo / Ingresos Brutos'
              },
              {
                id: 'nc_plan',
                title: 'Plan Mensual',
                description: 'Ya soy monotributista, conocer Plan Mensual'
              },
              {
                id: 'nc_ri',
                title: 'Responsable Inscripto',
                description: 'Mas info sobre servicios'
              },
              {
                id: 'nc_estado',
                title: 'Estado de Consulta',
                description: ''
              },
              {
                id: 'nc_ivan',
                title: 'Hablar con profesional',
                description: 'Otras dudas y consultas'
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildNoClienteMenuInteractive');
  return payload;
}

/**
 * Construye el menú NC_ALTA_MENU con texto del plan en body + menú 2 opciones
 */
export function buildNCAltaMenuInteractive(phone: string, bodyText: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: bodyText
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            rows: [
              {
                id: 'nc_alta_si',
                title: 'Si, quiero el alta',
                description: 'Que necesitas?'
              },
              {
                id: 'nc_alta_dudas',
                title: 'Prefiero hablar',
                description: 'Tengo dudas'
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildNCAltaMenuInteractive');
  return payload;
}

/**
 * Construye el menú NC_PLAN_MENU (2 opciones) con texto del plan en body
 */
export function buildNCPlanMenuInteractive(phone: string, bodyText: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: bodyText
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            rows: [
              {
                id: 'nc_plan_si',
                title: 'Si, quiero reporte',
                description: 'Conocer como esta todo'
              },
              {
                id: 'nc_plan_dudas',
                title: 'Prefiero hablar',
                description: 'Tengo dudas'
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildNCPlanMenuInteractive');
  return payload;
}

/**
 * Construye el menú NC_RI_MENU (2 opciones) con texto del plan RI en body
 */
export function buildNCRIMenuInteractive(phone: string, bodyText: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: bodyText
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            rows: [
              {
                id: 'ri_agendar_si',
                title: 'Sí, agendar',
                description: ''
              },
              {
                id: 'ri_agendar_no',
                title: 'No, volver',
                description: ''
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildNCRIMenuInteractive');
  return payload;
}

/**
 * Construye el menú NC_ESTADO_CONSULTA (2 opciones)
 */
export function buildNCEstadoConsultaMenuInteractive(phone: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: 'Elegí una opción'
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            rows: [
              {
                id: 'nc_estado_mas24',
                title: 'Ya pasó +24 hs',
                description: ''
              },
              {
                id: 'nc_estado_menos24',
                title: 'Aún no pasaron 24',
                description: ''
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildNCEstadoConsultaMenuInteractive');
  return payload;
}

/**
 * Construye el menú "Hablar con alguien" (4 opciones)
 */
export function buildHablarConAlguienMenuInteractive(phone: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: '¿Con quién querés hablar?'
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            rows: [
              {
                id: 'hablar_ivan',
                title: 'Hablar con Iván',
                description: ''
              },
              {
                id: 'hablar_belen',
                title: 'Hablar con Belén',
                description: ''
              },
              {
                id: 'hablar_elina',
                title: 'Hablar con Elina',
                description: ''
              },
              {
                id: 'hablar_volver',
                title: 'Volver',
                description: ''
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildHablarConAlguienMenuInteractive');
  return payload;
}

/**
 * Construye el menú de confirmación de factura (Sí/No)
 */
export function buildFacturaConfirmMenuInteractive(phone: string, bodyText: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: bodyText
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            rows: [
              {
                id: 'fac_ok',
                title: 'Sí, está bien',
                description: ''
              },
              {
                id: 'fac_bad',
                title: 'No, hay datos erróneos',
                description: ''
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildFacturaConfirmMenuInteractive');
  return payload;
}

/**
 * Construye el menú de edición de campos de factura
 */
export function buildFacturaEditFieldMenuInteractive(phone: string): InteractivePayload {
  const payload: InteractivePayload = {
    messaging_product: 'whatsapp',
    to: phone.startsWith('+') ? phone : `+${phone}`,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: {
        text: '¿Qué campo querés corregir?'
      },
      action: {
        button: 'Ver opciones',
        sections: [
          {
            rows: [
              {
                id: 'fac_edit_cuit',
                title: 'Corregir CUIT',
                description: ''
              },
              {
                id: 'fac_edit_concept',
                title: 'Corregir concepto',
                description: ''
              },
              {
                id: 'fac_edit_importe',
                title: 'Corregir importe',
                description: ''
              },
              {
                id: 'fac_edit_fecha',
                title: 'Corregir fecha',
                description: ''
              },
              {
                id: 'fac_edit_receptor',
                title: 'Corregir receptor',
                description: ''
              },
              {
                id: 'fac_edit_cancel',
                title: 'Cancelar',
                description: ''
              }
            ]
          }
        ]
      }
    }
  };
  
  validateRowTitles(payload, 'buildFacturaEditFieldMenuInteractive');
  return payload;
}
