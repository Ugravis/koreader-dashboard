import type { LucideIcon } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/** One figure with its label; `value: null` shows a skeleton. */
export function StatTile({
  label,
  icon: Icon,
  value,
  hint,
}: {
  label: string
  icon: LucideIcon
  value: string | null
  hint?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </CardDescription>
        {value === null ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <CardTitle className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</CardTitle>
        )}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  )
}

export const STAT_GRID = 'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'
