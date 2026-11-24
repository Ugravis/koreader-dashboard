import Link from 'next/link'
import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export type RankItem = {
  key: string
  label: ReactNode
  /** Secondary text after the label. */
  detail?: string
  value: number
  display: string
  href?: string
}

/** Ranked rows with a bar proportional to the first value. `items: null` shows skeletons. */
export function RankList({ items }: { items: RankItem[] | null }) {
  const max = Math.max(1, ...(items ?? []).map((i) => i.value))
  return (
    <ol className="flex flex-col gap-3">
      {items
        ? items.map((item) => {
            const body = (
              <>
                <span className="flex justify-between gap-3 text-sm">
                  <span className="truncate font-medium">
                    {item.label}
                    {item.detail && (
                      <span className="font-normal text-muted-foreground"> · {item.detail}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {item.display}
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span
                    className="block h-full rounded-full bg-chart-1"
                    style={{ width: `${(item.value / max) * 100}%` }}
                  />
                </span>
              </>
            )
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex flex-col gap-1 rounded-md outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex flex-col gap-1">{body}</div>
                )}
              </li>
            )
          })
        : [0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
    </ol>
  )
}
