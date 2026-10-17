import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import type { Condition, Variant } from '../../shared/copies.js'
import type { BinderTemplateCard } from '../../shared/schemas.js'
import type { SetType } from '../../shared/setTypes.js'

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
 * Cada linha é uma "cópia": a chave natural é (user_id, card_id, language, variant, condition).
 * A mesma carta em outro idioma, outra variante (normal/reverse/holo…) ou outra condição
 * (NM/LP/…) é um item separado, como colecionadores esperam.
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
    variant: text('variant').$type<Variant>().notNull().default('normal'),
    condition: text('condition').$type<Condition>().notNull().default('NM'),
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
    uniqueIndex('collection_items_copy_uq').on(
      t.userId,
      t.cardId,
      t.language,
      t.variant,
      t.condition,
    ),
    check('collection_items_quantity_positive', sql`${t.quantity} >= 1`),
  ],
)

/**
 * Binders do usuário. Um binder pode ser em branco (totalmente livre) ou criado a partir de uma
 * coleção do TCGdex (`set_id`): nesse caso `template` guarda a lista de cartas da coleção na
 * ordem, e o bolso `i` é reservado para a carta `template[i]`. A lista é gravada na criação para
 * o binder abrir sem depender do TCGdex.
 */
export const binders = sqliteTable(
  'binders',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    language: text('language').notNull().default('pt'),
    setId: text('set_id'),
    setName: text('set_name'),
    setLogoUrl: text('set_logo_url'),
    /** core/master; null em binder em branco e nos criados antes da Sprint 4. */
    setType: text('set_type').$type<SetType>(),
    template: text('template', { mode: 'json' }).$type<BinderTemplateCard[]>(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index('binders_user_id_idx').on(t.userId)],
)

/**
 * Bolsos ocupados. Página = floor(position / 9), bolso = position % 9; bolsos vazios não têm
 * linha. Aponta para o item da coleção (não para a carta), então tirar a carta da coleção
 * esvazia os bolsos dela. O mesmo item pode estar em vários bolsos e binders: o binder é uma
 * forma de ver a coleção, não um estoque.
 */
export const binderSlots = sqliteTable(
  'binder_slots',
  {
    binderId: text('binder_id')
      .notNull()
      .references(() => binders.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    collectionItemId: integer('collection_item_id')
      .notNull()
      .references(() => collectionItems.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.binderId, t.position] }),
    index('binder_slots_item_idx').on(t.collectionItemId),
    check('binder_slots_position_range', sql`${t.position} >= 0`),
  ],
)

export type UserRow = typeof users.$inferSelect
export type CollectionItemRow = typeof collectionItems.$inferSelect
export type NewCollectionItemRow = typeof collectionItems.$inferInsert
export type BinderRow = typeof binders.$inferSelect
