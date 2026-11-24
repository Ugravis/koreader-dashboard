import { beforeEach, describe, expect, it } from 'vitest'
import { pairDevice, request, resetDb, signUp } from './helpers.ts'

const DAY = 86_400

async function seed() {
  const { cookie } = await signUp()
  const token = await pairDevice(cookie)
  const start = Date.parse('2026-11-20T10:00:00Z') / 1000
  await request('/v1/ingest', {
    headers: { authorization: `Bearer ${token}` },
    body: {
      books: [{ ref: '1', md5: 'aa', title: 'Book', pages: 100 }],
      page_stats: [
        // Session 1: two pages back to back. Session 2: an hour later. Session 3: next day.
        { book_ref: '1', page: 1, start_time: start, duration: 60, total_pages: 100 },
        { book_ref: '1', page: 2, start_time: start + 60, duration: 120, total_pages: 100 },
        { book_ref: '1', page: 3, start_time: start + 3600, duration: 30, total_pages: 100 },
        { book_ref: '1', page: 50, start_time: start + DAY, duration: 90, total_pages: 100 },
      ],
    },
  })
  const books = (await (await request('/v1/me/books', { headers: { cookie } })).json()) as {
    books: { id: string }[]
  }
  return { cookie, bookId: books.books[0]!.id }
}

describe('insights', () => {
  beforeEach(resetDb)

  it('lists activity per day with its books', async () => {
    const { cookie, bookId } = await seed()
    const res = await request('/v1/me/activity?from=2026-11-01&to=2026-11-30&tz=UTC', {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const { days } = (await res.json()) as {
      days: { date: string; seconds: number; books: { id: string }[] }[]
    }
    expect(days.map((d) => [d.date, d.seconds])).toEqual([
      ['2026-11-20', 210],
      ['2026-11-21', 90],
    ])
    expect(days[0]!.books[0]!.id).toBe(bookId)
  })

  it('rejects a range too long', async () => {
    const { cookie } = await seed()
    const res = await request('/v1/me/activity?from=2020-01-01&to=2026-01-01', {
      headers: { cookie },
    })
    expect(res.status).toBe(400)
  })

  it('computes book stats with sessions and progress', async () => {
    const { cookie, bookId } = await seed()
    const res = await request(`/v1/me/books/${bookId}/stats?tz=UTC`, { headers: { cookie } })
    expect(res.status).toBe(200)
    const stats = (await res.json()) as {
      days: { progress: number }[]
      sessions: { count: number; longest_seconds: number }
      by_hour: number[]
    }
    expect(stats.sessions).toMatchObject({ count: 3, longest_seconds: 180 })
    expect(stats.days.map((d) => d.progress)).toEqual([0.03, 0.5])
    expect(stats.by_hour[10]).toBe(270)
  })

  it('adds sessions and records to the reading stats', async () => {
    const { cookie } = await seed()
    const res = await request('/v1/me/stats?tz=UTC', { headers: { cookie } })
    const stats = (await res.json()) as {
      sessions: { count: number }
      by_month: { month: string; seconds: number }[]
      records: { best_day: { date: string } }
    }
    expect(stats.sessions.count).toBe(3)
    expect(stats.by_month).toEqual([{ month: '2026-11', seconds: 300, pages: 4 }])
    expect(stats.records.best_day.date).toBe('2026-11-20')
  })

  it('allows PUT from the website (CORS preflight)', async () => {
    const res = await request('/v1/me/goals', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'content-type',
      },
    })
    expect(res.headers.get('access-control-allow-methods')).toContain('PUT')
  })

  it('saves goals', async () => {
    const { cookie } = await seed()
    const empty = await request('/v1/me/goals', { headers: { cookie } })
    expect(await empty.json()).toEqual({ yearly_books: null, daily_minutes: null })
    const body = { yearly_books: 24, daily_minutes: 30 }
    const put = await request('/v1/me/goals', { method: 'PUT', headers: { cookie }, body })
    expect(put.status).toBe(200)
    const res = await request('/v1/me/goals', { headers: { cookie } })
    expect(await res.json()).toEqual(body)
  })
})
