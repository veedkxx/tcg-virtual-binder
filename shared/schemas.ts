import { z } from 'zod'
import { DEFAULT_LANGUAGE, ENABLED_LANGUAGES } from './languages.js'

export const MAX_QUANTITY = 9999
export const SEARCH_PAGE_SIZE = 20

export const LanguageSchema = z.enum(ENABLED_LANGUAGES)

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
  set: z.object({
    id: z.string(),
    name: z.string(),
    logoUrl: z.string().nullable(),
    cardCount: z.number().nullable(),
  }),
})
export type CardDetail = z.infer<typeof CardDetailSchema>

// ---------- Coleção ----------

export const CollectionItemSchema = z.object({
  id: z.number().int(),
  cardId: z.string(),
  language: LanguageSchema,
  quantity: z.number().int().min(1),
  name: z.string(),
  imageUrl: z.string().nullable(),
  setId: z.string().nullable(),
  setName: z.string().nullable(),
  localId: z.string().nullable(),
  rarity: z.string().nullable(),
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
  quantity: QuantitySchema.default(1),
})
export type AddToCollectionInput = z.input<typeof AddToCollectionSchema>

export const SetQuantitySchema = z.object({
  quantity: QuantitySchema,
})
