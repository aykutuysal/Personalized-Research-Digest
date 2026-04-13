// src/app/onboarding/page.tsx
import { ChatShell } from '@/components/chat/ChatShell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function OnboardingPage() {
  return (
    <main>
      <header className="sticky top-0 z-10 flex h-[var(--header-h)] items-center justify-between border-b border-line bg-bg-overlay px-4 backdrop-blur">
        <span className="font-display text-[20px] text-ink">Research Digest</span>
        <ThemeToggle />
      </header>
      <ChatShell initialMode="docked" />
    </main>
  )
}
