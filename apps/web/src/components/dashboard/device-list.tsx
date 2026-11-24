'use client'

import { Tablet } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useLiveVersion } from '@/lib/live-events'
import { api, ApiError, type Device } from '@/lib/api'
import { formatDate } from '@/lib/format'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; devices: Device[] }

export function DeviceList() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [target, setTarget] = useState<Device | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Linked, revoked or synced elsewhere: refetch.
  const liveVersion = useLiveVersion(['devices', 'sync'])

  useEffect(() => {
    let active = true
    api
      .listDevices()
      .then(({ devices }) => active && setState({ status: 'ready', devices }))
      .catch((err) => {
        // 401: the shell redirects to sign-in, keep the skeleton meanwhile.
        if (active && !(err instanceof ApiError && err.status === 401))
          setState({ status: 'error' })
      })
    return () => {
      active = false
    }
  }, [liveVersion])

  async function revoke(id: string) {
    setRevoking(true)
    setError(null)
    try {
      await api.revokeDevice(id)
      setState((s) =>
        s.status === 'ready'
          ? { status: 'ready', devices: s.devices.filter((d) => d.id !== id) }
          : s,
      )
    } catch {
      setError('Could not revoke the device. Try again.')
    } finally {
      setRevoking(false)
      setTarget(null)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        Could not load your devices. Try again later.
      </p>
    )
  }

  if (state.devices.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No linked e-reader yet. Follow the steps below, then enter the code with Link a device.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {state.devices.map((d) => (
          <li key={d.id}>
            <Card>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Tablet className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-sm text-muted-foreground">
                      Last sync: {formatDate(d.last_sync_at)}
                    </span>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setTarget(d)}>
                  Revoke
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => !open && !revoking && setTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {target?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This e-reader stops syncing. It is unlinked at its next sync and must be linked again
              to resume. Your reading statistics are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revoking}
              onClick={() => target && revoke(target.id)}
            >
              {revoking ? 'Revoking…' : 'Revoke'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
