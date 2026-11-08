/**
 * Idiomas das cartas (os códigos são os do TCGdex).
 *
 * Os idiomas europeus usam os mesmos ids de carta (sv09-001 em pt, en, es…), então a mesma carta
 * em idiomas diferentes cabe no mesmo bolso de binder. Japonês fica de fora por enquanto: ids de
 * coleção próprios, busca só pelo nome em japonês e ~80% das cartas sem imagem no TCGdex.
 */
export const ENABLED_LANGUAGES = ['pt', 'en', 'es', 'fr', 'de', 'it'] as const

export type Language = (typeof ENABLED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'pt'

export const LANGUAGE_LABELS: Record<Language, string> = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
}
