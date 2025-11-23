"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.createSessionToken = createSessionToken;
exports.verifySessionToken = verifySessionToken;
exports.createAdmin = createAdmin;
exports.migratePasswords = migratePasswords;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const firebase_1 = require("../firebase");
const env_1 = require("../config/env");
const logger_1 = __importDefault(require("../libs/logger"));
// Login con validación contra Firestore
async function login(email, password) {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        // Buscar admin por email
        const adminSnapshot = await firebase_1.collections.admins()
            .where('email', '==', normalizedEmail)
            .limit(1)
            .get();
        if (adminSnapshot.empty) {
            logger_1.default.warn('login_failed_user_not_found', { email: normalizedEmail });
            throw new Error('Credenciales inválidas');
        }
        const adminDoc = adminSnapshot.docs[0];
        const adminData = adminDoc.data();
        // Verificar que esté activo
        if (!adminData.isActive) {
            logger_1.default.warn('login_failed_inactive_user', { adminId: adminDoc.id, email: normalizedEmail });
            throw new Error('Usuario inactivo');
        }
        // Verificar contraseña
        const isValidPassword = await bcrypt_1.default.compare(password, adminData.passwordHash);
        if (!isValidPassword) {
            logger_1.default.warn('login_failed_invalid_password', { adminId: adminDoc.id, email: normalizedEmail });
            throw new Error('Credenciales inválidas');
        }
        // Actualizar lastLoginAt
        await adminDoc.ref.update({
            lastLoginAt: new Date()
        }).catch(err => {
            logger_1.default.warn('failed_to_update_last_login', { adminId: adminDoc.id, error: err.message });
        });
        const user = {
            adminId: adminDoc.id,
            email: adminData.email,
            role: adminData.role
        };
        logger_1.default.info('user_logged_in', {
            adminId: user.adminId,
            email: user.email,
            role: user.role
        });
        return user;
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('login_error', {
            email: email.toLowerCase(),
            error: msg
        });
        throw error;
    }
}
// Crear token de sesión
function createSessionToken(user) {
    return jsonwebtoken_1.default.sign({
        adminId: user.adminId,
        email: user.email,
        role: user.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (env_1.config.sessionTTLMinutes * 60)
    }, env_1.config.sessionSecret);
}
// Verificar token de sesión
function verifySessionToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.config.sessionSecret);
        // Verificar expiración
        if (Date.now() >= decoded.exp * 1000) {
            throw new Error('Token expirado');
        }
        return {
            adminId: decoded.adminId,
            email: decoded.email,
            role: decoded.role
        };
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.warn('session_token_verification_failed', { error: msg });
        throw new Error('Token de sesión inválido');
    }
}
// Crear admin
async function createAdmin(email, password, role = 'operador') {
    try {
        const normalizedEmail = email.toLowerCase().trim();
        // Verificar que no exista
        const existingSnapshot = await firebase_1.collections.admins()
            .where('email', '==', normalizedEmail)
            .limit(1)
            .get();
        if (!existingSnapshot.empty) {
            throw new Error('El email ya está registrado');
        }
        const passwordHash = await bcrypt_1.default.hash(password, 12);
        const adminRef = await firebase_1.collections.admins().add({
            email: normalizedEmail,
            passwordHash,
            role,
            createdAt: new Date(),
            isActive: true
        });
        logger_1.default.info('admin_created', {
            adminId: adminRef.id,
            email: normalizedEmail,
            role
        });
        return adminRef.id;
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('error_creating_admin', {
            email: email.toLowerCase(),
            error: msg
        });
        throw error;
    }
}
// Migrar contraseñas en texto plano a bcrypt
async function migratePasswords() {
    const errors = [];
    let migrated = 0;
    try {
        const snapshot = await firebase_1.collections.admins().get();
        for (const doc of snapshot.docs) {
            const data = doc.data();
            // Si tiene 'pass' (texto plano) y no tiene 'passwordHash'
            if (data.pass && !data.passwordHash) {
                try {
                    const passwordHash = await bcrypt_1.default.hash(data.pass, 12);
                    await doc.ref.update({
                        email: data.user?.toLowerCase() || data.email?.toLowerCase(),
                        passwordHash,
                        role: data.role || 'operador',
                        createdAt: data.createdAt || new Date(),
                        isActive: data.isActive !== false,
                        lastLoginAt: data.lastLoginAt || null
                    });
                    // Eliminar campos antiguos
                    await doc.ref.update({
                        pass: null,
                        user: null
                    });
                    migrated++;
                    logger_1.default.info('password_migrated', { adminId: doc.id });
                }
                catch (error) {
                    const msg = (error instanceof Error) ? error.message : String(error);
                    const errorMsg = `Error migrando admin ${doc.id}: ${msg}`;
                    errors.push(errorMsg);
                    logger_1.default.error('password_migration_error', { adminId: doc.id, error: msg });
                }
            }
        }
        logger_1.default.info('password_migration_completed', { migrated, errors: errors.length });
        return { migrated, errors };
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('password_migration_failed', { error: msg });
        throw error;
    }
}
