import { useState } from 'react'
import { Heart, X } from 'lucide-react'
import { variantLabel, type Variant } from '../../shared/copies'
import { ENABLED_LANGUAGES, LANGUAGE_LABELS, type Language } from '../../shared/languages'
import type { CardDetail } from '../../shared/schemas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAddToWishlist, useCardWishes, useRemoveFromWishlist } from '@/hooks/useWishlist'

const selectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * "Quero esta carta": por padrão qualquer idioma e versão; dá para especificar os dois. Mostra os
 * desejos já feitos desta carta, com opção de tirar.
 */
export function WishButton({ card }: { card: CardDetail }) {
  const wishes = useCardWishes(card.id)
  const add = useAddToWishlist()
  const remove = useRemoveFromWishlist()
  const [language, setLanguage] = useState<Language | ''>('')
  const [variant, setVariant] = useState<Variant | ''>('')

  return (
    <div className="space-y-3">
      {wishes.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {wishes.map((w) => (
            <li key={w.id}>
              <Badge variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                <Heart className="size-3 fill-current" />
                {w.language ? LANGUAGE_LABELS[w.language] : 'Qualquer idioma'} ·{' '}
                {w.variant ? variantLabel(w.variant) : 'qualquer versão'}
                <button
                  type="button"
                  onClick={() => remove.mutate({ id: w.id, name: w.name })}
                  aria-label="Tirar este desejo"
                  className="rounded p-0.5 hover:bg-background/50"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language | '')}
          aria-label="Idioma desejado"
          className={selectClass}
        >
          <option value="">Qualquer idioma</option>
          {ENABLED_LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {LANGUAGE_LABELS[l]}
            </option>
          ))}
        </select>
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          aria-label="Versão desejada"
          className={selectClass}
        >
          <option value="">Qualquer versão</option>
          {card.variants.map((v) => (
            <option key={v} value={v}>
              {variantLabel(v)}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={add.isPending}
          onClick={() =>
            add.mutate({
              cardId: card.id,
              lang: card.language,
              language: language || null,
              variant: variant || null,
            })
          }
        >
          <Heart /> Quero esta carta
        </Button>
      </div>
    </div>
  )
}
