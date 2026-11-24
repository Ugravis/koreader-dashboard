'use client'

import { Dialog } from '@base-ui/react/dialog'
import {
  BarChart3,
  CalendarDays,
  Highlighter,
  House,
  Library,
  LogOut,
  Menu,
  PenLine,
  Settings,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { stripLocale } from '@/i18n/config'
import { useI18n } from '@/i18n/provider'
import { api } from '@/lib/api'
import { useSessionContext } from '@/lib/use-session'
import { cn } from '@/lib/utils'
import { SyncStatus } from './sync-status'
import { ThemeToggle } from './theme-toggle'

type NavKey =
  | 'overview'
  | 'books'
  | 'authors'
  | 'highlights'
  | 'stats'
  | 'calendar'
  | 'review'
  | 'community'
  | 'settings'
type NavItem = { key: NavKey; path: string; icon: LucideIcon }

const MAIN: NavItem[] = [
  { key: 'overview', path: '/dashboard', icon: House },
  { key: 'books', path: '/dashboard/books', icon: Library },
  { key: 'authors', path: '/dashboard/authors', icon: PenLine },
  { key: 'highlights', path: '/dashboard/highlights', icon: Highlighter },
  { key: 'stats', path: '/dashboard/stats', icon: BarChart3 },
  { key: 'calendar', path: '/dashboard/calendar', icon: CalendarDays },
  { key: 'review', path: '/dashboard/review', icon: Sparkles },
  { key: 'community', path: '/dashboard/community', icon: Users },
]
const SETTINGS: NavItem = { key: 'settings', path: '/dashboard/settings', icon: Settings }

const isActive = (path: string, current: string | null) =>
  current !== null &&
  (path === '/dashboard' ? current === path : current === path || current.startsWith(`${path}/`))

/** Vertical navigation: fixed column from `md`, drawer opened from a menu button below. */
export function AppSidebar() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <>
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <SidebarContent />
      </aside>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          render={
            <Button
              variant="outline"
              size="icon-lg"
              className="fixed top-3 left-3 z-40 bg-background/90 backdrop-blur md:hidden"
              aria-label={t.nav.openMenu}
            />
          }
        >
          <Menu />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden" />
          <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r bg-sidebar text-sidebar-foreground shadow-lg duration-200 outline-none data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left md:hidden">
            <Dialog.Title className="sr-only">{t.nav.label}</Dialog.Title>
            <Dialog.Close
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3.5 right-3"
                  aria-label={t.nav.closeMenu}
                />
              }
            >
              <X />
            </Dialog.Close>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t, href } = useI18n()
  const session = useSessionContext()

  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <Link
        href={href('/dashboard')}
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-semibold tracking-tight"
      >
        <Logo />
        KoDashboard
      </Link>

      <Suspense fallback={<Nav current={null} onNavigate={onNavigate} />}>
        <CurrentNav onNavigate={onNavigate} />
      </Suspense>

      <div className="mt-auto flex flex-col gap-3">
        {session.status === 'authenticated' && (
          <div className="px-2">
            <SyncStatus />
          </div>
        )}
        <div className="flex items-center gap-2 border-t pt-3">
          {session.status === 'authenticated' ? (
            <div className="flex min-w-0 flex-1 flex-col px-2">
              <span className="truncate text-sm font-medium">{session.user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{session.user.email}</span>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-1 px-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          )}
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}

function CurrentNav({ onNavigate }: { onNavigate?: () => void }) {
  return <Nav current={stripLocale(usePathname())} onNavigate={onNavigate} />
}

function Nav({ current, onNavigate }: { current: string | null; onNavigate?: () => void }) {
  const { t } = useI18n()
  return (
    <nav aria-label={t.nav.label} className="flex flex-1 flex-col gap-1">
      {MAIN.map((item) => (
        <NavLink key={item.key} item={item} current={current} onNavigate={onNavigate} />
      ))}
      <div className="mt-auto">
        <NavLink item={SETTINGS} current={current} onNavigate={onNavigate} />
      </div>
    </nav>
  )
}

function NavLink({
  item,
  current,
  onNavigate,
}: {
  item: NavItem
  current: string | null
  onNavigate?: () => void
}) {
  const { t, href } = useI18n()
  const active = isActive(item.path, current)
  const Icon = item.icon
  return (
    <Link
      href={href(item.path)}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
      )}
    >
      <Icon className="size-4" aria-hidden />
      {t.nav[item.key]}
    </Link>
  )
}

export function SignOutButton({ labelled = false }: { labelled?: boolean }) {
  const { t, href } = useI18n()
  const router = useRouter()
  async function signOut() {
    await api.signOut().catch(() => undefined)
    router.replace(href('/sign-in'))
  }
  if (labelled) {
    return (
      <Button variant="outline" onClick={signOut}>
        <LogOut data-icon="inline-start" />
        {t.nav.signOut}
      </Button>
    )
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={signOut}
      aria-label={t.nav.signOut}
      title={t.nav.signOut}
    >
      <LogOut />
    </Button>
  )
}
