// src/app/onboarding/page.tsx
import { ChatShell } from '@/components/chat/ChatShell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function OnboardingPage() {
  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden">
      <header className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-line bg-bg-overlay px-4 backdrop-blur">
        <span className="font-display text-[20px] text-ink">Research Digest</span>
        <ThemeToggle />
      </header>
      <ChatShell initialMode="docked" />
    </main>
  )
}
