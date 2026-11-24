'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, type Book } from '@/lib/api'
import { cleanMeta } from '@/lib/covers'
import { formatDuration } from '@/lib/format'
import { BookCover } from './book-cover'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; books: Book[] }

export function BookList() {
  const [state, setState] = useState<State>({ status: 'loading' })

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
  }, [])

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
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <BookCover md5={book.md5} title={book.title} authors={book.authors} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <p className="truncate font-medium">{book.title}</p>
        {authors && <p className="truncate text-sm text-muted-foreground">{authors}</p>}
        <div className="mt-auto flex flex-col gap-1">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`${book.title} progress`}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <p className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{percent}%</span>
            <span>{formatDuration(book.total_read_seconds)}</span>
          </p>
        </div>
      </div>
    </li>
  )
}
