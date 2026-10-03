import { ImageOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  src: string | null
  alt: string
  className?: string
}

/** Proporção de carta (63x88mm) com placeholder quando não há imagem. */
export function CardImage({ src, alt, className }: Props) {
  return (
    <div
      className={cn(
        'relative aspect-[63/88] w-full overflow-hidden rounded-lg bg-muted',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-2 text-center text-xs text-muted-foreground">
          <ImageOff className="size-6" />
          Sem imagem
        </div>
      )}
    </div>
  )
}
