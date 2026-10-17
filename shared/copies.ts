/**
 * O que diferencia duas cópias da mesma carta na coleção: variante (acabamento) e condição.
 */

/** Na ordem de preferência (ex.: qual cópia vai primeiro para um binder). Chaves do TCGdex. */
export const VARIANTS = ['normal', 'reverse', 'holo', 'firstEdition', 'wPromo'] as const
export type Variant = (typeof VARIANTS)[number]

export const VARIANT_LABELS: Record<Variant, string> = {
  normal: 'Normal',
  reverse: 'Reverse holo',
  holo: 'Holo',
  firstEdition: '1ª edição',
  wPromo: 'Promo W',
}

/** Rótulo curto para selos em cima da carta. */
export const VARIANT_SHORT: Record<Variant, string> = {
  normal: 'N',
  reverse: 'RH',
  holo: 'H',
  firstEdition: '1ª',
  wPromo: 'W',
}

/** Da melhor para a pior. */
export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const
export type Condition = (typeof CONDITIONS)[number]

export const DEFAULT_CONDITION: Condition = 'NM'

export const CONDITION_LABELS: Record<Condition, string> = {
  NM: 'Quase nova',
  LP: 'Pouco jogada',
  MP: 'Jogada',
  HP: 'Muito jogada',
  DMG: 'Danificada',
}

/** Ordena cópias: variante mais comum primeiro, depois a melhor condição. */
export function compareCopies(
  a: { variant: Variant; condition: Condition },
  b: { variant: Variant; condition: Condition },
) {
  return (
    VARIANTS.indexOf(a.variant) - VARIANTS.indexOf(b.variant) ||
    CONDITIONS.indexOf(a.condition) - CONDITIONS.indexOf(b.condition)
  )
}
