'use client'

import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, LogOut, User, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

interface AppHeaderProps {
  syncStatus?: SyncStatus
}

export default function AppHeader({ syncStatus = 'idle' }: AppHeaderProps) {
  const { data: session } = useSession()
  const [syncing, setSyncing] = useState(false)
  const [localStatus, setLocalStatus] = useState<SyncStatus>(syncStatus)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  async function handleSync() {
    setSyncing(true)
    setLocalStatus('syncing')
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      if (res.ok) {
        setLocalStatus('success')
        setTimeout(() => setLocalStatus('idle'), 3000)
      } else {
        setLocalStatus('error')
        setTimeout(() => setLocalStatus('idle'), 3000)
      }
    } catch {
      setLocalStatus('error')
      setTimeout(() => setLocalStatus('idle'), 3000)
    } finally {
      setSyncing(false)
    }
  }

  const syncLabel =
    localStatus === 'syncing'
      ? 'Syncing...'
      : localStatus === 'success'
      ? 'Synced!'
      : localStatus === 'error'
      ? 'Sync failed'
      : 'Sync now'

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className={cn(
            'gap-2 text-xs',
            localStatus === 'success' && 'text-green-600 border-green-300',
            localStatus === 'error' && 'text-red-600 border-red-300'
          )}
        >
          <RefreshCw
            className={cn('h-3 w-3', syncing && 'animate-spin')}
          />
          {syncLabel}
        </Button>
      </div>

      <div className="relative">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </div>
          <span className="hidden sm:block max-w-[120px] truncate">
            {session?.user?.name || session?.user?.email || 'Account'}
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>

        {userMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setUserMenuOpen(false)}
            />
            <div className="absolute right-0 top-9 z-50 w-48 rounded-md border border-border bg-card shadow-lg py-1">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-medium truncate">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {session?.user?.email}
                </p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
