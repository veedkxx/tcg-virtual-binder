import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { CardImage } from '@/components/CardImage'
import { CollectionTabs } from '@/components/CollectionTabs'
import { CopyBadges, LanguageBadge } from '@/components/CopyControls'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCollection,
  useRemoveCollectionItem,
  useUpdateCollectionItem,
} from '@/hooks/useCollection'
import {
  FILTER_KEYS,
  SORT_LABELS,
  filterOptions,
  matches,
  readFilters,
  sortItems,
  type SortKey,
} from '@/lib/collectionFilters'
import { cn } from '@/lib/utils'

const FILTER_LABELS: Record<(typeof FILTER_KEYS)[number], string> = {
  lang: 'Idioma',
  set: 'Coleção',
  rarity: 'Raridade',
  type: 'Tipo',
  artist: 'Artista',
  variant: 'Variante',
  condition: 'Condição',
}

export function CollectionPage() {
  const collection = useCollection()
  const update = useUpdateCollectionItem()
  const remove = useRemoveCollectionItem()

  // Filtros na URL: voltar da página da carta mantém a busca, e dá para compartilhar o link.
  const [params, setParams] = useSearchParams()
  // O texto digitado fica no estado (resposta imediata); a URL é atualizada junto.
  const [q, setQ] = useState(() => params.get('q') ?? '')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filters = { ...readFilters(params), q }
  // Parte sempre da URL atual: o React Router aplica a navegação em transição, e duas mudanças
  // seguidas a partir de `params` (ainda o valor antigo) fariam a segunda apagar a primeira.
  const updateUrl = (change: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(window.location.search)
    change(next)
    setParams(next, { replace: true })
  }
  const setFilter = (key: string, value: string) => {
    if (key === 'q') setQ(value)
    updateUrl((p) => (value ? p.set(key, value) : p.delete(key)))
  }
  const activeCount = FILTER_KEYS.filter((k) => filters[k]).length + (q ? 1 : 0)

  const all = useMemo(() => collection.data?.items ?? [], [collection.data])
  const options = useMemo(() => filterOptions(all), [all])
  const visible = useMemo(
    () =>
      sortItems(
        all.filter((i) => matches(i, filters)),
        filters.sort,
      ),
    // `filters` é recriado a cada render a partir da URL e do texto; estes são as dependências.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, params, q],
  )

  if (collection.isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (collection.isError) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-sm text-destructive">{collection.error.message}</p>
        <Button variant="outline" onClick={() => collection.refetch()}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  const { totals } = collection.data

  if (all.length === 0) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Sua coleção ainda está vazia.</p>
        <Button asChild>
          <Link to="/">Buscar cartas</Link>
        </Button>
      </div>
    )
  }

  const shownCards = visible.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div className="space-y-5">
      <CollectionTabs />
      <div>
        <h1 className="text-2xl font-bold">Minha coleção</h1>
        <p className="text-sm text-muted-foreground">
          {totals.totalCards} {totals.totalCards === 1 ? 'carta' : 'cartas'} · {totals.uniqueCards}{' '}
          {totals.uniqueCards === 1 ? 'diferente' : 'diferentes'}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
              placeholder="Filtrar por nome, coleção ou número"
              className="pl-9"
              aria-label="Filtrar por nome, coleção ou número"
            />
          </div>
          {/* No celular os filtros ficam recolhidos; no desktop, sempre à mostra. */}
          <Button
            variant="outline"
            className="sm:hidden"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <SlidersHorizontal />
            Filtros
            {activeCount - (q ? 1 : 0) > 0 && (
              <span className="tabular-nums">({activeCount - (q ? 1 : 0)})</span>
            )}
          </Button>
        </div>
        <div
          className={cn(
            'grid-cols-2 gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-8',
            filtersOpen ? 'grid' : 'hidden',
          )}
        >
          {FILTER_KEYS.map((key) => (
            <FilterSelect
              key={key}
              label={FILTER_LABELS[key]}
              value={filters[key]}
              options={options[key]}
              onChange={(v) => setFilter(key, v)}
            />
          ))}
          <label className="grid gap-1 text-xs text-muted-foreground">
            Ordenar
            <select
              value={filters.sort}
              onChange={(e) => setFilter('sort', e.target.value === 'recent' ? '' : e.target.value)}
              className={selectClass}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {activeCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {visible.length} {visible.length === 1 ? 'cópia' : 'cópias'} ({shownCards}{' '}
              {shownCards === 1 ? 'carta' : 'cartas'})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ('')
                updateUrl((p) => [...FILTER_KEYS, 'q'].forEach((k) => p.delete(k)))
              }}
            >
              <X /> Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma cópia com esses filtros.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {visible.map((item) => (
            <li key={item.id} className="flex items-center gap-4 p-3">
              <Link to={`/cards/${encodeURIComponent(item.cardId)}`} className="w-16 shrink-0">
                <CardImage src={item.imageUrl} alt={item.name} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/cards/${encodeURIComponent(item.cardId)}`}
                  className="block truncate font-medium hover:underline"
                >
                  {item.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {[item.setName, item.localId && `#${item.localId}`, item.rarity]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <LanguageBadge language={item.language} />
                  <CopyBadges variant={item.variant} condition={item.condition} />
                </div>
                {item.binderCount > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Em {item.binderCount} {item.binderCount === 1 ? 'binder' : 'binders'}
                  </p>
                )}
              </div>
              <QuantityStepper
                value={item.quantity}
                onChange={(quantity) => update.mutate({ id: item.id, patch: { quantity } })}
                confirmRemove={{
                  cardName: item.name,
                  onConfirm: () => remove.mutate({ id: item.id, name: item.name }),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const selectClass =
  'h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring'

function FilterSelect(props: {
  label: string
  value: string
  options: { value: string; label: string; n: number }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {props.label}
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.options.length === 0}
        className={selectClass}
      >
        <option value="">Todos</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({o.n})
          </option>
        ))}
      </select>
    </label>
  )
}
