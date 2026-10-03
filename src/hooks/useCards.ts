import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUiStore } from '@/store/ui'

export function useCardSearch(q: string, page: number) {
  const language = useUiStore((s) => s.language)
  return useQuery({
    queryKey: ['cards', 'search', language, q, page],
    queryFn: () => api.searchCards(q, page, language),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData, // evita "piscar" ao trocar de página
    staleTime: 5 * 60_000,
  })
}

export function useCard(id: string) {
  const language = useUiStore((s) => s.language)
  return useQuery({
    queryKey: ['cards', 'detail', language, id],
    queryFn: () => api.getCard(id, language),
    enabled: id.length > 0,
    staleTime: 60 * 60_000,
  })
}
