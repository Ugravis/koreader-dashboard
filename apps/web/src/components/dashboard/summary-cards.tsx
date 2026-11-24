'use client'

import { BookCheck, BookOpen, Clock, FileText } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, type Summary } from '@/lib/api'
import { formatDuration, formatNumber } from '@/lib/format'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; summary: Summary }

export function SummaryCards() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let active = true
    api
      .getSummary()
      .then((summary) => active && setState({ status: 'ready', summary }))
      .catch((err) => {
        // 401: the shell redirects to sign-in, keep the skeleton meanwhile.
        if (active && !(err instanceof ApiError && err.status === 401))
          setState({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [])

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load your statistics. Try again later.
      </p>
    )
  }

  const s = state.status === 'ready' ? state.summary : null
  const cards = [
    { label: 'Books', icon: BookOpen, value: s && formatNumber(s.books_count) },
    { label: 'Finished', icon: BookCheck, value: s && formatNumber(s.finished_count) },
    { label: 'Total reading time', icon: Clock, value: s && formatDuration(s.total_read_seconds) },
    { label: 'Pages read', icon: FileText, value: s && formatNumber(s.total_pages_read) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {cards.map(({ label, icon: Icon, value }) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Icon className="size-4" aria-hidden />
                {label}
              </CardDescription>
              {value === null ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">
                  {value}
                </CardTitle>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>
      {s && s.books_count === 0 && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              No reading data yet. Install the KOReader plugin and link your e-reader.
            </p>
            <Link href="/link" className={buttonVariants({ variant: 'outline' })}>
              Link a device
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
