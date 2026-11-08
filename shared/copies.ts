/**
 * O que diferencia duas cópias da mesma carta na coleção: variante (impressão) e condição.
 */

/** Versões base, na ordem de preferência (ex.: qual cópia vai primeiro para um binder). */
export const VARIANTS = ['normal', 'reverse', 'holo', 'firstEdition', 'wPromo'] as const
export type BaseVariant = (typeof VARIANTS)[number]

/**
 * Código da variante: `base[~subtipo][:acabamento][@carimbo,carimbo]`, a partir do
 * `variants_detailed` do TCGdex em inglês (os nomes em português vêm traduzidos pela metade, e o
 * código precisa ser o mesmo em qualquer idioma). Exemplos: `normal`, `reverse:pokeball`,
 * `holo:cosmos@player-rewards-program`, `holo~shadowless@1st-edition`.
 */
export type Variant = string

export const VARIANT_PATTERN =
  /^(normal|reverse|holo|firstEdition|wPromo)(~[a-z0-9-]+)?(:[a-z0-9-]+)?(@[a-z0-9-]+(,[a-z0-9-]+)*)?$/

export interface VariantParts {
  base: BaseVariant
  subtype?: string
  foil?: string
  stamps: string[]
}

export function parseVariant(code: Variant): VariantParts {
  const m = VARIANT_PATTERN.exec(code)
  if (!m) return { base: 'normal', stamps: [] }
  return {
    base: m[1] as BaseVariant,
    subtype: m[2]?.slice(1),
    foil: m[3]?.slice(1),
    stamps: m[4] ? m[4].slice(1).split(',') : [],
  }
}

export function variantCode(p: VariantParts): Variant {
  return (
    p.base +
    (p.subtype ? `~${p.subtype}` : '') +
    (p.foil ? `:${p.foil}` : '') +
    (p.stamps.length ? `@${[...p.stamps].sort().join(',')}` : '')
  )
}

/** Impressão especial: acabamento ou carimbo (Grand Master Set). */
export const isSpecialVariant = (code: Variant) => {
  const p = parseVariant(code)
  return Boolean(p.foil) || p.stamps.length > 0
}

const BASE_LABELS: Record<BaseVariant, string> = {
  normal: 'Normal',
  reverse: 'Reverse holo',
  holo: 'Holo',
  firstEdition: '1ª edição',
  wPromo: 'Promo W',
}

const BASE_SHORT: Record<BaseVariant, string> = {
  normal: 'N',
  reverse: 'RH',
  holo: 'H',
  firstEdition: '1ª',
  wPromo: 'W',
}

const FOIL_LABELS: Record<string, string> = {
  pokeball: 'Poké Ball',
  masterball: 'Master Ball',
  cosmos: 'Cosmos',
  league: 'Liga',
  gold: 'Dourada',
}

const STAMP_LABELS: Record<string, string> = {
  '1st-edition': '1ª edição',
  'set-logo': 'logo da coleção',
  'player-rewards-program': 'Player Rewards',
  'pokemon-center': 'Pokémon Center',
  'pokemon-together': 'Pokémon Together',
  'pre-release': 'pré-lançamento',
  '30th-pokeday': 'Pokémon Day 30 anos',
  snowflake: 'floco de neve',
  staff: 'Staff',
}

const SUBTYPE_LABELS: Record<string, string> = {
  shadowless: 'Shadowless',
  unlimited: 'Unlimited',
  '1999-2000-copyright': '© 1999-2000',
}

/** Nome desconhecido: "pokemon-day" → "Pokemon Day". */
const prettify = (slug: string) =>
  slug
    .split('-')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')

/** "Reverse holo · Poké Ball", "Holo · Shadowless · carimbo 1ª edição". */
export function variantLabel(code: Variant) {
  const p = parseVariant(code)
  return [
    BASE_LABELS[p.base],
    p.subtype && (SUBTYPE_LABELS[p.subtype] ?? prettify(p.subtype)),
    p.foil && (FOIL_LABELS[p.foil] ?? prettify(p.foil)),
    p.stamps.length > 0 &&
      `carimbo ${p.stamps.map((s) => STAMP_LABELS[s] ?? prettify(s)).join(', ')}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Selo curto em cima da carta: "RH", "RH·PB", "H★". */
export function variantShort(code: Variant) {
  const p = parseVariant(code)
  const foil = p.foil
    ? (FOIL_LABELS[p.foil] ?? p.foil)
        .split(/[\s-]+/)
        .map((w) => w[0]!.toUpperCase())
        .join('')
    : ''
  return BASE_SHORT[p.base] + (foil ? `·${foil}` : '') + (p.stamps.length ? '★' : '')
}

/** Ordem das variantes: base (normal, reverse, holo…), depois as comuns antes das especiais. */
export function compareVariants(a: Variant, b: Variant) {
  const pa = parseVariant(a)
  const pb = parseVariant(b)
  return (
    VARIANTS.indexOf(pa.base) - VARIANTS.indexOf(pb.base) ||
    Number(isSpecialVariant(a)) - Number(isSpecialVariant(b)) ||
    a.localeCompare(b)
  )
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
    compareVariants(a.variant, b.variant) ||
    CONDITIONS.indexOf(a.condition) - CONDITIONS.indexOf(b.condition)
  )
}
