'use client'

import Link from 'next/link'
import { RankList } from '@/components/charts/rank-list'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import type { Book } from '@/lib/api'
import { groupBy, sagas } from '@/lib/reading'
import { cn } from '@/lib/utils'

const TOP = 10

/** Reading time per genre (book keywords). */
export function GenreStats({ books }: { books: Book[] | null }) {
  const { t, format } = useI18n()
  const genres = books && groupBy(books, (b) => b.keywords).slice(0, TOP)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.stats.genres.title}</CardTitle>
        <CardDescription>{t.stats.genres.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {genres?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.stats.genres.empty}</p>
        ) : (
          <RankList
            items={
              genres?.map((g) => ({
                key: g.key,
                label: g.label,
                detail: t.books.count(g.books.length),
                value: g.seconds || g.books.length,
                display: format.duration(g.seconds),
              })) ?? null
            }
          />
        )}
      </CardContent>
    </Card>
  )
}

/** Each series with its volumes: finished, started, missing. */
export function SagaStats({ books }: { books: Book[] | null }) {
  const { t, format, href } = useI18n()
  const list = books && sagas(books).slice(0, TOP)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.stats.sagas.title}</CardTitle>
        <CardDescription>{t.stats.sagas.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!list ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.stats.sagas.empty}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {list.map((saga) => (
              <li key={saga.key} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{saga.label}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {t.stats.sagas.volumes(saga.finished, saga.volumes)} ·{' '}
                    {format.duration(saga.seconds)}
                  </span>
                </div>
                <ol className="flex flex-wrap gap-1">
                  {saga.books.map((b) => (
                    <li key={b.id}>
                      <Link
                        href={href(`/dashboard/books/${b.id}`)}
                        title={`${b.series_index ? `#${b.series_index} ` : ''}${b.title}`}
                        className={cn(
                          'flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-xs tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                          b.status === 'complete'
                            ? 'bg-chart-1 text-white'
                            : b.progress > 0
                              ? 'bg-chart-1/25 text-foreground'
                              : 'border text-muted-foreground',
                        )}
                      >
                        {b.series_index ?? '?'}
                      </Link>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
        {list && list.length > 0 && (
          <p className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend className="bg-chart-1" label={t.status.complete} />
            <Legend className="bg-chart-1/25" label={t.status.reading} />
            <Legend className="border" label={t.status.new} />
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-3 rounded-[3px]', className)} aria-hidden />
      {label}
    </span>
  )
}
