'use client'

import { Tablet } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError, type Device } from '@/lib/api'
import { formatDate } from '@/lib/format'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; devices: Device[] }

export function DeviceList() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [confirming, setConfirming] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
  }, [])

  async function revoke(id: string) {
    setRevoking(id)
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
      setRevoking(null)
      setConfirming(null)
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
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">No linked device.</p>
          <Link href="/link" className={buttonVariants({ variant: 'outline' })}>
            Link a device
          </Link>
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
                {confirming === d.id ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setConfirming(null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={revoking === d.id}
                      onClick={() => revoke(d.id)}
                    >
                      {revoking === d.id ? 'Revoking…' : 'Confirm revoke'}
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setConfirming(d.id)}>
                    Revoke
                  </Button>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
