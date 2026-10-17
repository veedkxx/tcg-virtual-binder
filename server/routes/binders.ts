import { Router } from 'express'
import {
  AddToPocketSchema,
  BinderPositionSchema,
  CreateBinderSchema,
  LangQuerySchema,
  PutSlotSchema,
  RenameBinderSchema,
} from '../../shared/schemas.js'
import { currentUser } from '../middleware/session.js'
import type { BindersService } from '../services/binders.js'
import { resolveVariant, snapshotOf, type CollectionService } from '../services/collection.js'
import type { CardsProvider } from '../services/tcgdex.js'

// Este router é montado atrás de `requireAuth`; todos os handlers usam o usuário da sessão.
export function createBindersRouter(deps: {
  binders: BindersService
  collection: CollectionService
  cards: CardsProvider
}) {
  const { binders, collection, cards } = deps
  const router = Router()

  // Dados do usuário: nunca cachear.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  router.get('/', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { lang } = LangQuerySchema.parse(req.query)
    res.json({ items: await binders.list(userId, lang) })
  })

  router.post('/', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { name, language, setId, fill } = CreateBinderSchema.parse(req.body)

    // O molde vem do TCGdex (servidor), nunca do cliente.
    const set = setId ? await cards.getSet({ lang: language, id: setId }) : undefined
    res.status(201).json(await binders.create(userId, { name, language, set, fill }))
  })

  router.get('/:id', async (req, res) => {
    const { id: userId } = currentUser(res)
    res.json(await binders.get(userId, req.params.id))
  })

  router.patch('/:id', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { name } = RenameBinderSchema.parse(req.body)
    await binders.rename(userId, req.params.id, name)
    res.status(204).end()
  })

  router.delete('/:id', async (req, res) => {
    const { id: userId } = currentUser(res)
    await binders.remove(userId, req.params.id)
    res.status(204).end()
  })

  router.post('/:id/fill', async (req, res) => {
    const { id: userId } = currentUser(res)
    res.json({ placed: await binders.fill(userId, req.params.id) })
  })

  router.put('/:id/slots/:position', async (req, res) => {
    const { id: userId } = currentUser(res)
    const position = BinderPositionSchema.parse(req.params.position)
    const { collectionItemId } = PutSlotSchema.parse(req.body)
    await binders.putSlot(userId, req.params.id, position, collectionItemId)
    res.status(204).end()
  })

  // Atalho do binder de coleção: a carta que falta entra na coleção e já vai para o bolso.
  router.post('/:id/slots/:position/add', async (req, res) => {
    const { id: userId } = currentUser(res)
    const position = BinderPositionSchema.parse(req.params.position)
    const input = AddToPocketSchema.parse(req.body ?? {})

    const { language, card: reserved } = await binders.reservedCard(userId, req.params.id, position)
    const card = await cards.get({ lang: language, id: reserved.id })
    const item = await collection.add(
      userId,
      snapshotOf(card, language),
      { variant: resolveVariant(card, input.variant), condition: input.condition },
      input.quantity,
    )
    await binders.putSlot(userId, req.params.id, position, item.id)
    res.status(201).json(await collection.item(userId, item.id))
  })

  router.delete('/:id/slots/:position', async (req, res) => {
    const { id: userId } = currentUser(res)
    const position = BinderPositionSchema.parse(req.params.position)
    await binders.clearSlot(userId, req.params.id, position)
    res.status(204).end()
  })

  return router
}
