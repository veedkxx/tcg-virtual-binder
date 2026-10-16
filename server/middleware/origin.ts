import type { RequestHandler } from 'express'
import { AppError } from '../errors.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Defesa extra contra CSRF (além do SameSite=Lax): requisições que alteram dados e trazem
 * o cabeçalho Origin precisam vir do próprio app. A origem é aceita se bater com:
 *  - o `APP_URL` configurado (cobre o dev, em que o proxy do Vite reescreve o Host para
 *    localhost:3001 mas o navegador continua enviando Origin http://localhost:5173); ou
 *  - o Host da requisição (cobre aliases e domínios da Vercel sem precisar configurar nada).
 * Chamadas sem Origin (curl, servidor a servidor) passam: não carregam cookies de navegador.
 */
export function createSameOrigin(appUrl: string): RequestHandler {
  const appHost = new URL(appUrl).host

  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next()

    const origin = req.get('origin')
    if (origin) {
      let ok = false
      try {
        const host = new URL(origin).host
        ok = host === appHost || host === req.get('host')
      } catch {
        ok = false
      }
      if (!ok) throw new AppError(403, 'BAD_ORIGIN', 'Origem não permitida.')
    }
    next()
  }
}
