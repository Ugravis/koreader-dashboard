'use client'

import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import type { Book } from '@/lib/api'
import { cleanMeta } from '@/lib/covers'
import { Book3D } from './book-3d'
import { BookCover } from './book-cover'
import { BookStatusBadge, ProgressBar } from './book-status'

/** Responsive grid: a card never spans the page, from two columns on phones to six. */
export const BOOK_GRID =
  'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'

export function BookCard({ book }: { book: Book }) {
  const { t, format, href } = useI18n()
  const authors = cleanMeta(book.authors)?.split('\n').join(', ')
  return (
    <li>
      <Link
        href={href(`/dashboard/books/${book.id}`)}
        className="group flex h-full flex-col gap-2 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Book3D pages={book.pages} className="mr-[6%] mb-2">
          <BookCover
            key={book.cover_url ?? 'none'}
            md5={book.md5}
            title={book.title}
            authors={book.authors}
            isbn={book.isbn}
            coverUrl={book.cover_url}
            className="w-full rounded-l-sm rounded-r-md sm:w-full"
          />
          <BookStatusBadge status={book.status} className="absolute top-2 left-3 shadow-sm" />
        </Book3D>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="line-clamp-2 text-sm leading-snug font-medium group-hover:underline">
            {book.title}
          </p>
          {authors && <p className="truncate text-xs text-muted-foreground">{authors}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <ProgressBar value={book.progress} label={t.books.progressLabel(book.title)} />
          <p className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
            <span>{Math.round(book.progress * 100)}%</span>
            <span className="truncate">{format.duration(book.total_read_seconds)}</span>
          </p>
        </div>
      </Link>
    </li>
  )
}

export function BookCardSkeleton() {
  return (
    <li className="flex flex-col gap-2" aria-hidden>
      <Skeleton className="mr-[6%] mb-2 aspect-[2/3] rounded-lg" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-1.5 w-full" />
    </li>
  )
}
