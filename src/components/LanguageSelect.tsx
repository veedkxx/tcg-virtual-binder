import { Languages } from 'lucide-react'
import { ENABLED_LANGUAGES, LANGUAGE_LABELS, type Language } from '../../shared/languages'
import { useUiStore } from '@/store/ui'

/** Idioma das cartas: vale para busca, coleção e binders. */
export function LanguageSelect() {
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)

  return (
    <label
      className="relative inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-accent"
      title="Idioma das cartas"
    >
      <Languages className="hidden size-4 sm:block" aria-hidden />
      <span className="uppercase">{language}</span>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        aria-label="Idioma das cartas"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {ENABLED_LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {LANGUAGE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  )
}
