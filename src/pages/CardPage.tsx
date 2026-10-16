import { ArrowLeft, Check, LogIn, Plus } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CardImage } from '@/components/CardImage'
import { QuantityStepper } from '@/components/QuantityStepper'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { loginUrl, useAuth } from '@/hooks/useAuth'
import { useCard } from '@/hooks/useCards'
import {
  useAddToCollection,
  useCollection,
  useRemoveFromCollection,
  useSetQuantity,
} from '@/hooks/useCollection'
import { useUiStore } from '@/store/ui'

export function CardPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { user, isLoading: authLoading } = useAuth()
  const card = useCard(id)
  const collection = useCollection()

  const pendingQuantity = useUiStore((s) => s.pendingQuantity)
  const setPendingQuantity = useUiStore((s) => s.setPendingQuantity)

  const add = useAddToCollection()
  const setQuantity = useSetQuantity()
  const remove = useRemoveFromCollection()

  const owned = collection.data?.items.find((i) => i.cardId === id)

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link to="/">
        <ArrowLeft /> Voltar à busca
      </Link>
    </Button>
  )

  if (card.isPending) {
    return (
      <div className="space-y-4">
        {back}
        <div className="grid gap-6 md:grid-cols-[320px_1fr]">
          <Skeleton className="aspect-[63/88] w-full" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (card.isError) {
    return (
      <div className="space-y-4">
        {back}
        <p className="py-16 text-center text-sm text-destructive">{card.error.message}</p>
      </div>
    )
  }

  const c = card.data

  return (
    <div className="space-y-4">
      {back}
      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <CardImage src={c.imageHighUrl ?? c.imageUrl} alt={c.name} />

        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{c.name}</h1>
            <p className="text-sm text-muted-foreground">
              {c.set.name} · #{c.localId}
              {c.set.cardCount ? ` / ${c.set.cardCount}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {c.rarity && <Badge variant="secondary">{c.rarity}</Badge>}
              {c.category && <Badge variant="outline">{c.category}</Badge>}
              {c.types.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
              {c.hp ? <Badge variant="outline">PS {c.hp}</Badge> : null}
            </div>
          </div>

          {c.description && <p className="text-sm leading-relaxed">{c.description}</p>}
          {c.illustrator && (
            <p className="text-xs text-muted-foreground">Ilustrador: {c.illustrator}</p>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Coleção</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              {authLoading ? (
                <Skeleton className="h-9 w-48" />
              ) : !user ? (
                <Button asChild>
                  <a href={loginUrl(location.pathname + location.search)}>
                    <LogIn /> Entrar para adicionar à coleção
                  </a>
                </Button>
              ) : owned ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Check className="size-4" /> Na sua coleção
                  </span>
                  <QuantityStepper
                    value={owned.quantity}
                    onChange={(quantity) => setQuantity.mutate({ cardId: c.id, quantity })}
                    confirmRemove={{
                      cardName: c.name,
                      onConfirm: () => remove.mutate({ cardId: c.id, name: c.name }),
                    }}
                  />
                </>
              ) : (
                <>
                  <QuantityStepper value={pendingQuantity} onChange={setPendingQuantity} />
                  <Button
                    disabled={add.isPending || collection.isPending}
                    onClick={() =>
                      add.mutate(
                        { cardId: c.id, quantity: pendingQuantity },
                        { onSuccess: () => setPendingQuantity(1) },
                      )
                    }
                  >
                    <Plus /> Adicionar à coleção
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
