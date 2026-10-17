import { z } from 'zod'
import type { CardDetail, CardSearchResponse, SetDetail, SetSummary } from '../../shared/schemas.js'
import { VARIANTS, type Variant } from '../../shared/copies.js'
import type { Language } from '../../shared/languages.js'
import { AppError } from '../errors.js'

const BASE_URL = 'https://api.tcgdex.net/v2'
const TIMEOUT_MS = 8000
const HEALTH_TIMEOUT_MS = 3000
const CACHE_TTL_MS = 60 * 60_000
const CACHE_MAX_ENTRIES = 500

/** Contrato que o resto do servidor usa; permite trocar/mocar o provedor de cartas. */
export interface CardsProvider {
  search(params: {
    lang: Language
    q: string
    page: number
    pageSize: number
  }): Promise<CardSearchResponse>
  get(params: { lang: Language; id: string }): Promise<CardDetail>
  listSets(params: { lang: Language }): Promise<SetSummary[]>
  getSet(params: { lang: Language; id: string }): Promise<SetDetail>
  /** Lança erro se o provedor não estiver respondendo. */
  ping(): Promise<void>
}

// Só validamos o que usamos; o resto do payload é descartado.
const RawBriefSchema = z.object({
  id: z.string(),
  localId: z.string(),
  name: z.string(),
  image: z.string().optional(),
})

const RawCardSchema = RawBriefSchema.extend({
  category: z.string().optional(),
  rarity: z.string().optional(),
  illustrator: z.string().optional(),
  hp: z.number().optional(),
  types: z.array(z.string()).optional(),
  description: z.string().optional(),
  variants: z.record(z.string(), z.boolean().nullish()).nullish(),
  set: z.object({
    id: z.string(),
    name: z.string(),
    logo: z.string().optional(),
    cardCount: z.object({ total: z.number().optional() }).optional(),
  }),
})

const RawSetBriefSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().optional(),
  symbol: z.string().optional(),
  cardCount: z.object({ total: z.number().optional() }).optional(),
})

const RawSetSchema = RawSetBriefSchema.extend({
  cards: z.array(RawBriefSchema),
})

/**
 * Cache em memória por instância (na Vercel, por função "quente"); o CDN cacheia por cima.
 * Se o TCGdex cair ou demorar, servimos a última resposta boa mesmo vencida (stale).
 * 404 nunca é cacheado nem mascarado.
 */
const cache = new Map<string, { at: number; data: unknown }>()

function remember(url: string, data: unknown) {
  cache.delete(url) // reinserir move para o fim (ordem de inserção = mais antigo primeiro)
  cache.set(url, { at: Date.now(), data })
  if (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!)
}

/** Só para testes. */
export function clearTcgdexCache() {
  cache.clear()
}

async function tcgdexFetch<S extends z.ZodTypeAny>(
  path: string,
  query: string,
  schema: S,
  notFound = { code: 'CARD_NOT_FOUND', message: 'Carta não encontrada.' },
): Promise<z.infer<S>> {
  const url = `${BASE_URL}${path}${query ? `?${query}` : ''}`

  const cached = cache.get(url)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data as z.infer<S>

  try {
    const data = await fetchUpstream(url, schema, notFound)
    remember(url, data)
    return data
  } catch (err) {
    const upstreamDown = err instanceof AppError && err.status !== 404
    if (cached && upstreamDown) return cached.data as z.infer<S>
    throw err
  }
}

async function fetchUpstream<S extends z.ZodTypeAny>(
  url: string,
  schema: S,
  notFound: { code: string; message: string },
): Promise<z.infer<S>> {
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new AppError(504, 'UPSTREAM_TIMEOUT', 'O TCGdex não respondeu a tempo. Tente de novo.')
  }

  if (res.status === 404) throw new AppError(404, notFound.code, notFound.message)
  if (!res.ok) throw new AppError(502, 'UPSTREAM_ERROR', 'Erro ao consultar o TCGdex.')

  // O TCGdex responde 200 com corpo vazio/null em alguns ids inexistentes.
  const json: unknown = await res.json().catch(() => null)
  if (json === null) throw new AppError(404, notFound.code, notFound.message)

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new AppError(502, 'UPSTREAM_BAD_PAYLOAD', 'Resposta inesperada do TCGdex.')
  }
  return parsed.data
}

const imageUrl = (base: string | undefined, quality: 'low' | 'high') =>
  base ? `${base}/${quality}.webp` : null

/** Variantes impressas, na ordem de VARIANTS. Sem informação do TCGdex, assume "normal". */
function toVariants(raw: Record<string, boolean | null | undefined> | null | undefined): Variant[] {
  const found = VARIANTS.filter((v) => raw?.[v] === true)
  return found.length > 0 ? found : ['normal']
}

const assetUrl = (base: string | undefined) => (base ? `${base}.webp` : null)

const SET_NOT_FOUND = { code: 'SET_NOT_FOUND', message: 'Coleção não encontrada.' }

function toSetSummary(s: z.infer<typeof RawSetBriefSchema>): SetSummary {
  return {
    id: s.id,
    name: s.name.trim(),
    logoUrl: assetUrl(s.logo),
    symbolUrl: assetUrl(s.symbol),
    cardCount: s.cardCount?.total ?? null,
  }
}

export const tcgdex: CardsProvider = {
  async search({ lang, q, page, pageSize }) {
    // Chaves do filtro de paginação do TCGdex contêm ":" e vão sem encode.
    const query = `name=${encodeURIComponent(q)}&pagination:page=${page}&pagination:itemsPerPage=${pageSize}`
    const raw = await tcgdexFetch(`/${lang}/cards`, query, z.array(RawBriefSchema))

    return {
      items: raw.map((c) => ({
        id: c.id,
        localId: c.localId,
        name: c.name,
        imageUrl: imageUrl(c.image, 'low'),
      })),
      page,
      pageSize,
      hasMore: raw.length === pageSize,
    }
  },

  async get({ lang, id }) {
    const c = await tcgdexFetch(`/${lang}/cards/${encodeURIComponent(id)}`, '', RawCardSchema)

    return {
      id: c.id,
      localId: c.localId,
      name: c.name,
      language: lang,
      imageUrl: imageUrl(c.image, 'low'),
      imageHighUrl: imageUrl(c.image, 'high'),
      category: c.category ?? null,
      rarity: c.rarity ?? null,
      illustrator: c.illustrator ?? null,
      hp: c.hp ?? null,
      types: c.types ?? [],
      description: c.description ?? null,
      variants: toVariants(c.variants),
      set: {
        id: c.set.id,
        name: c.set.name,
        logoUrl: c.set.logo ? `${c.set.logo}.webp` : null,
        cardCount: c.set.cardCount?.total ?? null,
      },
    }
  },

  async listSets({ lang }) {
    const raw = await tcgdexFetch(`/${lang}/sets`, '', z.array(RawSetBriefSchema))
    // O TCGdex lista da mais antiga para a mais nova; mostramos as recentes primeiro.
    return raw.map(toSetSummary).reverse()
  },

  async getSet({ lang, id }) {
    const s = await tcgdexFetch(
      `/${lang}/sets/${encodeURIComponent(id)}`,
      '',
      RawSetSchema,
      SET_NOT_FOUND,
    )
    return {
      ...toSetSummary(s),
      cards: s.cards.map((c) => ({
        id: c.id,
        localId: c.localId,
        name: c.name,
        imageUrl: imageUrl(c.image, 'low'),
      })),
    }
  },

  async ping() {
    // Sem cache: o objetivo é saber se o TCGdex está de pé agora.
    const res = await fetch(`${BASE_URL}/pt/sets/base1`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`TCGdex respondeu ${res.status}`)
  },
}
