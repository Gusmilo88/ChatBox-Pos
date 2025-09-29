import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  leadsFile: process.env.LEADS_FILE || './data/base_noclientes.xlsx',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  sessionTTL: 30, // minutos
  cleanupInterval: 5, // minutos
  // IA Configuration
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  aiMaxTokens: parseInt(process.env.AI_MAX_TOKENS || '300', 10),
  aiTemperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
  // Session Configuration
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'chatbox_sess',
  sessionTTLMinutes: parseInt(process.env.SESSION_TTL_MINUTES || '30', 10),
  sessionSecret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  dashboardOrigin: process.env.ALLOW_ORIGIN_DASHBOARD || 'http://localhost:5173'
};

export default config;
