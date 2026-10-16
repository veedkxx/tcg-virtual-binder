import express from 'express'
import type { Db } from './db/client.js'
import { AppError } from './errors.js'
import { errorHandler } from './middleware/error.js'
import { createSameOrigin } from './middleware/origin.js'
import { createSessionMiddleware, requireAuth } from './middleware/session.js'
import { createAuthRouter } from './routes/auth.js'
import { createCardsRouter } from './routes/cards.js'
import { createCollectionRouter } from './routes/collection.js'
import { createAuthService } from './services/auth.js'
import { createCollectionService } from './services/collection.js'
import type { GoogleProvider } from './services/google.js'
import type { CardsProvider } from './services/tcgdex.js'

export function createApp(deps: {
  db: Db
  cards: CardsProvider
  google: GoogleProvider
  /** URL pública do app; https:// liga o atributo Secure dos cookies. */
  appUrl: string
}) {
  const secure = deps.appUrl.startsWith('https://')
  const auth = createAuthService(deps.db)
  const session = createSessionMiddleware(auth, secure)

  const app = express()
  app.disable('x-powered-by')

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/api', createSameOrigin(deps.appUrl))
  app.use(express.json({ limit: '10kb' }))

  // Catálogo é público; autenticação e coleção passam pelo middleware de sessão.
  app.use('/api/cards', createCardsRouter(deps.cards))
  app.use('/api/auth', session, createAuthRouter({ auth, google: deps.google, secure }))
  app.use(
    '/api/collection',
    session,
    requireAuth,
    createCollectionRouter({ collection: createCollectionService(deps.db), cards: deps.cards }),
  )

  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'Rota não encontrada.'))
  })
  app.use(errorHandler)

  return app
}
