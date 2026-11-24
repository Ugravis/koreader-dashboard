'use client'

import { Monitor, Moon, Plus, Sun, Volume2, VolumeX } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { PairingSteps } from '@/components/pairing-steps'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LOCALE_COOKIE,
  LOCALE_NAMES,
  localizePath,
  locales,
  stripLocale,
  type Locale,
} from '@/i18n/config'
import { useI18n } from '@/i18n/provider'
import { setPageSound, usePageSound } from '@/lib/page-sound'
import { themes, useTheme, type Theme } from '@/lib/theme'
import { useSessionContext } from '@/lib/use-session'
import { cn } from '@/lib/utils'
import { SignOutButton } from './app-sidebar'
import { DataExport } from './data-export'
import { DeviceList } from './device-list'
import { GoalsSettings } from './goals'

const THEME_ICON = { light: Sun, dark: Moon, system: Monitor }

export function SettingsView() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <ProfileSection />
      <GoalsSettings />
      <AppearanceSection />
      <LanguageSection />
      <BooksSection />
      <DevicesSection />
      <DataExport />
      <AccountSection />
    </div>
  )
}

function Section({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ProfileSection() {
  const { t } = useI18n()
  const session = useSessionContext()
  const user = session.status === 'authenticated' ? session.user : null
  const rows = [
    { label: t.settings.profile.name, value: user?.name },
    { label: t.settings.profile.email, value: user?.email },
  ]
  return (
    <Section
      id="profile"
      title={t.settings.profile.title}
      description={t.settings.profile.description}
    >
      <dl className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="truncate text-sm font-medium">
              {row.value ?? <Skeleton className="h-5 w-40" />}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}

/** Segmented choice, one button per option. */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-3">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
            value === option.value && 'border-primary bg-muted font-medium',
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

function BooksSection() {
  const { t } = useI18n()
  const sound = usePageSound()
  return (
    <Section id="books" title={t.settings.books.title} description={t.settings.books.description}>
      <Choice<'on' | 'off'>
        label={t.settings.books.sound}
        value={sound ? 'on' : 'off'}
        onChange={(v) => setPageSound(v === 'on')}
        options={[
          {
            value: 'on',
            label: t.settings.books.on,
            icon: <Volume2 className="size-4" aria-hidden />,
          },
          {
            value: 'off',
            label: t.settings.books.off,
            icon: <VolumeX className="size-4" aria-hidden />,
          },
        ]}
      />
    </Section>
  )
}

function AppearanceSection() {
  const { t } = useI18n()
  const { theme, setTheme } = useTheme()
  return (
    <Section
      id="appearance"
      title={t.settings.appearance.title}
      description={t.settings.appearance.description}
    >
      <Choice<Theme>
        label={t.settings.appearance.title}
        value={theme}
        onChange={setTheme}
        options={themes.map((value) => {
          const Icon = THEME_ICON[value]
          return {
            value,
            label: t.settings.appearance[value],
            icon: <Icon className="size-4" aria-hidden />,
          }
        })}
      />
    </Section>
  )
}

function LanguageSection() {
  const { t, locale } = useI18n()
  function change(next: Locale) {
    if (next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    const { pathname, search, hash } = window.location
    // Full load: the root layout (<html lang>, theme script) renders again for the new locale.
    window.location.assign(`${localizePath(next, stripLocale(pathname))}${search}${hash}`)
  }
  return (
    <Section
      id="language"
      title={t.settings.language.title}
      description={t.settings.language.description}
    >
      <Choice<Locale>
        label={t.settings.language.title}
        value={locale}
        onChange={change}
        options={locales.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
      />
    </Section>
  )
}

function DevicesSection() {
  const { t, href } = useI18n()
  return (
    <Section
      id="devices"
      title={t.settings.devices.title}
      description={t.settings.devices.description}
      action={
        <Link href={href('/link')} className={buttonVariants({ size: 'sm' })}>
          <Plus data-icon="inline-start" />
          {t.settings.devices.link}
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        <DeviceList />
        <details className="group rounded-lg border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none">
            {t.pairing.title}
          </summary>
          <PairingSteps className="rounded-t-none border-0 shadow-none ring-0" />
        </details>
      </div>
    </Section>
  )
}

function AccountSection() {
  const { t } = useI18n()
  return (
    <Section
      id="account"
      title={t.settings.account.title}
      description={t.settings.account.description}
    >
      <SignOutButton labelled />
    </Section>
  )
}
