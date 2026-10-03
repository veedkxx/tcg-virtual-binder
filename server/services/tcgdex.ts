import { z } from 'zod'
import type { CardDetail, CardSearchResponse } from '../../shared/schemas.js'
import type { Language } from '../../shared/languages.js'
import { AppError } from '../errors.js'

const BASE_URL = 'https://api.tcgdex.net/v2'
const TIMEOUT_MS = 8000

/** Contrato que o resto do servidor usa; permite trocar/mocar o provedor de cartas. */
export interface CardsProvider {
  search(params: {
    lang: Language
    q: string
    page: number
    pageSize: number
  }): Promise<CardSearchResponse>
  get(params: { lang: Language; id: string }): Promise<CardDetail>
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
  set: z.object({
    id: z.string(),
    name: z.string(),
    logo: z.string().optional(),
    cardCount: z.object({ total: z.number().optional() }).optional(),
  }),
})

async function tcgdexFetch<S extends z.ZodTypeAny>(
  path: string,
  query: string,
  schema: S,
): Promise<z.infer<S>> {
  const url = `${BASE_URL}${path}${query ? `?${query}` : ''}`

  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new AppError(504, 'UPSTREAM_TIMEOUT', 'O TCGdex não respondeu a tempo. Tente de novo.')
  }

  if (res.status === 404) throw new AppError(404, 'CARD_NOT_FOUND', 'Carta não encontrada.')
  if (!res.ok) throw new AppError(502, 'UPSTREAM_ERROR', 'Erro ao consultar o TCGdex.')

  // O TCGdex responde 200 com corpo vazio/null em alguns ids inexistentes.
  const json: unknown = await res.json().catch(() => null)
  if (json === null) throw new AppError(404, 'CARD_NOT_FOUND', 'Carta não encontrada.')

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new AppError(502, 'UPSTREAM_BAD_PAYLOAD', 'Resposta inesperada do TCGdex.')
  }
  return parsed.data
}

const imageUrl = (base: string | undefined, quality: 'low' | 'high') =>
  base ? `${base}/${quality}.webp` : null

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
      set: {
        id: c.set.id,
        name: c.set.name,
        logoUrl: c.set.logo ? `${c.set.logo}.webp` : null,
        cardCount: c.set.cardCount?.total ?? null,
      },
    }
  },
}
