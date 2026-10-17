import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SetType } from '../../shared/setTypes'
import type { AddToPocketInput, BinderDetail, CollectionItem } from '../../shared/schemas'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import { useUiStore } from '@/store/ui'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado.')

// Tudo começa com 'binders' para invalidar/limpar de uma vez (logout, mudança na coleção).
const listKey = (userId: string | undefined, language: string) =>
  ['binders', userId, language] as const
const detailKey = (userId: string | undefined, id: string) =>
  ['binders', userId, 'detail', id] as const

/** Coleções do TCGdex, usadas como molde de binder. Mudam pouco: cache longo. */
export function useSets() {
  const language = useUiStore((s) => s.language)
  return useQuery({
    queryKey: ['sets', language],
    queryFn: () => api.listSets(language),
    staleTime: 60 * 60_000,
  })
}

export function useBinders() {
  const language = useUiStore((s) => s.language)
  const { user } = useAuth()
  return useQuery({
    queryKey: listKey(user?.id, language),
    queryFn: () => api.listBinders(language),
    enabled: Boolean(user),
  })
}

export function useBinder(id: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: detailKey(user?.id, id),
    queryFn: () => api.getBinder(id),
    enabled: Boolean(user) && id.length > 0,
  })
}

function useInvalidateBinders() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['binders'] })
    // binderCount dos itens da coleção muda junto.
    void qc.invalidateQueries({ queryKey: ['collection'] })
  }
}

export function useCreateBinder() {
  const language = useUiStore((s) => s.language)
  const invalidate = useInvalidateBinders()
  return useMutation({
    mutationFn: (input: { name: string; setId?: string; setType?: SetType; fill: boolean }) =>
      api.createBinder({ ...input, language }),
    onSuccess: (binder) => {
      toast.success(
        binder.set && binder.filled > 0
          ? `Binder criado com ${binder.filled} ${binder.filled === 1 ? 'carta' : 'cartas'} que você já tem.`
          : 'Binder criado.',
      )
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  })
}

export function useRenameBinder(id: string) {
  const invalidate = useInvalidateBinders()
  return useMutation({
    mutationFn: (name: string) => api.renameBinder(id, name),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  })
}

export function useDeleteBinder(id: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const invalidate = useInvalidateBinders()
  return useMutation({
    mutationFn: () => api.deleteBinder(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: detailKey(user?.id, id) })
      toast('Binder apagado. As cartas continuam na sua coleção.')
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  })
}

export function useFillBinder(id: string) {
  const invalidate = useInvalidateBinders()
  return useMutation({
    mutationFn: () => api.fillBinder(id),
    onSuccess: ({ placed }) => {
      toast.success(
        placed === 0
          ? 'Nenhuma carta nova para colocar.'
          : `${placed} ${placed === 1 ? 'carta colocada' : 'cartas colocadas'} no binder.`,
      )
    },
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  })
}

/** Coloca/troca/esvazia um bolso, com atualização otimista no detalhe do binder. */
export function useSlotMutations(binderId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const key = detailKey(user?.id, binderId)
  const invalidate = useInvalidateBinders()

  const optimistic = async (update: (slots: BinderDetail['slots']) => BinderDetail['slots']) => {
    await qc.cancelQueries({ queryKey: key })
    const previous = qc.getQueryData<BinderDetail>(key)
    if (previous) {
      const slots = update(previous.slots).sort((a, b) => a.position - b.position)
      qc.setQueryData<BinderDetail>(key, { ...previous, slots, filled: slots.length })
    }
    return { previous }
  }

  const rollback = (e: unknown, _vars: unknown, ctx: { previous?: BinderDetail } | undefined) => {
    if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    toast.error(errorMessage(e))
  }

  const put = useMutation({
    mutationFn: ({ position, item }: { position: number; item: CollectionItem }) =>
      api.putSlot(binderId, position, item.id),
    onMutate: ({ position, item }) =>
      optimistic((slots) => [...slots.filter((s) => s.position !== position), { position, item }]),
    onError: rollback,
    onSettled: invalidate,
  })

  const clear = useMutation({
    mutationFn: ({ position }: { position: number }) => api.clearSlot(binderId, position),
    onMutate: ({ position }) => optimistic((slots) => slots.filter((s) => s.position !== position)),
    onError: rollback,
    onSettled: invalidate,
  })

  /** Carta que falta num binder de coleção: entra na coleção e já vai para o bolso. */
  const addNew = useMutation({
    mutationFn: ({ position, input }: { position: number; input?: AddToPocketInput }) =>
      api.addToPocket(binderId, position, input),
    onSuccess: (item) => toast.success(`${item.name} adicionada à coleção e ao binder.`),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: invalidate,
  })

  return { put, clear, addNew }
}
