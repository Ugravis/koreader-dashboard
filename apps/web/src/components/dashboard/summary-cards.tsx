'use client'

import { BookCheck, BookOpen, Clock, FileText } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useI18n } from '@/i18n/provider'
import { api } from '@/lib/api'
import { useLiveQuery } from '@/lib/use-live-query'
import { STAT_GRID, StatTile } from './stat-tile'

export function SummaryCards() {
  const { t: i18n, format, href } = useI18n()
  const t = i18n.overview
  const state = useLiveQuery(() => api.getSummary(), [])

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {i18n.common.loadError}
      </p>
    )
  }

  const s = state.status === 'ready' ? state.data : null
  const tiles = [
    { label: t.books, icon: BookOpen, value: s && format.number(s.books_count) },
    { label: t.finished, icon: BookCheck, value: s && format.number(s.finished_count) },
    { label: t.totalTime, icon: Clock, value: s && format.duration(s.total_read_seconds) },
    { label: t.pagesRead, icon: FileText, value: s && format.number(s.total_pages_read) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className={STAT_GRID}>
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>
      {s && s.books_count === 0 && (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{t.empty}</p>
            <Link href={href('/link')} className={buttonVariants({ variant: 'outline' })}>
              {t.linkDevice}
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
