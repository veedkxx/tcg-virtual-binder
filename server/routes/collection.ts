import { Router } from 'express'
import type { Language } from '../../shared/languages.js'
import {
  AddToCollectionSchema,
  CollectionItemIdSchema,
  OptionalLangQuerySchema,
  UpdateCollectionItemSchema,
} from '../../shared/schemas.js'
import { AppError } from '../errors.js'
import { currentUser } from '../middleware/session.js'
import {
  detailsOf,
  resolveVariant,
  snapshotOf,
  type CollectionService,
} from '../services/collection.js'
import type { CardsProvider } from '../services/tcgdex.js'

const COMPLETE_BATCH = 40

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
    const { lang } = OptionalLangQuerySchema.parse(req.query)
    res.json(await collection.list(userId, lang))
  })

  // Completa categoria e tipos das cópias antigas (de antes da Sprint 6), de 40 em 40. O app chama
  // quando encontra cópias sem tipo; os dados vêm do TCGdex (com cache).
  router.post('/complete', async (_req, res) => {
    const { id: userId } = currentUser(res)
    const { rows, more } = await collection.incomplete(userId, COMPLETE_BATCH)
    let updated = 0
    await Promise.all(
      rows.map(async (r) => {
        try {
          const card = await cards.get({ lang: r.language as Language, id: r.cardId })
          await collection.setDetails(r.id, detailsOf(card))
          updated++
        } catch (err) {
          // Carta que o TCGdex não acha mais: marca sem tipos para não tentar de novo. Outros
          // erros (TCGdex fora do ar) deixam para a próxima chamada.
          if (err instanceof AppError && err.status === 404) {
            await collection.setDetails(r.id, { category: null, types: [], illustrator: null })
          }
        }
      }),
    )
    res.json({ updated, more })
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
