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

export function getDb() {
  if (!getApps().length) {
    const sa = fromEnv()
    if (sa) initializeApp({ credential: cert(sa), projectId: sa.projectId })
    else initializeApp({ credential: applicationDefault() }) // si hay GOOGLE_APPLICATION_CREDENTIALS
  }
  const db = getFirestore()
  db.settings({ ignoreUndefinedProperties: true })
  return db
}
