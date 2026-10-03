import { and, desc, eq, sql } from 'drizzle-orm'
import type { Language } from '../../shared/languages.js'
import { MAX_QUANTITY } from '../../shared/schemas.js'
import type { CollectionResponse } from '../../shared/schemas.js'
import type { Db } from '../db/client.js'
import { collectionItems } from '../db/schema.js'

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

export function createCollectionService(db: Db) {
  const key = (cardId: string, language: Language) =>
    and(eq(collectionItems.cardId, cardId), eq(collectionItems.language, language))

  return {
    async list(language: Language): Promise<CollectionResponse> {
      const rows = await db
        .select()
        .from(collectionItems)
        .where(eq(collectionItems.language, language))
        .orderBy(desc(collectionItems.updatedAt), desc(collectionItems.id))

      const items = rows.map((r) => ({ ...r, language: r.language as Language }))
      return {
        items,
        totals: {
          uniqueCards: items.length,
          totalCards: items.reduce((sum, i) => sum + i.quantity, 0),
        },
      }
    },

    /** Insere a carta ou soma a quantidade se ela já estiver na coleção (atômico). */
    async add(card: CardSnapshot, quantity: number) {
      const [row] = await db
        .insert(collectionItems)
        .values({ ...card, quantity })
        .onConflictDoUpdate({
          target: [collectionItems.cardId, collectionItems.language],
          set: {
            quantity: sql`min(${collectionItems.quantity} + ${quantity}, ${MAX_QUANTITY})`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning()
      return { ...row!, language: row!.language as Language }
    },

    /** Define a quantidade exata. Retorna null se a carta não está na coleção. */
    async setQuantity(cardId: string, language: Language, quantity: number) {
      const [row] = await db
        .update(collectionItems)
        .set({ quantity, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(key(cardId, language))
        .returning()
      return row ? { ...row, language: row.language as Language } : null
    },

    /** Retorna true se algo foi removido. */
    async remove(cardId: string, language: Language) {
      const rows = await db.delete(collectionItems).where(key(cardId, language)).returning({
        id: collectionItems.id,
      })
      return rows.length > 0
    },
  }
}

export type CollectionService = ReturnType<typeof createCollectionService>
