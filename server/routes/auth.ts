import { timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { AppError } from '../errors.js'
import { clearCookie, parseCookies, serializeCookie } from '../http/cookies.js'
import {
  SESSION_COOKIE,
  getSessionToken,
  getUser,
  setSessionCookie,
} from '../middleware/session.js'
import type { AuthService } from '../services/auth.js'
import type { GoogleProfile, GoogleProvider } from '../services/google.js'

const OAUTH_COOKIE_TTL_SEC = 10 * 60
const COOKIE = { state: 'oauth_state', verifier: 'oauth_verifier', returnTo: 'oauth_return' }

/** Só aceita caminhos internos ("/cards/x"); qualquer outra coisa vira "/" (evita open redirect). */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/'
  return /^\/(?![/\\])[^\s\\]*$/.test(value) ? value : '/'
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

const CallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
})

export function createAuthRouter(deps: {
  auth: AuthService
  google: GoogleProvider
  secure: boolean
}) {
  const { auth, google, secure } = deps
  const router = Router()

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  // Passo 1: manda o navegador para o Google, guardando state e PKCE em cookies de 10 min.
  router.get('/google', (req, res) => {
    let authorization: ReturnType<GoogleProvider['createAuthorization']>
    try {
      authorization = google.createAuthorization()
    } catch (err) {
      console.error(err)
      res.redirect('/login?error=config')
      return
    }

    const opts = { maxAgeSec: OAUTH_COOKIE_TTL_SEC, secure }
    res.append('Set-Cookie', serializeCookie(COOKIE.state, authorization.state, opts))
    res.append('Set-Cookie', serializeCookie(COOKIE.verifier, authorization.codeVerifier, opts))
    res.append(
      'Set-Cookie',
      serializeCookie(COOKIE.returnTo, safeReturnTo(req.query.returnTo), opts),
    )
    res.redirect(authorization.url)
  })

  // Passo 2: o Google devolve o usuário aqui com ?code=...&state=...
  router.get('/google/callback', async (req, res) => {
    const cookies = parseCookies(req.headers.cookie)
    const expectedState = cookies[COOKIE.state]
    const codeVerifier = cookies[COOKIE.verifier]
    const returnTo = safeReturnTo(cookies[COOKIE.returnTo])

    // Os cookies do fluxo valem uma tentativa só.
    for (const name of Object.values(COOKIE)) {
      res.append('Set-Cookie', clearCookie(name, secure))
    }
    const fail = (reason: string) => res.redirect(`/login?error=${reason}`)

    const query = CallbackQuerySchema.safeParse(req.query)
    if (!query.success) return fail('state')
    const { code, state, error } = query.data

    if (error) return fail('denied')
    if (!code || !state || !expectedState || !codeVerifier || !safeEqual(state, expectedState)) {
      return fail('state')
    }

    let profile: GoogleProfile
    try {
      profile = await google.exchange({ code, codeVerifier })
    } catch (err) {
      console.error('Falha no login com Google:', err)
      return fail(err instanceof AppError && err.code === 'EMAIL_NOT_VERIFIED' ? 'unverified' : 'google')
    }

    const user = await auth.upsertGoogleUser(profile)
    const session = await auth.createSession(user.id)
    setSessionCookie(res, session.token, session.expiresAt, secure)
    res.redirect(returnTo)
  })

  // Quem está logado? Sempre 200: "sem login" é um estado normal, não um erro.
  router.get('/me', (_req, res) => {
    res.json({ user: getUser(res) ?? null })
  })

  router.post('/logout', async (_req, res) => {
    const token = getSessionToken(res)
    if (token) await auth.deleteSession(token)
    res.append('Set-Cookie', clearCookie(SESSION_COOKIE, secure))
    res.status(204).end()
  })

  return router
}
