const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type ErrorPayload = { error?: { code?: string; message?: string }; code?: string; message?: string }

/** fetch wrapper for the API: cookie session, JSON in and out, throws ApiError. */
export async function apiFetch<T>(path: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, headers, ...rest } = init
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: { ...(json === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: json === undefined ? rest.body : JSON.stringify(json),
  })
  if (!res.ok) {
    // API errors are `{ error: { code, message } }`, Better Auth errors are `{ code, message }`.
    const payload = (await res.json().catch(() => ({}))) as ErrorPayload
    throw new ApiError(
      res.status,
      payload.error?.code ?? payload.code ?? 'http_error',
      payload.error?.message ?? payload.message ?? res.statusText,
    )
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export type User = { id: string; email: string; name: string }
export type Session = { user: User } | null

export type Summary = { books_count: number; total_read_seconds: number; total_pages_read: number }
export type Device = {
  id: string
  name: string
  model: string | null
  last_sync_at: string | null
  created_at: string
}

export const api = {
  getSession: () => apiFetch<Session>('/v1/auth/get-session'),
  signUp: (body: { name: string; email: string; password: string }) =>
    apiFetch<{ user: User }>('/v1/auth/sign-up/email', { method: 'POST', json: body }),
  signIn: (body: { email: string; password: string }) =>
    apiFetch<{ user: User }>('/v1/auth/sign-in/email', { method: 'POST', json: body }),
  signOut: () => apiFetch<unknown>('/v1/auth/sign-out', { method: 'POST', json: {} }),
  confirmPairing: (userCode: string) =>
    apiFetch<void>('/v1/devices/pair/confirm', { method: 'POST', json: { user_code: userCode } }),
  getSummary: () => apiFetch<Summary>('/v1/me/summary'),
  listDevices: () => apiFetch<{ devices: Device[] }>('/v1/devices'),
  revokeDevice: (id: string) => apiFetch<void>(`/v1/devices/${id}`, { method: 'DELETE' }),
}
