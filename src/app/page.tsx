// src/app/page.tsx
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function Home() {
  return (
    <main className="min-h-dvh p-8">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      <div className="mt-16 text-center">
        <p className="font-display text-5xl">Research Digest</p>
        <p className="mt-4 text-ink-soft">Theme toggle smoke test — Task 6.</p>
      </div>
    </main>
  )
}
