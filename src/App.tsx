import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/Layout'
import { CardPage } from '@/pages/CardPage'
import { CollectionPage } from '@/pages/CollectionPage'
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
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<SearchPage />} />
            <Route path="cards/:id" element={<CardPage />} />
            <Route path="collection" element={<CollectionPage />} />
            <Route
              path="*"
              element={<p className="py-16 text-center text-sm">Página não encontrada.</p>}
            />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-center" />
    </QueryClientProvider>
  )
}
