// Alias para pruebas de WhatsApp
import { Router } from 'express'
import { requireApiKey } from '../middleware/security'
import { handleTestSend } from './wa360_test'

const r = Router()

/**
 * POST /wa/test/send
 * Alias para la lógica de prueba de WhatsApp (reutiliza handleTestSend de wa360_test)
 * Requiere header: x-api-key
 */
r.post('/wa/test/send', requireApiKey(), handleTestSend)

export default r

