'use client'

import { ArrowLeft, Quote, StickyNote } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, type Annotation, type Book } from '@/lib/api'
import { cleanMeta } from '@/lib/covers'
import { formatDate, formatDuration, formatNumber } from '@/lib/format'
import { BookCover } from './book-cover'
import { BookStatusBadge, ProgressBar } from './book-status'

type State =
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean }
  | { status: 'ready'; book: Book; annotations: Annotation[] }

/** KOReader descriptions often contain HTML: keep the text only. */
const plainText = (html: string) =>
  html
    .replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export function BookDetail({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let active = true
    api
      .getBook(id)
      .then(({ book, annotations }) => active && setState({ status: 'ready', book, annotations }))
      .catch((err) => {
        if (!active || (err instanceof ApiError && err.status === 401)) return
        setState({ status: 'error', notFound: err instanceof ApiError && err.status === 404 })
      })
    return () => {
      active = false
    }
  }, [id])

  if (state.status === 'loading') return <BookDetailSkeleton />
  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <p role="alert" className="text-sm text-destructive">
          {state.notFound
            ? 'This book does not exist.'
            : 'Could not load this book. Try again later.'}
        </p>
      </div>
    )
  }

  const { book, annotations } = state
  const authors = cleanMeta(book.authors)?.split('\n').join(', ')
  const series = cleanMeta(book.series)
  const description = book.description ? plainText(book.description) : null
  const stats = [
    { label: 'Progress', value: `${Math.round(book.progress * 100)}%` },
    { label: 'Reading time', value: formatDuration(book.total_read_seconds) },
    { label: 'Pages read', value: formatNumber(book.pages_read) },
    { label: 'Last read', value: formatDate(book.last_read_at) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="flex gap-4">
        <BookCover
          md5={book.md5}
          title={book.title}
          authors={book.authors}
          isbn={book.isbn}
          className="w-24 sm:w-32"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{book.title}</h1>
          {authors && <p className="text-muted-foreground">{authors}</p>}
          {series && <p className="text-sm text-muted-foreground">{series}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <BookStatusBadge status={book.status} />
            {book.rating ? (
              <span className="text-sm" aria-label={`Rated ${book.rating} out of 5`}>
                {'★'.repeat(book.rating)}
                <span className="text-muted-foreground">{'★'.repeat(5 - book.rating)}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <ProgressBar value={book.progress} label={`${book.title} progress`} />
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="font-medium tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {book.review && (
        <Card>
          <CardHeader>
            <CardTitle>My review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{book.review}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Highlights and notes{' '}
            <span className="font-normal text-muted-foreground">({annotations.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {annotations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No highlights or notes for this book.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {annotations.map((a) => (
                <AnnotationItem key={a.id} annotation={a} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line text-muted-foreground">{description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AnnotationItem({ annotation: a }: { annotation: Annotation }) {
  const meta = [a.chapter, a.pageno ? `page ${a.pageno}` : null, a.datetime?.slice(0, 10)]
    .filter(Boolean)
    .join(' · ')
  return (
    <li className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      {a.text && (
        <blockquote className="flex gap-2 text-sm">
          <Quote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="whitespace-pre-line">{a.text}</span>
        </blockquote>
      )}
      {a.note && (
        <p className="flex gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="whitespace-pre-line">{a.note}</span>
        </p>
      )}
      {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
    </li>
  )
}

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Overview
    </Link>
  )
}

export function BookDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-4 w-20" />
      <div className="flex gap-4">
        <Skeleton className="aspect-[2/3] w-24 rounded-md sm:w-32" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}
