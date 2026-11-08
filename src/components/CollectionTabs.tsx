import { Heart, Library } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useWishlist } from '@/hooks/useWishlist'
import { cn } from '@/lib/utils'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'border-primary text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  )

/** Coleção e lista de desejos lado a lado (o cabeçalho não tem espaço para mais um link). */
export function CollectionTabs() {
  const wishlist = useWishlist()
  const wishes = wishlist.data?.items.length ?? 0
  return (
    <nav className="flex gap-1 border-b" aria-label="Coleção">
      <NavLink to="/collection" end className={tabClass}>
        <Library className="size-4" /> Minha coleção
      </NavLink>
      <NavLink to="/wishlist" className={tabClass}>
        <Heart className="size-4" /> Lista de desejos
        {wishes > 0 && <span className="tabular-nums text-muted-foreground">({wishes})</span>}
      </NavLink>
    </nav>
  )
}
