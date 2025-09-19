"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
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
function getDb() {
    if (!(0, app_1.getApps)().length) {
        const sa = fromEnv();
        if (sa)
            (0, app_1.initializeApp)({ credential: (0, app_1.cert)(sa), projectId: sa.projectId });
        else
            (0, app_1.initializeApp)({ credential: (0, app_1.applicationDefault)() }); // si hay GOOGLE_APPLICATION_CREDENTIALS
    }
    const db = (0, firestore_1.getFirestore)();
    db.settings({ ignoreUndefinedProperties: true });
    return db;
}
//# sourceMappingURL=firebase.js.map