'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { useSessionContext } from '@/lib/use-session'
import { PageHeader } from './page-header'

export function Greeting() {
  const { t } = useI18n()
  const session = useSessionContext()
  if (session.status !== 'authenticated') {
    return (
      <div className="flex min-h-9 items-center pl-12 md:pl-0">
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }
  return <PageHeader title={t.overview.greeting(session.user.name.split(' ')[0] ?? '')} />
}
