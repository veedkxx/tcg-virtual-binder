import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { loginUrl, useAuth } from '@/hooks/useAuth'

// Códigos devolvidos pelo servidor em /login?error=...
const ERROR_MESSAGES: Record<string, string> = {
  denied: 'O login foi cancelado.',
  state: 'A tentativa de login expirou. Tente de novo.',
  google: 'Não foi possível entrar com o Google. Tente de novo.',
  unverified: 'O e-mail dessa conta Google não está verificado.',
  config: 'O login ainda não está configurado neste servidor.',
}

export function LoginPage() {
  const { user, isLoading } = useAuth()
  const [params] = useSearchParams()
  const location = useLocation()

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const errorCode = params.get('error')

  if (!isLoading && user) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-sm space-y-6 py-16 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Entrar</h1>
        <p className="text-sm text-muted-foreground">
          Entre com sua conta Google para guardar e acompanhar a sua coleção.
        </p>
      </div>

      {errorCode && (
        <p role="alert" className="text-sm text-destructive">
          {ERROR_MESSAGES[errorCode] ?? 'Não foi possível entrar. Tente de novo.'}
        </p>
      )}

      <Button asChild size="lg" className="w-full">
        <a href={loginUrl(from)}>Continuar com o Google</a>
      </Button>
    </div>
  )
}
