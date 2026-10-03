import { Router } from 'express'
import { LangQuerySchema, SEARCH_PAGE_SIZE, SearchQuerySchema } from '../../shared/schemas.js'
import type { CardsProvider } from '../services/tcgdex.js'

export function createCardsRouter(cards: CardsProvider) {
  const router = Router()

  // Dados de cartas mudam raramente: deixa o CDN da Vercel cachear.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    next()
  })

  router.get('/', async (req, res) => {
    const { q, page, lang } = SearchQuerySchema.parse(req.query)
    res.json(await cards.search({ lang, q, page, pageSize: SEARCH_PAGE_SIZE }))
  })

  router.get('/:id', async (req, res) => {
    const { lang } = LangQuerySchema.parse(req.query)
    res.json(await cards.get({ lang, id: req.params.id }))
  })

  return router
}
