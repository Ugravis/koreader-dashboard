'use client'

import { ArrowLeft, BookCheck, Clock, Library, Search, Tags } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { RankList } from '@/components/charts/rank-list'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/provider'
import { api } from '@/lib/api'
import { authorsOf, groupBy } from '@/lib/reading'
import { useLiveQuery } from '@/lib/use-live-query'
import { BOOK_GRID, BookCard, BookCardSkeleton } from './book-card'
import { STAT_GRID, StatTile } from './stat-tile'

export const authorHref = (name: string) => `/dashboard/authors/${encodeURIComponent(name)}`

export function AuthorsView() {
  const { t, format, href } = useI18n()
  const state = useLiveQuery(() => api.listBooks(), [])
  const [query, setQuery] = useState('')
  if (state.status === 'error')
    return (
      <p role="alert" className="text-sm text-destructive">
        {t.common.loadError}
      </p>
    )
  const q = query.trim().toLowerCase()
  const authors =
    state.status === 'ready'
      ? groupBy(state.data.books, authorsOf).filter((a) => !q || a.key.includes(q))
      : null

  return (
    <div className="flex flex-col gap-4">
      <label className="relative max-w-md">
        <span className="sr-only">{t.authors.search}</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.authors.search}
          className="pl-8"
        />
      </label>
      <Card>
        <CardContent>
          {authors?.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {q ? t.authors.noMatch : t.authors.empty}
            </p>
          ) : (
            <RankList
              items={
                authors?.map((a) => ({
                  key: a.key,
                  label: a.label,
                  detail: `${t.books.count(a.books.length)}, ${t.authors.finished(a.finished)}`,
                  value: a.seconds,
                  display: format.duration(a.seconds),
                  href: href(authorHref(a.label)),
                })) ?? null
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function AuthorDetail({ name }: { name: string }) {
  const { t, format, href } = useI18n()
  const state = useLiveQuery(() => api.listBooks(), [])
  const key = name.toLowerCase()
  const author =
    state.status === 'ready'
      ? groupBy(state.data.books, authorsOf).find((a) => a.key === key)
      : undefined
  const genres = author ? groupBy(author.books, (b) => b.keywords).slice(0, 5) : null

  const tiles = [
    {
      label: t.authors.books,
      icon: Library,
      value: author ? format.number(author.books.length) : null,
    },
    {
      label: t.status.complete,
      icon: BookCheck,
      value: author ? format.number(author.finished) : null,
    },
    {
      label: t.overview.totalTime,
      icon: Clock,
      value: author ? format.duration(author.seconds) : null,
    },
    {
      label: t.authors.genres,
      icon: Tags,
      value: author
        ? genres
            ?.map((g) => g.label)
            .slice(0, 2)
            .join(', ') || '—'
        : null,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={href('/dashboard/authors')}
        className="ml-12 inline-flex min-h-9 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:ml-0"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.authors.back}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
      {state.status === 'error' || (state.status === 'ready' && !author) ? (
        <p role="alert" className="text-sm text-destructive">
          {state.status === 'error' ? t.common.loadError : t.authors.notFound}
        </p>
      ) : (
        <>
          <div className={STAT_GRID}>
            {tiles.map((tile) => (
              <StatTile key={tile.label} {...tile} />
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{t.authors.books}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className={BOOK_GRID}>
                {author
                  ? author.books.map((b) => <BookCard key={b.id} book={b} />)
                  : Array.from({ length: 4 }, (_, i) => <BookCardSkeleton key={i} />)}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
