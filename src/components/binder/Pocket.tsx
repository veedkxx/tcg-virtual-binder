import { Loader2, Plus } from 'lucide-react'
import { VARIANT_LABELS, VARIANT_SHORT } from '../../../shared/copies'
import type { BinderTemplateCard, CollectionItem } from '../../../shared/schemas'
import { CardImage } from '@/components/CardImage'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type PocketState =
  | { kind: 'filled'; item: CollectionItem }
  /**
   * Bolso reservado (binder de coleção) ainda vazio. `owned`: o usuário tem a carta; `best` é
   * a cópia que entra com um toque e `total` soma todas as cópias.
   */
  | {
      kind: 'reserved'
      card: BinderTemplateCard
      owned: { best: CollectionItem; total: number } | undefined
    }
  | { kind: 'free' }
  /** Depois da última carta de um binder de coleção. */
  | { kind: 'none' }

interface Props {
  state: PocketState
  onClick: () => void
  /** Bolso reservado de carta que falta: adiciona à coleção e coloca no bolso num toque. */
  onQuickAdd?: () => void
  busy?: boolean
}

export function Pocket({ state, onClick, onQuickAdd, busy }: Props) {
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
      <div
        className={cn(
          'group relative rounded-lg',
          owned && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background',
        )}
      >
        <button
          type="button"
          onClick={onClick}
          aria-label={
            owned
              ? `${card.name} #${card.localId}: você tem, toque para colocar`
              : `${card.name} #${card.localId}${card.variant ? ` (${VARIANT_LABELS[card.variant]})` : ''}: falta`
          }
          className="block w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        </button>
        <div className="pointer-events-none absolute inset-x-1 bottom-1 flex items-center gap-1">
          <span className="flex-1 truncate rounded bg-background/85 px-1 py-0.5 text-center text-[10px] font-medium tabular-nums sm:text-xs">
            #{card.localId}
            {card.variant && card.variant !== 'normal' && ` · ${VARIANT_SHORT[card.variant]}`}
          </span>
          {!owned && onQuickAdd && (
            <button
              type="button"
              onClick={onQuickAdd}
              disabled={busy}
              aria-label={`Adicionar ${card.name} à coleção e ao binder`}
              title="Adicionar à coleção e ao binder"
              className="pointer-events-auto flex size-6 shrink-0 items-center justify-center rounded bg-primary text-primary-foreground shadow outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:size-7"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-4" />}
            </button>
          )}
        </div>
        {owned && (
          <Badge className="pointer-events-none absolute right-1 top-1 px-1.5 text-[10px] shadow sm:text-xs">
            <Plus className="size-3" /> ×{owned.total}
          </Badge>
        )}
      </div>
    )
  }

  const { item } = state
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${item.name} (${VARIANT_LABELS[item.variant]}, ${item.condition}), você tem ${item.quantity}`}
      className="group relative rounded-lg outline-none transition-transform hover:-translate-y-0.5 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardImage src={item.imageUrl} alt={item.name} className="shadow-md group-hover:shadow-xl" />
      <Badge className="absolute right-1 top-1 px-1.5 text-[10px] tabular-nums shadow sm:text-xs">
        ×{item.quantity}
        {item.variant !== 'normal' && (
          <span className="opacity-80">· {VARIANT_SHORT[item.variant]}</span>
        )}
      </Badge>
    </button>
  )
}
