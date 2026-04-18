import AppSidebar from '@/components/app-sidebar'
import AppHeader from '@/components/app-header'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="pl-56">
        <AppHeader syncStatus="idle" />
        <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  )
}
