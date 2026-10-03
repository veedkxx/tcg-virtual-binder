import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Itens da coleção (usuário único na sprint 1).
 *
 * A chave natural é (card_id, language): a mesma carta em idiomas diferentes
 * são itens distintos, como colecionadores esperam. Variantes (normal/holo/reverse)
 * entrarão depois como uma coluna `variant` incluída nessa unicidade.
 *
 * name/image/set/rarity são um snapshot da carta, para listar a coleção sem
 * depender da API externa a cada abertura.
 */
export const collectionItems = sqliteTable(
  'collection_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cardId: text('card_id').notNull(),
    language: text('language').notNull().default('pt'),
    quantity: integer('quantity').notNull().default(1),
    name: text('name').notNull(),
    imageUrl: text('image_url'),
    setId: text('set_id'),
    setName: text('set_name'),
    localId: text('local_id'),
    rarity: text('rarity'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    uniqueIndex('collection_items_card_lang_uq').on(t.cardId, t.language),
    check('collection_items_quantity_positive', sql`${t.quantity} >= 1`),
  ],
)

export type CollectionItemRow = typeof collectionItems.$inferSelect
export type NewCollectionItemRow = typeof collectionItems.$inferInsert
