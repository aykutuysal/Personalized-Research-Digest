import { ChatShell } from '@/components/chat/ChatShell'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export default function Home() {
  return (
    <main>
      <header className="fixed top-0 right-0 p-4 z-10">
        <ThemeToggle />
      </header>
      <ChatShell initialMode="hero" />
    </main>
  )
}
