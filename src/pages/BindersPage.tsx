import { useState } from 'react'
import { BookOpen, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BinderSummary } from '../../shared/schemas'
import { CreateBinderDialog } from '@/components/CreateBinderDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBinders } from '@/hooks/useBinders'

export function BindersPage() {
  const binders = useBinders()
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meus binders</h1>
          <p className="text-sm text-muted-foreground">
            Organize a sua coleção em páginas, do jeito que quiser.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus /> Novo binder
        </Button>
      </div>

      {binders.isPending ? (
        <Grid>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </Grid>
      ) : binders.isError ? (
        <div className="space-y-3 py-16 text-center">
          <p className="text-sm text-destructive">{binders.error.message}</p>
          <Button variant="outline" onClick={() => binders.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : binders.data.items.length === 0 ? (
        <div className="space-y-4 rounded-xl border border-dashed py-16 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Você ainda não tem nenhum binder.</p>
          <Button onClick={() => setCreating(true)}>
            <Plus /> Criar o primeiro
          </Button>
        </div>
      ) : (
        <Grid>
          {binders.data.items.map((b) => (
            <BinderCover key={b.id} binder={b} />
          ))}
        </Grid>
      )}

      <CreateBinderDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
}

function BinderCover({ binder }: { binder: BinderSummary }) {
  const total = binder.templateSize
  const pct = total ? Math.round((binder.filled / total) * 100) : null

  return (
    <Link
      to={`/binders/${binder.id}`}
      className="group flex flex-col justify-between gap-4 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-md bg-muted">
          {binder.set?.logoUrl ? (
            <img src={binder.set.logoUrl} alt="" className="max-h-10 max-w-18 object-contain" />
          ) : (
            <BookOpen className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{binder.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {binder.set ? binder.set.name : 'Binder livre'}
          </p>
        </div>
      </div>

      {total ? (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {binder.filled}/{total} cartas
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {binder.filled} {binder.filled === 1 ? 'carta' : 'cartas'}
        </p>
      )}
    </Link>
  )
}
