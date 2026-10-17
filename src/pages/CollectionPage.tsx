import { Link } from 'react-router-dom'
import { LANGUAGE_LABELS } from '../../shared/languages'
import { CopyBadges } from '@/components/CopyControls'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CardImage } from '@/components/CardImage'
import {
  useCollection,
  useRemoveCollectionItem,
  useUpdateCollectionItem,
} from '@/hooks/useCollection'
import { useUiStore } from '@/store/ui'

export function CollectionPage() {
  const collection = useCollection()
  const update = useUpdateCollectionItem()
  const remove = useRemoveCollectionItem()
  const languageLabel = LANGUAGE_LABELS[useUiStore((s) => s.language)].toLowerCase()

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

  const { items, totals } = collection.data

  if (items.length === 0) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Você ainda não tem cartas em {languageLabel}.
        </p>
        <Button asChild>
          <Link to="/">Buscar cartas</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha coleção</h1>
        <p className="text-sm text-muted-foreground">
          {totals.totalCards} {totals.totalCards === 1 ? 'carta' : 'cartas'} ·{' '}
          {totals.uniqueCards} {totals.uniqueCards === 1 ? 'diferente' : 'diferentes'}
        </p>
      </div>

      <ul className="divide-y rounded-xl border">
        {items.map((item) => (
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
              <CopyBadges variant={item.variant} condition={item.condition} className="mt-1" />
              {item.binderCount > 0 && (
                <p className="text-xs text-muted-foreground">
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
    </div>
  )
}
