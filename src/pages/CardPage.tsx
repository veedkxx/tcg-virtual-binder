import { useState } from 'react'
import { ArrowLeft, LogIn, Plus } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { compareCopies, DEFAULT_CONDITION, type Condition, type Variant } from '../../shared/copies'
import type { CardDetail, CollectionItem } from '../../shared/schemas'
import { CardImage } from '@/components/CardImage'
import { ConditionSelect, VariantPicker, VariantSelect } from '@/components/CopyControls'
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
  useRemoveCollectionItem,
  useUpdateCollectionItem,
} from '@/hooks/useCollection'
import { useUiStore } from '@/store/ui'

export function CardPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const { user, isLoading: authLoading } = useAuth()
  const card = useCard(id)
  const collection = useCollection()
  const language = useUiStore((s) => s.language)

  const copies = (collection.data?.items ?? []).filter((i) => i.cardId === id).sort(compareCopies)
  const total = copies.reduce((sum, i) => sum + i.quantity, 0)

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
              <CardTitle className="flex items-baseline justify-between gap-2">
                Coleção
                {total > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    Você tem {total} {total === 1 ? 'cópia' : 'cópias'}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {authLoading ? (
                <Skeleton className="h-9 w-48" />
              ) : !user ? (
                <Button asChild>
                  <a href={loginUrl(location.pathname + location.search)}>
                    <LogIn /> Entrar para adicionar à coleção
                  </a>
                </Button>
              ) : (
                <>
                  {copies.length > 0 && (
                    <ul className="divide-y rounded-lg border">
                      {copies.map((item) => (
                        <CopyRow key={item.id} item={item} variants={c.variants} />
                      ))}
                    </ul>
                  )}
                  {/* A key zera o formulário ao trocar de carta ou de idioma. */}
                  <AddCopyForm
                    key={`${c.id}-${language}`}
                    card={c}
                    title={copies.length > 0 ? 'Adicionar outra cópia' : undefined}
                    disabled={collection.isPending}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** Uma cópia que o usuário tem: dá para corrigir variante/condição e mudar a quantidade. */
function CopyRow({ item, variants }: { item: CollectionItem; variants: Variant[] }) {
  const update = useUpdateCollectionItem()
  const remove = useRemoveCollectionItem()

  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <VariantSelect
        options={variants}
        value={item.variant}
        disabled={update.isPending}
        onChange={(variant) => update.mutate({ id: item.id, patch: { variant } })}
      />
      <ConditionSelect
        value={item.condition}
        disabled={update.isPending}
        onChange={(condition) => update.mutate({ id: item.id, patch: { condition } })}
      />
      {item.binderCount > 0 && (
        <span className="text-xs text-muted-foreground">
          em {item.binderCount} {item.binderCount === 1 ? 'binder' : 'binders'}
        </span>
      )}
      <div className="ml-auto">
        <QuantityStepper
          value={item.quantity}
          onChange={(quantity) => update.mutate({ id: item.id, patch: { quantity } })}
          confirmRemove={{
            cardName: item.name,
            onConfirm: () => remove.mutate({ id: item.id, name: item.name }),
          }}
        />
      </div>
    </li>
  )
}

function AddCopyForm({
  card,
  title,
  disabled,
}: {
  card: CardDetail
  title?: string
  disabled?: boolean
}) {
  const add = useAddToCollection()
  const pendingQuantity = useUiStore((s) => s.pendingQuantity)
  const setPendingQuantity = useUiStore((s) => s.setPendingQuantity)
  const [variant, setVariant] = useState<Variant>(card.variants[0]!)
  const [condition, setCondition] = useState<Condition>(DEFAULT_CONDITION)

  return (
    <div className="space-y-3">
      {title && <p className="text-sm font-medium">{title}</p>}
      {card.variants.length > 1 && (
        <VariantPicker options={card.variants} value={variant} onChange={setVariant} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <ConditionSelect value={condition} onChange={setCondition} />
        <QuantityStepper value={pendingQuantity} onChange={setPendingQuantity} />
        <Button
          disabled={add.isPending || disabled}
          onClick={() =>
            add.mutate(
              { cardId: card.id, quantity: pendingQuantity, variant, condition },
              { onSuccess: () => setPendingQuantity(1) },
            )
          }
        >
          <Plus /> Adicionar à coleção
        </Button>
      </div>
    </div>
  )
}
