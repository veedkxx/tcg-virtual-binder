import { Heart, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { variantLabel } from '../../shared/copies'
import { LANGUAGE_LABELS } from '../../shared/languages'
import { CardImage } from '@/components/CardImage'
import { CollectionTabs } from '@/components/CollectionTabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRemoveFromWishlist, useWishlist } from '@/hooks/useWishlist'

export function WishlistPage() {
  const wishlist = useWishlist()
  const remove = useRemoveFromWishlist()

  return (
    <div className="space-y-5">
      <CollectionTabs />

      {wishlist.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : wishlist.isError ? (
        <div className="space-y-3 py-16 text-center">
          <p className="text-sm text-destructive">{wishlist.error.message}</p>
          <Button variant="outline" onClick={() => wishlist.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : wishlist.data.items.length === 0 ? (
        <div className="space-y-4 py-16 text-center">
          <Heart className="mx-auto size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Sua lista de desejos está vazia. Na página de uma carta, toque em “Quero esta carta”.
          </p>
          <Button asChild>
            <Link to="/">Buscar cartas</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Quando você adiciona à coleção uma cópia que atende o desejo, ela sai da lista sozinha.
          </p>
          <ul className="divide-y rounded-xl border">
            {wishlist.data.items.map((w) => (
              <li key={w.id} className="flex items-center gap-4 p-3">
                <Link to={`/cards/${encodeURIComponent(w.cardId)}`} className="w-16 shrink-0">
                  <CardImage src={w.imageUrl} alt={w.name} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/cards/${encodeURIComponent(w.cardId)}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {w.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {[w.setName, w.localId && `#${w.localId}`].filter(Boolean).join(' · ')}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">
                      {w.language ? LANGUAGE_LABELS[w.language] : 'Qualquer idioma'}
                    </Badge>
                    <Badge variant="outline">
                      {w.variant ? variantLabel(w.variant) : 'Qualquer versão'}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Tirar ${w.name} da lista de desejos`}
                  title="Tirar da lista de desejos"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: w.id, name: w.name })}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
