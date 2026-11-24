'use client'

import { useEffect, useRef } from 'react'
import { useI18n } from '@/i18n/provider'
import { addDays, weekdayIndex } from '@/lib/reading'
import { cn } from '@/lib/utils'
import { durationLevel, LEVEL_CLASS, LevelLegend } from './levels'
import { useChartTooltip } from './tooltip'

export type HeatDay = { seconds: number; pages: number; books: number }

/**
 * One square per day from `from` to `to`, one column per week (Monday on top), colored by
 * reading time. Scrolls horizontally on small screens.
 */
export function ContributionGraph({
  from,
  to,
  days,
}: {
  from: string
  to: string
  days: Map<string, HeatDay>
}) {
  const { t, format, locale } = useI18n()
  const { bind, layer } = useChartTooltip()
  const scroller = useRef<HTMLDivElement>(null)
  // Small screens show the most recent weeks first.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [from, to])
  const month = new Intl.DateTimeFormat(locale, { month: 'short' })
  const start = addDays(from, -weekdayIndex(from))
  const weeks: string[][] = []
  for (let d = start; d <= to; d = addDays(d, 7))
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)))

  return (
    <div className="flex flex-col gap-2">
      <div ref={scroller} className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-[3px] pl-8 text-[0.65rem] text-muted-foreground" aria-hidden>
            {weeks.map((week) => {
              const first = week.find((d) => d.endsWith('-01') && d >= from && d <= to)
              return (
                <span key={week[0]} className="w-3 overflow-visible whitespace-nowrap">
                  {first ? month.format(new Date(`${first}T12:00:00`)) : ''}
                </span>
              )
            })}
          </div>
          <div className="flex gap-[3px]">
            <div
              className="flex w-7 flex-col gap-[3px] text-[0.6rem] text-muted-foreground"
              aria-hidden
            >
              {t.stats.weekdays.map((d, i) => (
                <span key={d} className="h-3 leading-3">
                  {i % 2 === 0 ? d : ''}
                </span>
              ))}
            </div>
            {weeks.map((week) => (
              <ul key={week[0]} className="flex flex-col gap-[3px]">
                {week.map((day) => {
                  const inRange = day >= from && day <= to
                  const d = days.get(day)
                  const value = d?.seconds ?? 0
                  const tip = {
                    title: format.longDay(day),
                    rows: [
                      { label: t.charts.time, value: format.duration(value) },
                      { label: t.charts.pages, value: format.number(d?.pages ?? 0) },
                      { label: t.charts.books, value: format.number(d?.books ?? 0) },
                    ],
                  }
                  return (
                    <li
                      key={day}
                      {...(inRange
                        ? bind(day, tip, { focusable: false })
                        : { 'aria-hidden': true })}
                      className={cn(
                        'size-3 rounded-[3px] transition-[outline] hover:outline-2 hover:outline-foreground/40',
                        inRange ? LEVEL_CLASS[durationLevel(value)] : 'invisible',
                      )}
                    />
                  )
                })}
              </ul>
            ))}
          </div>
        </div>
      </div>
      <LevelLegend less={t.charts.less} more={t.charts.more} className="self-end" />
      {layer}
    </div>
  )
}
