import { cn } from '@/lib/utils'

export type Bar = { key: string; value: number; label: string; tooltip: string }

/**
 * Plain CSS bar chart. Each bar carries its value as tooltip and accessible label;
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
  const max = Math.max(1, ...bars.map((b) => b.value))
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <ul className="flex h-40 items-end gap-[3px]">
        {bars.map((bar, i) => (
          <li
            key={bar.key}
            className="group relative flex h-full flex-1 items-end"
            title={bar.tooltip}
            aria-label={bar.tooltip}
          >
            <div
              className={cn(
                'w-full rounded-t-sm bg-primary/70 transition-colors group-hover:bg-primary',
                bar.value === 0 && 'bg-muted group-hover:bg-muted-foreground/30',
                highlightLast && i === bars.length - 1 && bar.value > 0 && 'bg-primary',
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
    </div>
  )
}
