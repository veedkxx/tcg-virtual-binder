/**
 * Idiomas das cartas.
 *
 * Sprint 1: somente português.
 */
export const ENABLED_LANGUAGES = ['pt'] as const

export type Language = (typeof ENABLED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'pt'

export const LANGUAGE_LABELS: Record<Language, string> = {
  pt: 'Português',
}
