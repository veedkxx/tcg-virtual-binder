import { and, desc, eq, sql } from 'drizzle-orm'
import type { Condition, Variant } from '../../shared/copies.js'
import type { Language } from '../../shared/languages.js'
import { MAX_QUANTITY } from '../../shared/schemas.js'
import type { CardDetail, CollectionItem, CollectionResponse } from '../../shared/schemas.js'
import type { Db } from '../db/client.js'
import { binderSlots, collectionItems, type CollectionItemRow } from '../db/schema.js'
import { AppError } from '../errors.js'

export interface CardSnapshot {
  cardId: string
  language: Language
  name: string
  imageUrl: string | null
  setId: string | null
  setName: string | null
  localId: string | null
  rarity: string | null
}

/** Snapshot gravado na coleção; sempre a partir do TCGdex (servidor), nunca do cliente. */
export function snapshotOf(card: CardDetail, language: Language): CardSnapshot {
  return {
    cardId: card.id,
    language,
    name: card.name,
    imageUrl: card.imageUrl,
    setId: card.set.id,
    setName: card.set.name,
    localId: card.localId,
    rarity: card.rarity,
  }
}

/** Sem variante pedida, vale a primeira em que a carta foi impressa. */
export function resolveVariant(card: CardDetail, requested: Variant | undefined): Variant {
  const variant = requested ?? card.variants[0]!
  if (!card.variants.includes(variant)) {
    throw new AppError(
      400,
      'VARIANT_NOT_AVAILABLE',
      `${card.name} não foi impressa nessa variante.`,
    )
  }
  return variant
}

/** Em quantos binders distintos o item aparece (subconsulta correlacionada). */
export const binderCountSql = sql<number>`(
  select count(distinct ${binderSlots.binderId}) from ${binderSlots}
  where ${binderSlots.collectionItemId} = ${collectionItems.id}
)`.mapWith(Number)

// Mapeamento explícito: o user_id nunca sai na resposta da API.
export function toItem(r: CollectionItemRow, binderCount: number): CollectionItem {
  return {
    id: r.id,
    cardId: r.cardId,
    language: r.language as Language,
    variant: r.variant,
    condition: r.condition,
    quantity: r.quantity,
    name: r.name,
    imageUrl: r.imageUrl,
    setId: r.setId,
    setName: r.setName,
    localId: r.localId,
    rarity: r.rarity,
    binderCount,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

/** Toda operação é escopada por `userId`: um usuário nunca enxerga nem altera itens de outro. */
export function createCollectionService(db: Db) {
  const byId = (userId: string, id: number) =>
    and(eq(collectionItems.id, id), eq(collectionItems.userId, userId))

  async function withBinderCount(row: CollectionItemRow) {
    const [r] = await db
      .select({ binderCount: binderCountSql })
      .from(collectionItems)
      .where(eq(collectionItems.id, row.id))
    return toItem(row, r?.binderCount ?? 0)
  }

  return {
    async list(userId: string, language: Language): Promise<CollectionResponse> {
      const rows = await db
        .select({ row: collectionItems, binderCount: binderCountSql })
        .from(collectionItems)
        .where(and(eq(collectionItems.userId, userId), eq(collectionItems.language, language)))
        .orderBy(desc(collectionItems.updatedAt), desc(collectionItems.id))

      const items = rows.map((r) => toItem(r.row, r.binderCount))
      return {
        items,
        totals: {
          uniqueCards: new Set(items.map((i) => i.cardId)).size,
          totalCards: items.reduce((sum, i) => sum + i.quantity, 0),
        },
      }
    },

    async get(userId: string, id: number) {
      const [row] = await db.select().from(collectionItems).where(byId(userId, id))
      return row ?? null
    },

    /** A cópia como a API devolve (com binderCount). */
    async item(userId: string, id: number) {
      const row = await this.get(userId, id)
      return row ? withBinderCount(row) : null
    },

    /** Insere a cópia ou soma a quantidade se ela já estiver na coleção (atômico). */
    async add(
      userId: string,
      card: CardSnapshot,
      copy: { variant: Variant; condition: Condition },
      quantity: number,
    ) {
      const [row] = await db
        .insert(collectionItems)
        .values({ ...card, ...copy, userId, quantity })
        .onConflictDoUpdate({
          target: [
            collectionItems.userId,
            collectionItems.cardId,
            collectionItems.language,
            collectionItems.variant,
            collectionItems.condition,
          ],
          set: {
            quantity: sql`min(${collectionItems.quantity} + ${quantity}, ${MAX_QUANTITY})`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning()
      return withBinderCount(row!)
    },

    /**
     * Muda quantidade, variante e/ou condição de uma cópia. Se a mudança cair numa cópia que
     * já existe (mesma carta, idioma, variante e condição), as duas viram uma só: as
     * quantidades somam e os bolsos de binder passam para a cópia que fica.
     * Retorna null se a cópia não é do usuário.
     */
    async update(
      userId: string,
      id: number,
      patch: { quantity?: number; variant?: Variant; condition?: Condition },
    ) {
      return db
        .transaction(async (tx) => {
          const [item] = await tx.select().from(collectionItems).where(byId(userId, id))
          if (!item) return null

          const variant = patch.variant ?? item.variant
          const condition = patch.condition ?? item.condition
          const quantity = patch.quantity ?? item.quantity

          const [twin] = await tx
            .select()
            .from(collectionItems)
            .where(
              and(
                eq(collectionItems.userId, userId),
                eq(collectionItems.cardId, item.cardId),
                eq(collectionItems.language, item.language),
                eq(collectionItems.variant, variant),
                eq(collectionItems.condition, condition),
              ),
            )

          if (twin && twin.id !== item.id) {
            // Os bolsos que mostravam a cópia antiga passam a mostrar a que fica.
            await tx
              .update(binderSlots)
              .set({ collectionItemId: twin.id })
              .where(eq(binderSlots.collectionItemId, item.id))
            await tx.delete(collectionItems).where(eq(collectionItems.id, item.id))
            const [merged] = await tx
              .update(collectionItems)
              .set({
                quantity: Math.min(twin.quantity + quantity, MAX_QUANTITY),
                updatedAt: sql`CURRENT_TIMESTAMP`,
              })
              .where(eq(collectionItems.id, twin.id))
              .returning()
            return merged!
          }

          const [updated] = await tx
            .update(collectionItems)
            .set({ variant, condition, quantity, updatedAt: sql`CURRENT_TIMESTAMP` })
            .where(eq(collectionItems.id, item.id))
            .returning()
          return updated!
        })
        .then((row) => (row ? withBinderCount(row) : null))
    },

    /** Retorna true se algo foi removido. */
    async remove(userId: string, id: number) {
      const rows = await db
        .delete(collectionItems)
        .where(byId(userId, id))
        .returning({ id: collectionItems.id })
      return rows.length > 0
    },
  }
}

export type CollectionService = ReturnType<typeof createCollectionService>
