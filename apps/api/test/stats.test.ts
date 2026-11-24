import { beforeEach, describe, expect, it } from 'vitest'
import { streaks } from '../src/lib/stats.ts'
import { pairDevice, request, resetDb, signUp } from './helpers.ts'

describe('streaks', () => {
  it('counts the run ending today or yesterday', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-20', '2026-11-21']
    expect(streaks(days, '2026-11-22')).toEqual({ current: 2, longest: 3 })
    expect(streaks(days, '2026-11-23')).toEqual({ current: 0, longest: 3 })
    expect(streaks([], '2026-11-23')).toEqual({ current: 0, longest: 0 })
  })
})

describe('GET /v1/me/stats', () => {
  beforeEach(resetDb)

  it('groups reading time by local day, hour and weekday', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    // 2026-11-23 23:30 UTC is 2026-11-24 00:30 in Paris (a Tuesday).
    const start = Date.parse('2026-11-23T23:30:00Z') / 1000
    await request('/v1/ingest', {
      headers: { authorization: `Bearer ${token}` },
      body: {
        books: [{ ref: '1', md5: 'aa', title: 'Book', pages: 100 }],
        page_stats: [
          { book_ref: '1', page: 1, start_time: start, duration: 60, total_pages: 100 },
          { book_ref: '1', page: 2, start_time: start + 60, duration: 120, total_pages: 100 },
        ],
      },
    })

    const res = await request('/v1/me/stats?tz=Europe/Paris&days=7', { headers: { cookie } })
    expect(res.status).toBe(200)
    const stats = (await res.json()) as {
      days: { date: string; seconds: number; pages: number }[]
      by_hour: number[]
      by_weekday: number[]
      reading_days: number
      first_read_on: string
    }
    expect(stats.days).toHaveLength(7)
    expect(stats.by_hour[0]).toBe(180)
    expect(stats.by_weekday[1]).toBe(180)
    expect(stats.reading_days).toBe(1)
    expect(stats.first_read_on).toBe('2026-11-24')
  })

  it('requires a session', async () => {
    expect((await request('/v1/me/stats')).status).toBe(401)
  })
})
