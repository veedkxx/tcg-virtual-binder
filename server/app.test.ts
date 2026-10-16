import { rmSync } from 'node:fs'
import http from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { CardDetail } from '../shared/schemas.js'
import { createApp } from './app.js'
import { createDb } from './db/client.js'
import { collectionItems, sessions, users } from './db/schema.js'
import { AppError } from './errors.js'
import { safeReturnTo } from './routes/auth.js'
import type { GoogleProfile, GoogleProvider } from './services/google.js'
import type { CardsProvider } from './services/tcgdex.js'

// Requer as migrations geradas: `npm run db:generate` (pasta ./drizzle).

const fakeCard = (id: string): CardDetail => ({
  id,
  localId: '25',
  name: 'Pikachu',
  language: 'pt',
  imageUrl: `https://assets.example/${id}/low.webp`,
  imageHighUrl: `https://assets.example/${id}/high.webp`,
  category: 'Pokémon',
  rarity: 'Comum',
  illustrator: 'Alguém',
  hp: 60,
  types: ['Elétrico'],
  description: null,
  set: { id: 'base1', name: 'Base Set', logoUrl: null, cardCount: 102 },
})

const cards: CardsProvider = {
  async search({ page, pageSize }) {
    return {
      items: [{ id: 'base1-25', localId: '25', name: 'Pikachu', imageUrl: null }],
      page,
      pageSize,
      hasMore: false,
    }
  },
  async get({ id }) {
    if (id === 'missing') throw new AppError(404, 'CARD_NOT_FOUND', 'Carta não encontrada.')
    return fakeCard(id)
  },
}

// Google falso: o "code" decide o resultado e o perfil devolvido vem de `nextProfile`.
let nextProfile: GoogleProfile = { sub: 'google-a', email: 'a@example.com', name: 'Ana' }
const google: GoogleProvider = {
  createAuthorization: () => ({
    url: 'https://accounts.example/auth',
    state: 'test-state',
    codeVerifier: 'test-verifier',
  }),
  async exchange({ code }) {
    if (code === 'fail') throw new AppError(502, 'GOOGLE_TOKEN_ERROR', 'O Google recusou o login.')
    if (code === 'unverified') {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'E-mail não verificado.')
    }
    return nextProfile
  },
}

// Arquivo temporário (e não ":memory:"): o cliente libsql pode abrir uma conexão nova
// após transações, o que descartaria um banco em memória.
const dbFile = join(tmpdir(), `tcg-binder-test-${process.pid}.db`)
const db = createDb(`file:${dbFile}`)
let server: Server
let base: string

/** Cliente HTTP com "jar" de cookies próprio, simulando um navegador. Não segue redirecionamentos. */
class Client {
  private jar = new Map<string, string>()

  async fetch(path: string, init: { method?: string; body?: unknown } = {}) {
    const headers = new Headers()
    if (init.body !== undefined) headers.set('content-type', 'application/json')
    if (this.jar.size > 0) {
      headers.set('cookie', [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '))
    }

    const res = await fetch(`${base}${path}`, {
      method: init.method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      redirect: 'manual',
    })

    for (const setCookie of res.headers.getSetCookie()) {
      const [pair = ''] = setCookie.split(';')
      const eq = pair.indexOf('=')
      const name = pair.slice(0, eq)
      const value = pair.slice(eq + 1)
      if (value === '') this.jar.delete(name)
      else this.jar.set(name, value)
    }
    return res
  }

  get = (path: string) => this.fetch(path)
  post = (path: string, body?: unknown) => this.fetch(path, { method: 'POST', body })
  patch = (path: string, body: unknown) => this.fetch(path, { method: 'PATCH', body })
  delete = (path: string) => this.fetch(path, { method: 'DELETE' })

  hasCookie = (name: string) => this.jar.has(name)
}

async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T
}

type CollectionBody = { items: { cardId: string; quantity: number }[]; totals: Record<string, number> }
type MeBody = { user: { id: string; email: string; name: string | null } | null }

/** Faz o fluxo completo de login (início + retorno do Google) e devolve o cliente logado. */
async function loginAs(profile: GoogleProfile, returnTo?: string) {
  nextProfile = profile
  const client = new Client()
  const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
  const start = await client.get(`/api/auth/google${query}`)
  expect(start.status).toBe(302)
  const callback = await client.get('/api/auth/google/callback?code=ok&state=test-state')
  expect(callback.status).toBe(302)
  return { client, location: callback.headers.get('location') }
}

/** POST cru, para controlar o cabeçalho Origin (o fetch do Node nem sempre deixa). */
function rawPost(path: string, headers: Record<string, string>) {
  return new Promise<number>((resolve, reject) => {
    const url = new URL(base)
    const req = http.request(
      { host: url.hostname, port: url.port, path, method: 'POST', headers },
      (res) => {
        res.resume()
        resolve(res.statusCode ?? 0)
      },
    )
    req.on('error', reject)
    req.end()
  })
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './drizzle' })
  server = createApp({ db, cards, google, appUrl: 'http://localhost' }).listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve())
    server.closeAllConnections()
  })
  // No Windows o arquivo fica travado (EPERM) enquanto o cliente libsql estiver aberto.
  db.$client.close()
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try {
      rmSync(dbFile + suffix, { force: true })
    } catch {
      // Limpeza best-effort: é um arquivo temporário do sistema.
    }
  }
})

beforeEach(async () => {
  // Ordem importa: filhos antes dos pais.
  await db.delete(collectionItems)
  await db.delete(sessions)
  await db.delete(users)
})

describe('catálogo (público)', () => {
  it('busca cartas sem login', async () => {
    const res = await new Client().get('/api/cards?q=pikachu')
    expect(res.status).toBe(200)
    const body = await json<{ items: unknown[]; page: number }>(res)
    expect(body.items).toHaveLength(1)
    expect(body.page).toBe(1)
  })

  it('rejeita busca curta demais', async () => {
    expect((await new Client().get('/api/cards?q=p')).status).toBe(400)
  })

  it('rejeita idioma não habilitado', async () => {
    expect((await new Client().get('/api/cards?q=pikachu&lang=en')).status).toBe(400)
  })
})

describe('login com Google', () => {
  it('sem login, /me responde 200 com user null', async () => {
    const res = await new Client().get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ user: null })
  })

  it('o fluxo completo cria o usuário e a sessão', async () => {
    const { client, location } = await loginAs({
      sub: 'google-a',
      email: 'a@example.com',
      name: 'Ana',
      picture: 'https://img.example/a.png',
    })
    expect(location).toBe('/')
    expect(client.hasCookie('session')).toBe(true)

    const me = await json<MeBody>(await client.get('/api/auth/me'))
    expect(me.user).toMatchObject({ email: 'a@example.com', name: 'Ana' })
  })

  it('o início do fluxo redireciona ao Google e grava os cookies do fluxo', async () => {
    const client = new Client()
    const res = await client.get('/api/auth/google')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://accounts.example/auth')
    expect(client.hasCookie('oauth_state')).toBe(true)
    expect(client.hasCookie('oauth_verifier')).toBe(true)
  })

  it('logar de novo com a mesma conta Google reaproveita o usuário', async () => {
    const first = await loginAs({ sub: 'google-a', email: 'a@example.com', name: 'Ana' })
    const second = await loginAs({ sub: 'google-a', email: 'a@example.com', name: 'Ana Maria' })
    const a = await json<MeBody>(await first.client.get('/api/auth/me'))
    const b = await json<MeBody>(await second.client.get('/api/auth/me'))
    expect(b.user?.id).toBe(a.user?.id)
    expect(b.user?.name).toBe('Ana Maria')
    expect(await db.select().from(users)).toHaveLength(1)
  })

  it('state errado não cria sessão', async () => {
    const client = new Client()
    await client.get('/api/auth/google')
    const res = await client.get('/api/auth/google/callback?code=ok&state=OUTRO')
    expect(res.headers.get('location')).toBe('/login?error=state')
    expect(client.hasCookie('session')).toBe(false)
    expect(await db.select().from(sessions)).toHaveLength(0)
  })

  it('callback sem ter iniciado o fluxo não cria sessão', async () => {
    const res = await new Client().get('/api/auth/google/callback?code=ok&state=test-state')
    expect(res.headers.get('location')).toBe('/login?error=state')
  })

  it('o estado do fluxo vale uma tentativa só', async () => {
    const client = new Client()
    await client.get('/api/auth/google')
    await client.get('/api/auth/google/callback?code=ok&state=test-state')
    const again = await client.get('/api/auth/google/callback?code=ok&state=test-state')
    expect(again.headers.get('location')).toBe('/login?error=state')
  })

  it('usuário que nega o acesso volta ao login com aviso', async () => {
    const client = new Client()
    await client.get('/api/auth/google')
    const res = await client.get('/api/auth/google/callback?error=access_denied&state=test-state')
    expect(res.headers.get('location')).toBe('/login?error=denied')
  })

  it('falha na troca do código com o Google volta ao login', async () => {
    const client = new Client()
    await client.get('/api/auth/google')
    const res = await client.get('/api/auth/google/callback?code=fail&state=test-state')
    expect(res.headers.get('location')).toBe('/login?error=google')
    expect(client.hasCookie('session')).toBe(false)
  })

  it('e-mail não verificado volta ao login com aviso próprio', async () => {
    const client = new Client()
    await client.get('/api/auth/google')
    const res = await client.get('/api/auth/google/callback?code=unverified&state=test-state')
    expect(res.headers.get('location')).toBe('/login?error=unverified')
  })

  it('volta para a página de origem após o login', async () => {
    const { location } = await loginAs(
      { sub: 'google-a', email: 'a@example.com' },
      '/cards/base1-25',
    )
    expect(location).toBe('/cards/base1-25')
  })

  it('ignora returnTo externo (open redirect)', async () => {
    const { location } = await loginAs(
      { sub: 'google-a', email: 'a@example.com' },
      'https://evil.example/x',
    )
    expect(location).toBe('/')
  })

  it('safeReturnTo só aceita caminhos internos', () => {
    expect(safeReturnTo('/collection')).toBe('/collection')
    expect(safeReturnTo('/cards/base1-25?lang=pt')).toBe('/cards/base1-25?lang=pt')
    expect(safeReturnTo('//evil.example')).toBe('/')
    expect(safeReturnTo('/\\evil.example')).toBe('/')
    expect(safeReturnTo('https://evil.example')).toBe('/')
    expect(safeReturnTo('/a b')).toBe('/')
    expect(safeReturnTo(undefined)).toBe('/')
  })

  it('logout encerra a sessão no servidor', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    expect((await client.post('/api/auth/logout')).status).toBe(204)
    expect(client.hasCookie('session')).toBe(false)
    expect(await json(await client.get('/api/auth/me'))).toEqual({ user: null })
    expect(await db.select().from(sessions)).toHaveLength(0)
  })

  it('sessão expirada é rejeitada e apagada', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    await db.update(sessions).set({ expiresAt: Date.now() - 1000 })

    expect(await json(await client.get('/api/auth/me'))).toEqual({ user: null })
    expect((await client.get('/api/collection')).status).toBe(401)
    expect(await db.select().from(sessions)).toHaveLength(0)
  })

  it('sessão perto de vencer é renovada', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    const soon = Date.now() + 24 * 60 * 60 * 1000
    await db.update(sessions).set({ expiresAt: soon })

    await client.get('/api/auth/me')
    const [row] = await db.select().from(sessions)
    expect(row!.expiresAt).toBeGreaterThan(Date.now() + 25 * 24 * 60 * 60 * 1000)
  })

  it('o token da sessão não fica gravado no banco', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    const [row] = await db.select().from(sessions)
    // O cookie tem o token; o banco só o hash (64 hex), então os dois nunca coincidem.
    expect(row!.id).toMatch(/^[0-9a-f]{64}$/)
    expect(client.hasCookie('session')).toBe(true)
  })
})

describe('proteção contra CSRF (Origin)', () => {
  it('bloqueia escrita vinda de outra origem', async () => {
    const status = await rawPost('/api/auth/logout', { origin: 'https://evil.example' })
    expect(status).toBe(403)
  })

  it('aceita escrita da mesma origem', async () => {
    const url = new URL(base)
    const status = await rawPost('/api/auth/logout', { origin: `http://${url.host}` })
    expect(status).toBe(204)
  })

  it('aceita a origem do APP_URL mesmo com o Host reescrito (proxy do Vite em dev)', async () => {
    // O app de teste usa appUrl http://localhost, mas a requisição chega com Host 127.0.0.1:porta.
    const status = await rawPost('/api/auth/logout', { origin: 'http://localhost' })
    expect(status).toBe(204)
  })
})

describe('/api/collection', () => {
  it('exige login', async () => {
    const client = new Client()
    expect((await client.get('/api/collection')).status).toBe(401)
    expect((await client.post('/api/collection', { cardId: 'base1-25' })).status).toBe(401)
    expect((await client.patch('/api/collection/base1-25', { quantity: 2 })).status).toBe(401)
    expect((await client.delete('/api/collection/base1-25')).status).toBe(401)
  })

  it('começa vazia', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    const body = await json(await client.get('/api/collection'))
    expect(body).toEqual({ items: [], totals: { uniqueCards: 0, totalCards: 0 } })
  })

  it('adiciona uma carta com quantidade 1 por padrão', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    const res = await client.post('/api/collection', { cardId: 'base1-25' })
    expect(res.status).toBe(201)
    const item = await json(res)
    expect(item).toMatchObject({ cardId: 'base1-25', quantity: 1, language: 'pt', name: 'Pikachu' })
    expect(item).not.toHaveProperty('userId')
  })

  it('adicionar de novo soma a quantidade (upsert)', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    await client.post('/api/collection', { cardId: 'base1-25', quantity: 2 })
    const second = await json<{ quantity: number }>(
      await client.post('/api/collection', { cardId: 'base1-25', quantity: 3 }),
    )
    expect(second.quantity).toBe(5)

    const list = await json<CollectionBody>(await client.get('/api/collection'))
    expect(list.items).toHaveLength(1)
    expect(list.totals).toEqual({ uniqueCards: 1, totalCards: 5 })
  })

  it('não adiciona carta inexistente no TCGdex', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    expect((await client.post('/api/collection', { cardId: 'missing' })).status).toBe(404)
  })

  it('define a quantidade exata', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    await client.post('/api/collection', { cardId: 'base1-25' })
    const res = await client.patch('/api/collection/base1-25', { quantity: 7 })
    expect(res.status).toBe(200)
    expect((await json<{ quantity: number }>(res)).quantity).toBe(7)
  })

  it('rejeita quantidade menor que 1', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    await client.post('/api/collection', { cardId: 'base1-25' })
    expect((await client.patch('/api/collection/base1-25', { quantity: 0 })).status).toBe(400)
  })

  it('PATCH em carta que não está na coleção dá 404', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    expect((await client.patch('/api/collection/base1-25', { quantity: 2 })).status).toBe(404)
  })

  it('remove da coleção', async () => {
    const { client } = await loginAs({ sub: 'google-a', email: 'a@example.com' })
    await client.post('/api/collection', { cardId: 'base1-25' })
    expect((await client.delete('/api/collection/base1-25')).status).toBe(204)
    expect((await client.delete('/api/collection/base1-25')).status).toBe(404)
    const list = await json<CollectionBody>(await client.get('/api/collection'))
    expect(list.items).toHaveLength(0)
  })

  it('cada usuário tem a sua coleção (isolamento)', async () => {
    const a = (await loginAs({ sub: 'google-a', email: 'a@example.com' })).client
    const b = (await loginAs({ sub: 'google-b', email: 'b@example.com' })).client

    await a.post('/api/collection', { cardId: 'base1-25', quantity: 2 })

    // B não vê a carta de A, nem consegue alterá-la ou apagá-la.
    const listB = await json<CollectionBody>(await b.get('/api/collection'))
    expect(listB.items).toHaveLength(0)
    expect((await b.patch('/api/collection/base1-25', { quantity: 9 })).status).toBe(404)
    expect((await b.delete('/api/collection/base1-25')).status).toBe(404)

    // A segue com a carta intacta.
    const listA = await json<CollectionBody>(await a.get('/api/collection'))
    expect(listA.items).toHaveLength(1)
    expect(listA.items[0]?.quantity).toBe(2)
  })

  it('a mesma carta em duas coleções não se mistura', async () => {
    const a = (await loginAs({ sub: 'google-a', email: 'a@example.com' })).client
    const b = (await loginAs({ sub: 'google-b', email: 'b@example.com' })).client

    await a.post('/api/collection', { cardId: 'base1-25', quantity: 2 })
    await b.post('/api/collection', { cardId: 'base1-25', quantity: 5 })

    const listA = await json<CollectionBody>(await a.get('/api/collection'))
    const listB = await json<CollectionBody>(await b.get('/api/collection'))
    expect(listA.items[0]?.quantity).toBe(2)
    expect(listB.items[0]?.quantity).toBe(5)
  })
})
