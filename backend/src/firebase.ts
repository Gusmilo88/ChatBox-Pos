import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import type { ServiceAccount } from 'firebase-admin'

function fromEnv(): ServiceAccount | null {
  const pj = process.env.FIREBASE_PROJECT_ID
  const email = process.env.FIREBASE_CLIENT_EMAIL
  const key = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (pj && email && key) return { projectId: pj, clientEmail: email, privateKey: key }
  // opción base64 de key completa (JSON)
  const b64 = process.env.BASE64_FIREBASE_KEY
  if (b64) {
    try {
      const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
      return {
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      }
    } catch {}
  }
  return null
}

let db: FirebaseFirestore.Firestore | null = null

export function getDb(): FirebaseFirestore.Firestore {
  if (!db) {
    if (!getApps().length) {
      const sa = fromEnv()
      if (sa) {
        initializeApp({ credential: cert(sa), projectId: sa.projectId })
      } else {
        initializeApp({ credential: applicationDefault() })
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

// Helpers para colecciones
export const collections = {
  conversations: () => getDb().collection('conversations'),
  messages: (conversationId: string) => getDb().collection('conversations').doc(conversationId).collection('messages'),
  outbox: () => getDb().collection('outbox'),
  admins: () => getDb().collection('admins'),
  audit: () => getDb().collection('audit')
}
