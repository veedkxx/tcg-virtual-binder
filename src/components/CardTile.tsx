import { Link } from 'react-router-dom'
import type { CardSummary } from '../../shared/schemas'
import { CardImage } from '@/components/CardImage'
import { Badge } from '@/components/ui/badge'

interface Props {
  card: CardSummary
  /** Quantidade que o usuário já tem (0/undefined = não tem). */
  owned?: number
}

export function CardTile({ card, owned }: Props) {
  return (
    <Link
      to={`/cards/${encodeURIComponent(card.id)}`}
      className="group relative flex flex-col gap-2 rounded-xl p-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardImage src={card.imageUrl} alt={card.name} className="transition-transform group-hover:scale-[1.02]" />
      {owned ? (
        <Badge className="absolute right-3 top-3 shadow">×{owned}</Badge>
      ) : null}
      <div className="px-1">
        <p className="truncate text-sm font-medium">{card.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          #{card.localId} · {card.id}
        </p>
      </div>
    </Link>
  )
}

export function CardTileSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="aspect-[63/88] w-full animate-pulse rounded-lg bg-accent" />
      <div className="h-4 w-3/4 animate-pulse rounded bg-accent" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-accent" />
    </div>
  )
}
