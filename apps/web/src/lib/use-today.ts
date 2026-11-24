'use client'

import { useSyncExternalStore } from 'react'
import { localDay } from './reading'

const subscribe = () => () => {}

/**
 * Today as `YYYY-MM-DD` in the browser time zone; null while prerendering, where the
 * current date is not allowed (cacheComponents) and would be stale anyway.
 */
export function useToday() {
  return useSyncExternalStore(
    subscribe,
    () => localDay(),
    () => null,
  )
}
