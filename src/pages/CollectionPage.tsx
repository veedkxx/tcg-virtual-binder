import { Link } from 'react-router-dom'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CardImage } from '@/components/CardImage'
import {
  useCollection,
  useRemoveFromCollection,
  useSetQuantity,
} from '@/hooks/useCollection'

export function CollectionPage() {
  const collection = useCollection()
  const setQuantity = useSetQuantity()
  const remove = useRemoveFromCollection()

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
        <p className="text-sm text-muted-foreground">Sua coleção ainda está vazia.</p>
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
            </div>
            <QuantityStepper
              value={item.quantity}
              onChange={(quantity) => setQuantity.mutate({ cardId: item.cardId, quantity })}
              confirmRemove={{
                cardName: item.name,
                onConfirm: () => remove.mutate({ cardId: item.cardId, name: item.name }),
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
