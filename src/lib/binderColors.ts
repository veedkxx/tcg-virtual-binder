import type { BinderColor } from '../../shared/binderStyle'

/**
 * Aparência de cada cor de binder. Classes escritas por inteiro para o Tailwind encontrá-las.
 * `swatch`: bolinha de escolha; `page`: fundo das páginas; `cover`: faixa da capa.
 */
export const BINDER_COLOR_CLASSES: Record<
  BinderColor,
  { swatch: string; page: string; cover: string }
> = {
  slate: {
    swatch: 'bg-slate-500',
    page: 'from-slate-500/30 to-slate-500/5',
    cover: 'bg-slate-500',
  },
  red: { swatch: 'bg-red-500', page: 'from-red-500/30 to-red-500/5', cover: 'bg-red-500' },
  orange: {
    swatch: 'bg-orange-500',
    page: 'from-orange-500/30 to-orange-500/5',
    cover: 'bg-orange-500',
  },
  amber: {
    swatch: 'bg-amber-400',
    page: 'from-amber-400/30 to-amber-400/5',
    cover: 'bg-amber-400',
  },
  green: {
    swatch: 'bg-green-500',
    page: 'from-green-500/30 to-green-500/5',
    cover: 'bg-green-500',
  },
  teal: { swatch: 'bg-teal-500', page: 'from-teal-500/30 to-teal-500/5', cover: 'bg-teal-500' },
  blue: { swatch: 'bg-blue-500', page: 'from-blue-500/30 to-blue-500/5', cover: 'bg-blue-500' },
  violet: {
    swatch: 'bg-violet-500',
    page: 'from-violet-500/30 to-violet-500/5',
    cover: 'bg-violet-500',
  },
  pink: { swatch: 'bg-pink-500', page: 'from-pink-500/30 to-pink-500/5', cover: 'bg-pink-500' },
}

/** Fundo da página do binder: a cor escolhida ou o neutro de antes. */
export const pageBackground = (color: BinderColor | null) =>
  color ? BINDER_COLOR_CLASSES[color].page : 'from-muted/60 to-muted/20'
