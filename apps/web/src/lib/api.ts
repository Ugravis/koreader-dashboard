export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

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

export type Summary = {
  books_count: number
  finished_count: number
  total_read_seconds: number
  total_pages_read: number
}
export type BookStatus = 'reading' | 'complete' | 'abandoned'
export type Book = {
  id: string
  ids: string[]
  md5: string
  title: string
  authors: string | null
  series: string | null
  series_index: number | null
  language: string | null
  isbn: string | null
  /** Genres and tags from the book metadata. */
  keywords: string[]
  pages: number | null
  /** API path of the cover sent by the device, null when none. */
  cover_url: string | null
  description: string | null
  status: BookStatus | null
  status_modified: string | null
  rating: number | null
  review: string | null
  progress: number
  total_read_seconds: number
  pages_read: number
  last_read_at: string | null
  highlights_count: number
  notes_count: number
}
export type Annotation = {
  id: string
  text: string | null
  note: string | null
  chapter: string | null
  pageno: number | null
  datetime: string | null
  color: string | null
}
export type Device = {
  id: string
  name: string
  model: string | null
  last_sync_at: string | null
  created_at: string
  /** A sync is in progress on the device (live). */
  syncing: boolean
  sync_step: 'stats' | 'library' | 'covers' | null
  /** Covers left to send, after the current or last sync. */
  covers_pending: number | null
}

export type DayStat = { date: string; seconds: number; pages: number }
export type ReadingStats = {
  timezone: string
  /** Last days in `timezone`, oldest first. */
  days: DayStat[]
  /** Seconds per hour of the day, 0-23. */
  by_hour: number[]
  /** Seconds per weekday, Monday first. */
  by_weekday: number[]
  /** Seconds per weekday (Monday first) and hour (0-23). */
  by_weekday_hour: number[][]
  /** Every month with reading, oldest first. */
  by_month: { month: string; seconds: number; pages: number }[]
  sessions: SessionSummary
  records: {
    best_day: { date: string; seconds: number } | null
    best_month: { month: string; seconds: number } | null
    fastest_book: { id: string; title: string; days: number } | null
  }
  reading_days: number
  current_streak: number
  longest_streak: number
  first_read_on: string | null
}

export type SessionSummary = {
  count: number
  average_seconds: number
  longest_seconds: number
  longest_on: string | null
}
export type ActivityDay = DayStat & {
  /** Books read that day (ids as in listBooks), most read first. */
  books: { id: string; seconds: number }[]
}
export type BookStats = {
  timezone: string
  /** Reading days, oldest first; `progress` is the furthest point reached (0-1). */
  days: (DayStat & { progress: number })[]
  by_hour: number[]
  sessions: SessionSummary
  /** Latest sessions, newest first. */
  recent_sessions: { start: string; seconds: number; pages: number }[]
  first_read_at: string | null
  last_read_at: string | null
  pages_per_hour: number | null
  last_14_days_seconds: number
}
export type AnnotationEntry = Annotation & {
  book_id: string
  book_title: string
  book_authors: string | null
}
export type Goals = { yearly_books: number | null; daily_minutes: number | null }

/** Browser time zone, so days and hours match the reader's clock. */
const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

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
  listBooks: () => apiFetch<{ books: Book[] }>('/v1/me/books'),
  getBook: (id: string) =>
    apiFetch<{ book: Book; annotations: Annotation[] }>(`/v1/me/books/${id}`),
  getStats: (days = 30) =>
    apiFetch<ReadingStats>(`/v1/me/stats?days=${days}&tz=${encodeURIComponent(timeZone())}`),
  /** Days with reading between two `YYYY-MM-DD` days (inclusive, at most 400 days apart). */
  getActivity: (from: string, to: string) =>
    apiFetch<{ days: ActivityDay[] }>(
      `/v1/me/activity?from=${from}&to=${to}&tz=${encodeURIComponent(timeZone())}`,
    ),
  getBookStats: (id: string) =>
    apiFetch<BookStats>(`/v1/me/books/${id}/stats?tz=${encodeURIComponent(timeZone())}`),
  listAnnotations: () => apiFetch<{ annotations: AnnotationEntry[] }>('/v1/me/annotations'),
  getGoals: () => apiFetch<Goals>('/v1/me/goals'),
  saveGoals: (goals: Goals) => apiFetch<Goals>('/v1/me/goals', { method: 'PUT', json: goals }),
  listDevices: () => apiFetch<{ devices: Device[] }>('/v1/devices'),
  revokeDevice: (id: string) => apiFetch<void>(`/v1/devices/${id}`, { method: 'DELETE' }),
}
