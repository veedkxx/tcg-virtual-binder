import { useRef } from 'react'
import { CardImage } from '@/components/CardImage'
import { cn } from '@/lib/utils'

interface Props {
  src: string | null
  alt: string
  className?: string
  /** Inclinação máxima em graus. */
  maxTilt?: number
}

/**
 * Carta que inclina seguindo o ponteiro, com um brilho por cima (efeito "holo").
 * Escreve direto em variáveis CSS para não re-renderizar a cada movimento.
 * Quem prefere menos movimento (prefers-reduced-motion) vê a carta parada.
 */
export function TiltCard({ src, alt, className, maxTilt = 14 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  const move = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--rx', `${(0.5 - y) * maxTilt * 2}deg`)
    el.style.setProperty('--ry', `${(x - 0.5) * maxTilt * 2}deg`)
    el.style.setProperty('--gx', `${x * 100}%`)
    el.style.setProperty('--gy', `${y * 100}%`)
    el.style.setProperty('--glare', '1')
  }

  const leave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--glare', '0')
  }

  return (
    <div className={cn('tilt-scene', className)} onPointerMove={move} onPointerLeave={leave}>
      <div ref={ref} className="tilt-card">
        <CardImage src={src} alt={alt} className="rounded-xl shadow-2xl" />
        {src && <div className="tilt-glare" aria-hidden />}
      </div>
    </div>
  )
}

/** As imagens do TCGdex têm a mesma URL em baixa e alta (…/low.webp → …/high.webp). */
export function highResUrl(url: string | null) {
  return url ? url.replace(/\/low\.webp$/, '/high.webp') : null
}
