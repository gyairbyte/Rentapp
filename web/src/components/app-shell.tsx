import { Sidebar } from './sidebar'
import { MobileNav } from './mobile-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:w-64 md:flex-col border-r bg-background">
        <Sidebar />
      </aside>
      <div className="md:pl-64">
        <main className="p-4 md:p-6 pb-24 md:pb-6">{children}</main>
      </div>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-background">
        <MobileNav />
      </nav>
    </div>
  )
}
