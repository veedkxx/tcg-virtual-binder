import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { POCKETS_PER_PAGE, type BinderDetail, type CollectionItem } from '../../shared/schemas'
import { Pocket, type PocketState } from '@/components/binder/Pocket'
import { PocketDialog, type PocketDialogTarget } from '@/components/binder/PocketDialog'
import { SlotPicker } from '@/components/binder/SlotPicker'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useBinder,
  useDeleteBinder,
  useFillBinder,
  useRenameBinder,
  useSlotMutations,
} from '@/hooks/useBinders'
import { useCollection } from '@/hooks/useCollection'
import { cn } from '@/lib/utils'

const WIDE_QUERY = '(min-width: 768px)'

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

const pocketLabel = (position: number) =>
  `Página ${Math.floor(position / POCKETS_PER_PAGE) + 1}, bolso ${(position % POCKETS_PER_PAGE) + 1}`

/**
 * Binder de coleção: uma página por 9 cartas do molde.
 * Binder livre: até a última página usada + uma página em branco para continuar (sem limite).
 */
function countPages(binder: BinderDetail) {
  if (binder.template) return Math.max(1, Math.ceil(binder.template.length / POCKETS_PER_PAGE))
  const last = binder.slots.at(-1)?.position
  return last === undefined ? 1 : Math.floor(last / POCKETS_PER_PAGE) + 2
}

export function BinderPage() {
  const { id = '' } = useParams()
  const binder = useBinder(id)

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link to="/binders">
        <ArrowLeft /> Meus binders
      </Link>
    </Button>
  )

  if (binder.isPending) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="aspect-[4/3] w-full md:aspect-[2/1]" />
      </div>
    )
  }

  if (binder.isError) {
    return (
      <div className="space-y-4">
        {back}
        <p className="py-16 text-center text-sm text-destructive">{binder.error.message}</p>
      </div>
    )
  }

  return <BinderView binder={binder.data} back={back} />
}

function BinderView({ binder, back }: { binder: BinderDetail; back: React.ReactNode }) {
  const collection = useCollection()
  const { put, clear } = useSlotMutations(binder.id)
  const fill = useFillBinder(binder.id)

  const wide = useMediaQuery(WIDE_QUERY)
  const perView = wide ? 2 : 1
  const pageCount = countPages(binder)

  // A página vive no estado (resposta imediata a cliques seguidos) e é espelhada na URL
  // (?p=3, 1-based), para recarregar ou compartilhar o link na mesma página.
  const [params, setParams] = useSearchParams()
  const [currentPage, setCurrentPage] = useState(() =>
    Math.max(0, (Number(params.get('p')) || 1) - 1),
  )
  const alignToSpread = (p: number) =>
    Math.floor(Math.min(Math.max(p, 0), pageCount - 1) / perView) * perView
  const start = alignToSpread(currentPage)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')

  const goTo = (target: number) => {
    target = alignToSpread(target)
    if (target === start) return
    setDirection(target > start ? 'next' : 'prev')
    setCurrentPage(target)
    setParams(
      (p) => {
        p.set('p', String(target + 1))
        return p
      },
      { replace: true },
    )
  }
  const canPrev = start > 0
  const canNext = start + perView < pageCount

  const [picker, setPicker] = useState<number | null>(null)
  const [zoom, setZoom] = useState<PocketDialogTarget | null>(null)
  const anyDialog = picker !== null || zoom !== null

  // Setas do teclado folheiam (menos com um diálogo aberto ou digitando).
  const nav = useRef({ goTo, start, perView })
  nav.current = { goTo, start, perView }
  useEffect(() => {
    if (anyDialog) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [role="dialog"], [role="alertdialog"]')) return
      const { goTo, start, perView } = nav.current
      if (e.key === 'ArrowRight') goTo(start + perView)
      if (e.key === 'ArrowLeft') goTo(start - perView)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anyDialog])

  // Deslizar o dedo folheia (só toque/caneta, para não brigar com cliques do mouse).
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      goTo(dx < 0 ? start + perView : start - perView)
    }
  }

  const slotByPosition = useMemo(
    () => new Map(binder.slots.map((s) => [s.position, s.item])),
    [binder.slots],
  )
  const ownedByCard = useMemo(
    () => new Map(collection.data?.items.map((i) => [i.cardId, i])),
    [collection.data],
  )

  const pocketState = (position: number): PocketState => {
    const item = slotByPosition.get(position)
    if (item) return { kind: 'filled', item }
    if (!binder.template) return { kind: 'free' }
    const card = binder.template[position]
    return card ? { kind: 'reserved', card, owned: ownedByCard.get(card.id) } : { kind: 'none' }
  }

  const onPocketClick = (position: number) => {
    const state = pocketState(position)
    if (state.kind === 'filled') setZoom({ kind: 'filled', position, item: state.item })
    else if (state.kind === 'free') setPicker(position)
    else if (state.kind === 'reserved') {
      if (state.owned) put.mutate({ position, item: state.owned })
      else setZoom({ kind: 'missing', position, card: state.card })
    }
  }

  const place = (position: number, item: CollectionItem) => put.mutate({ position, item })

  const total = binder.templateSize
  const pct = total ? Math.round((binder.filled / total) * 100) : null
  const pages = Array.from({ length: perView }, (_, i) => start + i)
  const missingOwned = binder.template
    ? binder.template.filter((c, pos) => !slotByPosition.has(pos) && ownedByCard.has(c.id)).length
    : 0

  return (
    <div className="space-y-5">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {binder.set?.logoUrl && (
            <img src={binder.set.logoUrl} alt="" className="h-10 max-w-24 object-contain" />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{binder.name}</h1>
            <p className="text-sm text-muted-foreground">
              {binder.set ? binder.set.name : 'Binder livre'} ·{' '}
              {total
                ? `${binder.filled}/${total} cartas (${pct}%)`
                : `${binder.filled} ${binder.filled === 1 ? 'carta' : 'cartas'}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {binder.template && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fill.mutate()}
              disabled={fill.isPending || missingOwned === 0}
              title={
                missingOwned === 0
                  ? 'Todas as cartas que você tem desta coleção já estão no binder.'
                  : undefined
              }
            >
              <Sparkles /> Colocar as que eu tenho
              {missingOwned > 0 && <span className="tabular-nums">({missingOwned})</span>}
            </Button>
          )}
          <RenameButton binder={binder} />
          <DeleteButton binder={binder} />
        </div>
      </div>

      {total ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      <div
        className="touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipe.current = null)}
      >
        <div
          key={start}
          className={cn(
            'grid gap-3 [perspective:1200px]',
            perView === 2 && 'grid-cols-2',
            direction === 'next' ? 'binder-flip-next' : 'binder-flip-prev',
          )}
        >
          {pages.map((page) =>
            page < pageCount ? (
              <section
                key={page}
                aria-label={`Página ${page + 1}`}
                className="rounded-2xl border bg-gradient-to-br from-muted/60 to-muted/20 p-2.5 shadow-inner sm:p-4"
              >
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {Array.from({ length: POCKETS_PER_PAGE }, (_, i) => {
                    const position = page * POCKETS_PER_PAGE + i
                    return (
                      <Pocket
                        key={position}
                        state={pocketState(position)}
                        onClick={() => onPocketClick(position)}
                      />
                    )
                  })}
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground tabular-nums">
                  {page + 1}
                </p>
              </section>
            ) : (
              <div key={page} className="rounded-2xl border border-dashed" aria-hidden />
            ),
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => goTo(start - perView)}
          disabled={!canPrev}
          aria-label="Página anterior"
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-36 text-center text-sm text-muted-foreground tabular-nums">
          {perView === 2 && start + 1 < pageCount
            ? `Páginas ${start + 1}–${start + 2} de ${pageCount}`
            : `Página ${start + 1} de ${pageCount}`}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => goTo(start + perView)}
          disabled={!canNext}
          aria-label="Próxima página"
        >
          <ChevronRight />
        </Button>
      </div>

      {pageCount > perView * 2 && (
        <input
          type="range"
          min={1}
          max={pageCount}
          value={start + 1}
          onChange={(e) => goTo(Number(e.target.value) - 1)}
          aria-label="Ir para a página"
          className="mx-auto block w-full max-w-md accent-primary"
        />
      )}

      <p className="text-center text-xs text-muted-foreground">
        {binder.template
          ? 'Cartas com borda: você tem, toque para colocar. Apagadas: ainda faltam.'
          : 'Toque num bolso vazio para escolher uma carta da sua coleção.'}{' '}
        <span className="hidden md:inline">Use ← → para folhear.</span>
      </p>

      <SlotPicker
        open={picker !== null}
        onOpenChange={(o) => !o && setPicker(null)}
        label={picker !== null ? pocketLabel(picker) : ''}
        onPick={(item) => picker !== null && place(picker, item)}
      />

      <PocketDialog
        target={zoom}
        onClose={() => setZoom(null)}
        label={pocketLabel}
        onSwap={
          binder.template
            ? undefined
            : (position) => {
                setZoom(null)
                setPicker(position)
              }
        }
        onRemove={(position) => clear.mutate({ position })}
      />
    </div>
  )
}

function RenameButton({ binder }: { binder: BinderDetail }) {
  const rename = useRenameBinder(binder.id)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(binder.name)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setName(binder.name)
          setOpen(true)
        }}
      >
        <Pencil /> Renomear
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              rename.mutate(name.trim(), { onSuccess: () => setOpen(false) })
            }}
          >
            <DialogHeader>
              <DialogTitle>Renomear binder</DialogTitle>
            </DialogHeader>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              aria-label="Nome do binder"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!name.trim() || rename.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DeleteButton({ binder }: { binder: BinderDetail }) {
  const navigate = useNavigate()
  const remove = useDeleteBinder(binder.id)

  return (
    <AlertDialog>
      <Button asChild variant="outline" size="sm">
        <AlertDialogTrigger>
          <Trash2 /> Apagar
        </AlertDialogTrigger>
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar “{binder.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            O binder some, mas todas as cartas continuam na sua coleção.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => remove.mutate(undefined, { onSuccess: () => navigate('/binders') })}
          >
            Apagar binder
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
