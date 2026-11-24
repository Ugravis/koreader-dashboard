import { cn } from '@/lib/utils'

/** Fill of each intensity level, 0 (none) to 4, from the sequential ramp. */
export const LEVEL_CLASS = ['bg-muted', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const

/** Level 1-4 relative to `max`, 0 for no value. */
export const relativeLevel = (value: number, max: number) =>
  value <= 0 || max <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((value / max) * 4)))

/** "Less ▢▢▢▢▢ More" legend for a heatmap. */
export function LevelLegend({
  less,
  more,
  className,
}: {
  less: string
  more: string
  className?: string
}) {
  return (
    <div
      className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}
      aria-hidden
    >
      <span className="mr-1">{less}</span>
      {LEVEL_CLASS.map((c) => (
        <span key={c} className={cn('size-3 rounded-[3px]', c)} />
      ))}
      <span className="ml-1">{more}</span>
    </div>
  )
}

/** Fixed thresholds, so a day reads the same in any period: 15 min, 30 min, 1 h. */
export const durationLevel = (seconds: number) =>
  seconds <= 0 ? 0 : seconds < 900 ? 1 : seconds < 1800 ? 2 : seconds < 3600 ? 3 : 4
