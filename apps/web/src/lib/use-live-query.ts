'use client'

import { useEffect, useState } from 'react'
import { ApiError } from './api'
import { useLiveVersion, type LiveEvent } from './live-events'

export type QueryState<T> =
  { status: 'loading' } | { status: 'error'; notFound: boolean } | { status: 'ready'; data: T }

/**
 * Fetches from the API and refetches when a device sends data (live events).
 * The current data stays on screen while refetching. A 401 keeps the loading state:
 * the dashboard shell redirects to sign-in.
 */
export function useLiveQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  topics?: LiveEvent['type'][],
) {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' })
  const liveVersion = useLiveVersion(topics)

  useEffect(() => {
    let active = true
    fetcher()
      .then((data) => active && setState({ status: 'ready', data }))
      .catch((err) => {
        if (!active || (err instanceof ApiError && err.status === 401)) return
        setState({ status: 'error', notFound: err instanceof ApiError && err.status === 404 })
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller lists the fetcher's inputs.
  }, [...deps, liveVersion])

  return state
}
