import { useEffect, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { SearchCandidate } from '../../../shared/schemas'
import { CardImage } from '@/components/CardImage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddBinderCards, useNewBinderCards } from '@/hooks/useBinders'
import { cn } from '@/lib/utils'

interface Props {
  binderId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Cartas da busca que não estão no binder. As lançadas depois da criação vêm marcadas; as que o
 * usuário removeu ficam à parte, desmarcadas, para trazer de volta se quiser. Entram no fim.
 */
export function NewCardsDialog({ binderId, open, onOpenChange }: Props) {
  const cards = useNewBinderCards(binderId, open)
  const add = useAddBinderCards(binderId)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showRemoved, setShowRemoved] = useState(false)

  const fresh = cards.data?.items ?? []
  const removed = cards.data?.removed ?? []
  const key = fresh.map((c) => c.id).join(',')
  useEffect(() => {
    setSelected(new Set(key ? key.split(',') : []))
    // Só quando a lista de novas muda.
  }, [key])

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setShowRemoved(false)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cartas novas</DialogTitle>
          <DialogDescription>
            Cartas da busca lançadas depois que o binder foi criado. As escolhidas entram no fim.
          </DialogDescription>
        </DialogHeader>

        {cards.isPending ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[63/88] w-full" />
            ))}
          </div>
        ) : cards.isError ? (
          <p className="text-sm text-destructive">{cards.error.message}</p>
        ) : (
          <div className="grid max-h-[55dvh] gap-4 overflow-y-auto">
            {fresh.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma carta nova desde que o binder foi criado.
              </p>
            ) : (
              <CardGrid items={fresh} selected={selected} onToggle={toggle} />
            )}

            {removed.length > 0 && (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setShowRemoved((v) => !v)}
                  aria-expanded={showRemoved}
                  className="flex items-center gap-1 justify-self-start text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown
                    className={cn('size-4 transition-transform', !showRemoved && '-rotate-90')}
                  />
                  Removidas por você ({removed.length})
                </button>
                {showRemoved && <CardGrid items={removed} selected={selected} onToggle={toggle} />}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            disabled={selected.size === 0 || add.isPending}
            onClick={() => add.mutate([...selected], { onSuccess: () => onOpenChange(false) })}
          >
            Acrescentar {selected.size > 0 && `(${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CardGrid(props: {
  items: SearchCandidate[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {props.items.map((c) => {
        const on = props.selected.has(c.id)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => props.onToggle(c.id)}
            aria-pressed={on}
            title={`${c.name} · ${c.id}`}
            className="relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  )
}
