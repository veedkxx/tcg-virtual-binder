export interface CookieOptions {
  /** Ausente = cookie de sessão do navegador. */
  maxAgeSec?: number
  /** true quando o app é servido por HTTPS (produção). */
  secure: boolean
}

/** Todos os cookies do app são httpOnly e SameSite=Lax (o Lax ainda vale no retorno do Google). */
export function serializeCookie(name: string, value: string, opts: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (opts.maxAgeSec !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAgeSec))}`)
  if (opts.secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearCookie(name: string, secure: boolean): string {
  return serializeCookie(name, '', { maxAgeSec: 0, secure })
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = Object.create(null)
  if (!header) return out

  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const name = part.slice(0, i).trim()
    if (!name || name in out) continue // vale o primeiro, como nos navegadores
    const raw = part.slice(i + 1).trim()
    try {
      out[name] = decodeURIComponent(raw)
    } catch {
      out[name] = raw
    }
  }
  return out
}
