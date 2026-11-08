import { and, desc, eq, inArray, or } from 'drizzle-orm'
import type { Variant } from '../../shared/copies.js'
import type { Language } from '../../shared/languages.js'
import type { CardDetail, WishlistItem } from '../../shared/schemas.js'
import type { Db } from '../db/client.js'
import { wishlistItems } from '../db/schema.js'

type Row = typeof wishlistItems.$inferSelect

// Mapeamento explícito: '' no banco = qualquer idioma/versão = null na API.
function toItem(r: Row): WishlistItem {
  return {
    id: r.id,
    cardId: r.cardId,
    language: (r.language || null) as Language | null,
    variant: r.variant || null,
    name: r.name,
    imageUrl: r.imageUrl,
    setName: r.setName,
    localId: r.localId,
    createdAt: r.createdAt,
  }
}

/** Toda operação é escopada por `userId`, como a coleção. */
export function createWishlistService(db: Db) {
  return {
    async list(userId: string) {
      const rows = await db
        .select()
        .from(wishlistItems)
        .where(eq(wishlistItems.userId, userId))
        .orderBy(desc(wishlistItems.createdAt), desc(wishlistItems.id))
      return rows.map(toItem)
    },

    /** Adiciona o desejo (se já existir igual, devolve o existente). */
    async add(
      userId: string,
      card: CardDetail,
      wish: { language: Language | null; variant: Variant | null },
    ) {
      const values = {
        userId,
        cardId: card.id,
        language: wish.language ?? '',
        variant: wish.variant ?? '',
        name: card.name,
        imageUrl: card.imageUrl,
        setName: card.set.name,
        localId: card.localId,
      }
      await db.insert(wishlistItems).values(values).onConflictDoNothing()
      const [row] = await db
        .select()
        .from(wishlistItems)
        .where(
          and(
            eq(wishlistItems.userId, userId),
            eq(wishlistItems.cardId, values.cardId),
            eq(wishlistItems.language, values.language),
            eq(wishlistItems.variant, values.variant),
          ),
        )
      return toItem(row!)
    },

    async remove(userId: string, id: number) {
      const rows = await db
        .delete(wishlistItems)
        .where(and(eq(wishlistItems.id, id), eq(wishlistItems.userId, userId)))
        .returning({ id: wishlistItems.id })
      return rows.length > 0
    },

    /**
     * Risca da lista os desejos que uma cópia nova atende: a mesma carta, com idioma e versão
     * iguais aos da cópia ou em aberto ("qualquer"). Devolve quantos saíram.
     */
    async fulfill(userId: string, copy: { cardId: string; language: Language; variant: Variant }) {
      const rows = await db
        .delete(wishlistItems)
        .where(
          and(
            eq(wishlistItems.userId, userId),
            eq(wishlistItems.cardId, copy.cardId),
            inArray(wishlistItems.language, ['', copy.language]),
            or(eq(wishlistItems.variant, ''), eq(wishlistItems.variant, copy.variant)),
          ),
        )
        .returning({ id: wishlistItems.id })
      return rows.length
    },
  }
}

export type WishlistService = ReturnType<typeof createWishlistService>
