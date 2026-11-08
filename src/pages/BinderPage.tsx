import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileMinus2,
  FilePlus2,
  Search as SearchIcon,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { compareCopies, type Variant } from '../../shared/copies'
import type { Language } from '../../shared/languages'
import { ORGANIZE_BY, ORGANIZE_LABELS, type OrganizeBy } from '../../shared/binderStyle'
import { SET_TYPE_LABELS } from '../../shared/setTypes'
import { POCKETS_PER_PAGE, type BinderDetail, type CollectionItem } from '../../shared/schemas'
import { CustomizeBinderButton } from '@/components/binder/CustomizeBinderDialog'
import { NewCardsDialog } from '@/components/binder/NewCardsDialog'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  useBinder,
  useDeleteBinder,
  useFillBinder,
  useBinderLayout,
  useRemoveReserved,
  useSlotMutations,
} from '@/hooks/useBinders'
import { useCollection } from '@/hooks/useCollection'
import { pageBackground } from '@/lib/binderColors'
import { proxied } from '@/lib/images'
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
  const { put, clear, addNew } = useSlotMutations(binder.id)
  const removeReserved = useRemoveReserved(binder.id)
  const [newCardsOpen, setNewCardsOpen] = useState(false)
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
  // Cópias que o usuário tem, por carta e por carta+variante (bolso de Master Set): a "melhor"
  // (normal NM primeiro) vai para o bolso com um toque; o total aparece no selo.
  const ownedByKey = useMemo(() => {
    const owned = new Map<string, { best: CollectionItem; total: number; copies: number }>()
    // Cópias no idioma do binder primeiro: são as que entram com um toque.
    const sameLanguageFirst = (a: CollectionItem, b: CollectionItem) =>
      Number(a.language !== binder.language) - Number(b.language !== binder.language)
    const items = [...(collection.data?.items ?? [])]
    for (const i of items.sort((a, b) => sameLanguageFirst(a, b) || compareCopies(a, b))) {
      for (const key of [i.cardId, `${i.cardId}|${i.variant}`]) {
        const o = owned.get(key)
        if (o) {
          o.total += i.quantity
          o.copies += 1
        } else owned.set(key, { best: i, total: i.quantity, copies: 1 })
      }
    }
    return owned
  }, [collection.data, binder.language])

  // Filtros de visualização: apagam os bolsos que não batem (a ordem das páginas não muda).
  const [show, setShow] = useState<'all' | 'owned' | 'missing'>('all')
  const [langFilter, setLangFilter] = useState<Language | ''>('')
  const slotLanguages = useMemo(
    () => [...new Set(binder.slots.map((s) => s.item.language))].sort(),
    [binder.slots],
  )
  const dimmed = (state: PocketState) => {
    if (state.kind === 'none') return false
    const filled = state.kind === 'filled'
    if (show === 'owned' && !filled) return true
    if (show === 'missing' && filled) return true
    if (langFilter && (!filled || state.item.language !== langFilter)) return true
    return false
  }
  const ownedFor = (card: { id: string; variant?: Variant }) =>
    ownedByKey.get(card.variant ? `${card.id}|${card.variant}` : card.id)

  const pocketState = (position: number): PocketState => {
    const item = slotByPosition.get(position)
    if (item) return { kind: 'filled', item }
    if (!binder.template) return { kind: 'free' }
    const card = binder.template[position]
    return card ? { kind: 'reserved', card, owned: ownedFor(card) } : { kind: 'none' }
  }

  // Binder livre: mover e trocar cartas (arrastar no desktop; "Mover" + toque no destino no celular).
  const blank = !binder.template
  const { move, page: pageOp, organize } = useBinderLayout(binder.id)
  const [moving, setMoving] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  useEffect(() => {
    if (moving === null) return
    const cancel = (e: KeyboardEvent) => e.key === 'Escape' && setMoving(null)
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [moving])
  const moveTo = (from: number, to: number) => {
    if (from !== to) move.mutate({ from, to })
  }

  const onPocketClick = (position: number) => {
    if (moving !== null) {
      moveTo(moving, position)
      setMoving(null)
      return
    }
    const state = pocketState(position)
    if (state.kind === 'filled') setZoom({ kind: 'filled', position, item: state.item })
    else if (state.kind === 'free') setPicker(position)
    else if (state.kind === 'reserved') {
      if (state.owned) put.mutate({ position, item: state.owned.best })
      else setZoom({ kind: 'missing', position, card: state.card })
    }
  }

  const place = (position: number, item: CollectionItem) => put.mutate({ position, item })

  const total = binder.templateSize
  const pct = total ? Math.round((binder.filled / total) * 100) : null
  const pages = Array.from({ length: perView }, (_, i) => start + i)
  const missingOwned = binder.template
    ? binder.template.filter((c, pos) => !slotByPosition.has(pos) && ownedFor(c)).length
    : 0

  return (
    <div className="space-y-5">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {binder.set?.logoUrl && (
            <img
              src={proxied(binder.set.logoUrl)!}
              alt=""
              className="h-10 max-w-24 object-contain"
            />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{binder.name}</h1>
            <p className="text-sm text-muted-foreground">
              {binder.set
                ? binder.set.name
                : binder.search
                  ? `${binder.search.field === 'name' ? 'Pokémon' : 'Artista'}: ${binder.search.query}`
                  : 'Binder livre'}
              {binder.setType && ` · ${SET_TYPE_LABELS[binder.setType]}`} ·{' '}
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
          {binder.search && (
            <Button variant="outline" size="sm" onClick={() => setNewCardsOpen(true)}>
              <SearchIcon /> Buscar cartas novas
            </Button>
          )}
          {blank && (
            <OrganizeButton
              disabled={organize.isPending || binder.filled === 0}
              onOrganize={(by) => organize.mutate(by)}
            />
          )}
          <CustomizeBinderButton binder={binder} />
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

      {(binder.template || slotLanguages.length > 1) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {binder.template && (
            <ChipGroup
              label="Mostrar"
              value={show}
              onChange={setShow}
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'owned', label: `Tenho (${binder.filled})` },
                { value: 'missing', label: `Faltam (${(total ?? 0) - binder.filled})` },
              ]}
            />
          )}
          {slotLanguages.length > 1 && (
            <ChipGroup
              label="Idioma"
              value={langFilter}
              onChange={setLangFilter}
              options={[
                { value: '', label: 'Todos' },
                ...slotLanguages.map((l) => ({ value: l, label: l.toUpperCase() })),
              ]}
            />
          )}
        </div>
      )}

      {moving !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-sm">
          <span>
            Movendo a carta de {pocketLabel(moving).toLowerCase()}: toque no bolso de destino (pode
            trocar de página). Bolso ocupado troca as duas de lugar.
          </span>
          <Button size="sm" variant="ghost" onClick={() => setMoving(null)}>
            Cancelar
          </Button>
        </div>
      )}

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
                className={cn(
                  'rounded-2xl border bg-gradient-to-br p-2.5 shadow-inner sm:p-4',
                  pageBackground(binder.color),
                )}
              >
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {Array.from({ length: POCKETS_PER_PAGE }, (_, i) => {
                    const position = page * POCKETS_PER_PAGE + i
                    const state = pocketState(position)
                    return (
                      <div
                        key={position}
                        // Arrastar e soltar (desktop) só no binder livre.
                        draggable={blank && state.kind === 'filled'}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(position))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragOver={(e) => {
                          if (!blank) return
                          e.preventDefault()
                          setDragOver(position)
                        }}
                        onDragLeave={() => setDragOver((p) => (p === position ? null : p))}
                        onDrop={(e) => {
                          e.preventDefault()
                          setDragOver(null)
                          const from = Number(e.dataTransfer.getData('text/plain'))
                          if (blank && Number.isInteger(from)) moveTo(from, position)
                        }}
                        className={cn(
                          'rounded-lg transition-shadow',
                          dragOver === position && 'ring-2 ring-primary ring-offset-2',
                          moving === position && 'ring-2 ring-primary ring-offset-2 animate-pulse',
                        )}
                      >
                        <Pocket
                          state={state}
                          binderLanguage={binder.language}
                          dimmed={dimmed(state)}
                          onClick={() => onPocketClick(position)}
                          onQuickAdd={() => addNew.mutate({ position })}
                          busy={addNew.isPending && addNew.variables?.position === position}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{page + 1}</span>
                  {blank && (
                    <PageTools
                      hasCards={binder.slots.some(
                        (s) => Math.floor(s.position / POCKETS_PER_PAGE) === page,
                      )}
                      busy={pageOp.isPending}
                      onInsert={() => pageOp.mutate({ page, action: 'insert' })}
                      onRemove={() => pageOp.mutate({ page, action: 'remove' })}
                    />
                  )}
                </div>
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
          ? 'Cartas com borda: você tem, toque para colocar. Apagadas: ainda faltam; o + adiciona à coleção e ao binder.'
          : 'Toque num bolso vazio para escolher uma carta da sua coleção.'}{' '}
        <span className="hidden md:inline">Use ← → para folhear.</span>
      </p>

      <SlotPicker
        open={picker !== null}
        onOpenChange={(o) => !o && setPicker(null)}
        label={picker !== null ? pocketLabel(picker) : ''}
        onPick={(item) => picker !== null && place(picker, item)}
        onlyCardId={picker !== null ? binder.template?.[picker]?.id : undefined}
        onlyVariant={picker !== null ? binder.template?.[picker]?.variant : undefined}
      />

      {binder.search && (
        <NewCardsDialog binderId={binder.id} open={newCardsOpen} onOpenChange={setNewCardsOpen} />
      )}

      <PocketDialog
        // A cópia do bolso vem sempre do binder atual: a quantidade muda enquanto o zoom está aberto.
        target={
          zoom?.kind === 'filled'
            ? { ...zoom, item: slotByPosition.get(zoom.position) ?? zoom.item }
            : zoom
        }
        onClose={() => setZoom(null)}
        label={pocketLabel}
        // Binder livre: troca por qualquer carta. Binder de coleção: só por outra cópia
        // (variante/condição) da mesma carta, se houver.
        onSwap={
          zoom?.kind === 'filled' &&
          (!binder.template ||
            (ownedFor(binder.template[zoom.position] ?? { id: zoom.item.cardId })?.copies ?? 0) > 1)
            ? (position) => {
                setZoom(null)
                setPicker(position)
              }
            : undefined
        }
        onRemove={(position) => clear.mutate({ position })}
        onMove={
          blank
            ? (position) => {
                setZoom(null)
                setMoving(position)
              }
            : undefined
        }
        onRemoveReserved={
          binder.template
            ? (position) =>
                removeReserved.mutate({
                  position,
                  name: binder.template?.[position]?.name ?? 'A carta',
                })
            : undefined
        }
        onAddMissing={(position, input) =>
          addNew.mutate({ position, input }, { onSuccess: () => setZoom(null) })
        }
        adding={addNew.isPending}
        binderLanguage={binder.language}
      />
    </div>
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

function ChipGroup<T extends string>(props: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={props.label}>
      <span className="text-xs text-muted-foreground">{props.label}</span>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={props.value === o.value}
          onClick={() => props.onChange(o.value)}
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
            props.value === o.value &&
              'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Inserir página em branco antes desta ou remover a página (pede confirmação se tiver cartas). */
function PageTools(props: {
  hasCards: boolean
  busy: boolean
  onInsert: () => void
  onRemove: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <span>Remover página com cartas?</span>
        <Button
          size="sm"
          variant="destructive"
          className="h-6 px-2 text-xs"
          onClick={() => {
            props.onRemove()
            setConfirming(false)
          }}
        >
          Remover
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
      </span>
    )
  }
  return (
    <span className="flex items-center">
      <Button
        size="icon"
        variant="ghost"
        className="size-6"
        disabled={props.busy}
        onClick={props.onInsert}
        title="Inserir página em branco antes desta"
        aria-label="Inserir página em branco antes desta"
      >
        <FilePlus2 className="size-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-6"
        disabled={props.busy}
        onClick={() => (props.hasCards ? setConfirming(true) : props.onRemove())}
        title="Remover esta página"
        aria-label="Remover esta página"
      >
        <FileMinus2 className="size-3.5" />
      </Button>
    </span>
  )
}

/** Organizar automaticamente (binder livre): reordena as cartas pelo critério, sem buracos. */
function OrganizeButton(props: { disabled: boolean; onOrganize: (by: OrganizeBy) => void }) {
  const [open, setOpen] = useState(false)
  const [by, setBy] = useState<OrganizeBy>('number')
  return (
    <>
      <Button variant="outline" size="sm" disabled={props.disabled} onClick={() => setOpen(true)}>
        <ArrowDownWideNarrow /> Organizar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organizar automaticamente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            As cartas são reordenadas desde o primeiro bolso, sem bolsos vazios entre elas.
          </p>
          <div className="grid gap-2" role="radiogroup" aria-label="Organizar por">
            {ORGANIZE_BY.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="organize-by"
                  checked={by === o}
                  onChange={() => setBy(o)}
                  className="size-4 accent-primary"
                />
                {ORGANIZE_LABELS[o]}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                props.onOrganize(by)
                setOpen(false)
              }}
            >
              Organizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
