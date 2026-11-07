import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { englishVersion, proxied } from '@/lib/images'
import { cn } from '@/lib/utils'

interface Props {
  src: string | null
  alt: string
  className?: string
  /** Imagem acima da dobra: carrega já, sem lazy. */
  eager?: boolean
}

/**
 * Proporção de carta (63x88mm). Se a imagem falha, tenta a mesma carta em inglês e, por fim,
 * mostra o placeholder "Sem imagem".
 */
export function CardImage({ src, alt, className, eager = false }: Props) {
  // Recomeça as tentativas quando a carta muda.
  const [attempt, setAttempt] = useState({ src, step: 0 })
  if (attempt.src !== src) setAttempt({ src, step: 0 })

  const candidates = [src, englishVersion(src)].filter((u): u is string => Boolean(u))
  const current = proxied(candidates[attempt.step])

  return (
    <div
      className={cn(
        'relative aspect-[63/88] w-full overflow-hidden rounded-lg bg-muted',
        className,
      )}
    >
      {current ? (
        <img
          key={current}
          src={current}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setAttempt((a) => ({ ...a, step: a.step + 1 }))}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-2 text-center text-xs text-muted-foreground">
          <ImageOff className="size-6" />
          Sem imagem
        </div>
      )}
    </div>
  )
}
