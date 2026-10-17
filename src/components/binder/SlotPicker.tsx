import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { compareCopies, type Variant } from '../../../shared/copies'
import type { CollectionItem } from '../../../shared/schemas'
import { CardImage } from '@/components/CardImage'
import { CopyBadges } from '@/components/CopyControls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCollection } from '@/hooks/useCollection'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Página e bolso (1-based) só para o título. */
  label: string
  onPick: (item: CollectionItem) => void
  /** Binder de coleção: o bolso só aceita cópias desta carta (e desta variante, no Master Set). */
  onlyCardId?: string
  onlyVariant?: Variant
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Escolhe uma cópia da coleção para um bolso. */
export function SlotPicker({ open, onOpenChange, label, onPick, onlyCardId, onlyVariant }: Props) {
  const collection = useCollection()
  const [query, setQuery] = useState('')

  const items = useMemo(() => {
    const q = normalize(query.trim())
    const all = (collection.data?.items ?? []).filter(
      (i) =>
        (!onlyCardId || i.cardId === onlyCardId) && (!onlyVariant || i.variant === onlyVariant),
    )
    if (onlyCardId) all.sort(compareCopies)
    if (!q) return all
    return all.filter((i) =>
      normalize([i.name, i.setName, i.localId, i.cardId].filter(Boolean).join(' ')).includes(q),
    )
  }, [collection.data, query, onlyCardId, onlyVariant])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setQuery('')
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{onlyCardId ? 'Escolher cópia' : 'Escolher carta'}</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>

        <div className={onlyCardId ? 'hidden' : 'relative'}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar a sua coleção por nome, coleção ou número"
            className="pl-9"
            aria-label="Filtrar coleção"
          />
        </div>

        <div className="max-h-[55dvh] overflow-y-auto">
          {collection.isPending ? (
            <PickerGrid>
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-[63/88] w-full" />
              ))}
            </PickerGrid>
          ) : collection.isError ? (
            <p className="py-10 text-center text-sm text-destructive">{collection.error.message}</p>
          ) : (collection.data?.items.length ?? 0) === 0 ? (
            <div className="space-y-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">Sua coleção ainda está vazia.</p>
              <Button asChild variant="outline">
                <Link to="/">Buscar cartas</Link>
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma carta da sua coleção bate com “{query}”.
            </p>
          ) : (
            <PickerGrid>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onPick(item)
                    onOpenChange(false)
                    setQuery('')
                  }}
                  className="group relative flex flex-col gap-1 rounded-lg p-1 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CardImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="transition-transform group-hover:scale-[1.03]"
                  />
                  <Badge className="absolute right-2 top-2 shadow">×{item.quantity}</Badge>
                  <span className="truncate px-0.5 text-xs font-medium">{item.name}</span>
                  <CopyBadges
                    variant={item.variant}
                    condition={item.condition}
                    full={!!onlyCardId}
                  />
                  <span className="truncate px-0.5 text-[11px] text-muted-foreground">
                    {item.binderCount === 0
                      ? 'Em nenhum binder'
                      : `Em ${item.binderCount} ${item.binderCount === 1 ? 'binder' : 'binders'}`}
                  </span>
                </button>
              ))}
            </PickerGrid>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PickerGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">{children}</div>
}
