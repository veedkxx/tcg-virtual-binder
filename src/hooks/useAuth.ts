import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'

export const authKey = ['auth', 'me'] as const

/** Quem está logado. `isLoading` é true só até a primeira resposta de /api/auth/me. */
export function useAuth() {
  const query = useQuery({
    queryKey: authKey,
    queryFn: api.getMe,
    staleTime: 5 * 60_000,
    retry: false,
  })
  return { user: query.data?.user ?? null, isLoading: query.isPending }
}

/** Endereço que inicia o login com Google e volta para `returnTo` (um caminho interno). */
export function loginUrl(returnTo = '/') {
  return `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      qc.setQueryData(authKey, { user: null })
      // Nada da coleção do usuário anterior pode ficar em cache.
      qc.removeQueries({ queryKey: ['collection'] })
    },
    onError: () => toast.error('Não foi possível sair. Tente de novo.'),
  })
}
