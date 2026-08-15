import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Database,
  Download,
  KeyRound,
  Loader2,
  RefreshCcw,
  Shield,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------
const SITE = {
  name: 'ASGAUTAM',
  domain: 'ASG',
  launchDate: null,
  // e.g. new Date('2026-03-21T00:00:00') — null => status readout
  description:
    'A working log of what gets built, broken, learned, and shipped — AI systems, Games, and the occasional civic-tech rabbit hole.',
  social: {
    github: 'https://github.com/asgofficial',
    linkedin: 'https://www.linkedin.com/in/ayush-singh-gautam-74a386331/',
    instagram: 'https://instagram.com/mr_gautam_ayush',
  },
}

const TRACKS = ['AI / ML', 'WEB', 'EXPERIMENTS', 'HACKATHONS', 'CREATIVE']
const DISPLAY_FONT = 'font-[family-name:var(--font-display)]'

const LOG = [
  {
    ref: '001',
    title: 'Build',
    copy: 'Projects, products, and the experiments that don\u2019t make the changelog.',
  },
  {
    ref: '002',
    title: 'Think',
    copy: 'AI, infrastructure, and the technical questions worth chasing.',
  },
  {
    ref: '003',
    title: 'Create',
    copy: 'Design, music, video \u2014 whatever the work needs.',
  },
  {
    ref: '004',
    title: 'Ship',
    copy: 'Turning the above into things people can actually use.',
  },
]

// ---------------------------------------------------------------------------
// lib
// ---------------------------------------------------------------------------
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'
const ADMIN_TOKEN_STORAGE = 'asgautam-admin-token'
let cachedVisitCount = null

async function getVisitCount() {
  if (cachedVisitCount !== null) return cachedVisitCount

  try {
    const res = await fetch(`${API_URL}/api/visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await res.json()

    if (!res.ok || !data?.ok) {
      throw new Error('Unable to load visit count.')
    }

    cachedVisitCount = data.visitCount
    return cachedVisitCount
  } catch {
    // Fallback if backend is temporarily unavailable.
    cachedVisitCount = 1
    return cachedVisitCount
  }
}

async function subscribeEmail(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.')
  }

  let res
  try {
    res = await fetch(`${API_URL}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'coming-soon-page' }),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    // fall through — handled by the !res.ok / !data checks below
  }

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Something went wrong. Try again shortly.')
  }

  return data
}

async function fetchSubscribers(adminKey) {
  const res = await fetch(`${API_URL}/api/subscribers`, {
    headers: {
      Authorization: `Bearer ${adminKey}`,
    },
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // handled below
  }

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Unable to load subscribers.')
  }

  return data
}

async function fetchHealth() {
  const res = await fetch(`${API_URL}/api/health`)
  const data = await res.json()
  if (!res.ok || !data?.ok) {
    throw new Error('Unable to load site health.')
  }
  return data
}

async function downloadSubscribersCsv(adminKey) {
  const res = await fetch(`${API_URL}/api/subscribers?format=csv`, {
    headers: {
      Authorization: `Bearer ${adminKey}`,
    },
  })

  if (!res.ok) {
    throw new Error('Unable to export CSV.')
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'subscribers.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function deleteSubscriber(adminKey, id) {
  const res = await fetch(`${API_URL}/api/subscribers/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${adminKey}`,
    },
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // handled below
  }

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Unable to delete subscriber.')
  }

  return data
}

async function loginAdmin(adminKey) {
  const res = await fetch(`${API_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: adminKey }),
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // handled below
  }

  if (!res.ok || !data?.ok || !data?.token) {
    throw new Error(data?.error || 'Unable to sign in.')
  }

  return data.token
}

function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!target) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [target])
  return useMemo(() => {
    if (!target) return null
    const diff = target.getTime() - now
    if (Number.isNaN(diff) || diff <= 0) return null
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    }
  }, [now, target])
}

function useBlink(period = 1000) {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), period)
    return () => clearInterval(id)
  }, [period])
  return on
}

// ---------------------------------------------------------------------------
// background — quiet blueprint texture, static, no cursor-chase
// ---------------------------------------------------------------------------
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[var(--bg)]">

      {/* Architectural grid */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.045,
          backgroundImage: `
            linear-gradient(rgba(201,161,90,0.28) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,161,90,0.28) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          maskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 78%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 78%)',
        }}
      />

      {/* Fine luxury texture */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.13,
          backgroundImage:
            'radial-gradient(circle, rgba(235,220,190,0.65) 0.55px, transparent 0.65px)',
          backgroundSize: '18px 18px',
          maskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 72%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 0%, transparent 72%)',
        }}
      />

      {/* Large champagne atmosphere */}
      <div
        className="absolute left-1/2 top-[5%] -translate-x-1/2"
        style={{
          width: '1000px',
          height: '700px',
          background:
            'radial-gradient(ellipse at center, rgba(201,161,90,0.12) 0%, rgba(201,161,90,0.055) 30%, transparent 70%)',
          filter: 'blur(35px)',
        }}
      />

      {/* Soft ivory light behind the title */}
      <div
        className="absolute left-1/2 top-[19%] -translate-x-1/2"
        style={{
          width: '600px',
          height: '420px',
          background:
            'radial-gradient(circle, rgba(120, 150, 190, 0.045) 0%, transparent 68%)',
          filter: 'blur(30px)',
        }}
      />

      {/* Lower ambient glow */}
      <div
        className="absolute left-1/2 top-[55%] -translate-x-1/2"
        style={{
          width: '800px',
          height: '500px',
          background:
            'radial-gradient(ellipse, rgba(120, 150, 190, 0.045), transparent 68%)',
          filter: 'blur(55px)',
        }}
      />

      {/* Cinematic vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 28%, rgba(0,0,0,0.28) 100%)',
        }}
      />

      {/* Bottom fade */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, transparent 68%, var(--bg) 100%)',
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// corner brackets — the signature: page framed like a spec sheet
// ---------------------------------------------------------------------------
function CornerMarks() {
  const common = 'absolute h-5 w-5 border-[var(--rule-strong)] sm:h-7 sm:w-7'
  return (
    <div className="pointer-events-none absolute inset-4 z-10 sm:inset-8" aria-hidden="true">
      <span className={`${common} left-0 top-0 border-l border-t`} />
      <span className={`${common} right-0 top-0 border-r border-t`} />
      <span className={`${common} bottom-0 left-0 border-b border-l`} />
      <span className={`${common} bottom-0 right-0 border-b border-r`} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// status readout
// ---------------------------------------------------------------------------
function CountdownUnit({ value, label }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden border border-[var(--rule)] bg-[var(--bg-raised)] sm:h-16 sm:w-16">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`${DISPLAY_FONT} text-xl font-medium text-[var(--ink)] [font-variant-numeric:tabular-nums] sm:text-2xl`}
          >
            {String(value).padStart(2, '0')}
          </motion.span>
        </AnimatePresence>
      </div>
      <span className={`${DISPLAY_FONT} text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]`}>
        {label}
      </span>
    </div>
  )
}

function StatusReadout({ target }) {
  const cd = useCountdown(target)
  const blink = useBlink(650)
  if (!cd) {
    return (
      <div className={`inline-flex items-center gap-3 border border-[var(--rule)] bg-[var(--bg-raised)] px-5 py-2.5 text-xs uppercase tracking-[0.22em] text-[var(--ink-dim)] ${DISPLAY_FONT}`}>
        <span className="text-[var(--ink-faint)]">[</span>
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
        status: building
        <span className="text-[var(--accent)]" style={{ opacity: blink ? 1 : 0 }}>
          _
        </span>
        <span className="text-[var(--ink-faint)]">]</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <CountdownUnit value={cd.days} label="days" />
      <CountdownUnit value={cd.hours} label="hrs" />
      <CountdownUnit value={cd.minutes} label="min" />
      <CountdownUnit value={cd.seconds} label="sec" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// notify modal
// ---------------------------------------------------------------------------
function NotifyModal({ open, onClose }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60)
    } else {
      setStatus('idle')
      setEmail('')
      setError('')
    }
  }, [open])

  const submit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Enter a valid email address.')
        setStatus('error')
        return
      }
      setStatus('loading')
      setError('')
      try {
        await subscribeEmail(email)
        setStatus('success')
      } catch (err) {
        setStatus('error')
        setError(err.message || 'Something went wrong.')
      }
    },
    [email]
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="notify-modal-title"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-full max-w-sm border border-[var(--rule-strong)] bg-[var(--bg-raised)] p-7"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute right-4 top-4 p-1 text-[var(--ink-faint)] transition hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            {status === 'success' ? (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="mb-4 flex h-11 w-11 items-center justify-center border border-[var(--accent)] text-[var(--accent)]">
                  <Check className="h-5 w-5" aria-hidden="true" />
                </div>
                <p
                  id="notify-modal-title"
                  className="font-[family-name:var(--font-display)] text-lg font-medium text-[var(--ink)]"
                >
                  You&rsquo;re on the list.
                </p>
                <p className="mt-1 text-sm text-[var(--ink-dim)]">
                  One email, the moment it ships.
                </p>
              </div>
            ) : (
              <>
                <p
                  id="notify-modal-title"
                  className="font-[family-name:var(--font-display)] text-lg font-medium text-[var(--ink)]"
                >
                  Be the first to know.
                </p>
                <p className="mt-1 text-sm text-[var(--ink-dim)]">
                  No spam. Just one email when it ships.
                </p>
                <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
                  <label htmlFor="notify-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    ref={inputRef}
                    id="notify-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (status === 'error') setStatus('idle')
                    }}
                    aria-invalid={status === 'error'}
                    aria-describedby={status === 'error' ? 'notify-email-error' : undefined}
                    className="w-full border border-[var(--rule)] bg-transparent px-4 py-2.5 font-mono text-sm text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none transition focus:border-[var(--accent)]"
                  />
                  {status === 'error' && (
                    <p id="notify-email-error" role="alert" className="text-xs text-red-400">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="mt-1 inline-flex items-center justify-center gap-2 bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-ink)] transition hover:opacity-90 disabled:opacity-60"
                  >
                    {status === 'loading' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      'Keep me posted'
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------------------------------------------------------------------------
// tracks strip (explore the build)
// ---------------------------------------------------------------------------
function TrackStrip({ open }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="overflow-hidden"
        >
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-6 pb-2 pt-6">
            {TRACKS.map((label, i) => (
              <React.Fragment key={label}>
                <span className={`${DISPLAY_FONT} text-[11px] uppercase tracking-[0.16em] text-[var(--ink-dim)]`}>
                  {label}
                </span>
                {i < TRACKS.length - 1 && (
                  <span className="text-[var(--ink-faint)]" aria-hidden="true">
                    &middot;
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AdminPanel() {
  const [adminKey, setAdminKey] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [healthCount, setHealthCount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [lastLoaded, setLastLoaded] = useState(null)

  const loadData = useCallback(
    async (token) => {
      const trimmed = token.trim()
      if (!trimmed) {
        setError('Sign in with the admin key.')
        return
      }

      setLoading(true)
      setError('')
      try {
        const [subscriberData, healthData] = await Promise.all([
          fetchSubscribers(trimmed),
          fetchHealth(),
        ])
        setRows(subscriberData.subscribers || [])
        setCount(subscriberData.count ?? subscriberData.subscribers?.length ?? 0)
        setHealthCount(healthData.subscribers ?? null)
        setLastLoaded(new Date())
        window.localStorage.setItem(ADMIN_TOKEN_STORAGE, trimmed)
      } catch (err) {
        setError(err.message || 'Unable to load subscribers.')
        setRows([])
        setCount(0)
        if ((err.message || '').toLowerCase().includes('unauthorized')) {
          window.localStorage.removeItem(ADMIN_TOKEN_STORAGE)
          setAdminToken('')
        }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    const saved = window.localStorage.getItem(ADMIN_TOKEN_STORAGE)
    if (saved) {
      setAdminToken(saved)
      loadData(saved)
    }
  }, [loadData])

  const exportCsv = useCallback(async () => {
    const trimmed = adminToken.trim()
    if (!trimmed) {
      setError('Sign in with the admin key.')
      return
    }
    setError('')
    try {
      await downloadSubscribersCsv(trimmed)
    } catch (err) {
      setError(err.message || 'Unable to export CSV.')
    }
  }, [adminToken])

  const signIn = useCallback(async () => {
    const trimmed = adminKey.trim()
    if (!trimmed) {
      setError('Enter the admin key.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const token = await loginAdmin(trimmed)
      setAdminToken(token)
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE, token)
      await loadData(token)
    } catch (err) {
      setError(err.message || 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }, [adminKey, loadData])

  const handleDelete = useCallback(
    async (row) => {
      const confirmed = window.confirm(
        `Delete ${row.email}? This will permanently remove this subscriber from the database.`
      )
      if (!confirmed) return

      const token = adminToken.trim()
      if (!token) {
        setError('Sign in with the admin key.')
        return
      }

      setDeletingId(row.id)
      setError('')
      try {
        await deleteSubscriber(token, row.id)
        await loadData(token)
      } catch (err) {
        setError(err.message || 'Unable to delete subscriber.')
      } finally {
        setDeletingId(null)
      }
    },
    [adminToken, loadData]
  )

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg)] px-6 py-8 text-[var(--ink)] sm:px-10 lg:px-12">
      <Backdrop />
      <CornerMarks />

      <section className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col">
        <header className="flex flex-col gap-5 border-b border-[var(--rule)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.34em] text-[var(--accent)]">
              Admin panel
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-medium tracking-[-0.04em] text-[var(--ink)] sm:text-5xl">
              Subscriber database
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--ink-dim)] sm:text-base">
              Sign in once with the admin key. The app stores only a signed token after that.
            </p>
          </div>

          <a
            href="/"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-dim)] transition hover:text-[var(--ink)]"
          >
            Back to site <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </header>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          <div className="border border-[var(--rule)] bg-[var(--bg-raised)] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center border border-[var(--rule-strong)] bg-[rgba(201,161,90,0.06)] text-[var(--accent)]">
                <Shield className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                  Access
                </p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl font-medium text-[var(--ink)]">
                  Load subscribers
                </h2>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="admin-key">
                Admin key
              </label>
              <div className="flex flex-1 items-center gap-3 border border-[var(--rule)] bg-[var(--bg)] px-4 py-3">
                <KeyRound className="h-4 w-4 text-[var(--ink-faint)]" aria-hidden="true" />
                <input
                  id="admin-key"
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') signIn()
                  }}
                  placeholder="Paste admin key"
                  className="w-full bg-transparent font-mono text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
                />
              </div>
              <button
                type="button"
                onClick={signIn}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 bg-[var(--accent)] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--accent-ink)] transition hover:opacity-90 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                )}
                {adminToken ? 'Refresh' : 'Sign in'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-2 border border-[var(--rule-strong)] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-dim)] transition hover:border-[var(--accent)] hover:text-[var(--ink)]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Export CSV
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                {adminToken ? 'Signed in locally in this browser' : 'Token not created yet'}
              </span>
            </div>

            {error && (
              <p className="mt-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="border border-[var(--rule)] bg-[var(--bg-raised)] p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                Rows
              </p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium text-[var(--ink)]">
                {count}
              </p>
            </div>
            <div className="border border-[var(--rule)] bg-[var(--bg-raised)] p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                Health check
              </p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-4xl font-medium text-[var(--ink)]">
                {healthCount ?? '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--rule)] pt-5">
          <div className="flex items-center gap-3">
            <Database className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
              {lastLoaded ? `Loaded ${lastLoaded.toLocaleString()}` : 'Waiting for data'}
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
            {rows.length} subscriber{rows.length === 1 ? '' : 's'} shown
          </span>
        </div>

        <div className="mt-5 flex-1 overflow-hidden border border-[var(--rule)] bg-[rgba(255,255,255,0.02)]">
          <div className="max-h-[60svh] overflow-auto">
            <table className="min-w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[rgba(19,17,16,0.96)] backdrop-blur">
                <tr className="border-b border-[var(--rule)]">
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                    ID
                  </th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                    Email
                  </th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                    Source
                  </th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                    Created
                  </th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                    Confirmed
                  </th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ink-faint)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--rule)]">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--ink-faint)]">
                        {row.id}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-[var(--ink)]">
                        {row.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--ink-dim)]">
                        {row.source || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--ink-dim)]">
                        {row.created_at}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--ink-dim)]">
                        {Number(row.confirmed) === 1 ? 'yes' : 'no'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          disabled={deletingId === row.id}
                          className="inline-flex items-center gap-2 border border-red-500/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
                        >
                          {deletingId === row.id ? 'Deleting' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-10 text-center text-sm text-[var(--ink-faint)]">
                      {loading ? 'Loading subscribers…' : 'No subscribers loaded yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  )
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
export default function ComingSoonPage() {
  const target =
    SITE.launchDate instanceof Date && !Number.isNaN(SITE.launchDate.getTime())
      ? SITE.launchDate
      : null
  const [modalOpen, setModalOpen] = useState(false)
  const [tracksOpen, setTracksOpen] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const visitCount = useMemo(() => getVisitCount(), [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  useEffect(() => {
    const totalMs = reducedMotion ? 250 : 4000
    const id = window.setTimeout(() => setIntroDone(true), totalMs)
    return () => window.clearTimeout(id)
  }, [reducedMotion])

  const ease = [0.16, 1, 0.3, 1]
  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: reducedMotion ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease, delay },
  })

  return (
    <main className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[var(--bg)] font-[family-name:var(--font-body)] text-[var(--ink)]">
      <Backdrop />
      <CornerMarks />

      <AnimatePresence>
        {!introDone && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-[var(--bg)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at center, rgba(201,161,90,0.14) 0%, rgba(201,161,90,0.06) 24%, transparent 60%)',
                filter: 'blur(18px)',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(12,11,9,0.94) 0%, rgba(12,11,9,0.82) 45%, rgba(12,11,9,0.94) 100%)',
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.985, filter: 'blur(10px)' }}
              animate={{
                opacity: reducedMotion ? 1 : [0, 1, 1, 0],
                y: reducedMotion ? 0 : [10, 0, 0, -8],
                scale: reducedMotion ? 1 : [0.985, 1, 1.01, 1],
                filter: reducedMotion ? 'blur(0px)' : ['blur(10px)', 'blur(0px)', 'blur(0px)', 'blur(8px)'],
              }}
              transition={{
                duration: reducedMotion ? 0.2 : 4.0,
                times: reducedMotion ? undefined : [0, 0.82, 0.93, 1],
                ease,
              }}
              className="relative z-10 text-center"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.48em] text-[var(--ink-faint)]">
                {SITE.name}
              </p>
              <h1
                className="mt-4 font-[family-name:var(--font-display)] text-[clamp(4rem,14vw,10rem)] font-medium tracking-[-0.08em] text-[var(--ink)]"
                style={{
                  textShadow: '0 0 38px rgba(201,161,90,0.08)',
                }}
              >
                ASG
              </h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* nav */}
      <header className={`relative z-10 flex items-center justify-between px-8 py-8 sm:px-12 sm:py-10 transition-opacity duration-1000 ${introDone ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-3">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: '#C9A15A',
              boxShadow: '0 0 12px rgba(201,161,90,0.45)',
            }}
          />

          <span
            className={`${DISPLAY_FONT} text-[11px] font-medium uppercase tracking-[0.38em]`}
            style={{ color: '#E7DFD0' }}
          >
            {SITE.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: '#C9A15A',
              boxShadow: '0 0 10px rgba(201,161,90,0.5)',
            }}
          />

          <span
            className={`${DISPLAY_FONT} text-[10px] uppercase tracking-[0.24em]`}
            style={{ color: '#AAA398' }}
          >
            Coming soon
          </span>
        </div>
      </header>

      {/* hero — fills the viewport */}
      <section className={`relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-20 text-center transition-opacity duration-1000 sm:px-12 ${introDone ? 'opacity-100' : 'opacity-0'}`}>
        <motion.p
          {...fadeUp(0)}
          className={`mb-7 text-[11px] uppercase tracking-[0.42em] text-[var(--accent)] ${DISPLAY_FONT}`}
        >
          Log entry &mdash; {String(visitCount).padStart(3, '0')}
        </motion.p>

        <motion.h1
          {...fadeUp(0.08)}
          className="m-0 font-[family-name:var(--font-display)] leading-[0.94] tracking-[-0.045em] [text-wrap:balance]"
          style={{
            fontSize: 'clamp(3.2rem, 11vw, 8.5rem)',
            fontWeight: 430,
          }}
        >
          <span
            className="block"
            style={{
              color: '#F1E9D8',
              textShadow: '0 0 50px rgba(201,161,90,0.07)',
            }}
          >
            {SITE.domain}
          </span>

          <span
            className="mt-2 block italic"
            style={{
              color: '#AAA398',
              fontWeight: 330,
            }}
          >
            is almost here.
          </span>
        </motion.h1>

        <motion.p
          {...fadeUp(0.18)}
          className={`mt-7 max-w-md text-[15px] leading-relaxed text-[var(--ink-dim)] sm:text-base ${DISPLAY_FONT}`}
        >
          {SITE.description}
        </motion.p>

        <motion.div {...fadeUp(0.26)} className="mt-11">
          <StatusReadout target={target} />
        </motion.div>

        <motion.div
          {...fadeUp(0.34)}
          className="mt-11 flex flex-col items-center gap-3 sm:flex-row"
        >
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={`group inline-flex w-full items-center justify-center gap-2 bg-[var(--accent)] px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--accent-ink)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(201,161,90,0.16)] sm:w-auto ${DISPLAY_FONT}`}
          >
            Notify me
            <ArrowRight
              className="h-4 w-4 transition group-hover:translate-x-1"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => setTracksOpen((v) => !v)}
            aria-expanded={tracksOpen}
            className={`inline-flex w-full items-center justify-center gap-2 border border-[var(--rule-strong)] px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--ink-dim)] transition-all duration-300 hover:border-[var(--accent)] hover:text-[var(--ink)] sm:w-auto ${DISPLAY_FONT}`}
          >
            {tracksOpen ? 'Hide the build' : 'Explore the build'}
          </button>
        </motion.div>

        <TrackStrip open={tracksOpen} />

        <motion.span
          {...fadeUp(0.5)}
          className={`mt-14 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-faint)] ${DISPLAY_FONT}`}
        >
          scroll
        </motion.span>
      </section>

      {/* log — what's coming, as a ledger not a card grid */}
      <section
        className="relative z-10 mx-auto w-full max-w-4xl px-6 py-16 sm:px-12 sm:py-24"
        aria-labelledby="log-heading"
      >
        <h2
          id="log-heading"
          className={`mb-2 text-xs uppercase tracking-[0.3em] text-[var(--ink-faint)] ${DISPLAY_FONT}`}
        >
          What&rsquo;s coming
        </h2>
        <div className="mt-8 border-t border-[var(--rule)]">
          {LOG.map((item) => (
            <div
              key={item.ref}
              className="group grid grid-cols-[3.5rem_1fr] items-baseline gap-x-6 border-b border-[var(--rule)] py-6 text-left transition hover:bg-[var(--bg-raised)] sm:grid-cols-[5rem_10rem_1fr] sm:items-center sm:px-4"
            >
              <span className={`text-xs text-[var(--ink-faint)] transition group-hover:text-[var(--accent)] ${DISPLAY_FONT}`}>
                {item.ref}
              </span>
              <h3 className="font-[family-name:var(--font-display)] text-xl font-medium text-[var(--ink)] sm:text-2xl">
                {item.title}
              </h3>
              <p className="col-span-2 mt-2 text-sm leading-relaxed text-[var(--ink-dim)] sm:col-span-1 sm:mt-0">
                {item.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* footer */}
      <footer className="relative z-10 flex flex-col items-center gap-6 border-t border-[var(--rule)] px-6 py-10 text-center sm:flex-row sm:justify-between sm:px-12 sm:text-left">
        <div className="flex flex-col gap-1">
          <span className={`${DISPLAY_FONT} text-xs text-[var(--ink-faint)]`}>
            &copy; 2026 {SITE.name}
          </span>
          <span className={`${DISPLAY_FONT} text-xs text-[var(--ink-faint)]`}>Built with curiosity.</span>
        </div>

        <div className="flex items-center gap-6">
          <a
            href={SITE.social.github}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 text-xs uppercase tracking-[0.1em] text-[var(--ink-dim)] transition hover:text-[var(--ink)] ${DISPLAY_FONT}`}
          >
            GitHub <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
          <a
            href={SITE.social.linkedin}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 text-xs uppercase tracking-[0.1em] text-[var(--ink-dim)] transition hover:text-[var(--ink)] ${DISPLAY_FONT}`}
          >
            LinkedIn <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
          <a
            href={SITE.social.instagram}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 text-xs uppercase tracking-[0.1em] text-[var(--ink-dim)] transition hover:text-[var(--ink)] ${DISPLAY_FONT}`}
          >
            Instagram <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
          <span className={`${DISPLAY_FONT} text-[10px] uppercase tracking-[0.16em] text-[var(--ink-faint)]`}>
            Building
          </span>
        </div>
      </footer>

      <NotifyModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </main>
  )
}

export { AdminPanel }
