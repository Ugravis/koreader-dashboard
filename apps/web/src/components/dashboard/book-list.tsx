'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useLiveVersion } from '@/lib/live-events'
import { api, ApiError, type Book } from '@/lib/api'
import { cleanMeta } from '@/lib/covers'
import { formatDuration } from '@/lib/format'
import { BookCover } from './book-cover'
import { BookStatusBadge, ProgressBar } from './book-status'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; books: Book[] }

export function BookList() {
  const [state, setState] = useState<State>({ status: 'loading' })
  // Refetch when a device sends data; the current data stays on screen meanwhile.
  const liveVersion = useLiveVersion()

  useEffect(() => {
    let active = true
    api
      .listBooks()
      .then(({ books }) => active && setState({ status: 'ready', books }))
      .catch((err) => {
        if (active && !(err instanceof ApiError && err.status === 401))
          setState({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [liveVersion])

  if (state.status === 'ready' && state.books.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Books</CardTitle>
      </CardHeader>
      <CardContent>
        {state.status === 'error' ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load your books. Try again later.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {state.status === 'loading'
              ? [0, 1, 2].map((i) => (
                  <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <Skeleton className="aspect-[2/3] w-14 shrink-0 rounded-md sm:w-16" />
                    <div className="flex flex-1 flex-col gap-2 py-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="mt-auto h-2 w-full" />
                    </div>
                  </li>
                ))
              : state.books.map((book) => <BookRow key={book.id} book={book} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function BookRow({ book }: { book: Book }) {
  const percent = Math.round(book.progress * 100)
  const authors = cleanMeta(book.authors)?.split('\n').join(', ')
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <Link
        href={`/dashboard/books/${book.id}`}
        className="-mx-2 flex gap-3 rounded-lg p-2 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BookCover
          key={book.cover_url ?? 'none'}
          md5={book.md5}
          title={book.title}
          authors={book.authors}
          isbn={book.isbn}
          coverUrl={book.cover_url}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium">{book.title}</p>
            <BookStatusBadge status={book.status} className="shrink-0" />
          </div>
          {authors && <p className="truncate text-sm text-muted-foreground">{authors}</p>}
          <div className="mt-auto flex flex-col gap-1">
            <ProgressBar value={book.progress} label={`${book.title} progress`} />
            <p className="flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{percent}%</span>
              <span>
                {book.highlights_count > 0 &&
                  `${book.highlights_count} highlight${book.highlights_count > 1 ? 's' : ''} · `}
                {formatDuration(book.total_read_seconds)}
              </span>
            </p>
          </div>
        </div>
      </Link>
    </li>
  )
}
