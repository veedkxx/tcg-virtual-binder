import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Condition, Variant } from '../../shared/copies'
import type { Language } from '../../shared/languages'
import type { CollectionResponse, UpdateCollectionItemInput } from '../../shared/schemas'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { useUiStore } from '@/store/ui'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado.')

// O id do usuário faz parte da chave: trocar de conta nunca mostra a coleção da anterior.
const collectionKey = (userId: string | undefined, language: Language) =>
  ['collection', userId, language] as const

/** Coleção do usuário logado. Sem login a consulta fica desligada (data = undefined). */
export function useCollection() {
  const language = useUiStore((s) => s.language)
  const { user } = useAuth()
  return useQuery({
    queryKey: collectionKey(user?.id, language),
    queryFn: () => api.getCollection(language),
    enabled: Boolean(user),
  })
}

function useInvalidateCollection() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['collection'] })
    // Bolsos mostram a cópia; mudar ou remover a cópia muda os binders.
    void qc.invalidateQueries({ queryKey: ['binders'] })
  }
}

export function useAddToCollection() {
  const language = useUiStore((s) => s.language)
  const invalidate = useInvalidateCollection()

  return useMutation({
    mutationFn: (input: {
      cardId: string
      quantity: number
      variant: Variant
      condition: Condition
    }) => api.addToCollection({ ...input, language }),
    onSuccess: (item) => {
      toast.success(`${item.name} adicionada (agora você tem ${item.quantity} desta cópia).`)
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  })
}

/**
 * Muda quantidade, variante e/ou condição de uma cópia. Só a quantidade é otimista: mudar
 * variante/condição pode juntar duas cópias, e quem decide isso é o servidor.
 */
export function useUpdateCollectionItem() {
  const qc = useQueryClient()
  const language = useUiStore((s) => s.language)
  const { user } = useAuth()
  const key = collectionKey(user?.id, language)
  const invalidate = useInvalidateCollection()

  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: UpdateCollectionItemInput }) =>
      api.updateCollectionItem(id, patch),
    onMutate: async ({ id, patch }) => {
      if (patch.quantity === undefined || patch.variant || patch.condition) return {}
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<CollectionResponse>(key)
      if (previous) {
        const items = previous.items.map((i) =>
          i.id === id ? { ...i, quantity: patch.quantity! } : i,
        )
        qc.setQueryData<CollectionResponse>(key, {
          items,
          totals: { ...previous.totals, totalCards: items.reduce((s, i) => s + i.quantity, 0) },
        })
      }
      return { previous }
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
      toast.error(errorMessage(e))
    },
    onSettled: invalidate,
  })
}

export function useRemoveCollectionItem() {
  const invalidate = useInvalidateCollection()

  return useMutation({
    mutationFn: ({ id }: { id: number; name: string }) => api.removeCollectionItem(id),
    onSuccess: (_data, { name }) => toast(`${name} removida da coleção.`),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  })
}
