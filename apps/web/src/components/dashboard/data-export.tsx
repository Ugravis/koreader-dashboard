'use client'

import { Download } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n/provider'
import { api, type Book } from '@/lib/api'
import { authorLine, download, localDay } from '@/lib/reading'

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function booksCsv(books: Book[]) {
  const head = [
    'title',
    'authors',
    'series',
    'series_index',
    'genres',
    'language',
    'isbn',
    'status',
    'progress_percent',
    'reading_seconds',
    'pages_read',
    'pages',
    'highlights',
    'notes',
    'rating',
    'last_read_at',
  ]
  const rows = books.map((b) => [
    b.title,
    authorLine(b),
    b.series,
    b.series_index,
    b.keywords.join(' | '),
    b.language,
    b.isbn,
    b.status,
    Math.round(b.progress * 100),
    b.total_read_seconds,
    b.pages_read,
    b.pages,
    b.highlights_count,
    b.notes_count,
    b.rating,
    b.last_read_at,
  ])
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

/** Settings card: library as CSV, or everything (library, highlights, stats) as JSON. */
export function DataExport() {
  const { t } = useI18n()
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null)
  const [error, setError] = useState(false)

  async function run(kind: 'csv' | 'json') {
    const stamp = localDay()
    setBusy(kind)
    setError(false)
    try {
      if (kind === 'csv') {
        const { books } = await api.listBooks()
        download(`kodashboard-books-${stamp}.csv`, booksCsv(books), 'text/csv;charset=utf-8')
      } else {
        const [books, annotations, stats, goals] = await Promise.all([
          api.listBooks(),
          api.listAnnotations(),
          api.getStats(366),
          api.getGoals(),
        ])
        const data = {
          exported_at: new Date().toISOString(),
          ...books,
          ...annotations,
          stats,
          goals,
        }
        download(`kodashboard-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')
      }
    } catch {
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card id="export" className="scroll-mt-6">
      <CardHeader>
        <CardTitle>{t.exportData.title}</CardTitle>
        <CardDescription>{t.exportData.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => run('csv')}>
            <Download data-icon="inline-start" />
            {busy === 'csv' ? t.common.pleaseWait : t.exportData.csv}
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => run('json')}>
            <Download data-icon="inline-start" />
            {busy === 'json' ? t.common.pleaseWait : t.exportData.json}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t.exportData.error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
