import type { RequestHandler, Response } from 'express'
import type { User } from '../../shared/schemas.js'
import { AppError } from '../errors.js'
import { clearCookie, parseCookies, serializeCookie } from '../http/cookies.js'
import type { AuthService } from '../services/auth.js'

export const SESSION_COOKIE = 'session'

export function setSessionCookie(res: Response, token: string, expiresAt: number, secure: boolean) {
  res.append(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, token, {
      maxAgeSec: (expiresAt - Date.now()) / 1000,
      secure,
    }),
  )
}

/** Usuário logado desta requisição (preenchido pelo middleware de sessão), se houver. */
export function getUser(res: Response): User | undefined {
  return res.locals.user as User | undefined
}

export function getSessionToken(res: Response): string | undefined {
  return res.locals.sessionToken as string | undefined
}

/** Para handlers de rotas já protegidas por `requireAuth`. */
export function currentUser(res: Response): User {
  const user = getUser(res)
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Faça login para continuar.')
  return user
}

export const requireAuth: RequestHandler = (_req, res, next) => {
  currentUser(res)
  next()
}

/** Lê o cookie de sessão e, se válido, deixa o usuário em `res.locals`. Nunca bloqueia. */
export function createSessionMiddleware(auth: AuthService, secure: boolean): RequestHandler {
  return async (req, res, next) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
    if (!token) return next()

    const result = await auth.validateSession(token)
    if (!result) {
      res.append('Set-Cookie', clearCookie(SESSION_COOKIE, secure))
      return next()
    }

    const { user, expiresAt, renewed } = result
    res.locals.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    } satisfies User
    res.locals.sessionToken = token
    if (renewed) setSessionCookie(res, token, expiresAt, secure)
    next()
  }
}
