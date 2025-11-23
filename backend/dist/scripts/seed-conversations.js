"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const firebase_1 = require("../firebase");
const uuid_1 = require("uuid");
const logger_1 = __importDefault(require("../libs/logger"));
// Datos de ejemplo
const samplePhones = [
    '+5491151093439',
    '+5491123456789',
    '+5491187654321',
    '+5491198765432',
    '+5491112345678',
    '+5491123456780',
    '+5491134567890',
    '+5491145678901',
    '+5491156789012',
    '+5491167890123'
];
const sampleNames = [
    'Juan Pérez',
    'María González',
    'Carlos Rodríguez',
    'Ana Martínez',
    'Luis Fernández',
    'Carmen López',
    'Pedro García',
    'Isabel Sánchez',
    'Miguel Torres',
    'Laura Díaz'
];
const sampleMessages = [
    'Hola, necesito ayuda con mi cuenta',
    '¿Cuál es mi saldo actual?',
    'Quiero enviar mis ventas del mes',
    'Necesito hablar con Iván',
    '¿Cómo puedo obtener una factura?',
    'Tengo problemas con mi clave fiscal',
    '¿Cuándo es mi próxima liquidación?',
    'Quiero agendar una reunión',
    '¿Pueden ayudarme con monotributo?',
    'Necesito actualizar mis datos',
    '¿Cómo funciona el plan mensual?',
    'Quiero ser cliente',
    '¿Qué necesito para el alta?',
    'Tengo una consulta sobre ingresos brutos',
    '¿Pueden enviarme un comprobante?'
];
const systemMessages = [
    '¡Hola! 👋 Soy el asistente de POS & Asociados. Elegí una opción:\n\n1 Soy cliente\n2 Quiero ser cliente / Consultar servicios',
    'Perfecto! Para continuar, necesito tu CUIT (solo números).',
    '¡Hola Juan! 👋 Soy el asistente 🤖 de POS & Asociados. Elegí una opción:\n\n1. Consultar mi estado general en ARCA e Ingresos Brutos\n2. Solicitar una factura electrónica\n3. Enviar las ventas del mes\n4. Agendar una reunión\n5. Hablar con Iván por otras consultas',
    'Tu saldo actual es de $15,000. ¿Necesitás algo más?',
    'Perfecto, te derivamos con Belén para que te ayude con la facturación. Te contactará a la brevedad. 📞',
    'Te derivamos con Iván Pos para revisar tu consulta. Te contactará a la brevedad. ¡Gracias!'
];
async function createConversation(phone, name, isClient) {
    const conversationId = (0, uuid_1.v4)();
    const now = new Date();
    // Crear conversación
    await firebase_1.collections.conversations().doc(conversationId).set({
        phone,
        name,
        isClient,
        lastMessageAt: now,
        unreadCount: 0,
        needsReply: Math.random() < 0.3, // 30% necesita respuesta
        createdAt: now,
        updatedAt: now
    });
    // Crear mensajes (entre 5 y 15 mensajes por conversación)
    const messageCount = Math.floor(Math.random() * 11) + 5;
    for (let i = 0; i < messageCount; i++) {
        const messageId = (0, uuid_1.v4)();
        const isUserMessage = Math.random() < 0.6; // 60% mensajes del usuario
        const messageTime = new Date(now.getTime() - (messageCount - i) * 60000); // 1 minuto entre mensajes
        let messageText;
        let from;
        let via;
        let aiSuggested = false;
        if (isUserMessage) {
            messageText = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
            from = 'usuario';
            via = Math.random() < 0.8 ? 'whatsapp' : 'manual';
        }
        else {
            messageText = systemMessages[Math.floor(Math.random() * systemMessages.length)];
            from = 'sistema';
            via = 'ia';
            aiSuggested = Math.random() < 0.4; // 40% sugeridos por IA
        }
        await firebase_1.collections.messages(conversationId).doc(messageId).set({
            ts: messageTime,
            from,
            text: messageText,
            via,
            aiSuggested
        });
    }
    // Actualizar lastMessageAt con el último mensaje
    const lastMessageTime = new Date(now.getTime() - Math.random() * 3600000); // Última hora
    await firebase_1.collections.conversations().doc(conversationId).update({
        lastMessageAt: lastMessageTime,
        unreadCount: Math.floor(Math.random() * 5) // 0-4 mensajes no leídos
    });
    return conversationId;
}
async function createAdminUser() {
    try {
        // Verificar si ya existe un admin
        const existingAdmin = await firebase_1.collections.admins()
            .where('user', '==', 'posyasociados@hotmail.com')
            .limit(1)
            .get();
        if (!existingAdmin.empty) {
            logger_1.default.info('Admin user already exists');
            return;
        }
        // Crear admin por defecto (usando la estructura de tu Firestore)
        await firebase_1.collections.admins().add({
            user: 'posyasociados@hotmail.com',
            pass: 'EstudioPos2025',
            role: 'owner',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        logger_1.default.info('Admin user created: posyasociados@hotmail.com / EstudioPos2025');
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('Error creating admin user', { error: msg });
    }
}
// Conversaciones hardcodeadas específicas para testing visual
const hardcodedConversations = [
    {
        phone: '+5491151093439',
        name: 'Fiorella Lucia Sponton',
        isClient: true,
        unreadCount: 3,
        needsReply: true,
        lastMessage: 'Necesito ayuda urgente con mi facturación',
        hoursAgo: 0.5
    },
    {
        phone: '+5491123456789',
        name: 'Roberto Martínez',
        isClient: true,
        unreadCount: 0,
        needsReply: false,
        lastMessage: 'Gracias por la ayuda, todo resuelto',
        hoursAgo: 2
    },
    {
        phone: '+5491187654321',
        name: 'Sofía Rodríguez',
        isClient: false,
        unreadCount: 5,
        needsReply: true,
        lastMessage: 'Quiero consultar sobre los servicios',
        hoursAgo: 1
    },
    {
        phone: '+5491198765432',
        name: 'Carlos Fernández',
        isClient: true,
        unreadCount: 1,
        needsReply: false,
        lastMessage: '¿Cuándo puedo agendar una reunión?',
        hoursAgo: 4
    },
    {
        phone: '+5491112345678',
        name: null, // Sin nombre
        isClient: false,
        unreadCount: 2,
        needsReply: true,
        lastMessage: 'Hola, tengo una consulta',
        hoursAgo: 0.2
    },
    {
        phone: '+5491123456780',
        name: 'María González',
        isClient: true,
        unreadCount: 0,
        needsReply: false,
        lastMessage: 'Perfecto, muchas gracias',
        hoursAgo: 12
    },
    {
        phone: '+5491134567890',
        name: 'Pedro García',
        isClient: false,
        unreadCount: 8,
        needsReply: true,
        lastMessage: 'URGENTE: Necesito hablar con alguien ya',
        hoursAgo: 0.1
    },
    {
        phone: '+5491145678901',
        name: 'Ana López',
        isClient: true,
        unreadCount: 0,
        needsReply: false,
        lastMessage: 'Todo bien, gracias',
        hoursAgo: 24
    }
];
async function createHardcodedConversation(data) {
    const conversationId = (0, uuid_1.v4)();
    const now = new Date();
    const lastMessageAt = new Date(now.getTime() - data.hoursAgo * 3600000);
    // Crear conversación
    await firebase_1.collections.conversations().doc(conversationId).set({
        phone: data.phone,
        name: data.name || null,
        isClient: data.isClient,
        lastMessageAt: lastMessageAt,
        unreadCount: data.unreadCount,
        needsReply: data.needsReply,
        createdAt: lastMessageAt,
        updatedAt: now
    });
    // Crear algunos mensajes (el último mensaje debe ser el más reciente)
    const messages = [
        {
            ts: lastMessageAt, // El último mensaje es el más reciente
            from: 'usuario',
            text: data.lastMessage,
            via: 'whatsapp',
            aiSuggested: false
        },
        {
            ts: new Date(lastMessageAt.getTime() - 300000), // 5 min antes
            from: 'sistema',
            text: '¡Hola! 👋 Soy el asistente de POS & Asociados.',
            via: 'ia',
            aiSuggested: true
        }
    ];
    // Importar Timestamp de Firestore
    const { Timestamp } = await Promise.resolve().then(() => __importStar(require('firebase-admin/firestore')));
    for (const msg of messages) {
        const messageId = (0, uuid_1.v4)();
        // Convertir Date a Timestamp de Firestore
        const firestoreTimestamp = msg.ts instanceof Date
            ? Timestamp.fromDate(msg.ts)
            : msg.ts;
        await firebase_1.collections.messages(conversationId).doc(messageId).set({
            ...msg,
            ts: firestoreTimestamp
        });
        logger_1.default.debug('Message created', {
            conversationId,
            messageId,
            text: msg.text.substring(0, 30),
            ts: msg.ts
        });
    }
    // Actualizar la conversación con el último mensaje (usar Timestamp)
    const firestoreLastMessageAt = lastMessageAt instanceof Date
        ? Timestamp.fromDate(lastMessageAt)
        : lastMessageAt;
    await firebase_1.collections.conversations().doc(conversationId).update({
        lastMessageAt: firestoreLastMessageAt
    });
    logger_1.default.info('Hardcoded conversation created', {
        conversationId,
        phone: data.phone,
        name: data.name,
        lastMessage: data.lastMessage,
        messageCount: messages.length
    });
    return conversationId;
}
async function main() {
    try {
        logger_1.default.info('Starting conversation seed...');
        // Crear admin
        await createAdminUser();
        // Crear conversaciones hardcodeadas específicas
        logger_1.default.info('Creating hardcoded conversations...');
        const hardcodedIds = [];
        for (const conv of hardcodedConversations) {
            const id = await createHardcodedConversation(conv);
            hardcodedIds.push(id);
        }
        logger_1.default.info(`Created ${hardcodedIds.length} hardcoded conversations`);
        // Crear conversaciones aleatorias adicionales
        const conversationCount = 20;
        const conversations = [];
        for (let i = 0; i < conversationCount; i++) {
            const phone = samplePhones[Math.floor(Math.random() * samplePhones.length)];
            const name = sampleNames[Math.floor(Math.random() * sampleNames.length)];
            const isClient = Math.random() < 0.6; // 60% clientes, 40% no clientes
            const conversationId = await createConversation(phone, name, isClient);
            conversations.push(conversationId);
            if ((i + 1) % 10 === 0) {
                logger_1.default.info(`Created ${i + 1}/${conversationCount} random conversations`);
            }
        }
        logger_1.default.info(`Seed completed! Created ${hardcodedIds.length} hardcoded + ${conversations.length} random conversations`);
        logger_1.default.info('Admin credentials: posyasociados@hotmail.com / EstudioPos2025');
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('Seed failed', { error: msg });
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
