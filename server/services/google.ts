import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { AppError } from '../errors.js'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const TIMEOUT_MS = 8000

export interface GoogleProfile {
  /** Identificador estável da conta Google. */
  sub: string
  email: string
  name?: string
  picture?: string
}

/** Contrato usado pelo resto do servidor; nos testes é trocado por um provedor falso. */
export interface GoogleProvider {
  createAuthorization(): { url: string; state: string; codeVerifier: string }
  exchange(params: { code: string; codeVerifier: string }): Promise<GoogleProfile>
}

const ClaimsSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  sub: z.string(),
  email: z.string(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
})

const TokenResponseSchema = z.object({ id_token: z.string() })

const badToken = () =>
  new AppError(502, 'GOOGLE_BAD_TOKEN', 'Resposta inválida do Google. Tente novamente.')

/**
 * Lê as informações do usuário do id_token. A assinatura não é verificada de propósito:
 * o token chega direto do endpoint do Google por TLS, na mesma requisição de troca do
 * código (permitido pela especificação OpenID Connect). Em compensação, conferimos
 * emissor, público (nosso client id), validade e e-mail verificado.
 */
export function parseIdToken(
  idToken: string,
  clientId: string,
  nowMs: number = Date.now(),
): GoogleProfile {
  const payload = idToken.split('.')[1]
  if (!payload) throw badToken()

  let json: unknown
  try {
    json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw badToken()
  }

  const parsed = ClaimsSchema.safeParse(json)
  if (!parsed.success) throw badToken()
  const claims = parsed.data

  if (!ISSUERS.includes(claims.iss) || claims.aud !== clientId || claims.exp * 1000 <= nowMs) {
    throw badToken()
  }
  if (claims.email_verified !== true) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'O e-mail da conta Google não está verificado.')
  }

  return { sub: claims.sub, email: claims.email, name: claims.name, picture: claims.picture }
}

interface GoogleConfig {
  clientId?: string
  clientSecret?: string
  redirectUri: string
}

export function createGoogleProvider(config: GoogleConfig): GoogleProvider {
  const requireCredentials = () => {
    if (!config.clientId || !config.clientSecret) {
      throw new AppError(
        500,
        'AUTH_NOT_CONFIGURED',
        'Login com Google não configurado: defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.',
      )
    }
    return { clientId: config.clientId, clientSecret: config.clientSecret }
  }

  return {
    createAuthorization() {
      const { clientId } = requireCredentials()
      const state = randomBytes(16).toString('base64url')
      // PKCE: o verifier fica num cookie nosso; o Google só recebe o hash (challenge).
      const codeVerifier = randomBytes(32).toString('base64url')
      const challenge = createHash('sha256').update(codeVerifier).digest('base64url')

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      })
      return { url: `${AUTH_URL}?${params}`, state, codeVerifier }
    },

    async exchange({ code, codeVerifier }) {
      const { clientId, clientSecret } = requireCredentials()

      let res: Response
      try {
        res = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier,
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch {
        throw new AppError(504, 'GOOGLE_TIMEOUT', 'O Google não respondeu a tempo.')
      }

      if (!res.ok) throw new AppError(502, 'GOOGLE_TOKEN_ERROR', 'O Google recusou o login.')

      const body = TokenResponseSchema.safeParse(await res.json().catch(() => null))
      if (!body.success) throw badToken()

      return parseIdToken(body.data.id_token, clientId)
    },
  }
}
