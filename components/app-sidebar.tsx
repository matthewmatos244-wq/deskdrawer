'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Database,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/chat', label: 'Chat', icon: MessageSquare },
  { href: '/app/documents', label: 'Documents', icon: FileText },
  { href: '/app/sources', label: 'Sources', icon: Database },
  { href: '/app/settings', label: 'Settings', icon: Settings },
]

export default function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-card border-r border-border flex flex-col z-40">
      <div className="px-4 py-5 border-b border-border">
        <h1 className="text-lg font-bold text-foreground">DeskDrawer</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Workspace memory</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/app' ? pathname === '/app' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} DeskDrawer
        </p>
      </div>
    </aside>
  )
}
