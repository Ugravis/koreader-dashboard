'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Suspense, useEffect, type ReactNode } from 'react'
import { useI18n } from '@/i18n/provider'
import { LiveEventsProvider } from '@/lib/live-events'
import { SessionProvider, useSession } from '@/lib/use-session'
import { AppSidebar } from './app-sidebar'

/**
 * Client-side guard: the session cookie lives on the API origin.
 * Children always render (instant navigation); their API calls get 401 while redirecting.
 * `usePathname` stays inside Suspense: it suspends on dynamic routes (cacheComponents).
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const session = useSession()

  return (
    <SessionProvider value={session}>
      <LiveEventsProvider>
        <Suspense>
          <RedirectWhenAnonymous anonymous={session.status === 'anonymous'} />
        </Suspense>
        <div className="flex flex-1">
          <AppSidebar />
          <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-6 px-4 pt-3 pb-8 md:px-8 md:pt-8">
            {children}
          </main>
        </div>
      </LiveEventsProvider>
    </SessionProvider>
  )
}

function RedirectWhenAnonymous({ anonymous }: { anonymous: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const { href } = useI18n()
  useEffect(() => {
    if (anonymous) router.replace(`${href('/sign-in')}?redirect=${encodeURIComponent(pathname)}`)
  }, [anonymous, router, pathname, href])
  return null
}
