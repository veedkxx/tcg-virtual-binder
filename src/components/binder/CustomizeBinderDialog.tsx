import { useMemo, useState } from 'react'
import { Check, Paintbrush } from 'lucide-react'
import { BINDER_COLORS, BINDER_COLOR_LABELS, type BinderColor } from '../../../shared/binderStyle'
import type { BinderDetail } from '../../../shared/schemas'
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
import { Input } from '@/components/ui/input'
import { useUpdateBinder } from '@/hooks/useBinders'
import { BINDER_COLOR_CLASSES } from '@/lib/binderColors'
import { cn } from '@/lib/utils'

/** Nome, cor e capa do binder. A capa é uma carta do próprio binder. */
export function CustomizeBinderButton({ binder }: { binder: BinderDetail }) {
  const update = useUpdateBinder(binder.id)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(binder.name)
  const [color, setColor] = useState<BinderColor | null>(binder.color)
  const [cover, setCover] = useState<string | null>(binder.coverImageUrl)

  // Candidatas a capa: cartas colocadas e, em binder de coleção, as reservadas (sem repetir).
  const covers = useMemo(() => {
    const urls = [
      ...binder.slots.map((s) => s.item.imageUrl),
      ...(binder.template ?? []).map((c) => c.imageUrl),
    ].filter((u): u is string => Boolean(u))
    return [...new Set(urls)].slice(0, 60)
  }, [binder.slots, binder.template])

  const reset = () => {
    setName(binder.name)
    setColor(binder.color)
    setCover(binder.coverImageUrl)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          reset()
          setOpen(true)
        }}
      >
        <Paintbrush /> Personalizar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              update.mutate(
                { name: name.trim(), color, coverImageUrl: cover },
                { onSuccess: () => setOpen(false) },
              )
            }}
          >
            <DialogHeader>
              <DialogTitle>Personalizar binder</DialogTitle>
              <DialogDescription>Nome, cor das páginas e a carta da capa.</DialogDescription>
            </DialogHeader>

            <label className="grid gap-1.5 text-sm font-medium">
              Nome
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                aria-label="Nome do binder"
              />
            </label>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Cor</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor do binder">
                <Swatch
                  label="Padrão"
                  active={color === null}
                  className="bg-muted"
                  onClick={() => setColor(null)}
                />
                {BINDER_COLORS.map((c) => (
                  <Swatch
                    key={c}
                    label={BINDER_COLOR_LABELS[c]}
                    active={color === c}
                    className={BINDER_COLOR_CLASSES[c].swatch}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <span className="text-sm font-medium">Capa</span>
              {covers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Coloque cartas no binder para escolher uma como capa.
                </p>
              ) : (
                <div className="grid max-h-56 grid-cols-5 gap-2 overflow-y-auto rounded-lg border p-2 sm:grid-cols-7">
                  <button
                    type="button"
                    onClick={() => setCover(null)}
                    aria-pressed={cover === null}
                    className={cn(
                      'flex aspect-[63/88] items-center justify-center rounded-md border-2 border-dashed text-[10px] text-muted-foreground',
                      cover === null && 'border-primary text-foreground',
                    )}
                  >
                    Sem capa
                  </button>
                  {covers.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setCover(url)}
                      aria-pressed={cover === url}
                      className={cn(
                        'relative rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        cover === url && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                      )}
                    >
                      <CardImage src={url} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!name.trim() || update.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Swatch(props: { label: string; active: boolean; className: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.active}
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring',
        props.className,
        props.active && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}
    >
      {props.active && <Check className="size-4 text-white drop-shadow" />}
    </button>
  )
}
