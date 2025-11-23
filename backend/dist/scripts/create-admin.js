"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_1 = require("../firebase");
const bcrypt_1 = __importDefault(require("bcrypt"));
const logger_1 = __importDefault(require("../libs/logger"));
async function createAdmin() {
    try {
        logger_1.default.info('Creating admin user...');
        // Verificar si ya existe un admin
        const existingAdmin = await firebase_1.collections.admins()
            .where('email', '==', 'admin@pos.com')
            .limit(1)
            .get();
        if (!existingAdmin.empty) {
            logger_1.default.info('Admin user already exists');
            return;
        }
        // Crear admin por defecto
        const passwordHash = await bcrypt_1.default.hash('admin123', 12);
        await firebase_1.collections.admins().add({
            email: 'admin@pos.com',
            passwordHash,
            role: 'owner',
            createdAt: new Date(),
            updatedAt: new Date()
        });
        logger_1.default.info('✅ Admin user created successfully!');
        logger_1.default.info('📧 Email: admin@pos.com');
        logger_1.default.info('🔑 Password: admin123');
    }
    catch (error) {
        const msg = (error instanceof Error) ? error.message : String(error);
        logger_1.default.error('❌ Error creating admin user', { error: msg });
        process.exit(1);
    }
}
if (require.main === module) {
    createAdmin();
}
