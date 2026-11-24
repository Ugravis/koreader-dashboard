'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Suspense, useEffect, type ReactNode } from 'react'
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
 * `usePathname` stays inside Suspense: it suspends on dynamic routes (cacheComponents).
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const session = useSession()
  const router = useRouter()

  async function signOut() {
    await api.signOut().catch(() => undefined)
    router.replace('/sign-in')
  }

  return (
    <div className="flex flex-1 flex-col">
      <Suspense>
        <RedirectWhenAnonymous anonymous={session.status === 'anonymous'} />
      </Suspense>
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
        <Suspense fallback={<Nav pathname={null} />}>
          <CurrentNav />
        </Suspense>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
        {children}
      </main>
    </div>
  )
}

function RedirectWhenAnonymous({ anonymous }: { anonymous: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    if (anonymous) router.replace(`/sign-in?redirect=${encodeURIComponent(pathname)}`)
  }, [anonymous, router, pathname])
  return null
}

function CurrentNav() {
  return <Nav pathname={usePathname()} />
}

function Nav({ pathname }: { pathname: string | null }) {
  const active = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard' || pathname?.startsWith('/dashboard/books/')
      : pathname === href
  return (
    <nav className="mx-auto flex w-full max-w-4xl gap-1 px-4 pb-2" aria-label="Dashboard">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active(item.href) ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted',
            active(item.href) && 'bg-muted font-medium text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
