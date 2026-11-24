'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n/provider'
import { api } from '@/lib/api'
import { useLiveQuery } from '@/lib/use-live-query'
import { BookCard, BookCardSkeleton } from './book-card'

const MAX = 6
/** Four cards (two rows on phones), five from `xl`, six from `2xl`. */
const ROW =
  'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 [&>li:nth-child(n+5)]:hidden xl:[&>li:nth-child(5)]:block 2xl:[&>li:nth-child(6)]:block'

/** Books in progress, most recently read first. Hidden when there are none. */
export function ContinueReading() {
  const { t, href } = useI18n()
  const state = useLiveQuery(() => api.listBooks(), [])
  if (state.status === 'error') return null

  const books =
    state.status === 'ready'
      ? state.data.books
          .filter((b) => b.status === 'reading' || (b.status === null && b.progress > 0))
          .sort((a, b) => (b.last_read_at ?? '').localeCompare(a.last_read_at ?? ''))
          .slice(0, MAX)
      : null
  if (books?.length === 0) return null

  return (
    <section className="flex flex-col gap-4" aria-labelledby="continue-reading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="continue-reading" className="text-lg font-semibold tracking-tight">
          {t.overview.continueReading}
        </h2>
        <Link
          href={href('/dashboard/books')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {t.overview.seeAll}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className={ROW}>
        {books
          ? books.map((book) => <BookCard key={book.id} book={book} />)
          : Array.from({ length: 4 }, (_, i) => <BookCardSkeleton key={i} />)}
      </ul>
    </section>
  )
}
