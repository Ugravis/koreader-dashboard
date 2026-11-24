'use client'

import { useI18n } from '@/i18n/provider'
import { cn } from '@/lib/utils'
import { LEVEL_CLASS, LevelLegend, relativeLevel } from './levels'
import { useChartTooltip } from './tooltip'

/** Weekday (rows, Monday first) by hour (columns) heatmap of reading time. */
export function HabitGrid({ grid }: { grid: number[][] }) {
  const { t, format, locale } = useI18n()
  const { bind, layer } = useChartTooltip()
  const max = Math.max(0, ...grid.flat())
  const total = grid.flat().reduce((a, b) => a + b, 0)
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' })
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto pb-1">
        <table className="border-separate border-spacing-[3px]">
          <thead>
            <tr className="text-[0.6rem] text-muted-foreground">
              <th />
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} scope="col" className="w-4 font-normal">
                  {h % 3 === 0 ? h : <span className="sr-only">{h}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((hours, day) => (
              <tr key={day}>
                <th
                  scope="row"
                  className="pr-1 text-left text-[0.65rem] font-normal text-muted-foreground"
                >
                  {t.stats.weekdays[day]}
                </th>
                {hours.map((seconds, h) => {
                  const tip = {
                    title: `${weekday.format(new Date(2024, 0, 1 + day))}, ${h}h – ${h + 1}h`,
                    rows: [
                      { label: t.charts.time, value: format.duration(seconds) },
                      {
                        label: t.charts.share,
                        value: format.percent(total > 0 ? seconds / total : 0),
                      },
                    ],
                  }
                  return (
                    <td
                      key={h}
                      {...bind(`${day}-${h}`, tip, { focusable: false })}
                      className={cn(
                        'h-4 w-4 min-w-4 rounded-[3px] hover:outline-2 hover:outline-foreground/40',
                        LEVEL_CLASS[relativeLevel(seconds, max)],
                      )}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <LevelLegend less={t.charts.less} more={t.charts.more} className="self-end" />
      {layer}
    </div>
  )
}
