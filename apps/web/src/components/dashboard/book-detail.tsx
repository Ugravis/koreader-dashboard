'use client'

import { ArrowLeft, Quote, StickyNote } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { api, type Annotation } from '@/lib/api'
import { cleanMeta } from '@/lib/covers'
import { authorsOf, plainText } from '@/lib/reading'
import { useLiveQuery } from '@/lib/use-live-query'
import { authorHref } from './authors-view'
import { BookCover } from './book-cover'
import { BookStats } from './book-stats'
import { BookStatusBadge, ProgressBar } from './book-status'

export function BookDetail({ id }: { id: string }) {
  const { t: i18n, format, href } = useI18n()
  const t = i18n.book
  const state = useLiveQuery(() => api.getBook(id), [id])

  if (state.status === 'loading') return <BookDetailSkeleton />
  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <p role="alert" className="text-sm text-destructive">
          {state.notFound ? t.notFound : t.loadError}
        </p>
      </div>
    )
  }

  const { book, annotations } = state.data
  const authors = authorsOf(book)
  const series = cleanMeta(book.series)
  const description = book.description ? plainText(book.description) : null
  const stats = [
    { label: t.progress, value: `${Math.round(book.progress * 100)}%` },
    { label: t.readingTime, value: format.duration(book.total_read_seconds) },
    { label: t.pagesRead, value: format.number(book.pages_read) },
    { label: t.lastRead, value: format.dateTime(book.last_read_at) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="flex gap-4">
        <BookCover
          key={book.cover_url ?? 'none'}
          md5={book.md5}
          title={book.title}
          authors={book.authors}
          isbn={book.isbn}
          coverUrl={book.cover_url}
          className="w-24 sm:w-32"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{book.title}</h1>
          {authors.length > 0 && (
            <p className="text-muted-foreground">
              {authors.map((a, i) => (
                <span key={a}>
                  {i > 0 && ', '}
                  <Link
                    href={href(authorHref(a))}
                    className="hover:text-foreground hover:underline"
                  >
                    {a}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {series && <p className="text-sm text-muted-foreground">{series}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <BookStatusBadge status={book.status} />
            {book.rating ? (
              <span className="text-sm" aria-label={t.rated(book.rating)}>
                {'★'.repeat(book.rating)}
                <span className="text-muted-foreground">{'★'.repeat(5 - book.rating)}</span>
              </span>
            ) : null}
          </div>
          {book.keywords.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-1" aria-label={t.genres}>
              {book.keywords.slice(0, 6).map((k) => (
                <li
                  key={k}
                  className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {k}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <ProgressBar value={book.progress} label={i18n.books.progressLabel(book.title)} />
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

      <BookStats book={book} annotations={annotations} />

      {book.review && (
        <Card>
          <CardHeader>
            <CardTitle>{t.review}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{book.review}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {t.annotations}{' '}
            <span className="font-normal text-muted-foreground">({annotations.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {annotations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noAnnotations}</p>
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
            <CardTitle>{t.description}</CardTitle>
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
  const { t, format } = useI18n()
  const day = a.datetime?.slice(0, 10)
  const meta = [a.chapter, a.pageno ? t.book.page(a.pageno) : null, day && format.day(day)]
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
  const { t, href } = useI18n()
  return (
    <Link
      href={href('/dashboard/books')}
      className="ml-12 inline-flex min-h-9 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:ml-0"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t.book.back}
    </Link>
  )
}

export function BookDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="ml-12 h-9 w-20 md:ml-0" />
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
