import { create } from 'zustand'
import { DEFAULT_LANGUAGE, type Language } from '../../shared/languages'
import { MAX_QUANTITY } from '../../shared/schemas'

/**
 * Somente estado de UI. Dados do servidor (cartas, coleção) ficam no TanStack Query.
 *
 * `language` já vive aqui para que o seletor de idioma futuro seja só uma tela nova:
 * todos os hooks leem o idioma desta store e o incluem nas query keys.
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

export const useUiStore = create<UiState>((set) => ({
  language: DEFAULT_LANGUAGE,
  searchQuery: '',
  searchPage: 1,
  pendingQuantity: 1,

  setLanguage: (language) => set({ language }),
  setSearchQuery: (searchQuery) => set({ searchQuery, searchPage: 1 }),
  setSearchPage: (searchPage) => set({ searchPage }),
  setPendingQuantity: (n) => set({ pendingQuantity: Math.min(Math.max(n, 1), MAX_QUANTITY) }),
}))
