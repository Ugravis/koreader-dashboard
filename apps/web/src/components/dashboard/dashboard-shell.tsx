'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { useSession } from '@/lib/use-session'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/devices', label: 'Devices' },
] as const

/**
 * Client-side guard: the session cookie lives on the API origin.
 * Children always render (instant navigation); their API calls get 401 while redirecting.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const session = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (session.status === 'anonymous') {
      router.replace(`/sign-in?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [session.status, router, pathname])

  async function signOut() {
    await api.signOut().catch(() => undefined)
    router.replace('/sign-in')
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-4 py-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            KOReader Dashboard
          </Link>
          {session.status === 'authenticated' ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          ) : (
            <Skeleton className="h-7 w-16" />
          )}
        </div>
        <nav className="mx-auto flex w-full max-w-4xl gap-1 px-4 pb-2" aria-label="Dashboard">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted',
                pathname === item.href && 'bg-muted font-medium text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </div>
  )
}
