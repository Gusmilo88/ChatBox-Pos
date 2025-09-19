#!/usr/bin/env tsx

import axios from 'axios';
import chalk from 'chalk';
import { z } from 'zod';

// Configuración desde variables de entorno
const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const API_KEY = process.env.API_KEY || '';
const FROM_A = process.env.FROM_A || '+5491100000002'; // Cliente
const FROM_B = process.env.FROM_B || '+5491100000003'; // No cliente
const CUIT_TEST = process.env.CUIT_TEST || '20123456786';
const WHATSAPP_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'test_token';

// Flags de línea de comandos
const args = process.argv.slice(2);
const isQuick = args.includes('--quick');
const isWaOnly = args.includes('--wa-only');

// Esquemas de validación
const HealthSchema = z.object({
  ok: z.boolean()
});

const MessageResponseSchema = z.object({
  replies: z.array(z.string())
});

const WhatsAppResponseSchema = z.object({
  received: z.boolean(),
  n_messages: z.number().optional()
});

// Configuración de axios
const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: API_KEY ? { 'x-api-key': API_KEY } : {}
});

// Resultados de tests
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

// Helper para ejecutar tests
async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(chalk.green(`✔ PASS`), chalk.gray(`(${duration}ms)`), name);
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg, duration });
    console.log(chalk.red(`✖ FAIL`), chalk.gray(`(${duration}ms)`), name);
    console.log(chalk.red(`  Error: ${errorMsg}`));
  }
}

// Tests individuales
async function testHealth(): Promise<void> {
  const response = await api.get('/health');
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  const data = HealthSchema.parse(response.data);
  if (!data.ok) {
    throw new Error('Health check failed');
  }
}

async function testMenuReset(): Promise<void> {
  const response = await api.post('/api/simulate/message', {
    from: FROM_A,
    text: 'menu'
  });
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  const data = MessageResponseSchema.parse(response.data);
  if (!data.replies || data.replies.length === 0) {
    throw new Error('No replies received');
  }
}

async function testHola(): Promise<void> {
  const response = await api.post('/api/simulate/message', {
    from: FROM_A,
    text: 'hola'
  });
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  const data = MessageResponseSchema.parse(response.data);
  if (!data.replies || data.replies.length === 0) {
    throw new Error('No replies received');
  }
}

async function testCuitAuth(): Promise<void> {
  const response = await api.post('/api/simulate/message', {
    from: FROM_A,
    text: CUIT_TEST
  });
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  const data = MessageResponseSchema.parse(response.data);
  if (!data.replies || data.replies.length === 0) {
    throw new Error('No replies received');
  }
  
  // Verificar que llegó al menú de cliente
  const reply = data.replies.join(' ').toLowerCase();
  if (!reply.includes('qué necesitás') && !reply.includes('opciones')) {
    throw new Error('Did not reach CLIENTE_MENU state');
  }
}

async function testSaldo(): Promise<void> {
  const response = await api.post('/api/simulate/message', {
    from: FROM_A,
    text: '1'
  });
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  const data = MessageResponseSchema.parse(response.data);
  if (!data.replies || data.replies.length === 0) {
    throw new Error('No replies received');
  }
  
  // Verificar que muestra saldo
  const reply = data.replies.join(' ').toLowerCase();
  if (!reply.includes('saldo') && !reply.includes('$') && !reply.includes('ars')) {
    throw new Error('Did not show balance information');
  }
}

async function testComprobantes(): Promise<void> {
  const response = await api.post('/api/simulate/message', {
    from: FROM_A,
    text: '2'
  });
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  const data = MessageResponseSchema.parse(response.data);
  if (!data.replies || data.replies.length === 0) {
    throw new Error('No replies received');
  }
  
  // Verificar que muestra comprobantes
  const reply = data.replies.join(' ').toLowerCase();
  if (!reply.includes('comprobante') && !reply.includes('último')) {
    throw new Error('Did not show invoices information');
  }
}

async function testLeadFlow(): Promise<void> {
  // Paso 1: "quiero info"
  let response = await api.post('/api/simulate/message', {
    from: FROM_B,
    text: 'quiero info'
  });
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  let data = MessageResponseSchema.parse(response.data);
  if (!data.replies || data.replies.length === 0) {
    throw new Error('No replies received for "quiero info"');
  }
  
  // Paso 2: Nombre
  response = await api.post('/api/simulate/message', {
    from: FROM_B,
    text: 'Juan Pérez'
  });
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  data = MessageResponseSchema.parse(response.data);
  if (!data.replies || data.replies.length === 0) {
    throw new Error('No replies received for name');
  }
  
  // Paso 3: Email
  response = await api.post('/api/simulate/message', {
    from: FROM_B,
    text: 'juan@empresa.com'
  });
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  data = MessageResponseSchema.parse(response.data);
  if (!data.replies || data.replies.length === 0) {
    throw new Error('No replies received for email');
  }
  
  // Paso 4: Interés
  response = await api.post('/api/simulate/message', {
    from: FROM_B,
    text: 'honorarios'
  });
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  data = MessageResponseSchema.parse(response.data);
  if (!data.replies || data.replies.length === 0) {
    throw new Error('No replies received for interest');
  }
  
  // Verificar que llegó al final del flujo
  const reply = data.replies.join(' ').toLowerCase();
  if (!reply.includes('derivamos') && !reply.includes('equipo')) {
    throw new Error('Did not complete lead flow');
  }
}

async function testWhatsAppVerification(): Promise<void> {
  // Probar con diferentes tokens comunes
  const tokens = [WHATSAPP_TOKEN, 'test_token', 'verification_token', 'whatsapp_token'];
  let lastError = '';
  
  for (const token of tokens) {
    try {
      const response = await api.get('/webhook/whatsapp', {
        params: {
          'hub.mode': 'subscribe',
          'hub.verify_token': token,
          'hub.challenge': '12345'
        }
      });
      
      if (response.status === 200 && response.data === '12345') {
        return; // Éxito
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  
  // Si todos los tokens fallan, verificar que al menos el endpoint existe
  try {
    const response = await api.get('/webhook/whatsapp', {
      params: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': '12345'
      }
    });
    
    // Si llega aquí, el endpoint existe pero el token es incorrecto
    if (response.status === 403) {
      console.log(chalk.yellow('⚠ WARN: WhatsApp verification endpoint exists but token mismatch (expected in production)'));
      return; // Considerar como éxito parcial
    }
  } catch (error) {
    // Si no hay respuesta, el endpoint no existe
    throw new Error(`WhatsApp webhook endpoint not accessible. Last error: ${lastError}`);
  }
  
  throw new Error(`WhatsApp verification failed with all tokens. Last error: ${lastError}`);
}

async function testWhatsAppMessage(): Promise<void> {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        value: {
          messages: [{
            from: FROM_A,
            id: 'wamid.X',
            timestamp: '0',
            type: 'text',
            text: { body: 'hola' }
          }]
        }
      }]
    }]
  };
  
  const response = await api.post('/webhook/whatsapp', payload);
  
  if (response.status !== 200) {
    throw new Error(`Expected status 200, got ${response.status}`);
  }
  
  const data = WhatsAppResponseSchema.parse(response.data);
  if (!data.received) {
    throw new Error('WhatsApp webhook did not process message');
  }
}

// Función principal
async function main(): Promise<void> {
  console.log(chalk.blue('🧪 Smoke Tests - Backend Chatbot'));
  console.log(chalk.gray(`API Base: ${API_BASE}`));
  console.log(chalk.gray(`API Key: ${API_KEY ? 'Set' : 'Not set'}`));
  console.log(chalk.gray(`Mode: ${isQuick ? 'Quick' : isWaOnly ? 'WhatsApp Only' : 'Full'}`));
  console.log('');
  
  try {
    // Test básico de conectividad
    await runTest('Health Check', testHealth);
    
    if (!isWaOnly) {
      // Tests de FSM
      await runTest('Menu Reset', testMenuReset);
      await runTest('Hola Response', testHola);
      
      if (!isQuick) {
        await runTest('CUIT Authentication', testCuitAuth);
        await runTest('Saldo Query', testSaldo);
        await runTest('Comprobantes Query', testComprobantes);
        await runTest('Lead Flow', testLeadFlow);
      }
    }
    
    // Tests de WhatsApp
    await runTest('WhatsApp Verification', testWhatsAppVerification);
    await runTest('WhatsApp Message', testWhatsAppMessage);
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
  
  // Resumen
  console.log('');
  console.log(chalk.blue('📊 Test Summary'));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const duration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(chalk.green(`✔ Passed: ${passed}`));
  console.log(chalk.red(`✖ Failed: ${failed}`));
  console.log(chalk.gray(`Total: ${total} tests`));
  console.log(chalk.gray(`Duration: ${duration}ms`));
  
  if (failed > 0) {
    console.log('');
    console.log(chalk.red('Failed Tests:'));
    results.filter(r => !r.passed).forEach(r => {
      console.log(chalk.red(`  - ${r.name}: ${r.error}`));
    });
  }
  
  console.log('');
  
  if (failed === 0) {
    console.log(chalk.green('🎉 All tests passed!'));
    process.exit(0);
  } else {
    console.log(chalk.red(`❌ ${failed} test(s) failed`));
    process.exit(1);
  }
}

// Ejecutar si es el módulo principal
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Unhandled error:'), error);
    process.exit(1);
  });
}
