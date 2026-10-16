import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/** Contas. O Google é o único provedor por enquanto; `google_id` é o "sub" estável do Google. */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  googleId: text('google_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
})

/**
 * Sessões de login. `id` é o SHA-256 do token que vai no cookie (o token em si nunca é
 * gravado), então um vazamento do banco não permite se passar por ninguém.
 * `expires_at` em milissegundos desde a época.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
)

/**
 * Itens da coleção de cada usuário.
 *
 * A chave natural é (user_id, card_id, language): a mesma carta em idiomas diferentes
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
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    uniqueIndex('collection_items_user_card_lang_uq').on(t.userId, t.cardId, t.language),
    check('collection_items_quantity_positive', sql`${t.quantity} >= 1`),
  ],
)

export type UserRow = typeof users.$inferSelect
export type CollectionItemRow = typeof collectionItems.$inferSelect
export type NewCollectionItemRow = typeof collectionItems.$inferInsert
