'use client'

import { type Tip, useChartTooltip } from '@/components/charts/tooltip'
import { cn } from '@/lib/utils'

export type Bar = { key: string; value: number; label: string; tip: Tip }

/**
 * Plain CSS bar chart. Hovering or focusing a bar (its whole column) shows its tooltip;
 * `tickEvery` thins the axis labels on dense charts.
 */
export function BarChart({
  bars,
  tickEvery = 1,
  className,
  highlightLast = false,
}: {
  bars: Bar[]
  tickEvery?: number
  className?: string
  highlightLast?: boolean
}) {
  const { bind, layer, active } = useChartTooltip()
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ul className="flex h-40 items-end gap-[3px]">
        {bars.map((bar, i) => (
          <li
            key={bar.key}
            className="relative flex h-full flex-1 items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            {...bind(bar.key, bar.tip, { anchorChild: true })}
          >
            <div
              className={cn(
                'w-full rounded-t-sm transition-colors',
                bar.value === 0
                  ? active === bar.key
                    ? 'bg-muted-foreground/30'
                    : 'bg-muted'
                  : active === bar.key || (highlightLast && i === bars.length - 1)
                    ? 'bg-chart-1'
                    : 'bg-chart-1/70',
              )}
              style={{
                height: bar.value === 0 ? '2px' : `${Math.max(3, (bar.value / max) * 100)}%`,
              }}
            />
          </li>
        ))}
      </ul>
      <div className="flex gap-[3px] text-[0.65rem] text-muted-foreground tabular-nums" aria-hidden>
        {bars.map((bar, i) => (
          <span key={bar.key} className="flex-1 overflow-visible text-center whitespace-nowrap">
            {i % tickEvery === 0 ? bar.label : ''}
          </span>
        ))}
      </div>
      {layer}
    </div>
  )
}
