import { rmSync } from 'node:fs'
import http from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Language } from '../shared/languages.js'
import type { BinderDetail, BinderSummary, CardDetail, SetDetail } from '../shared/schemas.js'
import { createApp } from './app.js'
import { createDb } from './db/client.js'
import { binderSlots, binders, collectionItems, sessions, users } from './db/schema.js'
import { AppError } from './errors.js'
import { safeReturnTo } from './routes/auth.js'
import type { GoogleProfile, GoogleProvider } from './services/google.js'
import type { CardsProvider } from './services/tcgdex.js'

// Requer as migrations geradas: `npm run db:generate` (pasta ./drizzle).

// Ids terminados em "-holo" só existem em holo; o resto em normal e reverse.
const fakeCard = (id: string, language: Language = 'pt'): CardDetail => ({
  id,
  localId: '25',
  name: 'Pikachu',
  language,
  imageUrl: `https://assets.example/${id}/low.webp`,
  imageHighUrl: `https://assets.example/${id}/high.webp`,
  category: 'Pokémon',
  rarity: 'Comum',
  illustrator: 'Alguém',
  hp: 60,
  types: ['Elétrico'],
  description: null,
  variants: id.endsWith('-holo') ? ['holo'] : ['normal', 'reverse'],
  set: { id: 'base1', name: 'Base Set', logoUrl: null, cardCount: 102 },
})

// Coleção falsa com 12 cartas (2 páginas de binder): sv09-001 … sv09-012.
const fakeSet: SetDetail = {
  id: 'sv09',
  name: 'Amigos de Jornada',
  logoUrl: 'https://assets.example/sv09/logo.webp',
  symbolUrl: null,
  cardCount: 12,
  cards: Array.from({ length: 12 }, (_, i) => {
    const localId = String(i + 1).padStart(3, '0')
    return { id: `sv09-${localId}`, localId, name: `Carta ${localId}`, imageUrl: null }
  }),
}

let tcgdexUp = true

const cards: CardsProvider = {
  async search({ page, pageSize }) {
    return {
      items: [{ id: 'base1-25', localId: '25', name: 'Pikachu', imageUrl: null }],
      page,
      pageSize,
      hasMore: false,
    }
  },
  async get({ id, lang }) {
    if (id === 'missing') throw new AppError(404, 'CARD_NOT_FOUND', 'Carta não encontrada.')
    return fakeCard(id, lang)
  },
  async listSets() {
    return [
      {
        id: fakeSet.id,
        name: fakeSet.name,
        logoUrl: fakeSet.logoUrl,
        symbolUrl: null,
        cardCount: 12,
      },
    ]
  },
  async getSet({ id }) {
    if (id !== fakeSet.id) throw new AppError(404, 'SET_NOT_FOUND', 'Coleção não encontrada.')
    return fakeSet
  },
  async ping() {
    if (!tcgdexUp) throw new Error('TCGdex fora do ar')
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
  put = (path: string, body: unknown) => this.fetch(path, { method: 'PUT', body })
  delete = (path: string) => this.fetch(path, { method: 'DELETE' })

  hasCookie = (name: string) => this.jar.has(name)
}

async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T
}

type CollectionBody = {
  items: { cardId: string; quantity: number }[]
  totals: Record<string, number>
}
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
  await db.delete(binderSlots)
  await db.delete(binders)
  await db.delete(collectionItems)
  await db.delete(sessions)
  await db.delete(users)
})

describe('/api/health', () => {
  it('responde ok sem tocar em nada por padrão', async () => {
    const res = await new Client().get('/api/health')
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ ok: true })
  })

  it('deep=1 testa banco e TCGdex', async () => {
    const res = await new Client().get('/api/health?deep=1')
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({
      ok: true,
      checks: { database: { ok: true }, tcgdex: { ok: true } },
    })
  })

  it('deep=1 responde 503 quando o TCGdex está fora', async () => {
    tcgdexUp = false
    try {
      const res = await new Client().get('/api/health?deep=1')
      expect(res.status).toBe(503)
      expect(await json(res)).toMatchObject({
        ok: false,
        checks: { database: { ok: true }, tcgdex: { ok: false, error: 'TCGdex fora do ar' } },
      })
    } finally {
      tcgdexUp = true
    }
  })
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
    expect((await new Client().get('/api/cards?q=pikachu&lang=xx')).status).toBe(400)
  })

  it('aceita inglês e devolve as variantes da carta', async () => {
    const res = await new Client().get('/api/cards/base1-25?lang=en')
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ language: 'en', variants: ['normal', 'reverse'] })
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
  type ItemBody = {
    id: number
    cardId: string
    language: string
    variant: string
    condition: string
    quantity: number
    binderCount: number
  }

  async function setup(sub = 'google-a') {
    const { client } = await loginAs({ sub, email: `${sub}@example.com` })
    const add = async (body: Record<string, unknown>) => {
      const res = await client.post('/api/collection', body)
      expect(res.status).toBe(201)
      return json<ItemBody>(res)
    }
    const list = async (lang = 'pt') =>
      json<CollectionBody>(await client.get(`/api/collection?lang=${lang}`))
    return { client, add, list }
  }

  it('exige login', async () => {
    const client = new Client()
    expect((await client.get('/api/collection')).status).toBe(401)
    expect((await client.post('/api/collection', { cardId: 'base1-25' })).status).toBe(401)
    expect((await client.patch('/api/collection/1', { quantity: 2 })).status).toBe(401)
    expect((await client.delete('/api/collection/1')).status).toBe(401)
  })

  it('começa vazia', async () => {
    const { list } = await setup()
    expect(await list()).toEqual({ items: [], totals: { uniqueCards: 0, totalCards: 0 } })
  })

  it('adiciona com quantidade 1, condição NM e a primeira variante da carta', async () => {
    const { add } = await setup()
    const item = await add({ cardId: 'base1-25' })
    expect(item).toMatchObject({
      cardId: 'base1-25',
      quantity: 1,
      language: 'pt',
      variant: 'normal',
      condition: 'NM',
      name: 'Pikachu',
    })
    expect(item).not.toHaveProperty('userId')

    // Carta que só existe em holo: o padrão é holo.
    expect((await add({ cardId: 'base1-4-holo' })).variant).toBe('holo')
  })

  it('adicionar a mesma cópia de novo soma a quantidade (upsert)', async () => {
    const { add, list } = await setup()
    await add({ cardId: 'base1-25', quantity: 2 })
    expect((await add({ cardId: 'base1-25', quantity: 3 })).quantity).toBe(5)
    const body = await list()
    expect(body.items).toHaveLength(1)
    expect(body.totals).toEqual({ uniqueCards: 1, totalCards: 5 })
  })

  it('variante ou condição diferente é outra cópia; uniqueCards conta cartas', async () => {
    const { add, list } = await setup()
    await add({ cardId: 'base1-25' })
    await add({ cardId: 'base1-25', variant: 'reverse' })
    await add({ cardId: 'base1-25', condition: 'LP', quantity: 2 })
    const body = await list()
    expect(body.items).toHaveLength(3)
    expect(body.totals).toEqual({ uniqueCards: 1, totalCards: 4 })
  })

  it('rejeita variante em que a carta não foi impressa e condição inválida', async () => {
    const { client } = await setup()
    const holo = await client.post('/api/collection', { cardId: 'base1-25', variant: 'holo' })
    expect(holo.status).toBe(400)
    expect(await json(holo)).toMatchObject({ error: { code: 'VARIANT_NOT_AVAILABLE' } })
    const bad = await client.post('/api/collection', { cardId: 'base1-25', condition: 'Mint' })
    expect(bad.status).toBe(400)
  })

  it('não adiciona carta inexistente no TCGdex', async () => {
    const { client } = await setup()
    expect((await client.post('/api/collection', { cardId: 'missing' })).status).toBe(404)
  })

  it('idiomas são coleções separadas', async () => {
    const { add, list } = await setup()
    await add({ cardId: 'base1-25', language: 'en', quantity: 2 })
    expect((await list('pt')).items).toHaveLength(0)
    expect((await list('en')).items[0]).toMatchObject({ language: 'en', quantity: 2 })
  })

  it('rejeita idioma não habilitado', async () => {
    const { client } = await setup()
    expect((await client.post('/api/collection', { cardId: 'x', language: 'xx' })).status).toBe(400)
  })

  it('define a quantidade exata', async () => {
    const { client, add } = await setup()
    const item = await add({ cardId: 'base1-25' })
    const res = await client.patch(`/api/collection/${item.id}`, { quantity: 7 })
    expect(res.status).toBe(200)
    expect((await json<ItemBody>(res)).quantity).toBe(7)
  })

  it('rejeita quantidade menor que 1, corpo vazio e id inválido', async () => {
    const { client, add } = await setup()
    const item = await add({ cardId: 'base1-25' })
    expect((await client.patch(`/api/collection/${item.id}`, { quantity: 0 })).status).toBe(400)
    expect((await client.patch(`/api/collection/${item.id}`, {})).status).toBe(400)
    expect((await client.patch('/api/collection/base1-25', { quantity: 2 })).status).toBe(400)
  })

  it('PATCH em cópia que não existe dá 404', async () => {
    const { client } = await setup()
    expect((await client.patch('/api/collection/999', { quantity: 2 })).status).toBe(404)
  })

  it('muda condição e variante de uma cópia', async () => {
    const { client, add } = await setup()
    const item = await add({ cardId: 'base1-25' })
    const res = await client.patch(`/api/collection/${item.id}`, {
      condition: 'MP',
      variant: 'reverse',
    })
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ id: item.id, condition: 'MP', variant: 'reverse' })

    const holo = await client.patch(`/api/collection/${item.id}`, { variant: 'holo' })
    expect(holo.status).toBe(400)
  })

  it('mudar para uma cópia que já existe junta as duas e leva os bolsos junto', async () => {
    const { client, add, list } = await setup()
    const nm = await add({ cardId: 'base1-25', quantity: 2 })
    const lp = await add({ cardId: 'base1-25', condition: 'LP', quantity: 3 })
    const binder = await json<{ id: string }>(await client.post('/api/binders', { name: 'X' }))
    await client.put(`/api/binders/${binder.id}/slots/4`, { collectionItemId: lp.id })

    const res = await client.patch(`/api/collection/${lp.id}`, { condition: 'NM' })
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ id: nm.id, quantity: 5, binderCount: 1 })

    const body = await list()
    expect(body.items).toHaveLength(1)
    const detail = await json<BinderDetail>(await client.get(`/api/binders/${binder.id}`))
    expect(detail.slots).toEqual([
      { position: 4, item: expect.objectContaining({ id: nm.id, condition: 'NM' }) },
    ])
  })

  it('remove da coleção', async () => {
    const { client, add, list } = await setup()
    const item = await add({ cardId: 'base1-25' })
    expect((await client.delete(`/api/collection/${item.id}`)).status).toBe(204)
    expect((await client.delete(`/api/collection/${item.id}`)).status).toBe(404)
    expect((await list()).items).toHaveLength(0)
  })

  it('cada usuário tem a sua coleção (isolamento)', async () => {
    const a = await setup('google-a')
    const b = await setup('google-b')
    const item = await a.add({ cardId: 'base1-25', quantity: 2 })

    // B não vê a carta de A, nem consegue alterá-la ou apagá-la.
    expect((await b.list()).items).toHaveLength(0)
    expect((await b.client.patch(`/api/collection/${item.id}`, { quantity: 9 })).status).toBe(404)
    expect(
      (await b.client.patch(`/api/collection/${item.id}`, { variant: 'reverse' })).status,
    ).toBe(404)
    expect((await b.client.delete(`/api/collection/${item.id}`)).status).toBe(404)

    // A segue com a carta intacta.
    const listA = await a.list()
    expect(listA.items).toHaveLength(1)
    expect(listA.items[0]?.quantity).toBe(2)
  })

  it('a mesma carta em duas coleções não se mistura', async () => {
    const a = await setup('google-a')
    const b = await setup('google-b')
    await a.add({ cardId: 'base1-25', quantity: 2 })
    await b.add({ cardId: 'base1-25', quantity: 5 })
    expect((await a.list()).items[0]?.quantity).toBe(2)
    expect((await b.list()).items[0]?.quantity).toBe(5)
  })
})

describe('/api/sets', () => {
  it('lista as coleções sem login', async () => {
    const res = await new Client().get('/api/sets')
    expect(res.status).toBe(200)
    const body = await json<{ items: { id: string }[] }>(res)
    expect(body.items.map((s) => s.id)).toEqual(['sv09'])
  })

  it('detalha uma coleção com as cartas', async () => {
    const body = await json<SetDetail>(await new Client().get('/api/sets/sv09'))
    expect(body.cards).toHaveLength(12)
  })

  it('coleção inexistente dá 404', async () => {
    expect((await new Client().get('/api/sets/nada')).status).toBe(404)
  })
})

describe('/api/binders', () => {
  type ItemBody = { id: number; cardId: string; quantity: number; binderCount: number }
  type BinderList = { items: BinderSummary[] }

  async function setup(sub = 'google-a') {
    const { client } = await loginAs({ sub, email: `${sub}@example.com` })
    const add = async (cardId: string, quantity = 1) =>
      json<ItemBody>(await client.post('/api/collection', { cardId, quantity }))
    const create = async (body: Record<string, unknown>) => {
      const res = await client.post('/api/binders', body)
      expect(res.status).toBe(201)
      return json<BinderSummary>(res)
    }
    const detail = async (id: string) => json<BinderDetail>(await client.get(`/api/binders/${id}`))
    const put = (binderId: string, position: number | string, collectionItemId: number) =>
      client.put(`/api/binders/${binderId}/slots/${position}`, { collectionItemId })
    return { client, add, create, detail, put }
  }

  it('exige login', async () => {
    const client = new Client()
    expect((await client.get('/api/binders')).status).toBe(401)
    expect((await client.post('/api/binders', { name: 'X' })).status).toBe(401)
  })

  it('cria um binder em branco e coloca cartas em qualquer bolso', async () => {
    const { add, create, detail, put } = await setup()
    const pikachu = await add('base1-25')
    const binder = await create({ name: 'Pikachus' })
    expect(binder).toMatchObject({ name: 'Pikachus', set: null, filled: 0, templateSize: null })

    // Bolso na página 51: binder em branco não tem limite de páginas.
    expect((await put(binder.id, 450, pikachu.id)).status).toBe(204)
    const d = await detail(binder.id)
    expect(d.slots).toEqual([
      { position: 450, item: expect.objectContaining({ cardId: 'base1-25', binderCount: 1 }) },
    ])
  })

  it('a mesma carta pode estar em vários bolsos e binders; binderCount conta binders', async () => {
    const { client, add, create, put } = await setup()
    const pikachu = await add('base1-25')
    const a = await create({ name: 'A' })
    const b = await create({ name: 'B' })
    expect((await put(a.id, 0, pikachu.id)).status).toBe(204)
    expect((await put(a.id, 1, pikachu.id)).status).toBe(204)
    expect((await put(b.id, 0, pikachu.id)).status).toBe(204)

    const list = await json<CollectionBody>(await client.get('/api/collection'))
    expect(list.items[0]).toMatchObject({ quantity: 1, binderCount: 2 })

    const binders = await json<BinderList>(await client.get('/api/binders'))
    expect(Object.fromEntries(binders.items.map((x) => [x.name, x.filled]))).toEqual({ A: 2, B: 1 })
  })

  it('trocar a carta do bolso e esvaziar', async () => {
    const { client, add, create, detail, put } = await setup()
    const p1 = await add('base1-25')
    const p2 = await add('base1-58')
    const binder = await create({ name: 'Trocas' })
    await put(binder.id, 3, p1.id)
    await put(binder.id, 3, p2.id)
    expect((await detail(binder.id)).slots.map((s) => s.item.cardId)).toEqual(['base1-58'])

    expect((await client.delete(`/api/binders/${binder.id}/slots/3`)).status).toBe(204)
    expect((await client.delete(`/api/binders/${binder.id}/slots/3`)).status).toBe(404)
    expect((await detail(binder.id)).slots).toEqual([])
  })

  it('rejeita posição negativa, absurda ou não numérica', async () => {
    const { add, create, put } = await setup()
    const p = await add('base1-25')
    const binder = await create({ name: 'X' })
    for (const pos of ['-1', '90000', 'abc']) {
      expect((await put(binder.id, pos, p.id)).status).toBe(400)
    }
  })

  it('tirar a carta da coleção esvazia os bolsos dela', async () => {
    const { client, add, create, detail, put } = await setup()
    const p = await add('base1-25')
    const binder = await create({ name: 'X' })
    await put(binder.id, 0, p.id)
    await client.delete(`/api/collection/${p.id}`)
    expect((await detail(binder.id)).slots).toEqual([])
  })

  it('renomear e apagar (as cartas continuam na coleção)', async () => {
    const { client, add, create, put } = await setup()
    const p = await add('base1-25')
    const binder = await create({ name: 'Velho' })
    await put(binder.id, 0, p.id)

    expect((await client.patch(`/api/binders/${binder.id}`, { name: 'Novo' })).status).toBe(204)
    expect((await client.patch(`/api/binders/${binder.id}`, { name: '  ' })).status).toBe(400)
    const list = await json<BinderList>(await client.get('/api/binders'))
    expect(list.items[0]?.name).toBe('Novo')

    expect((await client.delete(`/api/binders/${binder.id}`)).status).toBe(204)
    expect((await client.get(`/api/binders/${binder.id}`)).status).toBe(404)
    const collection = await json<CollectionBody>(await client.get('/api/collection'))
    expect(collection.items).toHaveLength(1)
  })

  it('binder a partir de uma coleção reserva um bolso por carta', async () => {
    const { create, detail } = await setup()
    const binder = await create({ name: 'Amigos de Jornada', setId: 'sv09' })
    expect(binder).toMatchObject({
      set: { id: 'sv09', name: 'Amigos de Jornada' },
      filled: 0,
      templateSize: 12,
    })
    const d = await detail(binder.id)
    expect(d.template?.map((c) => c.id)).toEqual(fakeSet.cards.map((c) => c.id))
  })

  it('coleção inexistente não cria binder', async () => {
    const { client } = await setup()
    expect((await client.post('/api/binders', { name: 'X', setId: 'nada' })).status).toBe(404)
    const list = await json<BinderList>(await client.get('/api/binders'))
    expect(list.items).toEqual([])
  })

  it('fill: true já coloca as cartas que o usuário tem no bolso certo', async () => {
    const { add, create, detail } = await setup()
    await add('sv09-003')
    await add('sv09-010', 2)
    await add('base1-25') // fora da coleção: ignorada
    const binder = await create({ name: 'AJ', setId: 'sv09', fill: true })
    expect(binder.filled).toBe(2)
    const d = await detail(binder.id)
    expect(d.slots.map((s) => [s.position, s.item.cardId, s.item.quantity])).toEqual([
      [2, 'sv09-003', 1],
      [9, 'sv09-010', 2],
    ])
  })

  it('com várias cópias da carta, o preenchimento escolhe normal na melhor condição', async () => {
    const { add, create, detail } = await setup()
    await add('sv09-003') // normal NM
    const { client } = await loginAs({ sub: 'google-a', email: 'google-a@example.com' })
    await client.post('/api/collection', { cardId: 'sv09-001', variant: 'reverse' })
    await client.post('/api/collection', { cardId: 'sv09-001', condition: 'LP' })
    await client.post('/api/collection', { cardId: 'sv09-001' })
    const binder = await create({ name: 'AJ', setId: 'sv09', fill: true })
    const d = await detail(binder.id)
    expect(d.slots.map((s) => [s.position, s.item.variant, s.item.condition])).toEqual([
      [0, 'normal', 'NM'],
      [2, 'normal', 'NM'],
    ])
  })

  it('preencher depois só ocupa bolsos vazios e é idempotente', async () => {
    const { client, add, create } = await setup()
    const binder = await create({ name: 'AJ', setId: 'sv09' })
    await add('sv09-001')
    await add('sv09-005')
    const fill = async () =>
      json<{ placed: number }>(await client.post(`/api/binders/${binder.id}/fill`))
    expect(await fill()).toEqual({ placed: 2 })
    expect(await fill()).toEqual({ placed: 0 })
  })

  it('atalho: a carta que falta entra na coleção e já vai para o bolso', async () => {
    const { client, create, detail } = await setup()
    const binder = await create({ name: 'AJ', setId: 'sv09' })

    const res = await client.post(`/api/binders/${binder.id}/slots/2/add`)
    expect(res.status).toBe(201)
    expect(await json(res)).toMatchObject({
      cardId: 'sv09-003',
      variant: 'normal',
      condition: 'NM',
      quantity: 1,
      binderCount: 1,
    })
    expect((await detail(binder.id)).slots.map((s) => [s.position, s.item.cardId])).toEqual([
      [2, 'sv09-003'],
    ])

    // Com variante e condição escolhidas, outra cópia vai para o bolso no lugar.
    const reverse = await client.post(`/api/binders/${binder.id}/slots/2/add`, {
      variant: 'reverse',
      condition: 'LP',
    })
    expect(await json(reverse)).toMatchObject({ variant: 'reverse', condition: 'LP' })
    const collection = await json<CollectionBody>(await client.get('/api/collection'))
    expect(collection.items).toHaveLength(2)
  })

  it('atalho: só em binder de coleção, dentro do molde e com variante válida', async () => {
    const { client, create } = await setup()
    const livre = await create({ name: 'Livre' })
    const aj = await create({ name: 'AJ', setId: 'sv09' })
    const add = (id: string, pos: number, body?: unknown) =>
      client.post(`/api/binders/${id}/slots/${pos}/add`, body)

    expect((await add(livre.id, 0)).status).toBe(400)
    expect((await add(aj.id, 12)).status).toBe(400)
    expect((await add(aj.id, 0, { variant: 'holo' })).status).toBe(400)
    const collection = await json<CollectionBody>(await client.get('/api/collection'))
    expect(collection.items).toEqual([])

    const other = await setup('google-b')
    expect((await other.client.post(`/api/binders/${aj.id}/slots/0/add`)).status).toBe(404)
  })

  it('preencher binder em branco dá 400', async () => {
    const { client, create } = await setup()
    const binder = await create({ name: 'Livre' })
    expect((await client.post(`/api/binders/${binder.id}/fill`)).status).toBe(400)
  })

  it('em binder de coleção, cada bolso só aceita a sua carta', async () => {
    const { add, create, put } = await setup()
    const c3 = await add('sv09-003')
    const binder = await create({ name: 'AJ', setId: 'sv09' })

    expect((await put(binder.id, 2, c3.id)).status).toBe(204)
    const wrong = await put(binder.id, 0, c3.id)
    expect(wrong.status).toBe(400)
    expect(await json(wrong)).toMatchObject({ error: { code: 'WRONG_CARD_FOR_POCKET' } })
    expect((await put(binder.id, 12, c3.id)).status).toBe(400) // depois da última carta
  })

  it('isolamento: ninguém vê nem mexe no binder de outro', async () => {
    const a = await setup('google-a')
    const binder = await a.create({ name: 'Meu' })

    const b = await setup('google-b')
    const theirs = await b.add('base1-25')

    expect((await b.client.get(`/api/binders/${binder.id}`)).status).toBe(404)
    expect((await b.client.patch(`/api/binders/${binder.id}`, { name: 'Hack' })).status).toBe(404)
    expect((await b.client.delete(`/api/binders/${binder.id}`)).status).toBe(404)
    expect((await b.put(binder.id, 0, theirs.id)).status).toBe(404)
    expect((await json<BinderList>(await b.client.get('/api/binders'))).items).toEqual([])

    // E o dono não consegue colocar a carta de outra pessoa no próprio binder.
    expect((await a.put(binder.id, 0, theirs.id)).status).toBe(404)
  })
})
