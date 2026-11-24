'use client'

import { useI18n } from '@/i18n/provider'
import type { Annotation, Book } from '@/lib/api'
import { plainText } from '@/lib/reading'
import { cn } from '@/lib/utils'
import { SWATCH } from './highlights-view'

/**
 * Sizes in `cqw` (percent of the page width): the text scales with the book. A page is
 * about 150cqw tall; the text box holds a whole number of lines so none is cut in half.
 */
const LINE = 6
const LINES = 19

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Maecenas fermentum consequat mi. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, neque. Aliquam faucibus, elit ut dictum aliquet, felis nisl adipiscing sapien, sed malesuada diam lacus eget erat. Cras mollis scelerisque nunc. Nullam arcu. Aliquam consequat.'

const sentences = (text: string) =>
  text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)

/** Text of the book: its own description first, then filler, as a pool of sentences. */
export function sentencePool(book: Pick<Book, 'description'>) {
  const own = book.description ? sentences(plainText(book.description)) : []
  return [...own, ...sentences(LOREM)]
}

/** Same paragraphs for a page on every render, from its number. */
function paragraphs(pool: string[], page: number) {
  const out: string[] = []
  let i = (page * 7) % pool.length
  let size = 0
  for (let p = 0; size < 1600; p++) {
    const count = 2 + ((page + p) % 4)
    const text = Array.from({ length: count }, () => pool[i++ % pool.length]).join(' ')
    out.push(text)
    size += text.length
  }
  return out
}

/** A new chapter every this many pages, from page 3. */
const CHAPTER_EVERY = 24

export type PageSide = 'left' | 'right'

/** One printed page: title page, chapter openings, running headers, folio, highlights. */
export function BookPage({
  book,
  authors,
  page,
  total,
  side,
  pool,
  notes,
  ribbon,
}: {
  book: Pick<Book, 'title' | 'language'>
  authors: string
  page: number
  total: number
  side: PageSide
  pool: string[]
  notes: Annotation[]
  ribbon?: boolean
}) {
  const { t } = useI18n()
  const chapter = page >= 3 && (page - 3) % CHAPTER_EVERY === 0
  const marks = notes.filter((n) => n.text && Math.min(n.pageno ?? 0, total) === page)
  // The last page ends early, on "The End".
  const body =
    page === total ? [paragraphs(pool, page)[0]!.slice(0, 280) + '…'] : paragraphs(pool, page)

  return (
    <span
      lang={book.language ?? undefined}
      className={cn(
        'absolute inset-0 @container overflow-hidden bg-[#fbf8f1] font-serif text-neutral-800 dark:bg-[#e6e1d5]',
        side === 'right'
          ? 'rounded-r-sm shadow-[inset_12px_0_16px_-12px_rgba(0,0,0,.3)]'
          : 'rounded-l-sm shadow-[inset_-12px_0_16px_-12px_rgba(0,0,0,.3)]',
      )}
    >
      {page === 1 ? (
        <span className="flex h-full flex-col items-center px-[12cqw] pt-[38cqw] text-center">
          <span className="line-clamp-4 text-[9cqw] leading-[11cqw]">{book.title}</span>
          <span className="mt-[6cqw] text-[5cqw] text-neutral-500 italic">{authors}</span>
          <span className="mt-[8cqw] text-[5cqw] text-neutral-400">❦</span>
        </span>
      ) : page === 2 ? (
        <span className="absolute inset-x-[12cqw] bottom-[14cqw] text-center text-[3.2cqw] text-neutral-400">
          {authors} — {book.title}
        </span>
      ) : (
        <>
          {!chapter && (
            <span
              className={cn(
                'absolute inset-x-[11cqw] top-[7cqw] truncate text-[3.2cqw] tracking-[0.15em] text-neutral-500 uppercase',
                side === 'left' ? 'text-left' : 'text-right',
              )}
            >
              {side === 'left' ? authors : book.title}
            </span>
          )}
          <span
            className="absolute inset-x-[11cqw] top-[16cqw] overflow-hidden text-justify text-[4.3cqw] hyphens-auto"
            style={{ height: `${LINE * LINES}cqw`, lineHeight: `${LINE}cqw` }}
          >
            {chapter && (
              <span
                className="block text-center text-[6cqw] tracking-wide"
                style={{ height: `${LINE * 4}cqw`, lineHeight: `${LINE * 3}cqw` }}
              >
                {t.book3d.chapter(Math.floor((page - 3) / CHAPTER_EVERY) + 1)}
              </span>
            )}
            {body.map((text, i) => (
              <span
                key={i}
                className={cn(
                  'block indent-[1.4em]',
                  chapter &&
                    i === 0 &&
                    'indent-0 first-letter:float-left first-letter:mr-[1cqw] first-letter:text-[13cqw] first-letter:leading-[12cqw]',
                )}
              >
                {/* The reader's own highlights of this page come first, in their color. */}
                {i === 0 &&
                  marks.map((m) => (
                    <mark
                      key={m.id}
                      className="rounded-[0.5cqw] px-[0.5cqw] text-neutral-900 [box-decoration-break:clone]"
                      style={{
                        background: `${SWATCH[(m.color ?? 'yellow').toLowerCase()] ?? SWATCH.yellow}66`,
                      }}
                    >
                      {m.text}{' '}
                    </mark>
                  ))}
                {text}
              </span>
            ))}
            {page === total && (
              <span className="block pt-[6cqw] text-center tracking-[0.3em]">{t.book3d.end}</span>
            )}
          </span>
          <span className="absolute inset-x-0 bottom-[6cqw] text-center text-[3.4cqw] text-neutral-500 tabular-nums">
            {page}
          </span>
        </>
      )}
      {ribbon && (
        <span className="absolute top-0 right-[16cqw] h-[55cqw] w-[5cqw] bg-chart-8 shadow-sm [clip-path:polygon(0_0,100%_0,100%_100%,50%_88%,0_100%)]" />
      )}
    </span>
  )
}
