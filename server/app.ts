import express from 'express'
import type { Db } from './db/client.js'
import { AppError } from './errors.js'
import { errorHandler } from './middleware/error.js'
import { createCardsRouter } from './routes/cards.js'
import { createCollectionRouter } from './routes/collection.js'
import { createCollectionService } from './services/collection.js'
import type { CardsProvider } from './services/tcgdex.js'

export function createApp(deps: { db: Db; cards: CardsProvider }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '10kb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/api/cards', createCardsRouter(deps.cards))
  app.use(
    '/api/collection',
    createCollectionRouter({ collection: createCollectionService(deps.db), cards: deps.cards }),
  )

  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'Rota não encontrada.'))
  })
  app.use(errorHandler)

  return app
}
