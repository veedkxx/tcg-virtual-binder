import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_LANGUAGE, ENABLED_LANGUAGES, type Language } from '../../shared/languages'
import { MAX_QUANTITY } from '../../shared/schemas'

/**
 * Somente estado de UI. Dados do servidor (cartas, coleção) ficam no TanStack Query.
 *
 * Todos os hooks leem o idioma desta store e o incluem nas query keys, então trocar o idioma
 * troca busca, coleção e binders de uma vez.
 */
interface UiState {
  language: Language
  searchQuery: string
  searchPage: number
  /** Quantidade escolhida no detalhe antes de confirmar "Adicionar à coleção". */
  pendingQuantity: number

  setLanguage: (language: Language) => void
  setSearchQuery: (q: string) => void
  setSearchPage: (page: number) => void
  setPendingQuantity: (n: number) => void
}

// localStorage pode não existir ou lançar (aba privada, cookies bloqueados): aí só não lembra.
const safeStorage = createJSONStorage(() => {
  try {
    const probe = '__tcg_binder__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
  }
})

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      searchQuery: '',
      searchPage: 1,
      pendingQuantity: 1,

      setLanguage: (language) => set({ language, searchPage: 1 }),
      setSearchQuery: (searchQuery) => set({ searchQuery, searchPage: 1 }),
      setSearchPage: (searchPage) => set({ searchPage }),
      setPendingQuantity: (n) => set({ pendingQuantity: Math.min(Math.max(n, 1), MAX_QUANTITY) }),
    }),
    {
      name: 'tcg-binder-ui',
      storage: safeStorage,
      // Só o idioma sobrevive a recarregar a página.
      partialize: (s) => ({ language: s.language }),
      merge: (persisted, current) => {
        const language = (persisted as { language?: string } | undefined)?.language
        return (ENABLED_LANGUAGES as readonly string[]).includes(language ?? '')
          ? { ...current, language: language as Language }
          : current
      },
    },
  ),
)
