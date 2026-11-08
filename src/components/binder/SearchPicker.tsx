import { useEffect, useState } from 'react'
import { Check, Search } from 'lucide-react'
import type { BinderSearch, SearchField, SearchSort } from '../../../shared/schemas'
import { CardImage } from '@/components/CardImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useIllustrators, useSearchCandidates } from '@/hooks/useBinders'
import { cn } from '@/lib/utils'

const SORT_LABELS: Record<SearchSort, string> = {
  oldest: 'Mais antigas primeiro',
  newest: 'Mais novas primeiro',
  name: 'Por nome',
}

interface Props {
  /** Busca feita (null = ainda não buscou). */
  search: BinderSearch | null
  onSearch: (search: BinderSearch) => void
  selected: Set<string>
  onSelectedChange: (selected: Set<string>) => void
}

/**
 * Monta um binder a partir de uma busca: por Pokémon (todas as variações do nome) ou por artista.
 * Todas as cartas encontradas vêm marcadas; o usuário desmarca as que não quer.
 */
export function SearchPicker({ search, onSearch, selected, onSelectedChange }: Props) {
  const [field, setField] = useState<SearchField>(search?.field ?? 'name')
  const [query, setQuery] = useState(search?.query ?? '')
  const [sort, setSort] = useState<SearchSort>(search?.sort ?? 'oldest')
  const illustrators = useIllustrators(field === 'illustrator')
  const candidates = useSearchCandidates(search)

  // Resultado novo (outra busca ou outra ordem): tudo marcado, como combinado. Em efeito, e não
  // durante a renderização, porque a seleção é estado do componente pai.
  const resultIds = candidates.data?.items.map((c) => c.id)
  const resultKey = resultIds ? `${JSON.stringify(search)}|${resultIds.length}` : null
  useEffect(() => {
    if (resultKey && resultIds) onSelectedChange(new Set(resultIds))
    // Só quando o resultado muda; `resultIds`/`onSelectedChange` são recriados a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey])

  const run = (next: Partial<BinderSearch> = {}) => {
    const q = (next.query ?? query).trim()
    if (q.length < 2) return
    onSearch({ field: next.field ?? field, query: q, sort: next.sort ?? sort })
  }

  const items = candidates.data?.items ?? []
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Buscar por">
        {(['name', 'illustrator'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={field === f}
            onClick={() => setField(f)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
              field === f &&
                'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {f === 'name' ? 'Pokémon' : 'Artista'}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter busca em vez de enviar o formulário do binder.
              if (e.key === 'Enter') {
                e.preventDefault()
                run()
              }
            }}
            list={field === 'illustrator' ? 'illustrators' : undefined}
            placeholder={field === 'name' ? 'Ex.: Pikachu' : 'Ex.: Mitsuhiro Arita'}
            className="pl-9"
            aria-label={field === 'name' ? 'Nome do Pokémon' : 'Nome do artista'}
          />
          {field === 'illustrator' && (
            <datalist id="illustrators">
              {illustrators.data?.items.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => run()}
          disabled={query.trim().length < 2}
        >
          Buscar
        </Button>
      </div>

      <label className="grid gap-1 text-xs text-muted-foreground">
        Ordem das cartas no binder
        <select
          value={sort}
          onChange={(e) => {
            const next = e.target.value as SearchSort
            setSort(next)
            if (search) run({ sort: next })
          }}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {(Object.keys(SORT_LABELS) as SearchSort[]).map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      {search && (
        <div className="grid gap-2">
          {candidates.isPending ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="aspect-[63/88] w-full" />
              ))}
            </div>
          ) : candidates.isError ? (
            <p className="text-sm text-destructive">{candidates.error.message}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma carta encontrada para “{search.query}”.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="mr-auto text-muted-foreground tabular-nums">
                  {selected.size} de {items.length} marcadas
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelectedChange(new Set(items.map((c) => c.id)))}
                >
                  Marcar todas
                </Button>
                {search.field === 'name' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onSelectedChange(new Set(items.filter((c) => c.exact).map((c) => c.id)))
                    }
                  >
                    Só “{search.query}”
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelectedChange(new Set())}
                >
                  Desmarcar todas
                </Button>
              </div>
              <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto rounded-lg border p-2 sm:grid-cols-6">
                {items.map((c) => {
                  const on = selected.has(c.id)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      aria-pressed={on}
                      title={`${c.name} · ${c.id}`}
                      className="group relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <CardImage
                        src={c.imageUrl}
                        alt={c.name}
                        className={cn('transition-opacity', !on && 'opacity-30 grayscale')}
                      />
                      <span
                        className={cn(
                          'absolute right-1 top-1 flex size-5 items-center justify-center rounded border bg-background/90 shadow',
                          on && 'border-primary bg-primary text-primary-foreground',
                        )}
                      >
                        {on && <Check className="size-3.5" />}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                        {c.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
