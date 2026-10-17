import { Router } from 'express'
import type { Language } from '../../shared/languages.js'
import {
  AddToCollectionSchema,
  CollectionItemIdSchema,
  LangQuerySchema,
  UpdateCollectionItemSchema,
} from '../../shared/schemas.js'
import { AppError } from '../errors.js'
import { currentUser } from '../middleware/session.js'
import { resolveVariant, snapshotOf, type CollectionService } from '../services/collection.js'
import type { CardsProvider } from '../services/tcgdex.js'

const notInCollection = () =>
  new AppError(404, 'NOT_IN_COLLECTION', 'Essa carta não está na coleção.')

// Este router é montado atrás de `requireAuth`; todos os handlers usam o usuário da sessão.
export function createCollectionRouter(deps: {
  collection: CollectionService
  cards: CardsProvider
}) {
  const { collection, cards } = deps
  const router = Router()

  // Dados do usuário: nunca cachear.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  router.get('/', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { lang } = LangQuerySchema.parse(req.query)
    res.json(await collection.list(userId, lang))
  })

  router.post('/', async (req, res) => {
    const { id: userId } = currentUser(res)
    const input = AddToCollectionSchema.parse(req.body)

    // O snapshot e as variantes vêm do TCGdex (servidor), nunca do cliente.
    const card = await cards.get({ lang: input.language, id: input.cardId })
    const item = await collection.add(
      userId,
      snapshotOf(card, input.language),
      { variant: resolveVariant(card, input.variant), condition: input.condition },
      input.quantity,
    )
    res.status(201).json(item)
  })

  router.patch('/:id', async (req, res) => {
    const { id: userId } = currentUser(res)
    const id = CollectionItemIdSchema.parse(req.params.id)
    const patch = UpdateCollectionItemSchema.parse(req.body)

    if (patch.variant) {
      const current = await collection.get(userId, id)
      if (!current) throw notInCollection()
      if (patch.variant !== current.variant) {
        const card = await cards.get({ lang: current.language as Language, id: current.cardId })
        resolveVariant(card, patch.variant)
      }
    }

    const item = await collection.update(userId, id, patch)
    if (!item) throw notInCollection()
    res.json(item)
  })

  router.delete('/:id', async (req, res) => {
    const { id: userId } = currentUser(res)
    const id = CollectionItemIdSchema.parse(req.params.id)
    if (!(await collection.remove(userId, id))) throw notInCollection()
    res.status(204).end()
  })

  return router
}
