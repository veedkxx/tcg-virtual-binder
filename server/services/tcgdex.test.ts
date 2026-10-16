import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearTcgdexCache, tcgdex } from './tcgdex.js'

const rawSet = {
  id: 'sv09',
  name: 'Amigos de Jornada ',
  logo: 'https://assets.tcgdex.net/pt/sv/sv09/logo',
  cardCount: { total: 2 },
  cards: [
    {
      id: 'sv09-001',
      localId: '001',
      name: 'Caterpie',
      image: 'https://assets.tcgdex.net/pt/sv/sv09/001',
    },
    { id: 'sv09-002', localId: '002', name: 'Metapod' },
  ],
}

const fetchMock = vi.fn<typeof fetch>()
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

beforeEach(() => {
  clearTcgdexCache()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('tcgdex', () => {
  it('normaliza a coleção: nome sem espaço sobrando, imagens .webp e cartas sem imagem', async () => {
    fetchMock.mockResolvedValueOnce(ok(rawSet))
    const set = await tcgdex.getSet({ lang: 'pt', id: 'sv09' })
    expect(set).toEqual({
      id: 'sv09',
      name: 'Amigos de Jornada',
      logoUrl: 'https://assets.tcgdex.net/pt/sv/sv09/logo.webp',
      symbolUrl: null,
      cardCount: 2,
      cards: [
        {
          id: 'sv09-001',
          localId: '001',
          name: 'Caterpie',
          imageUrl: 'https://assets.tcgdex.net/pt/sv/sv09/001/low.webp',
        },
        { id: 'sv09-002', localId: '002', name: 'Metapod', imageUrl: null },
      ],
    })
  })

  it('lista coleções da mais nova para a mais antiga', async () => {
    fetchMock.mockResolvedValueOnce(
      ok([
        { id: 'base1', name: 'Coleção Básica' },
        { id: 'sv09', name: 'Amigos de Jornada' },
      ]),
    )
    const sets = await tcgdex.listSets({ lang: 'pt' })
    expect(sets.map((s) => s.id)).toEqual(['sv09', 'base1'])
  })

  it('usa o cache dentro do TTL', async () => {
    fetchMock.mockResolvedValueOnce(ok(rawSet))
    await tcgdex.getSet({ lang: 'pt', id: 'sv09' })
    await tcgdex.getSet({ lang: 'pt', id: 'sv09' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('depois do TTL busca de novo', async () => {
    fetchMock.mockResolvedValue(ok(rawSet))
    await tcgdex.getSet({ lang: 'pt', id: 'sv09' })
    vi.setSystemTime(Date.now() + 61 * 60_000)
    fetchMock.mockResolvedValueOnce(ok(rawSet))
    await tcgdex.getSet({ lang: 'pt', id: 'sv09' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('TCGdex fora do ar: serve a última resposta boa (stale)', async () => {
    fetchMock.mockResolvedValueOnce(ok(rawSet))
    await tcgdex.getSet({ lang: 'pt', id: 'sv09' })
    vi.setSystemTime(Date.now() + 61 * 60_000)

    fetchMock.mockResolvedValueOnce(new Response('erro', { status: 500 }))
    const set = await tcgdex.getSet({ lang: 'pt', id: 'sv09' })
    expect(set.name).toBe('Amigos de Jornada')

    fetchMock.mockRejectedValueOnce(new Error('timeout'))
    expect((await tcgdex.getSet({ lang: 'pt', id: 'sv09' })).cards).toHaveLength(2)
  })

  it('TCGdex fora do ar e sem cache: erro 502/504', async () => {
    fetchMock.mockResolvedValueOnce(new Response('erro', { status: 500 }))
    await expect(tcgdex.getSet({ lang: 'pt', id: 'sv09' })).rejects.toMatchObject({ status: 502 })
    fetchMock.mockRejectedValueOnce(new Error('timeout'))
    await expect(tcgdex.getSet({ lang: 'pt', id: 'sv09' })).rejects.toMatchObject({ status: 504 })
  })

  it('404 nunca é cacheado nem mascarado', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }))
    await expect(tcgdex.getSet({ lang: 'pt', id: 'nada' })).rejects.toMatchObject({
      status: 404,
      code: 'SET_NOT_FOUND',
    })
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }))
    await expect(tcgdex.getSet({ lang: 'pt', id: 'nada' })).rejects.toMatchObject({ status: 404 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('ping ignora o cache e falha se o TCGdex não responde 200', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }))
    await expect(tcgdex.ping()).resolves.toBeUndefined()
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }))
    await expect(tcgdex.ping()).rejects.toThrow('503')
  })
})
