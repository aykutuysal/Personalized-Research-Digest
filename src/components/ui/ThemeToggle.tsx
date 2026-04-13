// src/components/ui/ThemeToggle.tsx
'use client'

import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { getTheme, toggleTheme, type Theme } from '@/lib/theme'

export function ThemeToggle() {
  const [theme, setLocalTheme] = useState<Theme>(() => getTheme())

  const onClick = () => {
    setLocalTheme(toggleTheme())
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors duration-[var(--dur-sm)] hover:bg-accent-soft hover:text-ink focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-ring"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
