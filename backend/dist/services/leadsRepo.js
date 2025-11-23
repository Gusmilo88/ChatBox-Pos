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
exports.LeadsRepository = void 0;
const XLSX = __importStar(require("xlsx"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dayjs_1 = __importDefault(require("dayjs"));
const logger_1 = __importDefault(require("../libs/logger"));
class LeadsRepository {
    constructor(filePath) {
        this.filePath = filePath;
        this.ensureFileExists();
    }
    ensureFileExists() {
        const dir = path_1.default.dirname(this.filePath);
        // Crear directorio si no existe
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        // Si el archivo no existe, crearlo
        if (!fs_1.default.existsSync(this.filePath)) {
            this.createInitialFile();
        }
    }
    createInitialFile() {
        const wb = XLSX.utils.book_new();
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
        // Hoja clientes_mock
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
            }
        ];
        const wsClientes = XLSX.utils.json_to_sheet(clientesData);
        XLSX.utils.book_append_sheet(wb, wsClientes, 'clientes_mock');
        XLSX.writeFile(wb, this.filePath);
        logger_1.default.info(`Archivo Excel inicial creado: ${this.filePath}`);
    }
    async saveLead(phone, fullName, email, interest, cuit) {
        try {
            const now = (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss');
            // Determinar assigned_to según el interés
            let assignedTo = 'Ivan'; // default
            if (interest === 'turno_consulta') {
                assignedTo = 'Secretaria1';
            }
            else if (interest === 'honorarios') {
                assignedTo = 'Secretaria2';
            }
            const lead = {
                created_at: now,
                phone_e164: phone,
                full_name: fullName,
                cuit: cuit || '',
                email: email,
                city: '',
                company: '',
                interest: interest,
                source: 'whatsapp',
                utm_campaign: '',
                consent_ts: now,
                stage: 'nuevo',
                assigned_to: assignedTo,
                last_msg_at: now,
                last_msg_text: `Lead creado: ${fullName} - ${interest}`,
                notes: '',
                tag1: '',
                tag2: ''
            };
            // Leer archivo existente
            const workbook = XLSX.readFile(this.filePath);
            const sheetName = workbook.SheetNames.find(name => name === 'leads');
            if (!sheetName) {
                throw new Error('Hoja leads no encontrada');
            }
            const worksheet = workbook.Sheets[sheetName];
            const existingData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            // Agregar nueva fila
            const newRow = [
                lead.created_at,
                lead.phone_e164,
                lead.full_name,
                lead.cuit,
                lead.email,
                lead.city,
                lead.company,
                lead.interest,
                lead.source,
                lead.utm_campaign,
                lead.consent_ts,
                lead.stage,
                lead.assigned_to,
                lead.last_msg_at,
                lead.last_msg_text,
                lead.notes,
                lead.tag1,
                lead.tag2
            ];
            existingData.push(newRow);
            // Crear nueva hoja con los datos actualizados
            const newWorksheet = XLSX.utils.aoa_to_sheet(existingData);
            workbook.Sheets[sheetName] = newWorksheet;
            // Guardar archivo
            XLSX.writeFile(workbook, this.filePath);
            logger_1.default.info(`Lead guardado: ${fullName} (${phone}) - ${interest}`);
        }
        catch (error) {
            logger_1.default.error('Error guardando lead:', error);
            throw error;
        }
    }
}
exports.LeadsRepository = LeadsRepository;
