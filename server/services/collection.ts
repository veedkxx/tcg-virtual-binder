import { and, desc, eq, sql } from 'drizzle-orm'
import type { Language } from '../../shared/languages.js'
import { MAX_QUANTITY } from '../../shared/schemas.js'
import type { CollectionItem, CollectionResponse } from '../../shared/schemas.js'
import type { Db } from '../db/client.js'
import { binderSlots, collectionItems, type CollectionItemRow } from '../db/schema.js'

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
  const key = (userId: string, cardId: string, language: Language) =>
    and(
      eq(collectionItems.userId, userId),
      eq(collectionItems.cardId, cardId),
      eq(collectionItems.language, language),
    )

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
          uniqueCards: items.length,
          totalCards: items.reduce((sum, i) => sum + i.quantity, 0),
        },
      }
    },

    /** Insere a carta ou soma a quantidade se ela já estiver na coleção (atômico). */
    async add(userId: string, card: CardSnapshot, quantity: number) {
      const [row] = await db
        .insert(collectionItems)
        .values({ ...card, userId, quantity })
        .onConflictDoUpdate({
          target: [collectionItems.userId, collectionItems.cardId, collectionItems.language],
          set: {
            quantity: sql`min(${collectionItems.quantity} + ${quantity}, ${MAX_QUANTITY})`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning()
      return withBinderCount(row!)
    },

    /** Define a quantidade exata. Retorna null se a carta não está na coleção do usuário. */
    async setQuantity(userId: string, cardId: string, language: Language, quantity: number) {
      const [row] = await db
        .update(collectionItems)
        .set({ quantity, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(key(userId, cardId, language))
        .returning()
      return row ? withBinderCount(row) : null
    },

    /** Retorna true se algo foi removido. */
    async remove(userId: string, cardId: string, language: Language) {
      const rows = await db
        .delete(collectionItems)
        .where(key(userId, cardId, language))
        .returning({ id: collectionItems.id })
      return rows.length > 0
    },
  }
}

export type CollectionService = ReturnType<typeof createCollectionService>
