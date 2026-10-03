import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { CollectionResponse } from '../../shared/schemas'
import { api } from '@/lib/api'
import { useUiStore } from '@/store/ui'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado.')

export function useCollection() {
  const language = useUiStore((s) => s.language)
  return useQuery({
    queryKey: ['collection', language],
    queryFn: () => api.getCollection(language),
  })
}

export function useAddToCollection() {
  const qc = useQueryClient()
  const language = useUiStore((s) => s.language)

  return useMutation({
    mutationFn: ({ cardId, quantity }: { cardId: string; quantity: number }) =>
      api.addToCollection({ cardId, quantity, language }),
    onSuccess: (item) => {
      toast.success(`${item.name} adicionada (agora você tem ${item.quantity}).`)
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['collection'] }),
  })
}

/** Define a quantidade exata, com atualização otimista e rollback em caso de erro. */
export function useSetQuantity() {
  const qc = useQueryClient()
  const language = useUiStore((s) => s.language)
  const key = ['collection', language] as const

  return useMutation({
    mutationFn: ({ cardId, quantity }: { cardId: string; quantity: number }) =>
      api.setQuantity(cardId, language, quantity),
    onMutate: async ({ cardId, quantity }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<CollectionResponse>(key)
      if (previous) {
        const items = previous.items.map((i) => (i.cardId === cardId ? { ...i, quantity } : i))
        qc.setQueryData<CollectionResponse>(key, {
          items,
          totals: {
            uniqueCards: items.length,
            totalCards: items.reduce((sum, i) => sum + i.quantity, 0),
          },
        })
      }
      return { previous }
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
      toast.error(errorMessage(e))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useRemoveFromCollection() {
  const qc = useQueryClient()
  const language = useUiStore((s) => s.language)

  return useMutation({
    mutationFn: ({ cardId }: { cardId: string; name: string }) =>
      api.removeFromCollection(cardId, language),
    onSuccess: (_data, { name }) => toast(`${name} removida da coleção.`),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['collection'] }),
  })
}
