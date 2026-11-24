'use client'

import { BookCheck, Target, Timer } from 'lucide-react'
import Link from 'next/link'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/i18n/provider'
import { api, type Book, type Goals } from '@/lib/api'
import { useLiveQuery } from '@/lib/use-live-query'
import { useToday } from '@/lib/use-today'

/** Books finished in `year`: the status date from KOReader, else the last reading. */
export const finishedIn = (books: Book[], year: number) =>
  books.filter(
    (b) =>
      b.status === 'complete' &&
      (b.status_modified ?? b.last_read_at ?? '').slice(0, 4) === String(year),
  )

function Gauge({ value, goal, label }: { value: number; goal: number; label: string }) {
  const ratio = Math.min(1, value / goal)
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={goal}
      aria-valuenow={value}
    >
      <div
        className={ratio >= 1 ? 'h-full rounded-full bg-chart-6' : 'h-full rounded-full bg-chart-1'}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}

/** Overview card: yearly books and today's minutes against the goals. */
export function GoalsCard() {
  const { t, format, href } = useI18n()
  const goals = useLiveQuery(() => api.getGoals(), [])
  const books = useLiveQuery(() => api.listBooks(), [])
  const stats = useLiveQuery(() => api.getStats(7), [])
  const today = useToday()
  if (goals.status === 'error') return null
  const g = goals.status === 'ready' && today ? goals.data : null
  const year = Number(today?.slice(0, 4))
  const finished = books.status === 'ready' ? finishedIn(books.data.books, year).length : null
  const todayMinutes =
    stats.status === 'ready' ? Math.floor((stats.data.days.at(-1)?.seconds ?? 0) / 60) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-4" aria-hidden />
          {t.goals.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!g ? (
          <Skeleton className="h-16 w-full" />
        ) : !g.yearly_books && !g.daily_minutes ? (
          <p className="text-sm text-muted-foreground">
            {t.goals.none}{' '}
            <Link href={href('/dashboard/settings#goals')} className="underline">
              {t.goals.set}
            </Link>
          </p>
        ) : (
          <>
            {g.yearly_books && (
              <div className="flex flex-col gap-1.5">
                <p className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <BookCheck className="size-4 text-muted-foreground" aria-hidden />
                    {t.goals.yearly(year)}
                  </span>
                  <span className="tabular-nums">
                    {finished === null ? '…' : t.goals.progress(finished, g.yearly_books)}
                  </span>
                </p>
                <Gauge value={finished ?? 0} goal={g.yearly_books} label={t.goals.yearly(year)} />
              </div>
            )}
            {g.daily_minutes && (
              <div className="flex flex-col gap-1.5">
                <p className="flex justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Timer className="size-4 text-muted-foreground" aria-hidden />
                    {t.goals.today}
                  </span>
                  <span className="tabular-nums">
                    {todayMinutes === null
                      ? '…'
                      : `${format.duration(todayMinutes * 60)} / ${format.duration(g.daily_minutes * 60)}`}
                  </span>
                </p>
                <Gauge value={todayMinutes ?? 0} goal={g.daily_minutes} label={t.goals.today} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Settings form; an empty field removes the goal. */
export function GoalsForm({ initial }: { initial: Goals }) {
  const { t } = useI18n()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const num = (k: string) => {
      const n = Number(data.get(k))
      return Number.isInteger(n) && n > 0 ? n : null
    }
    setStatus('saving')
    try {
      await api.saveGoals({
        yearly_books: num('yearly_books'),
        daily_minutes: num('daily_minutes'),
      })
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="yearly_books">{t.goals.yearlyLabel}</Label>
          <Input
            id="yearly_books"
            name="yearly_books"
            type="number"
            min={1}
            inputMode="numeric"
            defaultValue={initial.yearly_books ?? ''}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="daily_minutes">{t.goals.dailyLabel}</Label>
          <Input
            id="daily_minutes"
            name="daily_minutes"
            type="number"
            min={1}
            inputMode="numeric"
            defaultValue={initial.daily_minutes ?? ''}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? t.common.pleaseWait : t.goals.save}
        </Button>
        <p className="text-sm text-muted-foreground" role="status">
          {status === 'saved' ? t.goals.saved : status === 'error' ? t.goals.error : ''}
        </p>
      </div>
    </form>
  )
}

export function GoalsSettings() {
  const { t } = useI18n()
  const state = useLiveQuery(() => api.getGoals(), [])
  return (
    <Card id="goals" className="scroll-mt-6">
      <CardHeader>
        <CardTitle>{t.goals.title}</CardTitle>
        <CardDescription>{t.goals.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === 'ready' ? (
          <GoalsForm initial={state.data} />
        ) : state.status === 'error' ? (
          <p className="text-sm text-destructive">{t.common.loadError}</p>
        ) : (
          <Skeleton className="h-24 w-full" />
        )}
      </CardContent>
    </Card>
  )
}
