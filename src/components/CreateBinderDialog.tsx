import { useMemo, useState } from 'react'
import { BookOpen, Check, LayoutGrid, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { SetSummary } from '../../shared/schemas'
import {
  SET_TYPE_DESCRIPTIONS,
  SET_TYPE_LABELS,
  SET_TYPES,
  type SetType,
} from '../../shared/setTypes'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateBinder, useSets } from '@/hooks/useBinders'
import { cn } from '@/lib/utils'

type Mode = 'blank' | 'set'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function CreateBinderDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const create = useCreateBinder()

  const [mode, setMode] = useState<Mode>('blank')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [set, setSet] = useState<SetSummary | null>(null)
  const [fill, setFill] = useState(true)
  const [setType, setSetType] = useState<SetType>('core')

  const reset = () => {
    setMode('blank')
    setName('')
    setNameTouched(false)
    setSet(null)
    setFill(true)
    setSetType('core')
  }

  const chooseSet = (s: SetSummary) => {
    setSet(s)
    // Sugere o nome da coleção até a pessoa escrever um nome próprio.
    if (!nameTouched) setName(s.name)
  }

  const canSubmit = name.trim().length > 0 && (mode === 'blank' || set !== null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    create.mutate(
      {
        name: name.trim(),
        ...(mode === 'set' ? { setId: set!.id, setType } : {}),
        fill,
      },
      {
        onSuccess: (binder) => {
          onOpenChange(false)
          reset()
          navigate(`/binders/${binder.id}`)
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) reset()
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Novo binder</DialogTitle>
            <DialogDescription>
              Comece em branco e organize do seu jeito, ou use uma coleção como molde.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de binder">
            <ModeOption
              active={mode === 'blank'}
              onClick={() => setMode('blank')}
              icon={<LayoutGrid className="size-5" />}
              title="Em branco"
              description="Livre: você escolhe cada carta e cada bolso."
            />
            <ModeOption
              active={mode === 'set'}
              onClick={() => setMode('set')}
              icon={<BookOpen className="size-5" />}
              title="De uma coleção"
              description="Um bolso para cada carta da coleção, na ordem."
            />
          </div>

          {mode === 'set' && <SetPicker selected={set} onSelect={chooseSet} />}

          {mode === 'set' && (
            <div className="grid gap-2" role="radiogroup" aria-label="Tipo de binder da coleção">
              {SET_TYPES.map((t) => (
                <label
                  key={t}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-accent',
                    setType === t && 'border-primary ring-1 ring-primary',
                  )}
                >
                  <input
                    type="radio"
                    name="set-type"
                    value={t}
                    checked={setType === t}
                    onChange={() => setSetType(t)}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {SET_TYPE_LABELS[t]}
                      {set && <SetTypeCount set={set} type={t} />}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {SET_TYPE_DESCRIPTIONS[t]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          <label className="grid gap-1.5 text-sm font-medium">
            Nome
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameTouched(true)
              }}
              maxLength={60}
              placeholder={mode === 'set' ? 'Ex.: Amigos de Jornada' : 'Ex.: Trocas, Pikachus…'}
            />
          </label>

          {mode === 'set' && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={fill}
                onChange={(e) => setFill(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Já colocar as cartas que eu tenho
                <span className="block text-xs text-muted-foreground">
                  Dá pra fazer isso depois também, ou ir colocando uma a uma.
                </span>
              </span>
            </label>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit || create.isPending}>
              {create.isPending ? 'Montando o binder…' : 'Criar binder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ModeOption(props: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.active}
      onClick={props.onClick}
      className={cn(
        'flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
        props.active && 'border-primary ring-1 ring-primary',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {props.icon}
        {props.title}
      </span>
      <span className="text-xs text-muted-foreground">{props.description}</span>
    </button>
  )
}

function SetPicker(props: { selected: SetSummary | null; onSelect: (s: SetSummary) => void }) {
  const sets = useSets()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    const items = sets.data?.items ?? []
    return q ? items.filter((s) => normalize(s.name).includes(q) || s.id.includes(q)) : items
  }, [sets.data, query])

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar coleção (ex.: Amigos de Jornada)"
          className="pl-9"
          aria-label="Buscar coleção"
        />
      </div>

      <div
        className="h-64 overflow-y-auto rounded-lg border p-1"
        role="listbox"
        aria-label="Coleções"
      >
        {sets.isPending ? (
          <div className="grid gap-1 p-1">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : sets.isError ? (
          <div className="grid h-full place-items-center gap-2 p-4 text-center text-sm">
            <p className="text-destructive">{sets.error.message}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => sets.refetch()}>
              Tentar de novo
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma coleção encontrada.
          </p>
        ) : (
          filtered.map((s) => {
            const active = props.selected?.id === s.id
            return (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => props.onSelect(s)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                  active && 'bg-accent',
                )}
              >
                <span className="flex h-8 w-16 shrink-0 items-center justify-center">
                  {s.logoUrl || s.symbolUrl ? (
                    <img
                      src={(s.logoUrl ?? s.symbolUrl)!}
                      alt=""
                      loading="lazy"
                      className="max-h-8 max-w-16 object-contain"
                    />
                  ) : (
                    <BookOpen className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.cardCount ? `${s.cardCount} cartas` : s.id}
                  </span>
                </span>
                {active && <Check className="size-4 shrink-0" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

/** Quantos bolsos o tipo vai ter, quando dá para saber antes de criar. */
function SetTypeCount({ set, type }: { set: SetSummary; type: SetType }) {
  const count = type === 'core' ? (set.officialCount ?? set.cardCount) : set.cardCount
  if (!count) return null
  return (
    <span className="font-normal text-muted-foreground">
      {' '}
      · {type === 'master' ? `${count} cartas, em cada versão` : `${count} cartas`}
    </span>
  )
}
