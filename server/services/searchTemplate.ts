import type { Language } from '../../shared/languages.js'
import type { BinderSearch, SearchCandidate } from '../../shared/schemas.js'
import type { CardsProvider } from './tcgdex.js'

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** "sv03.5-001" → "sv03.5". */
function setIdOf(card: { id: string; localId: string }) {
  return card.id.endsWith(`-${card.localId}`) ? card.id.slice(0, -card.localId.length - 1) : card.id
}

/** Campos usados para ordenar (tipo próprio: o do zod fica todo opcional sem strictNullChecks). */
type Ordered = { id: string; localId: string; name: string }

const byNumber = (a: string, b: string) => a.localeCompare(b, 'pt', { numeric: true })

/**
 * Cartas de uma busca (Pokémon ou artista), na ordem escolhida. A ordem de lançamento vem da
 * lista de coleções do TCGdex (que já vem da mais nova para a mais antiga).
 */
export async function searchCandidates(
  cards: CardsProvider,
  lang: Language,
  search: BinderSearch,
): Promise<SearchCandidate[]> {
  const [found, sets] = await Promise.all([
    cards.findAll({ lang, field: search.field, q: search.query }),
    cards.listSets({ lang }),
  ])

  // Índice de lançamento: 0 = coleção mais antiga. Coleção desconhecida vai para o fim.
  const released = new Map(sets.map((s, i) => [s.id, sets.length - 1 - i]))
  const age = (c: { id: string; localId: string }) => released.get(setIdOf(c)) ?? sets.length
  const oldest = (a: Ordered, b: Ordered) => age(a) - age(b) || byNumber(a.localId, b.localId)
  const newest = (a: Ordered, b: Ordered) => age(b) - age(a) || byNumber(a.localId, b.localId)
  const byName = (a: Ordered, b: Ordered) => a.name.localeCompare(b.name, 'pt') || oldest(a, b)

  const query = normalize(search.query)
  // Campos listados um a um: sem strictNullChecks (build da Vercel) o zod infere tudo como opcional.
  const items = found.map((c) => ({
    id: c.id,
    localId: c.localId,
    name: c.name,
    imageUrl: c.imageUrl,
    exact: search.field === 'illustrator' || normalize(c.name) === query,
  }))
  return items.sort(search.sort === 'newest' ? newest : search.sort === 'name' ? byName : oldest)
}
