import { useEffect } from 'react'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Condition, Variant } from '../../shared/copies'
import type { Language } from '../../shared/languages'
import type { CollectionResponse, UpdateCollectionItemInput } from '../../shared/schemas'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { useUiStore } from '@/store/ui'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado.')

// O id do usuário faz parte da chave: trocar de conta nunca mostra a coleção da anterior.
const collectionKey = (userId: string | undefined) => ['collection', userId] as const

/**
 * Coleção do usuário logado, em todos os idiomas. Sem login a consulta fica desligada.
 * Cópias antigas sem tipo (de antes da Sprint 6) são completadas no servidor aos poucos.
 */
export function useCollection() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: collectionKey(user?.id),
    queryFn: () => api.getCollection(),
    enabled: Boolean(user),
  })

  const incomplete = query.data?.items.some((i) => i.types === null) ?? false
  // Vários componentes usam a coleção ao mesmo tempo: só um completa por vez.
  const completing = useIsMutating({ mutationKey: ['collection', 'complete'] }) > 0
  const complete = useMutation({
    mutationKey: ['collection', 'complete'],
    mutationFn: api.completeCollection,
    onSuccess: ({ updated, more }) => {
      if (updated > 0 || more) void qc.invalidateQueries({ queryKey: collectionKey(user?.id) })
    },
  })
  useEffect(() => {
    // Uma chamada por vez; se der erro, tenta de novo na próxima vez que a coleção carregar.
    if (incomplete && !completing && !complete.isError) complete.mutate()
  }, [incomplete, completing, complete])

  return query
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
    mutationFn: ({
      language: chosen,
      ...input
    }: {
      cardId: string
      quantity: number
      variant: Variant
      condition: Condition
      /** Sem idioma, vale o do seletor do cabeçalho. */
      language?: Language
    }) => api.addToCollection({ ...input, language: chosen ?? language }),
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
  const { user } = useAuth()
  const key = collectionKey(user?.id)
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
