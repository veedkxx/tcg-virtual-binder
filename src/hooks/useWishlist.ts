import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AddToWishlistInput, WishlistItem } from '../../shared/schemas'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Algo deu errado.')

const wishlistKey = (userId: string | undefined) => ['wishlist', userId] as const

/** Lista de desejos do usuário logado (desligada sem login). */
export function useWishlist() {
  const { user } = useAuth()
  return useQuery({
    queryKey: wishlistKey(user?.id),
    queryFn: api.getWishlist,
    enabled: Boolean(user),
  })
}

/** Desejos de uma carta (qualquer idioma/versão ou específicos). */
export function useCardWishes(cardId: string): WishlistItem[] {
  const wishlist = useWishlist()
  return (wishlist.data?.items ?? []).filter((w) => w.cardId === cardId)
}

export function useAddToWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddToWishlistInput) => api.addToWishlist(input),
    onSuccess: (w) => toast.success(`${w.name} está na sua lista de desejos.`),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  })
}

export function useRemoveFromWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: number; name: string }) => api.removeFromWishlist(id),
    onSuccess: (_r, { name }) => toast(`${name} saiu da lista de desejos.`),
    onError: (e) => toast.error(errorMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  })
}
