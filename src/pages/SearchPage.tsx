import { useMemo } from 'react'
import { Search } from 'lucide-react'
import { CardTile, CardTileSkeleton } from '@/components/CardTile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCardSearch } from '@/hooks/useCards'
import { useCollection } from '@/hooks/useCollection'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useUiStore } from '@/store/ui'

export function SearchPage() {
  const searchQuery = useUiStore((s) => s.searchQuery)
  const setSearchQuery = useUiStore((s) => s.setSearchQuery)
  const page = useUiStore((s) => s.searchPage)
  const setPage = useUiStore((s) => s.setSearchPage)

  const debounced = useDebouncedValue(searchQuery.trim(), 400)
  const active = debounced.length >= 2

  const search = useCardSearch(debounced, page)
  const collection = useCollection()

  const ownedById = useMemo(
    () => new Map(collection.data?.items.map((i) => [i.cardId, i.quantity] as const)),
    [collection.data],
  )

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar carta por nome (ex.: Pikachu)"
          className="h-11 pl-9"
          aria-label="Buscar carta por nome"
        />
      </div>

      {!active ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Digite pelo menos 2 letras para buscar cartas em português.
        </p>
      ) : search.isPending ? (
        <Grid>
          {Array.from({ length: 10 }, (_, i) => (
            <CardTileSkeleton key={i} />
          ))}
        </Grid>
      ) : search.isError ? (
        <div className="space-y-3 py-16 text-center">
          <p className="text-sm text-destructive">{search.error.message}</p>
          <Button variant="outline" onClick={() => search.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : search.data.items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma carta encontrada para “{debounced}”. Nem todo set está traduzido para português.
        </p>
      ) : (
        <>
          <div className={search.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <Grid>
              {search.data.items.map((card) => (
                <CardTile key={card.id} card={card} owned={ownedById.get(card.id)} />
              ))}
            </Grid>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </Button>
            <span className="text-sm text-muted-foreground">Página {page}</span>
            <Button
              variant="outline"
              disabled={!search.data.hasMore || search.isPlaceholderData}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {children}
    </div>
  )
}
