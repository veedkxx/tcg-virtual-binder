import { rmSync } from 'node:fs'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { CardDetail } from '../shared/schemas.js'
import { createApp } from './app.js'
import { createDb } from './db/client.js'
import { collectionItems } from './db/schema.js'
import { AppError } from './errors.js'
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

// Arquivo temporário (e não ":memory:"): o cliente libsql pode abrir uma conexão nova
// após transações, o que descartaria um banco em memória.
const dbFile = join(tmpdir(), `tcg-binder-test-${process.pid}.db`)
const db = createDb(`file:${dbFile}`)
let server: Server
let base: string

const api = (path: string, init?: RequestInit) =>
  fetch(`${base}${path}`, { ...init, headers: { 'content-type': 'application/json' } })

const json = async (res: Response) => (await res.json()) as Record<string, unknown>

const post = (body: unknown) =>
  api('/api/collection', { method: 'POST', body: JSON.stringify(body) })

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './drizzle' })
  server = createApp({ db, cards }).listen(0)
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
  await db.delete(collectionItems)
})

describe('GET /api/cards', () => {
  it('busca cartas', async () => {
    const res = await api('/api/cards?q=pikachu')
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.items).toHaveLength(1)
    expect(body.page).toBe(1)
  })

  it('rejeita busca curta demais', async () => {
    expect((await api('/api/cards?q=p')).status).toBe(400)
  })

  it('rejeita idioma não habilitado', async () => {
    expect((await api('/api/cards?q=pikachu&lang=en')).status).toBe(400)
  })
})

describe('/api/collection', () => {
  it('começa vazia', async () => {
    const body = await json(await api('/api/collection'))
    expect(body).toEqual({ items: [], totals: { uniqueCards: 0, totalCards: 0 } })
  })

  it('adiciona uma carta com quantidade 1 por padrão', async () => {
    const res = await post({ cardId: 'base1-25' })
    expect(res.status).toBe(201)
    expect(await json(res)).toMatchObject({
      cardId: 'base1-25',
      quantity: 1,
      language: 'pt',
      name: 'Pikachu',
    })
  })

  it('adicionar de novo soma a quantidade (upsert)', async () => {
    await post({ cardId: 'base1-25', quantity: 2 })
    const second = await json(await post({ cardId: 'base1-25', quantity: 3 }))
    expect(second.quantity).toBe(5)

    const list = await json(await api('/api/collection'))
    expect(list.items).toHaveLength(1)
    expect(list.totals).toEqual({ uniqueCards: 1, totalCards: 5 })
  })

  it('não adiciona carta inexistente no TCGdex', async () => {
    expect((await post({ cardId: 'missing' })).status).toBe(404)
  })

  it('define a quantidade exata', async () => {
    await post({ cardId: 'base1-25' })
    const res = await api('/api/collection/base1-25', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 7 }),
    })
    expect(res.status).toBe(200)
    expect((await json(res)).quantity).toBe(7)
  })

  it('rejeita quantidade menor que 1', async () => {
    await post({ cardId: 'base1-25' })
    const res = await api('/api/collection/base1-25', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 0 }),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH em carta que não está na coleção dá 404', async () => {
    const res = await api('/api/collection/base1-25', {
      method: 'PATCH',
      body: JSON.stringify({ quantity: 2 }),
    })
    expect(res.status).toBe(404)
  })

  it('remove da coleção', async () => {
    await post({ cardId: 'base1-25' })
    expect((await api('/api/collection/base1-25', { method: 'DELETE' })).status).toBe(204)
    expect((await api('/api/collection/base1-25', { method: 'DELETE' })).status).toBe(404)
    expect((await json(await api('/api/collection'))).items).toHaveLength(0)
  })
})
