import { Router } from 'express'
import { AddToWishlistSchema, CollectionItemIdSchema } from '../../shared/schemas.js'
import { AppError } from '../errors.js'
import { currentUser } from '../middleware/session.js'
import { resolveVariant } from '../services/collection.js'
import type { CardsProvider } from '../services/tcgdex.js'
import type { WishlistService } from '../services/wishlist.js'

// Este router é montado atrás de `requireAuth`; todos os handlers usam o usuário da sessão.
export function createWishlistRouter(deps: { wishlist: WishlistService; cards: CardsProvider }) {
  const { wishlist, cards } = deps
  const router = Router()

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  router.get('/', async (_req, res) => {
    const { id: userId } = currentUser(res)
    res.json({ items: await wishlist.list(userId) })
  })

  router.post('/', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { cardId, lang, language, variant } = AddToWishlistSchema.parse(req.body)
    // Nome e imagem do TCGdex (no idioma desejado, se houver); a versão precisa existir.
    const card = await cards.get({ lang: language ?? lang, id: cardId })
    if (variant) resolveVariant(card, variant)
    res.status(201).json(await wishlist.add(userId, card, { language, variant }))
  })

  router.delete('/:id', async (req, res) => {
    const { id: userId } = currentUser(res)
    const id = CollectionItemIdSchema.parse(req.params.id)
    if (!(await wishlist.remove(userId, id))) {
      throw new AppError(404, 'NOT_IN_WISHLIST', 'Essa carta não está na lista de desejos.')
    }
    res.status(204).end()
  })

  return router
}
