import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import logger from '../libs/logger';

const MODE = String(process.env.USE_FIREBASE || '0')

type Cliente = {
  cuit: string
  nombre: string
  email?: string
  saldo?: number
  id_xubio?: string
  last_doc_date?: string
  comprobantes?: string[]
}

// --- Excel (implementación actual) ---
async function xl_existsByCuit(cuit: string): Promise<boolean> {
  // Implementación actual de Excel
  return false; // Placeholder
}

async function xl_getSaldo(cuit: string): Promise<number | null> {
  // Implementación actual de Excel
  return null; // Placeholder
}

async function xl_getUltimos(cuit: string): Promise<string[]> {
  // Implementación actual de Excel
  return []; // Placeholder
}

// --- Firestore ---
async function fb_getDoc(cuit: string): Promise<Cliente | null> {
  const { getDb } = await import('../firebase')
  const snap = await getDb().collection('clientes').doc(cuit).get()
  return snap.exists ? (snap.data() as Cliente) : null
}

export async function existsByCuit(cuit: string): Promise<boolean> {
  if (MODE === 'prod' || MODE === 'emu') return !!(await fb_getDoc(cuit))
  return xl_existsByCuit(cuit)
}

export async function getSaldo(cuit: string): Promise<number | null> {
  if (MODE === 'prod' || MODE === 'emu') return (await fb_getDoc(cuit))?.saldo ?? null
  return xl_getSaldo(cuit)
}

export async function getUltimosComprobantes(cuit: string): Promise<string[]> {
  if (MODE === 'prod' || MODE === 'emu') return (await fb_getDoc(cuit))?.comprobantes ?? []
  return xl_getUltimos(cuit)
}

// Clase legacy para compatibilidad (mantener para no romper código existente)
export class ClientsRepository {
  private filePath: string;
  private clientes: Cliente[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
    this.initializeFile();
  }

  private initializeFile(): void {
    const dir = path.dirname(this.filePath);
    
    // Crear directorio si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Si el archivo no existe, crearlo con datos de ejemplo
    if (!fs.existsSync(this.filePath)) {
      this.createInitialFile();
    }

    this.loadClientes();
  }

  private createInitialFile(): void {
    const clientesData: Cliente[] = [
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
    logger.info(`Archivo Excel inicial creado: ${this.filePath}`);
  }

  private loadClientes(): void {
    try {
      const workbook = XLSX.readFile(this.filePath);
      const sheetName = workbook.SheetNames.find(name => name === 'clientes_mock');
      
      if (!sheetName) {
        logger.error('Hoja clientes_mock no encontrada');
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      this.clientes = XLSX.utils.sheet_to_json(worksheet);
      
      logger.info(`Cargados ${this.clientes.length} clientes desde ${this.filePath}`);
      
      // Log de CUITs disponibles para testing
      const cuits = this.clientes.map(c => c.cuit).join(', ');
      logger.info(`CUITs mock disponibles para testing: ${cuits}`);
    } catch (error) {
      logger.error('Error cargando clientes:', error);
    }
  }

  public existsByCuit(cuit: string): boolean {
    return this.clientes.some(cliente => cliente.cuit === cuit);
  }

  public async getSaldo(cuit: string): Promise<number | null> {
    const cliente = this.clientes.find(c => c.cuit === cuit);
    return cliente ? (cliente.saldo ?? null) : null;
  }

  public async getUltimosComprobantes(cuit: string): Promise<string[]> {
    const cliente = this.clientes.find(c => c.cuit === cuit);
    if (!cliente) return [];
    
    // Comprobantes mock específicos por cliente
    if (cuit === "20123456786") {
      return [
        "A 0001-00001234 (2025-08-15) – $0",
        "B 0002-00004567 (2025-07-30) – $15.230",
        "NC A 0001-00000012 (2025-07-05) – -$3.500"
      ];
    } else if (cuit === "20987654326") {
      return [
        "A 0001-00001235 (2025-09-01) – $45.230",
        "B 0002-00004568 (2025-08-15) – $25.100",
        "A 0001-00001236 (2025-08-01) – $12.500"
      ];
    }
    
    return [];
  }
}
