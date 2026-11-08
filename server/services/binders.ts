import { randomUUID } from 'node:crypto'
import { and, asc, count, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { compareCopies, variantLabel } from '../../shared/copies.js'
import type { Language } from '../../shared/languages.js'
import type {
  BinderDetail,
  BinderSummary,
  BinderTemplateCard,
  BinderSearch,
  SetSummary,
} from '../../shared/schemas.js'
import type { SetType } from '../../shared/setTypes.js'
import type { Db } from '../db/client.js'
import { binderSlots, binders, collectionItems, type BinderRow } from '../db/schema.js'
import { AppError } from '../errors.js'
import { binderCountSql, toItem } from './collection.js'

/** Deslocamento temporário ao renumerar bolsos (acima de qualquer posição válida). */
const SHIFT = 1_000_000

const notFound = () => new AppError(404, 'BINDER_NOT_FOUND', 'Binder não encontrado.')

function toSummary(b: BinderRow, filled: number): BinderSummary {
  return {
    id: b.id,
    name: b.name,
    language: b.language as Language,
    set: b.setId ? { id: b.setId, name: b.setName ?? b.setId, logoUrl: b.setLogoUrl } : null,
    setType: b.setType ?? null,
    search: b.search ?? null,
    filled,
    templateSize: b.template?.length ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }
}

/** Toda operação é escopada por `userId`, como a coleção. */
export function createBindersService(db: Db) {
  async function owned(userId: string, binderId: string) {
    const [b] = await db
      .select()
      .from(binders)
      .where(and(eq(binders.id, binderId), eq(binders.userId, userId)))
    if (!b) throw notFound()
    return b
  }

  const touch = (binderId: string) =>
    db
      .update(binders)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(binders.id, binderId))

  /** Coloca cada carta do molde que o usuário tem no bolso reservado, sem mexer nos ocupados. */
  async function fillFromCollection(b: BinderRow) {
    const template = b.template
    if (!template) {
      throw new AppError(
        400,
        'BINDER_HAS_NO_SET',
        'Só binders de uma coleção podem ser preenchidos.',
      )
    }

    const [items, taken] = await Promise.all([
      db
        .select({
          id: collectionItems.id,
          cardId: collectionItems.cardId,
          language: collectionItems.language,
          variant: collectionItems.variant,
          condition: collectionItems.condition,
        })
        .from(collectionItems)
        .where(
          and(
            eq(collectionItems.userId, b.userId),
            inArray(
              collectionItems.cardId,
              template.map((c) => c.id),
            ),
          ),
        ),
      db
        .select({ position: binderSlots.position })
        .from(binderSlots)
        .where(eq(binderSlots.binderId, b.id)),
    ])

    // Com várias cópias da mesma carta, vai a do idioma do binder, depois a mais comum em melhor
    // estado (normal NM primeiro). Bolso com variante (Master Set) só aceita aquela variante.
    const sameLanguageFirst = (a: { language: string }, b2: { language: string }) =>
      Number(a.language !== b.language) - Number(b2.language !== b.language)
    const itemByKey = new Map<string, number>()
    for (const i of [...items].sort((x, y) => sameLanguageFirst(x, y) || compareCopies(x, y))) {
      for (const key of [i.cardId, `${i.cardId}|${i.variant}`]) {
        if (!itemByKey.has(key)) itemByKey.set(key, i.id)
      }
    }
    const takenPositions = new Set(taken.map((t) => t.position))
    const rows = template.flatMap((card, position) => {
      const collectionItemId = itemByKey.get(card.variant ? `${card.id}|${card.variant}` : card.id)
      return collectionItemId && !takenPositions.has(position)
        ? [{ binderId: b.id, position, collectionItemId }]
        : []
    })

    if (rows.length > 0) {
      await db.insert(binderSlots).values(rows).onConflictDoNothing()
      await touch(b.id)
    }
    return rows.length
  }

  return {
    /** Sem idioma, todos os binders. */
    async list(userId: string, language?: Language) {
      const rows = await db
        .select({ binder: binders, filled: count(binderSlots.position) })
        .from(binders)
        .leftJoin(binderSlots, eq(binderSlots.binderId, binders.id))
        .where(
          and(eq(binders.userId, userId), language ? eq(binders.language, language) : undefined),
        )
        .groupBy(binders.id)
        .orderBy(desc(binders.updatedAt), desc(binders.createdAt))
      return rows.map((r) => toSummary(r.binder, r.filled))
    },

    /** `set` e `template` vêm juntos (binder de coleção) ou nenhum dos dois (binder em branco). */
    async create(
      userId: string,
      input: {
        name: string
        language: Language
        set?: { summary: SetSummary; type: SetType; template: BinderTemplateCard[] }
        /** Binder por Pokémon/artista: as cartas escolhidas e as que ficaram de fora. */
        search?: { search: BinderSearch; template: BinderTemplateCard[]; excluded: string[] }
        fill: boolean
      },
    ) {
      const template = input.set?.template ?? input.search?.template ?? null
      const [b] = await db
        .insert(binders)
        .values({
          id: randomUUID(),
          userId,
          name: input.name,
          language: input.language,
          setId: input.set?.summary.id ?? null,
          setName: input.set?.summary.name ?? null,
          setLogoUrl: input.set?.summary.logoUrl ?? null,
          setType: input.set?.type ?? null,
          search: input.search?.search ?? null,
          excluded: input.search?.excluded ?? null,
          template,
        })
        .returning()

      const filled = template && input.fill ? await fillFromCollection(b!) : 0
      return toSummary(b!, filled)
    },

    async get(userId: string, binderId: string): Promise<BinderDetail> {
      const b = await owned(userId, binderId)
      const rows = await db
        .select({
          position: binderSlots.position,
          item: collectionItems,
          binderCount: binderCountSql,
        })
        .from(binderSlots)
        .innerJoin(collectionItems, eq(collectionItems.id, binderSlots.collectionItemId))
        .where(eq(binderSlots.binderId, b.id))
        .orderBy(asc(binderSlots.position))

      return {
        ...toSummary(b, rows.length),
        slots: rows.map((r) => ({
          position: r.position,
          item: toItem(r.item, r.binderCount),
        })),
        template: b.template,
      }
    },

    async rename(userId: string, binderId: string, name: string) {
      await owned(userId, binderId)
      await db
        .update(binders)
        .set({ name, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(binders.id, binderId))
    },

    async remove(userId: string, binderId: string) {
      await owned(userId, binderId)
      await db.delete(binders).where(eq(binders.id, binderId))
    },

    /** A carta que o molde reserva para o bolso (só em binder de coleção). */
    /** O binder com molde (coleção ou busca), para quem precisa das cartas e da busca de origem. */
    async withTemplate(userId: string, binderId: string) {
      const b = await owned(userId, binderId)
      if (!b.template) {
        throw new AppError(400, 'BINDER_HAS_NO_SET', 'Esse binder não tem cartas reservadas.')
      }
      return { ...b, template: b.template }
    },

    /**
     * Tira uma carta do molde: o bolso some e os seguintes andam uma posição para trás, levando
     * junto as cartas já colocadas. A carta fica como removida (não volta em "cartas novas").
     */
    async removeReserved(userId: string, binderId: string, position: number) {
      const b = await this.withTemplate(userId, binderId)
      const removed = b.template[position]
      if (!removed) {
        throw new AppError(400, 'POSITION_OUT_OF_SET', 'Esse bolso não existe neste binder.')
      }
      const template = b.template.filter((_, i) => i !== position)
      const excluded = [...new Set([...(b.excluded ?? []), removed.id])]

      await db.transaction(async (tx) => {
        await tx
          .delete(binderSlots)
          .where(and(eq(binderSlots.binderId, b.id), eq(binderSlots.position, position)))
        // Em duas etapas: subtrair 1 direto bateria na chave (binder, posição) no meio do caminho.
        const after = and(eq(binderSlots.binderId, b.id), gt(binderSlots.position, position))
        await tx
          .update(binderSlots)
          .set({ position: sql`${binderSlots.position} + ${SHIFT}` })
          .where(after)
        await tx
          .update(binderSlots)
          .set({ position: sql`${binderSlots.position} - ${SHIFT + 1}` })
          .where(and(eq(binderSlots.binderId, b.id), gt(binderSlots.position, SHIFT)))
        await tx
          .update(binders)
          .set({ template, excluded, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(binders.id, b.id))
      })
      return { removed, templateSize: template.length }
    },

    /** Acrescenta cartas no fim do molde (cartas novas da busca); deixam de contar como removidas. */
    async appendCards(userId: string, binderId: string, cards: BinderTemplateCard[]) {
      const b = await this.withTemplate(userId, binderId)
      const present = new Set(b.template.map((c) => c.id))
      const added = cards.filter((c) => !present.has(c.id))
      const ids = new Set(added.map((c) => c.id))
      await db
        .update(binders)
        .set({
          template: [...b.template, ...added],
          excluded: (b.excluded ?? []).filter((id) => !ids.has(id)),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(binders.id, b.id))
      return added.length
    },

    async reservedCard(userId: string, binderId: string, position: number) {
      const b = await owned(userId, binderId)
      if (!b.template) {
        throw new AppError(400, 'BINDER_HAS_NO_SET', 'Esse binder não tem cartas reservadas.')
      }
      const card = b.template[position]
      if (!card)
        throw new AppError(400, 'POSITION_OUT_OF_SET', 'Esse bolso não existe neste binder.')
      return { language: b.language as Language, card }
    },

    /** Coloca (ou troca) a carta de um bolso. */
    async putSlot(userId: string, binderId: string, position: number, collectionItemId: number) {
      const b = await owned(userId, binderId)
      const [item] = await db
        .select()
        .from(collectionItems)
        .where(and(eq(collectionItems.id, collectionItemId), eq(collectionItems.userId, userId)))
      if (!item) throw new AppError(404, 'NOT_IN_COLLECTION', 'Essa carta não está na coleção.')

      if (b.template) {
        const reserved = b.template[position]
        if (!reserved) {
          throw new AppError(400, 'POSITION_OUT_OF_SET', 'Esse bolso não existe neste binder.')
        }
        if (reserved.id !== item.cardId) {
          throw new AppError(
            400,
            'WRONG_CARD_FOR_POCKET',
            `Esse bolso é da carta ${reserved.name} (#${reserved.localId}).`,
          )
        }
        if (reserved.variant && reserved.variant !== item.variant) {
          throw new AppError(
            400,
            'WRONG_VARIANT_FOR_POCKET',
            `Esse bolso é da versão ${variantLabel(reserved.variant)} de ${reserved.name}.`,
          )
        }
      }

      await db
        .insert(binderSlots)
        .values({ binderId, position, collectionItemId })
        .onConflictDoUpdate({
          target: [binderSlots.binderId, binderSlots.position],
          set: { collectionItemId },
        })
      await touch(binderId)
    },

    async clearSlot(userId: string, binderId: string, position: number) {
      await owned(userId, binderId)
      const removed = await db
        .delete(binderSlots)
        .where(and(eq(binderSlots.binderId, binderId), eq(binderSlots.position, position)))
        .returning({ position: binderSlots.position })
      if (removed.length === 0) throw new AppError(404, 'POCKET_EMPTY', 'Esse bolso já está vazio.')
      await touch(binderId)
    },

    async fill(userId: string, binderId: string) {
      return fillFromCollection(await owned(userId, binderId))
    },
  }
}

export type BindersService = ReturnType<typeof createBindersService>
