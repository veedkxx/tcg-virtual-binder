import {
  CONDITIONS,
  CONDITION_LABELS,
  VARIANT_LABELS,
  type Condition,
  type Variant,
} from '../../shared/copies'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Selos "Reverse holo · LP"; "Normal" e "NM" são o padrão e só aparecem com `full`. */
export function CopyBadges({
  variant,
  condition,
  full = false,
  className,
}: {
  variant: Variant
  condition: Condition
  full?: boolean
  className?: string
}) {
  const showVariant = full || variant !== 'normal'
  const showCondition = full || condition !== 'NM'
  if (!showVariant && !showCondition) return null
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {showVariant && (
        <Badge variant={variant === 'normal' ? 'outline' : 'secondary'}>
          {VARIANT_LABELS[variant]}
        </Badge>
      )}
      {showCondition && (
        <Badge variant="outline" title={CONDITION_LABELS[condition]}>
          {condition}
        </Badge>
      )}
    </span>
  )
}

/** Botões de variante; mostra só as variantes em que a carta foi impressa. */
export function VariantPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Variant[]
  value: Variant
  onChange: (v: Variant) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Variante">
      {options.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cn(
            'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
            v === value && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {VARIANT_LABELS[v]}
        </button>
      ))}
    </div>
  )
}

export function ConditionSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: Condition
  onChange: (c: Condition) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as Condition)}
      aria-label="Condição"
      className={cn(
        'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
    >
      {CONDITIONS.map((c) => (
        <option key={c} value={c}>
          {c} · {CONDITION_LABELS[c]}
        </option>
      ))}
    </select>
  )
}

export function VariantSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Variant[]
  value: Variant
  onChange: (v: Variant) => void
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      disabled={disabled || options.length < 2}
      onChange={(e) => onChange(e.target.value as Variant)}
      aria-label="Variante"
      className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
    >
      {/* A cópia pode ter uma variante que o TCGdex não lista mais: mantém visível. */}
      {[...new Set([value, ...options])].map((v) => (
        <option key={v} value={v}>
          {VARIANT_LABELS[v]}
        </option>
      ))}
    </select>
  )
}
