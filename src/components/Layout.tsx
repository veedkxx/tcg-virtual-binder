import { Library, Search } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { useCollection } from '@/hooks/useCollection'
import { cn } from '@/lib/utils'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent',
    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
  )

export function Layout() {
  const { data } = useCollection()
  const total = data?.totals.totalCards

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="font-semibold">TCG Binder</span>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              <Search className="size-4" />
              Buscar
            </NavLink>
            <NavLink to="/collection" className={linkClass}>
              <Library className="size-4" />
              Coleção
              {total ? <Badge variant="secondary">{total}</Badge> : null}
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
