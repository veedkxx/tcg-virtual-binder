import { lazy, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/Layout'
import { RequireAuth } from '@/components/RequireAuth'
import { useTheme } from '@/lib/theme'
import { SearchPage } from '@/pages/SearchPage'

// A busca (página inicial) vai no pacote principal; as outras páginas carregam sob demanda
// e são pré-carregadas quando o navegador fica ocioso, para a navegação continuar instantânea.
const pages = {
  card: () => import('@/pages/CardPage').then((m) => ({ default: m.CardPage })),
  login: () => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
  collection: () => import('@/pages/CollectionPage').then((m) => ({ default: m.CollectionPage })),
  binders: () => import('@/pages/BindersPage').then((m) => ({ default: m.BindersPage })),
  binder: () => import('@/pages/BinderPage').then((m) => ({ default: m.BinderPage })),
}
const CardPage = lazy(pages.card)
const LoginPage = lazy(pages.login)
const CollectionPage = lazy(pages.collection)
const BindersPage = lazy(pages.binders)
const BinderPage = lazy(pages.binder)

function usePreloadPages() {
  useEffect(() => {
    const preload = () => Object.values(pages).forEach((load) => void load())
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(preload, { timeout: 3000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(preload, 1500)
    return () => clearTimeout(id)
  }, [])
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  const { theme } = useTheme()
  usePreloadPages()

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<SearchPage />} />
            <Route path="cards/:id" element={<CardPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route element={<RequireAuth />}>
              <Route path="collection" element={<CollectionPage />} />
              <Route path="binders" element={<BindersPage />} />
              <Route path="binders/:id" element={<BinderPage />} />
            </Route>
            <Route
              path="*"
              element={<p className="py-16 text-center text-sm">Página não encontrada.</p>}
            />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-center" theme={theme} />
    </QueryClientProvider>
  )
}
