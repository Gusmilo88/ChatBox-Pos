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
exports.ClientsRepository = void 0;
exports.getDoc = getDoc;
exports.existsByCuit = existsByCuit;
exports.getSaldo = getSaldo;
exports.getUltimosComprobantes = getUltimosComprobantes;
const XLSX = __importStar(require("xlsx"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = __importDefault(require("../libs/logger"));
const MODE = String(process.env.USE_FIREBASE || '0');
// --- Excel (implementación actual) ---
async function xl_existsByCuit(cuit) {
    return excelRepo.existsByCuit(cuit);
}
async function xl_getSaldo(cuit) {
    return excelRepo.getSaldo(cuit);
}
async function xl_getUltimos(cuit) {
    return excelRepo.getUltimosComprobantes(cuit);
}
// --- Firestore ---
async function getDoc(cuit) {
    return fb_getDoc(cuit);
}
async function fb_getDoc(cuit) {
    const { getDb } = await Promise.resolve().then(() => __importStar(require('../firebase')));
    const db = getDb();
    // Normalizar CUIT: remover guiones y espacios para búsqueda
    const normalizedCuit = cuit.replace(/\D/g, '');
    // Buscar por campo cuit (puede estar con o sin guiones en la BD)
    // Intentar primero con el CUIT normalizado (sin guiones)
    let snapshot = await db.collection('clientes').where('cuit', '==', normalizedCuit).limit(1).get();
    // Si no encuentra, intentar con formato con guiones (XX-XXXXXXXX-X)
    if (snapshot.empty && normalizedCuit.length === 11) {
        const formattedCuit = `${normalizedCuit.slice(0, 2)}-${normalizedCuit.slice(2, 10)}-${normalizedCuit.slice(10)}`;
        snapshot = await db.collection('clientes').where('cuit', '==', formattedCuit).limit(1).get();
    }
    // Si aún no encuentra, buscar en todos los documentos y comparar normalizado
    if (snapshot.empty) {
        const allSnapshot = await db.collection('clientes').get();
        for (const doc of allSnapshot.docs) {
            const cliente = doc.data();
            const clienteCuitNormalized = cliente.cuit?.replace(/\D/g, '') || '';
            if (clienteCuitNormalized === normalizedCuit) {
                return cliente;
            }
        }
        return null;
    }
    const doc = snapshot.docs[0];
    return doc.data();
}
async function existsByCuit(cuit) {
    if (MODE === 'prod' || MODE === 'emu') {
        return !!(await fb_getDoc(cuit));
    }
    return xl_existsByCuit(cuit);
}
async function getSaldo(cuit) {
    if (MODE === 'prod' || MODE === 'emu') {
        const cliente = await fb_getDoc(cuit);
        if (!cliente)
            return null;
        // Usar campos de tu base de datos real
        // Si tiene deuda_honorarios, usar ese valor
        if (cliente.deuda_honorarios !== undefined) {
            return cliente.deuda_honorarios;
        }
        // Si no, usar deuda general
        if (cliente.deuda !== undefined) {
            return cliente.deuda;
        }
        // Fallback al saldo original
        return cliente.saldo ?? null;
    }
    return xl_getSaldo(cuit);
}
async function getUltimosComprobantes(cuit) {
    if (MODE === 'prod' || MODE === 'emu') {
        const cliente = await fb_getDoc(cuit);
        if (!cliente)
            return [];
        // Si tiene comprobantes específicos, usarlos
        if (cliente.comprobantes && cliente.comprobantes.length > 0) {
            return cliente.comprobantes;
        }
        // Generar comprobantes basados en info_adicional o estado
        const comprobantes = [];
        if (cliente.info_adicional) {
            comprobantes.push(`Info: ${cliente.info_adicional}`);
        }
        if (cliente.planes_pago) {
            comprobantes.push(`Planes: ${cliente.planes_pago}`);
        }
        if (cliente.monto_monotributo !== undefined) {
            comprobantes.push(`Monotributo: $${cliente.monto_monotributo}`);
        }
        return comprobantes.length > 0 ? comprobantes : ['No hay comprobantes disponibles'];
    }
    return xl_getUltimos(cuit);
}
// Clase legacy para compatibilidad (mantener para no romper código existente)
class ClientsRepository {
    constructor(filePath) {
        this.clientes = [];
        this.filePath = filePath;
        this.initializeFile();
    }
    initializeFile() {
        const dir = path_1.default.dirname(this.filePath);
        // Crear directorio si no existe
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        // Si el archivo no existe, crearlo con datos de ejemplo
        if (!fs_1.default.existsSync(this.filePath)) {
            this.createInitialFile();
        }
        this.loadClientes();
    }
    createInitialFile() {
        const clientesData = [
            {
                cuit: "20123456786",
                nombre: "Cliente Demo SRL",
                email: "facturacion@cliente-demo.com",
                saldo: 0,
                id_xubio: "XUBIO-0001",
                last_doc_date: "2025-08-15"
            },
            {
                cuit: "20987654326",
                nombre: "Ejemplo S.A.",
                email: "admin@ejemplo.com",
                saldo: 152300.50,
                id_xubio: "XUBIO-0002",
                last_doc_date: "2025-09-01"
            },
            {
                cuit: "20338385316",
                nombre: "Gustavo Romero prueba del 15 11 2025",
                email: "",
                saldo: 0,
                id_xubio: "",
                last_doc_date: ""
            }
        ];
        // Crear workbook con múltiples hojas
        const wb = XLSX.utils.book_new();
        // Hoja clientes_mock
        const wsClientes = XLSX.utils.json_to_sheet(clientesData);
        XLSX.utils.book_append_sheet(wb, wsClientes, 'clientes_mock');
        // Hoja leads (solo headers)
        const leadsHeaders = [
            'created_at', 'phone_e164', 'full_name', 'cuit', 'email', 'city',
            'company', 'interest', 'source', 'utm_campaign', 'consent_ts',
            'stage', 'assigned_to', 'last_msg_at', 'last_msg_text', 'notes', 'tag1', 'tag2'
        ];
        const wsLeads = XLSX.utils.aoa_to_sheet([leadsHeaders]);
        XLSX.utils.book_append_sheet(wb, wsLeads, 'leads');
        // Hoja catalogos
        const catalogosData = [
            ['interest', 'alta_cliente', 'honorarios', 'turno_consulta', 'otras_consultas'],
            ['source', 'whatsapp', 'instagram', 'web', 'referidos', 'otros'],
            ['stage', 'nuevo', 'cualificado', 'en_conversacion', 'propuesta_enviada', 'ganado', 'perdido'],
            ['assigned_to', 'Ivan', 'Secretaria1', 'Secretaria2', 'Gus']
        ];
        const wsCatalogos = XLSX.utils.aoa_to_sheet(catalogosData);
        XLSX.utils.book_append_sheet(wb, wsCatalogos, 'catalogos');
        XLSX.writeFile(wb, this.filePath);
        logger_1.default.info(`Archivo Excel inicial creado: ${this.filePath}`);
    }
    loadClientes() {
        try {
            const workbook = XLSX.readFile(this.filePath);
            const sheetName = workbook.SheetNames.find(name => name === 'clientes_mock');
            if (!sheetName) {
                logger_1.default.error('Hoja clientes_mock no encontrada');
                return;
            }
            const worksheet = workbook.Sheets[sheetName];
            this.clientes = XLSX.utils.sheet_to_json(worksheet);
            // Agregar cliente faltante si no existe (para testing)
            const cuitFaltante = '20338385316';
            if (!this.clientes.some(c => c.cuit === cuitFaltante)) {
                this.clientes.push({
                    cuit: cuitFaltante,
                    nombre: 'Gustavo Romero prueba del 15 11 2025',
                    email: '',
                    saldo: 0,
                    id_xubio: '',
                    last_doc_date: ''
                });
                logger_1.default.info(`Cliente ${cuitFaltante} agregado temporalmente al Excel`);
            }
            logger_1.default.info(`Cargados ${this.clientes.length} clientes desde ${this.filePath}`);
            // Log de CUITs disponibles para testing
            const cuits = this.clientes.map(c => c.cuit).join(', ');
            logger_1.default.info(`CUITs mock disponibles para testing: ${cuits}`);
        }
        catch (error) {
            logger_1.default.error('Error cargando clientes:', error);
        }
    }
    existsByCuit(cuit) {
        return this.clientes.some(cliente => cliente.cuit === cuit);
    }
    async getSaldo(cuit) {
        const cliente = this.clientes.find(c => c.cuit === cuit);
        return cliente ? (cliente.saldo ?? null) : null;
    }
    async getUltimosComprobantes(cuit) {
        const cliente = this.clientes.find(c => c.cuit === cuit);
        if (!cliente)
            return [];
        // Comprobantes mock específicos por cliente
        if (cuit === "20123456786") {
            return [
                "A 0001-00001234 (2025-08-15) – $0",
                "B 0002-00004567 (2025-07-30) – $15.230",
                "NC A 0001-00000012 (2025-07-05) – -$3.500"
            ];
        }
        else if (cuit === "20987654326") {
            return [
                "A 0001-00001235 (2025-09-01) – $45.230",
                "B 0002-00004568 (2025-08-15) – $25.100",
                "A 0001-00001236 (2025-08-01) – $12.500"
            ];
        }
        return [];
    }
}
exports.ClientsRepository = ClientsRepository;
// Instancia global para Excel
const excelRepo = new ClientsRepository('./data/base_noclientes.xlsx');
