import { Router } from 'express'
import { LangQuerySchema, SearchCandidatesQuerySchema } from '../../shared/schemas.js'
import { searchCandidates } from '../services/searchTemplate.js'
import type { CardsProvider } from '../services/tcgdex.js'

/** Busca para montar binders por Pokémon ou artista (dados públicos do TCGdex). */
export function createSearchRouter(cards: CardsProvider) {
  const router = Router()

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    next()
  })

  router.get('/candidates', async (req, res) => {
    const { lang, ...search } = SearchCandidatesQuerySchema.parse(req.query)
    res.json({ items: await searchCandidates(cards, lang, search) })
  })

  router.get('/illustrators', async (req, res) => {
    const { lang } = LangQuerySchema.parse(req.query)
    res.json({ items: await cards.listIllustrators({ lang }) })
  })

  return router
}
