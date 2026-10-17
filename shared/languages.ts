/**
 * Idiomas das cartas (os códigos são os do TCGdex).
 *
 * Para habilitar outro idioma basta incluí-lo aqui: o TCGdex também tem es, fr, de, it, ja…
 */
export const ENABLED_LANGUAGES = ['pt', 'en'] as const

export type Language = (typeof ENABLED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'pt'

export const LANGUAGE_LABELS: Record<Language, string> = {
  pt: 'Português',
  en: 'Inglês',
}
