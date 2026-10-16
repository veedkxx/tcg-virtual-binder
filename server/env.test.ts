import { describe, expect, it } from 'vitest'
import { resolveAppUrl } from './env.js'

describe('resolveAppUrl', () => {
  it('mantém só a origem, descartando caminho e barra final', () => {
    expect(resolveAppUrl('https://app.vercel.app/')).toBe('https://app.vercel.app')
    expect(
      resolveAppUrl('https://app.vercel.app/api/auth/google/callback/api/auth/google/callback'),
    ).toBe('https://app.vercel.app')
    expect(resolveAppUrl('http://localhost:5173')).toBe('http://localhost:5173')
  })

  it('cai no domínio de produção da Vercel e depois no Vite local', () => {
    expect(resolveAppUrl(undefined, 'app.vercel.app')).toBe('https://app.vercel.app')
    expect(resolveAppUrl(undefined)).toBe('http://localhost:5173')
  })

  it('rejeita valor que não é URL', () => {
    expect(() => resolveAppUrl('app.vercel.app')).toThrow(/APP_URL inválida/)
    expect(() => resolveAppUrl('localhost:5173')).toThrow(/APP_URL inválida/)
  })
})
