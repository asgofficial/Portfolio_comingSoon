import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import crypto from 'node:crypto'
import { Resend } from 'resend'
import {
  insertSubscriber,
  findSubscriberByEmail,
  deleteSubscriberById,
  listSubscribers,
  countSubscribers,
} from './db.js'

const PORT = process.env.PORT || 8787
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || ''
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const NOTIFY_FROM_EMAIL =
  process.env.NOTIFY_FROM_EMAIL || 'onboarding@resend.dev'
const SITE_NAME = process.env.SITE_NAME || 'ASGAUTAM'

const resend = RESEND_API_KEY
  ? new Resend(RESEND_API_KEY)
  : null

if (resend) {
  console.log('Resend email transport ready')
} else {
  console.warn('Resend email transport disabled: RESEND_API_KEY is not set')
}

const app = express()

// Trust the first proxy hop (Render/Railway/Fly/Heroku etc. all sit behind
// one) so express-rate-limit and req.ip see the real client IP.
app.set('trust proxy', 1)

app.use(helmet())
app.use(express.json({ limit: '10kb' }))

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser requests (no Origin header) and
      // anything explicitly whitelisted in ALLOWED_ORIGINS.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
  })
)

// -----------------------------------------------------------------------
// rate limiting — generous enough for real visitors, tight enough to stop
// scripted spam. Applies per-IP.
// -----------------------------------------------------------------------
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many attempts. Try again in a few minutes.' },
})

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(globalLimiter)

// -----------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase()
}

function hashIp(ip) {
  // Never store raw IPs — a salted, truncated hash is enough to spot abuse
  // patterns without keeping anything personally identifying long-term.
  return crypto
    .createHash('sha256')
    .update((process.env.IP_HASH_SALT || 'change-me') + ip)
    .digest('hex')
    .slice(0, 16)
}

function signAdminToken() {
  const payload = JSON.stringify({
    exp: Date.now() + ADMIN_SESSION_TTL_MS,
    nonce: crypto.randomBytes(16).toString('hex'),
  })
  const body = Buffer.from(payload).toString('base64url')
  const sig = crypto.createHmac('sha256', ADMIN_API_KEY).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verifyAdminToken(token) {
  if (!token || !ADMIN_API_KEY) return false
  const [body, sig] = String(token).split('.')
  if (!body || !sig) return false
  const expected = crypto.createHmac('sha256', ADMIN_API_KEY).update(body).digest('base64url')
  if (sig !== expected) return false

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return typeof payload.exp === 'number' && payload.exp > Date.now()
  } catch {
    return false
  }
}

function isAdminAuthorized(req) {
  if (ADMIN_API_KEY && req.get('x-admin-key') === ADMIN_API_KEY) return true

  const auth = req.get('authorization') || ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (match && verifyAdminToken(match[1])) return true

  const token = req.get('x-admin-token')
  return verifyAdminToken(token)
}

async function sendWelcomeEmail(email) {
  if (!resend) {
    console.warn(`welcome email skipped for ${email}: Resend API key is not set`)
    return false
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `${SITE_NAME} <${NOTIFY_FROM_EMAIL}>`,
      to: [email],
      subject: `You're on the list`,
      text: `Hi,

You're all set and will be notified the moment ${SITE_NAME} goes live.

Thanks for signing up. This is the first step, and you'll only hear from me when there's something worth sharing.

Until then, keep an eye out. The build is in motion.

— Ayush Singh Gautam`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827; max-width: 560px; margin: 0 auto;">
          <p style="font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin: 0 0 16px;">
            You're on the list
          </p>

          <h1 style="font-size: 24px; margin: 0 0 12px;">
            You're all set and will be notified the moment ${SITE_NAME} goes live.
          </h1>

          <p style="font-size: 16px; margin: 0 0 20px;">
            Thanks for signing up. This is the first step, and you'll only hear from me when there's something worth sharing.
          </p>

          <p style="font-size: 16px; margin: 0 0 20px;">
            Until then, keep an eye out. The build is in motion.
          </p>

          <p style="font-size: 13px; color: #6b7280; margin: 0;">
            — Ayush Singh Gautam
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('welcome email failed:', error)
      return false
    }

    console.log(`welcome email sent to ${email}: ${data?.id || 'ok'}`)
    return true
  } catch (err) {
    console.error('welcome email failed:', err.message)
    return false
  }
}

// -----------------------------------------------------------------------
// routes
// -----------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, subscribers: countSubscribers.get().count })
})

app.post('/api/subscribe', subscribeLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email)

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({
      ok: false,
      error: 'Enter a valid email address.',
    })
  }

  if (email.length > 254) {
    return res.status(400).json({
      ok: false,
      error: 'Enter a valid email address.',
    })
  }

  const existing = findSubscriberByEmail.get(email)

  if (existing) {
    return res.json({
      ok: true,
      alreadySubscribed: true,
    })
  }

  try {
    insertSubscriber.run({
      email,
      source: req.body?.source || 'coming-soon-page',
      ipHash: hashIp(req.ip),
    })
  } catch (err) {
    console.error('insert failed:', err.message)

    return res.status(500).json({
      ok: false,
      error: 'Something went wrong. Try again shortly.',
    })
  }

  // Send email without blocking the signup response
sendWelcomeEmail(email).catch((err) => {

  console.error('Background welcome email error:', err)

})

return res.status(201).json({ ok: true })

  // Respond immediately
  return res.status(201).json({
    ok: true,
  })
})

app.delete('/api/subscribers/:id', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const id = Number.parseInt(req.params.id, 10)
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'Invalid subscriber id.' })
  }

  const result = deleteSubscriberById.run(id)
  if (result.changes === 0) {
    return res.status(404).json({ ok: false, error: 'Subscriber not found.' })
  }

  return res.json({ ok: true, deletedId: id })
})

// Protected export for you, the site owner — not for the public frontend.
app.get('/api/subscribers', (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const rows = listSubscribers.all()

  if (req.query.format === 'csv') {
    const header = 'id,email,created_at,source'
    const lines = rows.map(
      (r) => `${r.id},${r.email},${r.created_at},${(r.source || '').replace(/,/g, ';')}`
    )
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"')
    return res.send([header, ...lines].join('\n'))
  }

  return res.json({ ok: true, count: rows.length, subscribers: rows })
})

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' })
})

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ ok: false, error: 'Origin not allowed.' })
  }
  console.error(err)
  res.status(500).json({ ok: false, error: 'Something went wrong.' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`notify-me backend listening on :${PORT}`)
})
