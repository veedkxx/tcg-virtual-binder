import { parseVariant, type Variant } from '../../shared/copies.js'
import type { Language } from '../../shared/languages.js'
import type { BinderTemplateCard, SetDetail } from '../../shared/schemas.js'
import type { SetType } from '../../shared/setTypes.js'
import { AppError } from '../errors.js'
import type { CardsProvider } from './tcgdex.js'

/** Versões base que entram no Master Set (1ª edição e promo W ficam para o Grand Master). */
const MASTER_BASES = ['normal', 'reverse', 'holo']
const DETAIL_CONCURRENCY = 8

/** Como Promise.all, mas com no máximo `limit` chamadas ao mesmo tempo. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/**
 * Bolsos reservados de um binder de coleção. Grand Master: como o Master, mais as impressões
 * especiais (reverse Poké Ball/Master Ball, cosmos, carimbos…), cada uma no seu bolso.
 * - Core Set: uma de cada carta numerada até o total oficial (sem as secretas).
 * - Master Set: todas as cartas, um bolso por versão de booster (normal, reverse, holo).
 */
export async function buildSetTemplate(
  cards: CardsProvider,
  lang: Language,
  set: SetDetail,
  type: SetType,
): Promise<BinderTemplateCard[]> {
  if (type === 'core') {
    const official = set.officialCount
    if (!official) return set.cards
    const numbered = set.cards.filter(
      (c) => /^\d+$/.test(c.localId) && Number(c.localId) <= official,
    )
    // Coleções sem numeração simples (promos etc.): melhor todas que nenhuma.
    return numbered.length > 0 ? numbered : set.cards
  }

  const variants = await mapLimit(set.cards, DETAIL_CONCURRENCY, async (c) => {
    try {
      const card = await cards.get({ lang, id: c.id })
      // Grand Master: todas as impressões; Master: só as comuns de booster.
      return type === 'grandmaster' ? card.variants : card.boosterVariants
    } catch (err) {
      // Carta que o TCGdex não detalha: um bolso só. Fora do ar: não dá para montar.
      if (err instanceof AppError && err.status === 404) return ['normal'] as Variant[]
      throw err
    }
  })

  return set.cards.flatMap((card, i) => {
    const all = variants[i]!
    const found =
      type === 'grandmaster' ? all : all.filter((v) => MASTER_BASES.includes(parseVariant(v).base))
    const pockets = found.length > 0 ? found : [all[0]!]
    return pockets.map((variant) => ({ ...card, variant }))
  })
}
