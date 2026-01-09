/**
 * Menú interactivo de WhatsApp (Interactive List Message)
 * Upgrade PRO: Menú tipo Personal con secciones y rows
 */

import logger from '../libs/logger';
import { maskPhone } from './replies';
import { collections } from '../firebase';
import { sendWhatsAppInteractiveList } from './whatsappSender';

export type MenuOption = {
  id: string;
  title: string;
  description: string;
};

export type InteractiveMenuResult = {
  sent: boolean;
  fallbackText?: string;
  error?: string;
};

/**
 * Envía el menú principal como Interactive List Message
 * Fallback a texto si falla o no está soportado
 */
export async function sendMainMenu(
  phone: string,
  nombre?: string | null
): Promise<InteractiveMenuResult> {
  const saludo = nombre ? `Hola ${nombre} 👋` : 'Hola 👋';
  const headerText = `${saludo}\n¿Con qué tema te ayudamos?`;

  const menuOptions: MenuOption[] = [
    {
      id: '1',
      title: 'Facturación / comprobantes',
      description: 'Monotributo, facturas, planes de pago'
    },
    {
      id: '2',
      title: 'Pagos / VEP / deudas',
      description: 'VEP Ingresos Brutos, QR, ARCA, SIRADIG'
    },
    {
      id: '3',
      title: 'Pagar honorarios',
      description: 'Pago de honorarios por Bio Libre'
    },
    {
      id: '4',
      title: 'Datos registrales',
      description: 'Domicilio, datos registrales'
    },
    {
      id: '5',
      title: 'Sueldos / empleada doméstica',
      description: 'Recibos de sueldo, casas particulares'
    },
    {
      id: '6',
      title: 'Consultas generales',
      description: 'Otras consultas contables'
    },
    {
      id: '7',
      title: 'Hablar con el estudio',
      description: 'Contactar con el equipo'
    }
  ];

  try {
    const result = await sendWhatsAppInteractiveList(phone, {
      headerText,
      bodyText: 'Elegí una opción:',
      footerText: 'Pos & Asociados',
      buttonText: 'Menú principal',
      sections: [
        {
          title: 'Servicios',
          rows: menuOptions.map(opt => ({
            id: opt.id,
            title: opt.title,
            description: opt.description
          }))
        }
      ]
    });

    if (result.success) {
      logger.info('interactive_menu_sent', {
        phone: maskPhone(phone),
        messageId: result.messageId,
        hasNombre: !!nombre
      });
      return { sent: true };
    } else {
      // Fallback a texto
      logger.warn('interactive_menu_failed_fallback_text', {
        phone: maskPhone(phone),
        error: result.error
      });
      return {
        sent: false,
        fallbackText: buildTextMenu(nombre)
      };
    }
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('interactive_menu_error_fallback_text', {
      phone: maskPhone(phone),
      error: msg
    });
    return {
      sent: false,
      fallbackText: buildTextMenu(nombre),
      error: msg
    };
  }
}

/**
 * Construye el menú en formato texto (fallback)
 */
function buildTextMenu(nombre?: string | null): string {
  const saludo = nombre ? `Hola ${nombre} 👋` : 'Hola 👋';
  return `${saludo}
¿Con qué tema te ayudamos?

1️⃣ Facturación / comprobantes
2️⃣ Pagos / VEP / deudas
3️⃣ Pagar honorarios
4️⃣ Datos registrales
5️⃣ Sueldos / empleada doméstica
6️⃣ Consultas generales
7️⃣ Hablar con el estudio`;
}

/**
 * Envía submenú interactivo antes de derivar
 * Captura subtema y lo guarda en session/conversation
 */
export async function sendSubMenu(
  phone: string,
  mainOption: string,
  conversationId?: string
): Promise<InteractiveMenuResult> {
  // Definir submenús según opción principal
  const subMenus: Record<string, { title: string; options: MenuOption[] }> = {
    '1': {
      title: 'Facturación / comprobantes',
      options: [
        { id: '1.1', title: 'Facturas electrónicas', description: 'Emitir o consultar facturas' },
        { id: '1.2', title: 'Monotributo', description: 'Categoría, pagos, cuotas' },
        { id: '1.3', title: 'Planes de pago', description: 'Rehabilitar, consultar estado' },
        { id: '1.4', title: 'Comprobantes', description: 'Ver o descargar comprobantes' }
      ]
    },
    '2': {
      title: 'Pagos / VEP / deudas',
      options: [
        { id: '2.1', title: 'VEP Ingresos Brutos', description: 'Generar VEP para pagar' },
        { id: '2.2', title: 'QR Ingresos Brutos', description: 'Código QR para pagar' },
        { id: '2.3', title: 'Pagos ARCA', description: 'Consultar o realizar pagos' },
        { id: '2.4', title: 'SIRADIG', description: 'Declaración jurada anual' }
      ]
    },
    '4': {
      title: 'Datos registrales',
      options: [
        { id: '4.1', title: 'Cambiar domicilio', description: 'Actualizar dirección fiscal' },
        { id: '4.2', title: 'Datos registrales', description: 'Consultar información' },
        { id: '4.3', title: 'Clave fiscal', description: 'Gestionar clave fiscal' }
      ]
    },
    '5': {
      title: 'Sueldos / empleada doméstica',
      options: [
        { id: '5.1', title: 'Recibo de sueldo', description: 'Generar o consultar recibos' },
        { id: '5.2', title: 'Empleada doméstica', description: 'Altas, bajas, pagos' },
        { id: '5.3', title: 'Casas particulares', description: 'Regímenes especiales' }
      ]
    },
    '6': {
      title: 'Consultas generales',
      options: [
        { id: '6.1', title: 'Consulta contable', description: 'Preguntas generales' },
        { id: '6.2', title: 'Asesoramiento', description: 'Orientación profesional' },
        { id: '6.3', title: 'Otra consulta', description: 'Otros temas' }
      ]
    }
  };

  const subMenu = subMenus[mainOption];
  if (!subMenu) {
    // Si no hay submenú, no enviar nada (derivar directamente)
    return { sent: false };
  }

  try {
    const result = await sendWhatsAppInteractiveList(phone, {
      headerText: subMenu.title,
      bodyText: 'Elegí el subtema:',
      footerText: 'Pos & Asociados',
      buttonText: 'Ver opciones',
      sections: [
        {
          title: 'Opciones',
          rows: subMenu.options.map(opt => ({
            id: opt.id,
            title: opt.title,
            description: opt.description
          }))
        }
      ]
    });

    if (result.success) {
      logger.info('interactive_submenu_sent', {
        phone: maskPhone(phone),
        mainOption,
        conversationId,
        messageId: result.messageId
      });
      return { sent: true };
    } else {
      // Fallback: no enviar submenú, derivar directamente
      logger.warn('interactive_submenu_failed', {
        phone: maskPhone(phone),
        mainOption,
        error: result.error
      });
      return { sent: false };
    }
  } catch (error) {
    const msg = (error as Error)?.message ?? String(error);
    logger.error('interactive_submenu_error', {
      phone: maskPhone(phone),
      mainOption,
      error: msg
    });
    return { sent: false, error: msg };
  }
}

/**
 * Procesa la selección de submenú y guarda en conversation
 */
export async function processSubMenuSelection(
  conversationId: string,
  selectedId: string,
  mainOption: string
): Promise<{ topic: string; subtopic: string } | null> {
  // Mapear IDs de submenú a temas/subtemas
  const topicMap: Record<string, { topic: string; subtopic: string }> = {
    '1.1': { topic: 'Facturación', subtopic: 'Facturas electrónicas' },
    '1.2': { topic: 'Facturación', subtopic: 'Monotributo' },
    '1.3': { topic: 'Facturación', subtopic: 'Planes de pago' },
    '1.4': { topic: 'Facturación', subtopic: 'Comprobantes' },
    '2.1': { topic: 'Pagos', subtopic: 'VEP Ingresos Brutos' },
    '2.2': { topic: 'Pagos', subtopic: 'QR Ingresos Brutos' },
    '2.3': { topic: 'Pagos', subtopic: 'Pagos ARCA' },
    '2.4': { topic: 'Pagos', subtopic: 'SIRADIG' },
    '4.1': { topic: 'Datos registrales', subtopic: 'Cambiar domicilio' },
    '4.2': { topic: 'Datos registrales', subtopic: 'Datos registrales' },
    '4.3': { topic: 'Datos registrales', subtopic: 'Clave fiscal' },
    '5.1': { topic: 'Sueldos', subtopic: 'Recibo de sueldo' },
    '5.2': { topic: 'Sueldos', subtopic: 'Empleada doméstica' },
    '5.3': { topic: 'Sueldos', subtopic: 'Casas particulares' },
    '6.1': { topic: 'Consultas', subtopic: 'Consulta contable' },
    '6.2': { topic: 'Consultas', subtopic: 'Asesoramiento' },
    '6.3': { topic: 'Consultas', subtopic: 'Otra consulta' }
  };

  const topicInfo = topicMap[selectedId];
  if (!topicInfo) {
    logger.warn('submenu_selection_invalid', {
      conversationId,
      selectedId,
      mainOption
    });
    return null;
  }

  // Guardar en conversación
  try {
    await collections.conversations().doc(conversationId).update({
      topic: topicInfo.topic,
      subtopic: topicInfo.subtopic,
      updatedAt: new Date()
    });

    logger.info('submenu_selection_saved', {
      conversationId,
      topic: topicInfo.topic,
      subtopic: topicInfo.subtopic
    });

    return topicInfo;
  } catch (error) {
    logger.error('submenu_selection_save_error', {
      conversationId,
      error: (error as Error)?.message
    });
    return topicInfo; // Devolver info aunque falle el guardado
  }
}
