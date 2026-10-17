import { z } from 'zod'
import { CONDITIONS, DEFAULT_CONDITION, VARIANTS } from './copies.js'
import { DEFAULT_LANGUAGE, ENABLED_LANGUAGES } from './languages.js'
import { SET_TYPES } from './setTypes.js'

export const MAX_QUANTITY = 9999
export const SEARCH_PAGE_SIZE = 20
/** Bolsos por página do binder (3x3). */
export const POCKETS_PER_PAGE = 9
/** Teto técnico de posições (10 mil páginas); na prática o binder não tem limite. */
export const MAX_BINDER_POSITION = 10_000 * POCKETS_PER_PAGE - 1

export const LanguageSchema = z.enum(ENABLED_LANGUAGES)
export const VariantSchema = z.enum(VARIANTS)
export const ConditionSchema = z.enum(CONDITIONS)
export const SetTypeSchema = z.enum(SET_TYPES)

// ---------- Cartas (TCGdex normalizado) ----------

export const CardSummarySchema = z.object({
  id: z.string(),
  localId: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
})
export type CardSummary = z.infer<typeof CardSummarySchema>

export const CardSearchResponseSchema = z.object({
  items: z.array(CardSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  // A API do TCGdex não retorna total; "hasMore" é inferido pelo tamanho da página.
  hasMore: z.boolean(),
})
export type CardSearchResponse = z.infer<typeof CardSearchResponseSchema>

export const CardDetailSchema = CardSummarySchema.extend({
  language: LanguageSchema,
  imageHighUrl: z.string().nullable(),
  category: z.string().nullable(),
  rarity: z.string().nullable(),
  illustrator: z.string().nullable(),
  hp: z.number().nullable(),
  types: z.array(z.string()),
  description: z.string().nullable(),
  /** Variantes em que a carta foi impressa (nunca vazio). */
  variants: z.array(VariantSchema).min(1),
  /** Só as versões que saem nos boosters (sem carimbos/acabamentos especiais): Master Set. */
  boosterVariants: z.array(VariantSchema).min(1),
  set: z.object({
    id: z.string(),
    name: z.string(),
    logoUrl: z.string().nullable(),
    cardCount: z.number().nullable(),
  }),
})
export type CardDetail = z.infer<typeof CardDetailSchema>

// ---------- Coleções do TCGdex (sets) ----------

export const SetSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  symbolUrl: z.string().nullable(),
  /** Total de cartas, incluindo as secretas. */
  cardCount: z.number().nullable(),
  /** Último número oficial (sem as secretas): Core Set. */
  officialCount: z.number().nullable(),
})
export type SetSummary = z.infer<typeof SetSummarySchema>

export const SetListResponseSchema = z.object({ items: z.array(SetSummarySchema) })

export const SetDetailSchema = SetSummarySchema.extend({
  cards: z.array(CardSummarySchema),
})
export type SetDetail = z.infer<typeof SetDetailSchema>

// ---------- Coleção ----------

export const CollectionItemSchema = z.object({
  id: z.number().int(),
  cardId: z.string(),
  language: LanguageSchema,
  variant: VariantSchema,
  condition: ConditionSchema,
  quantity: z.number().int().min(1),
  name: z.string(),
  imageUrl: z.string().nullable(),
  setId: z.string().nullable(),
  setName: z.string().nullable(),
  localId: z.string().nullable(),
  rarity: z.string().nullable(),
  /** Em quantos binders diferentes esta cópia aparece. */
  binderCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type CollectionItem = z.infer<typeof CollectionItemSchema>

export const CollectionResponseSchema = z.object({
  items: z.array(CollectionItemSchema),
  totals: z.object({
    uniqueCards: z.number().int(),
    totalCards: z.number().int(),
  }),
})
export type CollectionResponse = z.infer<typeof CollectionResponseSchema>

// ---------- Binders ----------

/**
 * Carta reservada para um bolso de binder criado a partir de uma coleção. No Master Set o bolso
 * também é de uma variante (normal/reverse/holo); sem `variant`, qualquer cópia serve.
 */
export const BinderTemplateCardSchema = CardSummarySchema.extend({
  variant: VariantSchema.optional(),
})
export type BinderTemplateCard = z.infer<typeof BinderTemplateCardSchema>

export const BinderSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  language: LanguageSchema,
  /** Coleção de origem; null = binder em branco. */
  set: z.object({ id: z.string(), name: z.string(), logoUrl: z.string().nullable() }).nullable(),
  /** Core ou Master; null em binder em branco e nos criados antes da Sprint 4. */
  setType: SetTypeSchema.nullable(),
  /** Bolsos ocupados. */
  filled: z.number().int(),
  /** Bolsos reservados pela coleção de origem (null em binder em branco). */
  templateSize: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type BinderSummary = z.infer<typeof BinderSummarySchema>

export const BinderListResponseSchema = z.object({ items: z.array(BinderSummarySchema) })

export const BinderSlotSchema = z.object({
  position: z.number().int(),
  item: CollectionItemSchema,
})
export type BinderSlot = z.infer<typeof BinderSlotSchema>

export const BinderDetailSchema = BinderSummarySchema.extend({
  slots: z.array(BinderSlotSchema),
  template: z.array(BinderTemplateCardSchema).nullable(),
})
export type BinderDetail = z.infer<typeof BinderDetailSchema>

export const FillBinderResponseSchema = z.object({ placed: z.number().int() })

// ---------- Usuário ----------

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof UserSchema>

// `user: null` = ninguém logado (resposta 200, não erro).
export const MeResponseSchema = z.object({ user: UserSchema.nullable() })

// ---------- Inputs (validados no servidor, reutilizáveis no cliente) ----------

const QuantitySchema = z.number().int().min(1).max(MAX_QUANTITY)

export const LangQuerySchema = z.object({
  lang: LanguageSchema.default(DEFAULT_LANGUAGE),
})

export const SearchQuerySchema = LangQuerySchema.extend({
  q: z.string().trim().min(2).max(60),
  page: z.coerce.number().int().min(1).max(500).default(1),
})

export const AddToCollectionSchema = z.object({
  cardId: z.string().trim().min(1).max(100),
  language: LanguageSchema.default(DEFAULT_LANGUAGE),
  /** Sem variante, vale a primeira em que a carta foi impressa. */
  variant: VariantSchema.optional(),
  condition: ConditionSchema.default(DEFAULT_CONDITION),
  quantity: QuantitySchema.default(1),
})
export type AddToCollectionInput = z.input<typeof AddToCollectionSchema>

export const CollectionItemIdSchema = z.coerce.number().int().positive()

/** Muda quantidade, variante e/ou condição de uma cópia. */
export const UpdateCollectionItemSchema = z
  .object({
    quantity: QuantitySchema.optional(),
    variant: VariantSchema.optional(),
    condition: ConditionSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Informe quantity, variant ou condition.',
  })
export type UpdateCollectionItemInput = z.infer<typeof UpdateCollectionItemSchema>

const BinderNameSchema = z.string().trim().min(1).max(60)

export const CreateBinderSchema = z.object({
  name: BinderNameSchema,
  language: LanguageSchema.default(DEFAULT_LANGUAGE),
  /** Coleção do TCGdex para usar como molde (opcional). */
  setId: z.string().trim().min(1).max(40).optional(),
  /** Com molde: Core Set (uma de cada carta numerada) ou Master Set (cada versão). */
  setType: SetTypeSchema.default('core'),
  /** Com molde: já coloca nos bolsos as cartas que o usuário tem. */
  fill: z.boolean().default(false),
})
export type CreateBinderInput = z.input<typeof CreateBinderSchema>

export const RenameBinderSchema = z.object({ name: BinderNameSchema })

export const BinderPositionSchema = z.coerce.number().int().min(0).max(MAX_BINDER_POSITION)

/** Adiciona a carta reservada do bolso à coleção e já coloca no bolso. */
export const AddToPocketSchema = z.object({
  variant: VariantSchema.optional(),
  condition: ConditionSchema.default(DEFAULT_CONDITION),
  quantity: QuantitySchema.default(1),
})
export type AddToPocketInput = z.input<typeof AddToPocketSchema>

export const PutSlotSchema = z.object({
  collectionItemId: z.number().int().positive(),
})
