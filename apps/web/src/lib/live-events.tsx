'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { API_URL, type Device } from './api'

/** Events of `GET /v1/me/events` (see the API's LiveEvent), plus `resync`. */
export type LiveEvent =
  | ({ type: 'sync'; device_id: string; last_sync_at: string } & Pick<
      Device,
      'syncing' | 'sync_step' | 'covers_pending'
    >)
  | { type: 'data' }
  | { type: 'devices' }
  /** Connection (re)opened: events may have been missed, refetch everything. */
  | { type: 'resync' }

type Listener = (event: LiveEvent) => void

const TYPES = ['sync', 'data', 'devices'] as const
/** Retry delay when the stream is closed for good (signed out, API down). */
const RETRY_MS = 5_000

const ListenersContext = createContext<Set<Listener> | null>(null)

/** One SSE connection for the dashboard, shared by `useLiveEvent`. */
export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const [listeners] = useState(() => new Set<Listener>())

  useEffect(() => {
    let source: EventSource | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let connectedOnce = false
    const dispatch = (event: LiveEvent) => listeners.forEach((l) => l(event))

    function connect() {
      source = new EventSource(`${API_URL}/v1/me/events`, { withCredentials: true })
      source.addEventListener('ready', () => {
        if (connectedOnce) dispatch({ type: 'resync' })
        connectedOnce = true
      })
      for (const type of TYPES) {
        source.addEventListener(type, (e) => dispatch(JSON.parse((e as MessageEvent).data)))
      }
      // Network errors reconnect by themselves; an HTTP error closes the stream.
      source.onerror = () => {
        if (source?.readyState !== EventSource.CLOSED) return
        source.close()
        retry = setTimeout(connect, RETRY_MS)
      }
    }

    connect()
    return () => {
      clearTimeout(retry)
      source?.close()
    }
  }, [listeners])

  return <ListenersContext.Provider value={listeners}>{children}</ListenersContext.Provider>
}

/** Calls `handler` on every live event (latest handler, no resubscribe). */
export function useLiveEvent(handler: Listener) {
  const listeners = useContext(ListenersContext)
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!listeners) return
    const listener: Listener = (e) => ref.current(e)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [listeners])
}

/** Coalesces bursts (one event per library batch or cover) into one refetch. */
const REFETCH_DEBOUNCE_MS = 400

/**
 * Bumped when new data reached the server (or after a reconnect): add it to a data
 * effect's deps to refetch. `types` adds other events, e.g. `devices`.
 */
export function useLiveVersion(types: readonly LiveEvent['type'][] = ['data']) {
  const [version, setVersion] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  useLiveEvent((e) => {
    if (e.type !== 'resync' && !types.includes(e.type)) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setVersion((v) => v + 1), REFETCH_DEBOUNCE_MS)
  })
  return version
}
