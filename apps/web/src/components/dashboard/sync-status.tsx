'use client'

import { LoaderCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, type Device } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { useLiveEvent, useLiveVersion } from '@/lib/live-events'

/** Same as the API: a sync silent for this long was cut short (device asleep, Wi-Fi lost). */
const SYNC_STALE_MS = 2 * 60_000
/** Refreshes "Synced 5 min ago". */
const TICK_MS = 30_000

const STEP_LABEL: Record<NonNullable<Device['sync_step']>, string> = {
  stats: 'reading stats',
  library: 'library',
  covers: 'covers',
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Live sync state of the user's devices, updated by the API's `sync` events. */
export function SyncStatus() {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const devicesVersion = useLiveVersion(['devices'])

  useEffect(() => {
    let active = true
    api
      .listDevices()
      .then(({ devices }) => active && setDevices(devices))
      .catch(() => undefined) // Signed out: the shell redirects.
    return () => {
      active = false
    }
  }, [devicesVersion])

  useLiveEvent((e) => {
    if (e.type !== 'sync') return
    setNow(Date.now())
    setDevices(
      (list) =>
        list?.map((d) =>
          d.id === e.device_id
            ? {
                ...d,
                syncing: e.syncing,
                sync_step: e.sync_step,
                covers_pending: e.covers_pending,
                last_sync_at: e.last_sync_at,
              }
            : d,
        ) ?? list,
    )
  })

  // Relative time, and a sync with no news for too long shown as ended.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  if (!devices || devices.length === 0) return null
  const syncing = devices.find(
    (d) =>
      d.syncing &&
      d.last_sync_at !== null &&
      now - new Date(d.last_sync_at).getTime() < SYNC_STALE_MS,
  )
  const last = devices
    .map((d) => d.last_sync_at)
    .filter((t): t is string => t !== null)
    .sort()
    .at(-1)
  const pending = devices.reduce((n, d) => n + (d.covers_pending ?? 0), 0)

  return (
    <p
      className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground"
      aria-live="polite"
    >
      {syncing ? (
        <>
          <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden />
          <span className="truncate">
            Syncing<span className="hidden sm:inline"> {syncing.name}</span>
            {syncing.sync_step ? `: ${STEP_LABEL[syncing.sync_step]}` : ''}
            {syncing.sync_step === 'covers' && syncing.covers_pending
              ? ` (${syncing.covers_pending} left)`
              : ''}
          </span>
        </>
      ) : (
        <>
          <RefreshCw className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {last ? `Synced ${formatRelative(last, now)}` : 'Never synced'}
            {pending > 0 ? ` · ${plural(pending, 'cover')} to send` : ''}
          </span>
        </>
      )}
    </p>
  )
}
