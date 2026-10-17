import { ArrowLeftRight, ExternalLink, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BinderTemplateCard, CollectionItem } from '../../../shared/schemas'
import { CopyBadges } from '@/components/CopyControls'
import { TiltCard, highResUrl } from '@/components/TiltCard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type PocketDialogTarget =
  | { kind: 'filled'; position: number; item: CollectionItem }
  | { kind: 'missing'; position: number; card: BinderTemplateCard }

interface Props {
  target: PocketDialogTarget | null
  onClose: () => void
  label: (position: number) => string
  /** Só em binder livre: abre o seletor para trocar a carta do bolso. */
  onSwap?: (position: number) => void
  onRemove: (position: number) => void
}

/** Zoom da carta do bolso, com a carta inclinando no ponteiro. */
export function PocketDialog({ target, onClose, label, onSwap, onRemove }: Props) {
  const open = target !== null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        {target && (
          <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,320px)_1fr]">
            <TiltCard
              src={
                target.kind === 'filled'
                  ? highResUrl(target.item.imageUrl)
                  : highResUrl(target.card.imageUrl)
              }
              alt={target.kind === 'filled' ? target.item.name : target.card.name}
              className={
                target.kind === 'missing'
                  ? 'mx-auto w-56 opacity-50 grayscale sm:w-full'
                  : 'mx-auto w-56 sm:w-full'
              }
            />

            <div className="grid gap-4">
              {target.kind === 'filled' ? (
                <FilledInfo item={target.item} where={label(target.position)} />
              ) : (
                <MissingInfo card={target.card} where={label(target.position)} />
              )}

              <DialogFooter className="sm:justify-start">
                {target.kind === 'filled' ? (
                  <>
                    {onSwap && (
                      <Button variant="outline" onClick={() => onSwap(target.position)}>
                        <ArrowLeftRight /> Trocar
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        onRemove(target.position)
                        onClose()
                      }}
                    >
                      <Trash2 /> Tirar do bolso
                    </Button>
                    <Button asChild variant="ghost">
                      <Link to={`/cards/${encodeURIComponent(target.item.cardId)}`}>
                        <ExternalLink /> Ver carta
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild>
                    <Link to={`/cards/${encodeURIComponent(target.card.id)}`}>
                      <ExternalLink /> Ver carta e adicionar à coleção
                    </Link>
                  </Button>
                )}
              </DialogFooter>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FilledInfo({ item, where }: { item: CollectionItem; where: string }) {
  const meta = [item.setName, item.localId && `#${item.localId}`, item.rarity]
    .filter(Boolean)
    .join(' · ')
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">{item.name}</DialogTitle>
        <DialogDescription>{meta}</DialogDescription>
      </DialogHeader>
      <CopyBadges variant={item.variant} condition={item.condition} full />
      <dl className="grid grid-cols-2 gap-3">
        <Stat label="Você tem desta cópia" value={`×${item.quantity}`} />
        <Stat
          label="Aparece em"
          value={`${item.binderCount} ${item.binderCount === 1 ? 'binder' : 'binders'}`}
        />
      </dl>
      <p className="text-xs text-muted-foreground">{where}</p>
    </>
  )
}

function MissingInfo({ card, where }: { card: BinderTemplateCard; where: string }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">{card.name}</DialogTitle>
        <DialogDescription>#{card.localId}</DialogDescription>
      </DialogHeader>
      <p className="text-sm">Você ainda não tem esta carta.</p>
      <p className="text-xs text-muted-foreground">{where}</p>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
