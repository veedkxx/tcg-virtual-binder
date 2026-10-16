import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/Layout'
import { RequireAuth } from '@/components/RequireAuth'
import { useTheme } from '@/lib/theme'
import { CardPage } from '@/pages/CardPage'
import { CollectionPage } from '@/pages/CollectionPage'
import { LoginPage } from '@/pages/LoginPage'
import { SearchPage } from '@/pages/SearchPage'

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
