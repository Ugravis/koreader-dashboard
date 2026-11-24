'use client'

import { useI18n } from '@/i18n/provider'
import type { BookStatus } from '@/lib/api'
import { cn } from '@/lib/utils'

export function BookStatusBadge({
  status,
  className,
}: {
  status: BookStatus | null
  className?: string
}) {
  const { t } = useI18n()
  if (!status) {
    // No status and no reading session: never opened in KOReader.
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-dashed bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground',
          className,
        )}
      >
        {t.status.new}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        status === 'complete' && 'border-transparent bg-primary text-primary-foreground',
        status === 'reading' && 'bg-muted text-foreground',
        status === 'abandoned' && 'bg-background text-muted-foreground',
        className,
      )}
    >
      {t.status[status]}
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
