// src/lib/theme.ts
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'rd:theme'

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'dark' ? 'dark' : 'light'
}

export function setTheme(next: Theme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* storage blocked — ignore */
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
