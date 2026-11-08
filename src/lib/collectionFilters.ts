import {
  CONDITIONS,
  CONDITION_LABELS,
  VARIANTS,
  VARIANT_LABELS,
  type Condition,
  type Variant,
} from '../../shared/copies'
import { ENABLED_LANGUAGES, LANGUAGE_LABELS, type Language } from '../../shared/languages'
import type { CollectionItem } from '../../shared/schemas'

export type SortKey = 'recent' | 'name' | 'number' | 'set' | 'artist'

export const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Mais recentes',
  name: 'Nome',
  number: 'Coleção e número',
  set: 'Coleção',
  artist: 'Artista',
}

/** Filtros da coleção; vazio = sem filtro. Ficam na URL (?lang=pt&type=Fogo…). */
export interface CollectionFilters {
  q: string
  lang: Language | ''
  set: string
  rarity: string
  type: string
  variant: Variant | ''
  condition: Condition | ''
  artist: string
  sort: SortKey
}

export const FILTER_KEYS = [
  'lang',
  'set',
  'rarity',
  'type',
  'artist',
  'variant',
  'condition',
] as const

export function readFilters(params: URLSearchParams): CollectionFilters {
  const pick = <T extends string>(key: string, allowed: readonly T[]): T | '' => {
    const v = params.get(key) ?? ''
    return (allowed as readonly string[]).includes(v) ? (v as T) : ''
  }
  const sort = params.get('sort')
  return {
    q: params.get('q') ?? '',
    lang: pick('lang', ENABLED_LANGUAGES),
    set: params.get('set') ?? '',
    rarity: params.get('rarity') ?? '',
    type: params.get('type') ?? '',
    variant: pick('variant', VARIANTS),
    condition: pick('condition', CONDITIONS),
    artist: params.get('artist') ?? '',
    sort: sort && sort in SORT_LABELS ? (sort as SortKey) : 'recent',
  }
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Tipo usado no filtro: o tipo do Pokémon ou, para Treinador/Energia, a categoria. */
export function typesOf(item: CollectionItem): string[] {
  if (item.types && item.types.length > 0) return item.types
  return item.category ? [item.category] : []
}

export function matches(item: CollectionItem, f: CollectionFilters) {
  if (f.lang && item.language !== f.lang) return false
  if (f.set && item.setId !== f.set) return false
  if (f.rarity && item.rarity !== f.rarity) return false
  if (f.type && !typesOf(item).includes(f.type)) return false
  if (f.variant && item.variant !== f.variant) return false
  if (f.condition && item.condition !== f.condition) return false
  if (f.artist && item.illustrator !== f.artist) return false
  if (f.q) {
    const text = normalize([item.name, item.setName, item.localId, item.cardId].join(' '))
    if (
      !normalize(f.q.trim())
        .split(/\s+/)
        .every((word) => text.includes(word))
    )
      return false
  }
  return true
}

/** "025" < "100" < "TG01": números primeiro, em ordem numérica. */
const byNumber = (a: string | null, b: string | null) =>
  (a ?? '').localeCompare(b ?? '', 'pt', { numeric: true })

export function sortItems(items: CollectionItem[], sort: SortKey) {
  const sorted = [...items]
  if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  if (sort === 'artist') {
    // Cartas sem artista conhecido vão para o fim.
    sorted.sort(
      (a, b) =>
        Number(!a.illustrator) - Number(!b.illustrator) ||
        (a.illustrator ?? '').localeCompare(b.illustrator ?? '', 'pt') ||
        a.name.localeCompare(b.name, 'pt'),
    )
  }
  if (sort === 'set') {
    sorted.sort((a, b) => (a.setName ?? '').localeCompare(b.setName ?? '', 'pt'))
  }
  if (sort === 'number') {
    sorted.sort(
      (a, b) =>
        (a.setName ?? '').localeCompare(b.setName ?? '', 'pt') || byNumber(a.localId, b.localId),
    )
  }
  // 'recent' mantém a ordem da API (atualizadas por último primeiro).
  return sorted
}

/** Opções de cada filtro, só com o que existe na coleção, e quantas cópias cada uma tem. */
export function filterOptions(items: CollectionItem[]) {
  const count = (values: (string | null)[]) => {
    const m = new Map<string, number>()
    for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1)
    return m
  }
  const sets = new Map<string, string>()
  for (const i of items) if (i.setId) sets.set(i.setId, i.setName ?? i.setId)
  const setCounts = count(items.map((i) => i.setId))
  const byLabel = (a: { label: string }, b: { label: string }) =>
    a.label.localeCompare(b.label, 'pt')

  return {
    lang: [...count(items.map((i) => i.language))]
      .map(([value, n]) => ({ value, label: LANGUAGE_LABELS[value as Language], n }))
      .sort(byLabel),
    set: [...sets]
      .map(([value, label]) => ({ value, label, n: setCounts.get(value) ?? 0 }))
      .sort(byLabel),
    rarity: [...count(items.map((i) => i.rarity))]
      .map(([value, n]) => ({ value, label: value, n }))
      .sort(byLabel),
    type: [...count(items.flatMap(typesOf))]
      .map(([value, n]) => ({ value, label: value, n }))
      .sort(byLabel),
    variant: VARIANTS.filter((v) => items.some((i) => i.variant === v)).map((v) => ({
      value: v,
      label: VARIANT_LABELS[v],
      n: items.filter((i) => i.variant === v).length,
    })),
    condition: CONDITIONS.filter((c) => items.some((i) => i.condition === c)).map((c) => ({
      value: c,
      label: `${c} · ${CONDITION_LABELS[c]}`,
      n: items.filter((i) => i.condition === c).length,
    })),
    artist: [...count(items.map((i) => i.illustrator))]
      .map(([value, n]) => ({ value, label: value, n }))
      .sort(byLabel),
  }
}
