import type { BookStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

const LABELS: Record<BookStatus, string> = {
  complete: 'Finished',
  reading: 'Reading',
  abandoned: 'On hold',
}

export function BookStatusBadge({
  status,
  className,
}: {
  status: BookStatus | null
  className?: string
}) {
  if (!status) return null
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        status === 'complete' && 'border-transparent bg-primary text-primary-foreground',
        status === 'reading' && 'bg-muted text-foreground',
        status === 'abandoned' && 'text-muted-foreground',
        className,
      )}
    >
      {LABELS[status]}
    </span>
  )
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.round(value * 100)
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  )
}
