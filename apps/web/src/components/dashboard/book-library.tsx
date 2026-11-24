'use client'

import { Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/provider'
import { api, type Book } from '@/lib/api'
import { useLiveQuery } from '@/lib/use-live-query'
import { cn } from '@/lib/utils'
import { BOOK_GRID, BookCard, BookCardSkeleton } from './book-card'

const FILTERS = ['all', 'reading', 'complete', 'abandoned', 'new'] as const
type Filter = (typeof FILTERS)[number]
const SORTS = ['recent', 'title', 'time', 'progress'] as const
type Sort = (typeof SORTS)[number]

const matchesFilter = (book: Book, filter: Filter) =>
  filter === 'all' || (filter === 'new' ? book.status === null : book.status === filter)

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function sortBooks(books: Book[], sort: Sort, locale: string) {
  const list = [...books]
  if (sort === 'title') return list.sort((a, b) => a.title.localeCompare(b.title, locale))
  if (sort === 'time') return list.sort((a, b) => b.total_read_seconds - a.total_read_seconds)
  if (sort === 'progress') return list.sort((a, b) => b.progress - a.progress)
  // Never opened books last.
  return list.sort((a, b) => (b.last_read_at ?? '').localeCompare(a.last_read_at ?? ''))
}

/** All books as cards, with search, status filter and sort. */
export function BookLibrary() {
  const { t, locale } = useI18n()
  const state = useLiveQuery(() => api.listBooks(), [])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const deferredQuery = useDeferredValue(query)

  const books = state.status === 'ready' ? state.data.books : null
  const visible = useMemo(() => {
    if (!books) return null
    const q = normalize(deferredQuery.trim())
    const filtered = books.filter(
      (b) =>
        matchesFilter(b, filter) &&
        (!q || normalize(`${b.title} ${b.authors ?? ''} ${b.series ?? ''}`).includes(q)),
    )
    return sortBooks(filtered, sort, locale)
  }, [books, deferredQuery, filter, sort, locale])

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t.common.loadError}
      </p>
    )
  }

  if (books?.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.books.empty}</p>
        </CardContent>
      </Card>
    )
  }

  const counts =
    books &&
    Object.fromEntries(FILTERS.map((f) => [f, books.filter((b) => matchesFilter(b, f)).length]))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.books.search}
            aria-label={t.books.search}
            className="h-9 pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t.books.title} className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                  filter === f &&
                    'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {t.books.filters[f]}
                {counts && <span className="ml-1 tabular-nums opacity-70">{counts[f]}</span>}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {t.books.sort.label}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-7 rounded-md border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t.books.sort[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {visible && (
        <p className="-mt-3 text-xs text-muted-foreground" aria-live="polite">
          {t.books.count(visible.length)}
        </p>
      )}

      {visible?.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.books.noMatch}</p>
      ) : (
        <ul className={BOOK_GRID} aria-busy={!visible}>
          {visible
            ? visible.map((book) => <BookCard key={book.id} book={book} />)
            : Array.from({ length: 10 }, (_, i) => <BookCardSkeleton key={i} />)}
        </ul>
      )}
    </div>
  )
}
