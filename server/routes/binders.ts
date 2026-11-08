import { Router } from 'express'
import type { Language } from '../../shared/languages.js'
import {
  AddCardsToBinderSchema,
  AddToPocketSchema,
  BinderPositionSchema,
  CreateBinderSchema,
  OptionalLangQuerySchema,
  PutSlotSchema,
  MoveSlotSchema,
  OrganizeBinderSchema,
  PageActionSchema,
  UpdateBinderSchema,
  type BinderTemplateCard,
  type SearchCandidate,
} from '../../shared/schemas.js'
import { AppError } from '../errors.js'
import { currentUser } from '../middleware/session.js'
import type { BindersService } from '../services/binders.js'
import { searchCandidates } from '../services/searchTemplate.js'
import { buildSetTemplate } from '../services/setTemplate.js'
import { resolveVariant, snapshotOf, type CollectionService } from '../services/collection.js'
import type { CardsProvider } from '../services/tcgdex.js'
import type { WishlistService } from '../services/wishlist.js'

// Este router é montado atrás de `requireAuth`; todos os handlers usam o usuário da sessão.
export function createBindersRouter(deps: {
  binders: BindersService
  collection: CollectionService
  wishlist: WishlistService
  cards: CardsProvider
}) {
  const { binders, collection, wishlist, cards } = deps
  const router = Router()

  // Dados do usuário: nunca cachear.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  router.get('/', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { lang } = OptionalLangQuerySchema.parse(req.query)
    res.json({ items: await binders.list(userId, lang) })
  })

  router.post('/', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { name, language, setId, setType, search, fill } = CreateBinderSchema.parse(req.body)

    // O molde vem do TCGdex (servidor), nunca do cliente: o cliente só diz quais cartas quer.
    let set
    if (setId) {
      const detail = await cards.getSet({ lang: language, id: setId })
      const template = await buildSetTemplate(cards, language, detail, setType)
      set = { summary: detail, type: setType, template }
    }
    let fromSearch
    if (search) {
      const { cardIds, ...origin } = search
      const found = await searchCandidates(cards, language, origin)
      const chosen = new Set(cardIds)
      const template = found.filter((c) => chosen.has(c.id)).map(toTemplateCard)
      if (template.length === 0) {
        throw new AppError(
          400,
          'NO_CARDS_SELECTED',
          'Nenhuma das cartas escolhidas foi encontrada.',
        )
      }
      const excluded = found.filter((c) => !chosen.has(c.id)).map((c) => c.id)
      fromSearch = { search: origin, template, excluded }
    }
    res
      .status(201)
      .json(await binders.create(userId, { name, language, set, search: fromSearch, fill }))
  })

  // Binder por Pokémon/artista: cartas da busca que não estão no binder. `items` são as novas
  // (lançadas depois); `removed`, as que o usuário tirou, para poder trazer de volta.
  router.get('/:id/new-cards', async (req, res) => {
    const { id: userId } = currentUser(res)
    const b = await binders.withTemplate(userId, req.params.id)
    if (!b.search) {
      throw new AppError(400, 'BINDER_HAS_NO_SEARCH', 'Esse binder não foi criado por uma busca.')
    }
    const inBinder = new Set(b.template.map((c) => c.id))
    const excluded = new Set(b.excluded ?? [])
    const outside = (await searchCandidates(cards, b.language as Language, b.search)).filter(
      (c) => !inBinder.has(c.id),
    )
    res.json({
      items: outside.filter((c) => !excluded.has(c.id)),
      removed: outside.filter((c) => excluded.has(c.id)),
    })
  })

  // Acrescenta cartas da busca no fim do binder (inclusive as que tinham sido removidas).
  router.post('/:id/cards', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { cardIds } = AddCardsToBinderSchema.parse(req.body)
    const b = await binders.withTemplate(userId, req.params.id)
    if (!b.search) {
      throw new AppError(400, 'BINDER_HAS_NO_SEARCH', 'Esse binder não foi criado por uma busca.')
    }
    const wanted = new Set(cardIds)
    const found = await searchCandidates(cards, b.language as Language, b.search)
    const added = await binders.appendCards(
      userId,
      b.id,
      found.filter((c) => wanted.has(c.id)).map(toTemplateCard),
    )
    res.json({ added })
  })

  // Tira uma carta do molde (bolso reservado) de qualquer binder de coleção ou de busca.
  router.delete('/:id/template/:position', async (req, res) => {
    const { id: userId } = currentUser(res)
    const position = BinderPositionSchema.parse(req.params.position)
    res.json(await binders.removeReserved(userId, req.params.id, position))
  })

  router.get('/:id', async (req, res) => {
    const { id: userId } = currentUser(res)
    res.json(await binders.get(userId, req.params.id))
  })

  router.patch('/:id', async (req, res) => {
    const { id: userId } = currentUser(res)
    await binders.update(userId, req.params.id, UpdateBinderSchema.parse(req.body))
    res.status(204).end()
  })

  // Binder livre: mover/trocar cartas, inserir/remover páginas e organizar automaticamente.
  router.post('/:id/move', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { from, to } = MoveSlotSchema.parse(req.body)
    await binders.move(userId, req.params.id, from, to)
    res.status(204).end()
  })

  router.post('/:id/pages', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { page, action } = PageActionSchema.parse(req.body)
    await binders.page(userId, req.params.id, page, action)
    res.status(204).end()
  })

  router.post('/:id/organize', async (req, res) => {
    const { id: userId } = currentUser(res)
    const { by } = OrganizeBinderSchema.parse(req.body)
    res.json({ organized: await binders.organize(userId, req.params.id, by) })
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

    const reservedFor = await binders.reservedCard(userId, req.params.id, position)
    const reserved = reservedFor.card
    // A carta pode entrar em outro idioma que o do binder (mesmo id de carta).
    const language = input.language ?? reservedFor.language
    const card = await cards.get({ lang: language, id: reserved.id })
    const item = await collection.add(
      userId,
      snapshotOf(card, language),
      // Bolso de Master Set já define a variante.
      {
        variant: resolveVariant(card, reserved.variant ?? input.variant),
        condition: input.condition,
      },
      input.quantity,
    )
    await binders.putSlot(userId, req.params.id, position, item.id)
    const wishlistRemoved = await wishlist.fulfill(userId, {
      cardId: item.cardId,
      language: item.language,
      variant: item.variant,
    })
    res.status(201).json({ ...(await collection.item(userId, item.id)), wishlistRemoved })
  })

  router.delete('/:id/slots/:position', async (req, res) => {
    const { id: userId } = currentUser(res)
    const position = BinderPositionSchema.parse(req.params.position)
    await binders.clearSlot(userId, req.params.id, position)
    res.status(204).end()
  })

  return router
}

/** Candidata da busca → bolso reservado (sem o campo `exact`). */
function toTemplateCard(c: SearchCandidate): BinderTemplateCard {
  return { id: c.id, localId: c.localId, name: c.name, imageUrl: c.imageUrl }
}
