import { Link, Outlet } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'

export function AppShell() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Link to="/" className="text-lg font-semibold">
            lnovel
          </Link>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/settings" aria-label="設定">
              <Settings className="size-5" />
            </Link>
          </Button>
        </div>
      </header>
      <Outlet />
      <Toaster />
    </div>
  )
}
