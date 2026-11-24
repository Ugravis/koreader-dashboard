'use client'

import { Download, Quote, Search, StickyNote } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { api, type AnnotationEntry } from '@/lib/api'
import { cleanMeta } from '@/lib/covers'
import { dailyIndex, download } from '@/lib/reading'
import { useLiveQuery } from '@/lib/use-live-query'
import { useToday } from '@/lib/use-today'

/** KOReader highlight colors, as shown on the device. */
const SWATCH: Record<string, string> = {
  yellow: '#f5d90a',
  orange: '#f5a524',
  red: '#e5484d',
  green: '#46a758',
  olive: '#8b8d4b',
  cyan: '#05a2c2',
  blue: '#3e63dd',
  purple: '#8e4ec6',
  gray: '#8b8d98',
}
const colorOf = (a: AnnotationEntry) => (a.color ?? 'yellow').toLowerCase()

/** Markdown export: one section per book, a quote per highlight. */
function toMarkdown(list: AnnotationEntry[]) {
  const books = new Map<string, AnnotationEntry[]>()
  for (const a of list) books.set(a.book_id, [...(books.get(a.book_id) ?? []), a])
  return [...books.values()]
    .map((items) => {
      const head = items[0]!
      const authors = cleanMeta(head.book_authors)?.split('\n').join(', ')
      const body = items
        .map((a) => {
          const quote = a.text
            ? a.text
                .split('\n')
                .map((l) => `> ${l}`)
                .join('\n')
            : ''
          const meta = [a.chapter, a.pageno ? `p. ${a.pageno}` : null].filter(Boolean).join(' · ')
          return [quote, a.note ? `\n${a.note}` : '', meta ? `\n_${meta}_` : ''].join('').trim()
        })
        .join('\n\n')
      return `## ${head.book_title}${authors ? ` — ${authors}` : ''}\n\n${body}`
    })
    .join('\n\n')
}

export function HighlightsView() {
  const { t } = useI18n()
  const state = useLiveQuery(() => api.listAnnotations(), [])
  const [query, setQuery] = useState('')
  const [book, setBook] = useState('')
  const [color, setColor] = useState('')

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t.common.loadError}
      </p>
    )
  }
  const all = state.status === 'ready' ? state.data.annotations : null
  const books = all && [...new Map(all.map((a) => [a.book_id, a.book_title])).entries()]
  const colors = all && [...new Set(all.filter((a) => a.text).map(colorOf))]
  const q = query.trim().toLowerCase()
  const list = all?.filter(
    (a) =>
      (!book || a.book_id === book) &&
      (!color || (a.text && colorOf(a) === color)) &&
      (!q || [a.text, a.note, a.book_title, a.chapter].some((s) => s?.toLowerCase().includes(q))),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">{t.highlights.search}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.highlights.search}
            className="pl-8"
          />
        </label>
        <select
          value={book}
          onChange={(e) => setBook(e.target.value)}
          aria-label={t.highlights.book}
          className="h-8 max-w-56 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          <option value="">{t.highlights.allBooks}</option>
          {books?.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={!list?.length}
          onClick={() => list && download('highlights.md', toMarkdown(list), 'text/markdown')}
        >
          <Download data-icon="inline-start" />
          {t.highlights.export}
        </Button>
      </div>
      {colors && colors.length > 1 && (
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label={t.highlights.color}
        >
          <Button size="sm" variant={color ? 'ghost' : 'secondary'} onClick={() => setColor('')}>
            {t.highlights.allColors}
          </Button>
          {colors.map((c) => (
            <Button
              key={c}
              size="sm"
              variant={color === c ? 'secondary' : 'ghost'}
              aria-pressed={color === c}
              onClick={() => setColor(color === c ? '' : c)}
            >
              <span
                className="size-3 rounded-full border"
                style={{ background: SWATCH[c] ?? SWATCH.yellow }}
                aria-hidden
              />
              {t.highlights.colors[c] ?? c}
            </Button>
          ))}
        </div>
      )}
      <div className="text-sm text-muted-foreground" role="status">
        {list ? t.highlights.count(list.length) : <Skeleton className="h-4 w-24" />}
      </div>
      {!list ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
      ) : all?.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">{t.highlights.empty}</p>
          </CardContent>
        </Card>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.highlights.noMatch}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.slice(0, 300).map((a) => (
            <HighlightCard key={a.id} annotation={a} />
          ))}
        </ul>
      )}
    </div>
  )
}

function HighlightCard({
  annotation: a,
  as = 'li',
}: {
  annotation: AnnotationEntry
  as?: 'li' | 'div'
}) {
  const { t, format, href } = useI18n()
  const Tag = as
  const day = a.datetime?.slice(0, 10)
  const meta = [a.chapter, a.pageno ? t.book.page(a.pageno) : null, day && format.day(day)]
    .filter(Boolean)
    .join(' · ')
  return (
    <Tag className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      {a.text && (
        <blockquote
          className="border-l-4 pl-3 text-sm whitespace-pre-line"
          style={{ borderColor: SWATCH[colorOf(a)] ?? SWATCH.yellow }}
        >
          {a.text}
        </blockquote>
      )}
      {a.note && (
        <p className="flex gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="whitespace-pre-line">{a.note}</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        <Link href={href(`/dashboard/books/${a.book_id}`)} className="font-medium hover:underline">
          {a.book_title}
        </Link>
        {meta && ` · ${meta}`}
      </p>
    </Tag>
  )
}

/** Overview card: the same highlight all day, another one tomorrow. */
export function HighlightOfTheDay() {
  const { t, href } = useI18n()
  const state = useLiveQuery(() => api.listAnnotations(), [])
  const today = useToday()
  if (state.status === 'error') return null
  const quotes = state.status === 'ready' ? state.data.annotations.filter((a) => a.text) : null
  if (quotes?.length === 0) return null
  const pick = today ? quotes?.[dailyIndex(quotes.length, today)] : undefined
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Quote className="size-4" aria-hidden />
          {t.highlights.ofTheDay}
        </CardTitle>
        <CardDescription>
          <Link href={href('/dashboard/highlights')} className="hover:text-foreground">
            {t.highlights.seeAll}
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pick ? <HighlightCard annotation={pick} as="div" /> : <Skeleton className="h-24 w-full" />}
      </CardContent>
    </Card>
  )
}
