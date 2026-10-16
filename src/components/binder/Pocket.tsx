import { Plus } from 'lucide-react'
import type { BinderTemplateCard, CollectionItem } from '../../../shared/schemas'
import { CardImage } from '@/components/CardImage'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type PocketState =
  | { kind: 'filled'; item: CollectionItem }
  /** Bolso reservado (binder de coleção) ainda vazio; `owned` = carta que o usuário já tem. */
  | { kind: 'reserved'; card: BinderTemplateCard; owned: CollectionItem | undefined }
  | { kind: 'free' }
  /** Depois da última carta de um binder de coleção. */
  | { kind: 'none' }

interface Props {
  state: PocketState
  onClick: () => void
}

export function Pocket({ state, onClick }: Props) {
  if (state.kind === 'none') {
    return <div className="aspect-[63/88] rounded-lg bg-muted/30" aria-hidden />
  }

  if (state.kind === 'free') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Bolso vazio: escolher carta"
        className="flex aspect-[63/88] items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 text-muted-foreground/60 outline-none transition-colors hover:border-muted-foreground/60 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="size-6" />
      </button>
    )
  }

  if (state.kind === 'reserved') {
    const { card, owned } = state
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={
          owned
            ? `${card.name} #${card.localId}: você tem, toque para colocar`
            : `${card.name} #${card.localId}: falta`
        }
        className={cn(
          'group relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring',
          owned && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background',
        )}
      >
        <CardImage
          src={card.imageUrl}
          alt=""
          className={cn(
            'transition-[filter,opacity]',
            owned
              ? 'opacity-60 grayscale-[60%] group-hover:opacity-90 group-hover:grayscale-0'
              : 'opacity-25 grayscale group-hover:opacity-40',
          )}
        />
        <span className="absolute inset-x-1 bottom-1 truncate rounded bg-background/85 px-1 py-0.5 text-center text-[10px] font-medium tabular-nums sm:text-xs">
          #{card.localId}
        </span>
        {owned && (
          <Badge className="absolute right-1 top-1 px-1.5 text-[10px] shadow sm:text-xs">
            <Plus className="size-3" /> ×{owned.quantity}
          </Badge>
        )}
      </button>
    )
  }

  const { item } = state
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${item.name}, você tem ${item.quantity}`}
      className="group relative rounded-lg outline-none transition-transform hover:-translate-y-0.5 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardImage src={item.imageUrl} alt={item.name} className="shadow-md group-hover:shadow-xl" />
      <Badge className="absolute right-1 top-1 px-1.5 text-[10px] tabular-nums shadow sm:text-xs">
        ×{item.quantity}
      </Badge>
    </button>
  )
}
