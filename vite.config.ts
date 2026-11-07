import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas mudam pouco: ficam em arquivos próprios e o navegador as mantém em cache
        // entre deploys (só o código do app muda de hash).
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react-router-dom'],
          data: ['@tanstack/react-query', 'zod', 'zustand'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-slot',
            'sonner',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Em dev, o Express roda em :3001 e o Vite repassa /api para ele.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
