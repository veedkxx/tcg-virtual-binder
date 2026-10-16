import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

// Mantenha a chave e a regra de padrão em sincronia com o script inline do index.html.
const STORAGE_KEY = 'theme'
const DEFAULT_THEME: Theme = 'dark'

const listeners = new Set<() => void>()

function read(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : DEFAULT_THEME
  } catch {
    // localStorage indisponível (modo privado, bloqueio de cookies): usa o padrão.
    return DEFAULT_THEME
  }
}

function apply(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // A troca vale só para esta visita.
  }
  apply(theme)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Mantém abas abertas em sincronia quando o tema muda em outra.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      apply(read())
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => DEFAULT_THEME)
  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  }
}
