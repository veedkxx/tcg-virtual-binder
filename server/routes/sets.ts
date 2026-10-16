import { Router } from 'express'
import { LangQuerySchema } from '../../shared/schemas.js'
import type { CardsProvider } from '../services/tcgdex.js'

export function createSetsRouter(cards: CardsProvider) {
  const router = Router()

  // Coleções do TCGdex mudam raramente: deixa o CDN da Vercel cachear.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    next()
  })

  router.get('/', async (req, res) => {
    const { lang } = LangQuerySchema.parse(req.query)
    res.json({ items: await cards.listSets({ lang }) })
  })

  router.get('/:id', async (req, res) => {
    const { lang } = LangQuerySchema.parse(req.query)
    res.json(await cards.getSet({ lang, id: req.params.id }))
  })

  return router
}
