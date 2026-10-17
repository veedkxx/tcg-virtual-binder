import { randomUUID } from 'node:crypto'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { compareCopies } from '../../shared/copies.js'
import type { Language } from '../../shared/languages.js'
import type {
  BinderDetail,
  BinderSummary,
  BinderTemplateCard,
  SetDetail,
} from '../../shared/schemas.js'
import type { Db } from '../db/client.js'
import { binderSlots, binders, collectionItems, type BinderRow } from '../db/schema.js'
import { AppError } from '../errors.js'
import { binderCountSql, toItem } from './collection.js'

const notFound = () => new AppError(404, 'BINDER_NOT_FOUND', 'Binder não encontrado.')

function toSummary(b: BinderRow, filled: number): BinderSummary {
  return {
    id: b.id,
    name: b.name,
    language: b.language as Language,
    set: b.setId ? { id: b.setId, name: b.setName ?? b.setId, logoUrl: b.setLogoUrl } : null,
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
          variant: collectionItems.variant,
          condition: collectionItems.condition,
        })
        .from(collectionItems)
        .where(
          and(
            eq(collectionItems.userId, b.userId),
            eq(collectionItems.language, b.language),
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

    // Com várias cópias da mesma carta, vai a mais comum em melhor estado (normal NM primeiro).
    const itemByCard = new Map<string, number>()
    for (const i of [...items].sort(compareCopies)) {
      if (!itemByCard.has(i.cardId)) itemByCard.set(i.cardId, i.id)
    }
    const takenPositions = new Set(taken.map((t) => t.position))
    const rows = template.flatMap((card, position) => {
      const collectionItemId = itemByCard.get(card.id)
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
    async list(userId: string, language: Language) {
      const rows = await db
        .select({ binder: binders, filled: count(binderSlots.position) })
        .from(binders)
        .leftJoin(binderSlots, eq(binderSlots.binderId, binders.id))
        .where(and(eq(binders.userId, userId), eq(binders.language, language)))
        .groupBy(binders.id)
        .orderBy(desc(binders.updatedAt), desc(binders.createdAt))
      return rows.map((r) => toSummary(r.binder, r.filled))
    },

    async create(
      userId: string,
      input: { name: string; language: Language; set?: SetDetail; fill: boolean },
    ) {
      const template: BinderTemplateCard[] | null = input.set?.cards ?? null
      const [b] = await db
        .insert(binders)
        .values({
          id: randomUUID(),
          userId,
          name: input.name,
          language: input.language,
          setId: input.set?.id ?? null,
          setName: input.set?.name ?? null,
          setLogoUrl: input.set?.logoUrl ?? null,
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

    /** Coloca (ou troca) a carta de um bolso. */
    async putSlot(userId: string, binderId: string, position: number, collectionItemId: number) {
      const b = await owned(userId, binderId)
      const [item] = await db
        .select()
        .from(collectionItems)
        .where(and(eq(collectionItems.id, collectionItemId), eq(collectionItems.userId, userId)))
      if (!item) throw new AppError(404, 'NOT_IN_COLLECTION', 'Essa carta não está na coleção.')
      if (item.language !== b.language) {
        throw new AppError(400, 'WRONG_LANGUAGE', 'A carta é de outro idioma que o do binder.')
      }

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
