import { BookOpen, Library, LogIn, LogOut, Search } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import type { User } from '../../shared/schemas'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { loginUrl, useAuth, useLogout } from '@/hooks/useAuth'
import { useCollection } from '@/hooks/useCollection'
import { cn } from '@/lib/utils'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors hover:bg-accent sm:px-3',
    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
  )

function UserAvatar({ user }: { user: User }) {
  const initial = (user.name ?? user.email).charAt(0).toUpperCase()
  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt=""
      // O Google recusa algumas fotos quando a requisição traz o referer do site.
      referrerPolicy="no-referrer"
      className="size-8 rounded-full bg-muted object-cover"
    />
  ) : (
    <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
      {initial}
    </span>
  )
}

function AccountArea() {
  const { user, isLoading } = useAuth()
  const logout = useLogout()
  const location = useLocation()

  if (isLoading) return <div className="size-8" aria-hidden />

  if (!user) {
    return (
      <Button asChild size="sm">
        <a href={loginUrl(location.pathname + location.search)}>
          <LogIn /> Entrar
        </a>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <span title={user.email}>
        <UserAvatar user={user} />
      </span>
      <span className="hidden max-w-32 truncate text-sm sm:inline">{user.name ?? user.email}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        aria-label="Sair"
        title="Sair"
      >
        <LogOut />
      </Button>
    </div>
  )
}

export function Layout() {
  const { data } = useCollection()
  const total = data?.totals.totalCards

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <span className="shrink-0 font-semibold">
            TCG<span className="hidden sm:inline"> Binder</span>
          </span>
          <nav className="flex items-center gap-0.5 sm:gap-1">
            <NavLink to="/" end className={linkClass} aria-label="Buscar">
              <Search className="size-4" />
              <span className="hidden sm:inline">Buscar</span>
            </NavLink>
            <NavLink to="/collection" className={linkClass} aria-label="Coleção">
              <Library className="size-4" />
              <span className="hidden sm:inline">Coleção</span>
              {total ? <Badge variant="secondary">{total}</Badge> : null}
            </NavLink>
            <NavLink to="/binders" className={linkClass} aria-label="Binders">
              <BookOpen className="size-4" />
              <span className="hidden sm:inline">Binders</span>
            </NavLink>
            <ThemeToggle />
            <AccountArea />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
