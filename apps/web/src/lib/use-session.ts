'use client'

import { useEffect, useState } from 'react'
import { api, type User } from './api'

type SessionState =
  { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; user: User }

/** Reads the Better Auth session from the API (cookie lives on the API origin). */
export function useSession() {
  const [state, setState] = useState<SessionState>({ status: 'loading' })
  useEffect(() => {
    let active = true
    api
      .getSession()
      .then(
        (s) =>
          active &&
          setState(s ? { status: 'authenticated', user: s.user } : { status: 'anonymous' }),
      )
      .catch(() => active && setState({ status: 'anonymous' }))
    return () => {
      active = false
    }
  }, [])
  return state
}
