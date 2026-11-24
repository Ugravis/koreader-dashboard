'use client'

import { cn } from '@/lib/utils'
import { type Tip, useChartTooltip } from './tooltip'

export type Point = { key: string; value: number; label: string; tip: Tip }

const H = 100

/**
 * Line with a light area under it. Hovering (or focusing) a slot shows a crosshair, the
 * point and its tooltip. `max` pins the top of the scale (1 for a 0-1 progress).
 */
export function LineChart({
  points,
  max,
  tickEvery = 1,
  className,
}: {
  points: Point[]
  max?: number
  tickEvery?: number
  className?: string
}) {
  const { bind, layer, active } = useChartTooltip()
  const top = max ?? Math.max(1, ...points.map((p) => p.value)) * 1.1
  const n = points.length
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100)
  const y = (v: number) => H - (Math.min(v, top) / top) * H
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ')
  const index = points.findIndex((p) => p.key === active)
  const current = points[index]

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative h-40">
        <svg
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
          aria-hidden
        >
          <line
            x1="0"
            x2="100"
            y1={H}
            y2={H}
            className="stroke-border"
            vectorEffect="non-scaling-stroke"
          />
          {n > 1 && (
            <path d={`${line} L100,${H} L0,${H} Z`} className="fill-chart-1/10 stroke-none" />
          )}
          <path
            d={line}
            className="fill-none stroke-chart-1"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {current && (
          <>
            <span
              className="pointer-events-none absolute inset-y-0 w-px bg-foreground/20"
              style={{ left: `${x(index)}%` }}
            />
            <span
              className="pointer-events-none absolute size-2.5 -translate-1/2 rounded-full border-2 border-card bg-chart-1"
              style={{ left: `${x(index)}%`, top: `${y(current.value)}%` }}
            />
          </>
        )}
        <ul className="absolute inset-0 flex">
          {points.map((p, i) => (
            // Each slot is a column centred on its point: hover anywhere above or below it.
            <li
              key={p.key}
              className="h-full outline-none"
              style={{
                width: `${100 / Math.max(1, n - 1)}%`,
                marginLeft: i === 0 ? `-${50 / Math.max(1, n - 1)}%` : undefined,
              }}
              {...bind(p.key, p.tip)}
            />
          ))}
        </ul>
      </div>
      <div className="flex text-[0.65rem] text-muted-foreground tabular-nums" aria-hidden>
        {points.map((p, i) => (
          <span key={p.key} className="flex-1 text-center whitespace-nowrap">
            {i % tickEvery === 0 ? p.label : ''}
          </span>
        ))}
      </div>
      {layer}
    </div>
  )
}
