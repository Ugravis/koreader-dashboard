'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type User } from './api'

export type SessionState =
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

const SessionContext = createContext<SessionState>({ status: 'loading' })

/** Shares one session fetch with the whole dashboard. */
export function SessionProvider({ value, children }: { value: SessionState; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSessionContext = () => useContext(SessionContext)
