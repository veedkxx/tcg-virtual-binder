import { Router } from 'express'
import {
  AddToCollectionSchema,
  LangQuerySchema,
  SetQuantitySchema,
} from '../../shared/schemas.js'
import { AppError } from '../errors.js'
import { currentUser } from '../middleware/session.js'
import type { CollectionService } from '../services/collection.js'
import type { CardsProvider } from '../services/tcgdex.js'

// Este router é montado atrás de `requireAuth`; todos os handlers usam o usuário da sessão.
export function createCollectionRouter(deps: { collection: CollectionService; cards: CardsProvider }) {
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
    const { cardId, language, quantity } = AddToCollectionSchema.parse(req.body)

    // O snapshot vem do TCGdex (servidor), nunca do cliente.
    const card = await cards.get({ lang: language, id: cardId })
    const item = await collection.add(
      userId,
      {
        cardId: card.id,
        language,
        name: card.name,
        imageUrl: card.imageUrl,
        setId: card.set.id,
        setName: card.set.name,
        localId: card.localId,
        rarity: card.rarity,
      },
      quantity,
    )
    res.status(201).json(item)
  })

  router.patch('/:cardId', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { lang } = LangQuerySchema.parse(req.query)
    const { quantity } = SetQuantitySchema.parse(req.body)

    const item = await collection.setQuantity(userId, req.params.cardId, lang, quantity)
    if (!item) throw new AppError(404, 'NOT_IN_COLLECTION', 'Essa carta não está na coleção.')
    res.json(item)
  })

  router.delete('/:cardId', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { lang } = LangQuerySchema.parse(req.query)

    const removed = await collection.remove(userId, req.params.cardId, lang)
    if (!removed) throw new AppError(404, 'NOT_IN_COLLECTION', 'Essa carta não está na coleção.')
    res.status(204).end()
  })

  return router
}
