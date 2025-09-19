import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import dayjs from 'dayjs';
import logger from '../libs/logger';

export interface Lead {
  created_at: string;
  phone_e164: string;
  full_name: string;
  cuit?: string;
  email: string;
  city?: string;
  company?: string;
  interest: string;
  source: string;
  utm_campaign?: string;
  consent_ts: string;
  stage: string;
  assigned_to: string;
  last_msg_at: string;
  last_msg_text: string;
  notes?: string;
  tag1?: string;
  tag2?: string;
}

export class LeadsRepository {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.ensureFileExists();
  }

  private ensureFileExists(): void {
    const dir = path.dirname(this.filePath);
    
    // Crear directorio si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Si el archivo no existe, crearlo
    if (!fs.existsSync(this.filePath)) {
      this.createInitialFile();
    }
  }

  private createInitialFile(): void {
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
    logger.info(`Archivo Excel inicial creado: ${this.filePath}`);
  }

  public async saveLead(phone: string, fullName: string, email: string, interest: string, cuit?: string): Promise<void> {
    try {
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      
      // Determinar assigned_to según el interés
      let assignedTo = 'Ivan'; // default
      if (interest === 'turno_consulta') {
        assignedTo = 'Secretaria1';
      } else if (interest === 'honorarios') {
        assignedTo = 'Secretaria2';
      }

      const lead: Lead = {
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
      const newWorksheet = XLSX.utils.aoa_to_sheet(existingData as any[][]);
      workbook.Sheets[sheetName] = newWorksheet;
      
      // Guardar archivo
      XLSX.writeFile(workbook, this.filePath);
      
      logger.info(`Lead guardado: ${fullName} (${phone}) - ${interest}`);
    } catch (error) {
      logger.error('Error guardando lead:', error);
      throw error;
    }
  }
}
