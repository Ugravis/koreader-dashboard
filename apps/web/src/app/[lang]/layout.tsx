import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { locales } from '@/i18n/config'
import { I18nProvider } from '@/i18n/provider'
import { getDictionary, getLocale } from '@/i18n/server'
import { themeScript } from '@/lib/theme-script'
import '../globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }))
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary()
  return {
    title: { template: '%s · KoDashboard', default: 'KoDashboard' },
    description: t.meta.description,
  }
}

export default async function RootLayout({ children }: LayoutProps<'/[lang]'>) {
  const locale = await getLocale()
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  )
}
