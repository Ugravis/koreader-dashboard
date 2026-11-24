import { BarChart3, Library, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/logo'
import { buttonVariants } from '@/components/ui/button'
import { localizePath } from '@/i18n/config'
import { getDictionary, getLocale } from '@/i18n/server'

const ICONS = [RefreshCw, Library, BarChart3]

export default async function Home() {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()])
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <Logo className="size-12" />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">KoDashboard</h1>
        <p className="max-w-md text-muted-foreground">{t.home.tagline}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={localizePath(locale, '/sign-up')} className={buttonVariants({ size: 'lg' })}>
            {t.home.getStarted}
          </Link>
          <Link
            href={localizePath(locale, '/sign-in')}
            className={buttonVariants({ size: 'lg', variant: 'outline' })}
          >
            {t.home.signIn}
          </Link>
        </div>
      </div>
      <ul className="grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
        {t.home.features.map((f, i) => {
          const Icon = ICONS[i] ?? Library
          return (
            <li key={f.title} className="flex flex-col gap-2 rounded-xl border p-4">
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              <p className="font-medium">{f.title}</p>
              <p className="text-sm text-muted-foreground">{f.text}</p>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
