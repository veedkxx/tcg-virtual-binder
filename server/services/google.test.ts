import { describe, expect, it } from 'vitest'
import { parseIdToken } from './google.js'

const CLIENT_ID = 'meu-client-id.apps.googleusercontent.com'
const NOW = 1_800_000_000_000 // ms

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

function makeToken(overrides: Record<string, unknown> = {}) {
  const claims = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    exp: NOW / 1000 + 3600,
    sub: '1234567890',
    email: 'ana@example.com',
    email_verified: true,
    name: 'Ana',
    picture: 'https://img.example/ana.png',
    ...overrides,
  }
  return `${b64({ alg: 'RS256' })}.${b64(claims)}.assinatura`
}

describe('parseIdToken', () => {
  it('lê o perfil de um token válido', () => {
    expect(parseIdToken(makeToken(), CLIENT_ID, NOW)).toEqual({
      sub: '1234567890',
      email: 'ana@example.com',
      name: 'Ana',
      picture: 'https://img.example/ana.png',
    })
  })

  it('aceita o emissor sem https', () => {
    expect(() =>
      parseIdToken(makeToken({ iss: 'accounts.google.com' }), CLIENT_ID, NOW),
    ).not.toThrow()
  })

  it('rejeita token emitido para outro client id', () => {
    expect(() => parseIdToken(makeToken({ aud: 'outro-app' }), CLIENT_ID, NOW)).toThrow()
  })

  it('rejeita emissor desconhecido', () => {
    expect(() =>
      parseIdToken(makeToken({ iss: 'https://evil.example' }), CLIENT_ID, NOW),
    ).toThrow()
  })

  it('rejeita token expirado', () => {
    expect(() =>
      parseIdToken(makeToken({ exp: NOW / 1000 - 1 }), CLIENT_ID, NOW),
    ).toThrow()
  })

  it('rejeita e-mail não verificado', () => {
    expect(() =>
      parseIdToken(makeToken({ email_verified: false }), CLIENT_ID, NOW),
    ).toThrow(/verificado/)
  })

  it('rejeita e-mail sem a marca de verificação', () => {
    expect(() =>
      parseIdToken(makeToken({ email_verified: undefined }), CLIENT_ID, NOW),
    ).toThrow(/verificado/)
  })

  it('rejeita lixo no lugar do token', () => {
    expect(() => parseIdToken('isto-nao-e-um-jwt', CLIENT_ID, NOW)).toThrow()
    expect(() => parseIdToken('a.%%%.c', CLIENT_ID, NOW)).toThrow()
    expect(() => parseIdToken('a.e30.c', CLIENT_ID, NOW)).toThrow() // payload "{}"
  })
})
