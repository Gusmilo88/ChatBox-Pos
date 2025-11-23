import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import type { ServiceAccount } from 'firebase-admin'

function fromEnv(): ServiceAccount | null {
  // PRIORIDAD 1: BASE64_FIREBASE_KEY (más confiable, evita problemas de formato)
  const b64Raw = process.env.BASE64_FIREBASE_KEY
  if (b64Raw && b64Raw.trim().length > 0) {
    console.log(`🔍 Firebase: BASE64_FIREBASE_KEY encontrado (longitud: ${b64Raw.length})`)
    try {
      // Limpiar el base64: quitar comillas, espacios, saltos de línea
      let b64 = b64Raw.trim()
      // Quitar comillas al inicio y final
      b64 = b64.replace(/^["']|["']$/g, '')
      // Quitar espacios y saltos de línea
      b64 = b64.replace(/\s+/g, '')
      
      const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
      console.log(`✅ Firebase: Configurando con BASE64_FIREBASE_KEY (proyecto: ${json.project_id})`)
      return {
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      }
    } catch (error) {
      const errorMsg = (error instanceof Error) ? error.message : String(error)
      console.error('❌ Error parseando BASE64_FIREBASE_KEY:', errorMsg)
      console.warn('⚠️  Usando variables individuales como fallback...')
      // NO lanzar error, continuar con variables individuales
    }
  }
  
  // PRIORIDAD 2: Variables individuales (fallback o principal)
  const pj = process.env.FIREBASE_PROJECT_ID
  const email = process.env.FIREBASE_CLIENT_EMAIL
  let key = process.env.FIREBASE_PRIVATE_KEY || ''
  
  // Normalizar la clave privada: reemplazar \n literales por saltos de línea reales
  if (key) {
    // Quitar comillas al inicio y final
    key = key.replace(/^["']|["']$/g, '')
    // Reemplazar \n literales por saltos de línea reales
    key = key.replace(/\\n/g, '\n')
    // Si no tiene saltos de línea pero tiene BEGIN PRIVATE KEY, agregar saltos después de los headers
    if (!key.includes('\n') && key.includes('BEGIN PRIVATE KEY')) {
      key = key.replace(/-----BEGIN PRIVATE KEY-----/g, '-----BEGIN PRIVATE KEY-----\n')
      key = key.replace(/-----END PRIVATE KEY-----/g, '\n-----END PRIVATE KEY-----\n')
    }
    
    // Validar que la clave tenga el formato correcto
    if (!key.includes('BEGIN PRIVATE KEY') || !key.includes('END PRIVATE KEY')) {
      console.warn('Firebase: La clave privada no tiene el formato correcto (falta BEGIN/END PRIVATE KEY)')
    }
    if (key.length < 100) {
      console.warn('Firebase: La clave privada parece muy corta (debería tener ~1600+ caracteres)')
    }
  }
  
  if (pj && email && key) {
    console.log(`✅ Firebase: Configurando con credenciales de ${email} (proyecto: ${pj})`)
    return { projectId: pj, clientEmail: email, privateKey: key }
  }
  
  console.warn('Firebase: No se encontraron credenciales válidas en variables de entorno')
  return null
}

let db: FirebaseFirestore.Firestore | null = null

export function getDb(): FirebaseFirestore.Firestore {
  if (!db) {
    if (!getApps().length) {
      console.log('🔍 Firebase: Verificando variables de entorno...')
      console.log('  - BASE64_FIREBASE_KEY:', process.env.BASE64_FIREBASE_KEY ? `EXISTE (${process.env.BASE64_FIREBASE_KEY.length} chars)` : 'NO EXISTE')
      console.log('  - FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID || 'NO EXISTE')
      console.log('  - FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL || 'NO EXISTE')
      console.log('  - FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? `EXISTE (${process.env.FIREBASE_PRIVATE_KEY.length} chars)` : 'NO EXISTE')
      const sa = fromEnv()
      if (sa) {
        try {
          console.log('Firebase: Inicializando con credenciales de ServiceAccount...')
          initializeApp({ credential: cert(sa), projectId: sa.projectId })
          console.log('Firebase: Inicializado correctamente ✅')
        } catch (error) {
          const errorMsg = (error instanceof Error) ? error.message : String(error)
          console.error('❌ Error inicializando Firebase con credenciales:', errorMsg)
          
          // Si el error es de clave privada, dar más detalles
          if (errorMsg.includes('private key') || errorMsg.includes('ASN.1')) {
            console.error('💡 El problema es la clave privada. Verifica:')
            console.error('   1. FIREBASE_PRIVATE_KEY debe tener formato: "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"')
            console.error('   2. O usa BASE64_FIREBASE_KEY con el JSON completo en base64')
            console.error('   3. La clave debe tener ~1600+ caracteres')
          }
          
          // Si falla, intentar con applicationDefault
          console.warn('⚠️  Intentando con applicationDefault (puede fallar si no hay credenciales en sistema)...')
          try {
            initializeApp({ credential: applicationDefault() })
            console.log('Firebase: Inicializado con applicationDefault ✅')
          } catch (defaultError) {
            const defaultErrorMsg = (defaultError instanceof Error) ? defaultError.message : String(defaultError)
            console.error('❌ Error con applicationDefault también:', defaultErrorMsg)
            throw new Error(`Firebase no pudo inicializarse. Error: ${errorMsg}`)
          }
        }
      } else {
        console.warn('⚠️  Firebase: No se encontraron credenciales en env, usando applicationDefault')
        try {
          initializeApp({ credential: applicationDefault() })
          console.log('Firebase: Inicializado con applicationDefault ✅')
        } catch (error) {
          const errorMsg = (error instanceof Error) ? error.message : String(error)
          console.error('❌ Error con applicationDefault:', errorMsg)
          throw new Error(`Firebase no pudo inicializarse. Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en .env`)
        }
      }
    }
    db = getFirestore()
    // Solo configurar settings si no se ha hecho antes
    try {
      db.settings({ ignoreUndefinedProperties: true })
    } catch (error) {
      // Ignorar error si ya se configuró
    }
  }
  return db
}

export { Timestamp }

// Helpers para colecciones
export const collections = {
  conversations: (db?: FirebaseFirestore.Firestore) => (db || getDb()).collection('conversations'),
  messages: (conversationId: string, db?: FirebaseFirestore.Firestore) => (db || getDb()).collection('conversations').doc(conversationId).collection('messages'),
  outbox: (db?: FirebaseFirestore.Firestore) => (db || getDb()).collection('outbox'),
  admins: (db?: FirebaseFirestore.Firestore) => (db || getDb()).collection('admins'),
  audit: (db?: FirebaseFirestore.Firestore) => (db || getDb()).collection('audit'),
  aiUsage: (db?: FirebaseFirestore.Firestore) => (db || getDb()).collection('ai_usage'),
  aiSettings: (db?: FirebaseFirestore.Firestore) => (db || getDb()).collection('ai_settings'),
  autoReplyRules: (db?: FirebaseFirestore.Firestore) => (db || getDb()).collection('auto_reply_rules')
}
