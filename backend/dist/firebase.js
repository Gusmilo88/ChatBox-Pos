"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collections = exports.Timestamp = void 0;
exports.getDb = getDb;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
Object.defineProperty(exports, "Timestamp", { enumerable: true, get: function () { return firestore_1.Timestamp; } });
function fromEnv() {
    const pj = process.env.FIREBASE_PROJECT_ID;
    const email = process.env.FIREBASE_CLIENT_EMAIL;
    const key = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (pj && email && key)
        return { projectId: pj, clientEmail: email, privateKey: key };
    // opción base64 de key completa (JSON)
    const b64 = process.env.BASE64_FIREBASE_KEY;
    if (b64) {
        try {
            const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
            return {
                projectId: json.project_id,
                clientEmail: json.client_email,
                privateKey: json.private_key,
            };
        }
        catch { }
    }
    return null;
}
let db = null;
function getDb() {
    if (!db) {
        if (!(0, app_1.getApps)().length) {
            const sa = fromEnv();
            if (sa) {
                (0, app_1.initializeApp)({ credential: (0, app_1.cert)(sa), projectId: sa.projectId });
            }
            else {
                (0, app_1.initializeApp)({ credential: (0, app_1.applicationDefault)() });
            }
        }
        db = (0, firestore_1.getFirestore)();
        // Solo configurar settings si no se ha hecho antes
        try {
            db.settings({ ignoreUndefinedProperties: true });
        }
        catch (error) {
            // Ignorar error si ya se configuró
        }
    }
    return db;
}
// Helpers para colecciones
exports.collections = {
    conversations: (db) => (db || getDb()).collection('conversations'),
    messages: (conversationId, db) => (db || getDb()).collection('conversations').doc(conversationId).collection('messages'),
    outbox: (db) => (db || getDb()).collection('outbox'),
    admins: (db) => (db || getDb()).collection('admins'),
    audit: (db) => (db || getDb()).collection('audit')
};
