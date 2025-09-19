import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  leadsFile: process.env.LEADS_FILE || './data/base_noclientes.xlsx',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  sessionTTL: 30, // minutos
  cleanupInterval: 5, // minutos
  // IA Configuration
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  aiMaxTokens: parseInt(process.env.AI_MAX_TOKENS || '300', 10),
  aiTemperature: parseFloat(process.env.AI_TEMPERATURE || '0.3')
};

export default config;
