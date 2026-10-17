import { useState } from 'react'
import { ArrowLeftRight, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DEFAULT_CONDITION, type Condition, type Variant } from '../../../shared/copies'
import type { AddToPocketInput, BinderTemplateCard, CollectionItem } from '../../../shared/schemas'
import { ConditionSelect, CopyBadges, VariantPicker } from '@/components/CopyControls'
import { TiltCard, highResUrl } from '@/components/TiltCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCard } from '@/hooks/useCards'
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
  /** Carta que falta: adiciona à coleção e já coloca no bolso. */
  onAddMissing: (position: number, input: AddToPocketInput) => void
  adding: boolean
}

/** Zoom da carta do bolso, com a carta inclinando no ponteiro. */
export function PocketDialog({
  target,
  onClose,
  label,
  onSwap,
  onRemove,
  onAddMissing,
  adding,
}: Props) {
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
                <MissingInfo
                  card={target.card}
                  where={label(target.position)}
                  adding={adding}
                  onAdd={(input) => onAddMissing(target.position, input)}
                />
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
                  <Button asChild variant="ghost">
                    <Link to={`/cards/${encodeURIComponent(target.card.id)}`}>
                      <ExternalLink /> Ver carta
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

/** Carta que falta: escolhe variante e condição e adiciona direto ao bolso. */
function MissingInfo({
  card,
  where,
  adding,
  onAdd,
}: {
  card: BinderTemplateCard
  where: string
  adding: boolean
  onAdd: (input: AddToPocketInput) => void
}) {
  // As variantes não ficam no molde do binder: vêm do detalhe da carta (cacheado).
  const detail = useCard(card.id)
  const [variant, setVariant] = useState<Variant | undefined>()
  const [condition, setCondition] = useState<Condition>(DEFAULT_CONDITION)
  const variants = detail.data?.variants ?? []
  const chosen = variant ?? variants[0]

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-2xl">{card.name}</DialogTitle>
        <DialogDescription>#{card.localId} · você ainda não tem esta carta</DialogDescription>
      </DialogHeader>
      {detail.isPending ? (
        <Skeleton className="h-8 w-48" />
      ) : (
        variants.length > 1 &&
        chosen && <VariantPicker options={variants} value={chosen} onChange={setVariant} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <ConditionSelect value={condition} onChange={setCondition} />
        <Button
          disabled={adding || detail.isPending}
          onClick={() => onAdd({ variant: detail.isError ? undefined : chosen, condition })}
        >
          <Plus /> Adicionar ao binder
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Entra na sua coleção e já vai para este bolso. {where}.
      </p>
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
