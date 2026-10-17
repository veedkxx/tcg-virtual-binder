import { sql } from 'drizzle-orm'
import express from 'express'
import type { Db } from './db/client.js'
import { AppError } from './errors.js'
import { errorHandler } from './middleware/error.js'
import { createSameOrigin } from './middleware/origin.js'
import { createSessionMiddleware, requireAuth } from './middleware/session.js'
import { createAuthRouter } from './routes/auth.js'
import { createBindersRouter } from './routes/binders.js'
import { createCardsRouter } from './routes/cards.js'
import { createCollectionRouter } from './routes/collection.js'
import { createSetsRouter } from './routes/sets.js'
import { createAuthService } from './services/auth.js'
import { createBindersService } from './services/binders.js'
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

  // Leve por padrão; `?deep=1` também testa o banco e o TCGdex (usado pelo smoke test).
  app.get('/api/health', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    if (req.query.deep !== '1') {
      res.json({ ok: true })
      return
    }

    const check = async (fn: () => Promise<unknown>) => {
      const started = Date.now()
      try {
        await fn()
        return { ok: true, ms: Date.now() - started }
      } catch (err) {
        return { ok: false, ms: Date.now() - started, error: (err as Error).message }
      }
    }
    const [database, tcgdex] = await Promise.all([
      check(() => deps.db.run(sql`select 1`)),
      check(() => deps.cards.ping()),
    ])
    const ok = database.ok && tcgdex.ok
    res.status(ok ? 200 : 503).json({ ok, checks: { database, tcgdex } })
  })

  app.use('/api', createSameOrigin(deps.appUrl))
  app.use(express.json({ limit: '10kb' }))

  // Catálogo é público; autenticação e coleção passam pelo middleware de sessão.
  app.use('/api/cards', createCardsRouter(deps.cards))
  app.use('/api/sets', createSetsRouter(deps.cards))
  app.use('/api/auth', session, createAuthRouter({ auth, google: deps.google, secure }))
  app.use(
    '/api/collection',
    session,
    requireAuth,
    createCollectionRouter({ collection: createCollectionService(deps.db), cards: deps.cards }),
  )
  app.use(
    '/api/binders',
    session,
    requireAuth,
    createBindersRouter({
      binders: createBindersService(deps.db),
      collection: createCollectionService(deps.db),
      cards: deps.cards,
    }),
  )

  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'Rota não encontrada.'))
  })
  app.use(errorHandler)

  return app
}
