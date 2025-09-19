import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import type { RequestHandler } from 'express'

export function buildCors() {
  const list = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  return cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true) // curl / local
      if (list.length === 0 || list.includes(origin)) return cb(null, true)
      return cb(new Error('Origin not allowed by CORS'))
    },
    credentials: true,
  })
}

export function secureHeaders() {
  return helmet({
    contentSecurityPolicy: false, // SPA local
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
}

export function limiter() {
  const windowMs = Number(process.env.RATE_WINDOW_MS || 60000)
  const max = Number(process.env.RATE_MAX || 60)
  return rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false })
}

export function requireApiKey(): RequestHandler {
  const protect = process.env.PROTECT_API === '1'
  const key = process.env.API_KEY || ''
  return (req, res, next) => {
    if (!protect) return next()
    const k = req.header('x-api-key') || ''
    if (k && key && k === key) return next()
    return res.status(401).json({ error: 'unauthorized' })
  }
}
