import { sql } from '@koreader-dashboard/db'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { closeLiveEvents } from '../src/lib/events.ts'
import { db, pairDevice, request, resetDb, signUp } from './helpers.ts'

/** Reads SSE events from a response until `count` named events arrived. */
async function readEvents(res: Response, count: number, onReady?: () => Promise<unknown>) {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader()
  const events: string[] = []
  let buffer = ''
  while (events.length < count) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    for (const m of buffer.matchAll(/^event: (\w+)$/gm)) {
      events.push(m[1]!)
      if (m[1] === 'ready') await onReady?.()
    }
    buffer = buffer.slice(buffer.lastIndexOf('\n\n') + 2)
  }
  await reader.cancel()
  return events
}

describe('live events', () => {
  beforeEach(resetDb)
  afterAll(closeLiveEvents)

  it('streams the events of the signed-in user only', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    const other = await signUp()
    const otherToken = await pairDevice(other.cookie)

    const res = await request('/v1/me/events', { headers: { cookie } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const device = (t: string) => ({ authorization: `Bearer ${t}` })
    // Sent once subscribed (`ready`), or they could be published before the stream listens.
    const events = await readEvents(res, 3, async () => {
      await request('/v1/devices/current/sync', {
        method: 'PUT',
        body: { state: 'running', step: 'library' },
        headers: device(otherToken),
      })
      await request('/v1/devices/current/sync', {
        method: 'PUT',
        body: { state: 'running', step: 'library' },
        headers: device(token),
      })
      await request('/v1/library', {
        body: { books: [{ md5: 'aaa', title: 'Dune', file_path: '/b/dune.epub' }] },
        headers: device(token),
      })
    })
    expect(events).toEqual(['ready', 'sync', 'data'])
  })

  it('ends the streams when Postgres drops the listener, then listens again', async () => {
    const { cookie, userId } = await signUp()
    const kill = () =>
      db.execute(
        sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
            WHERE query LIKE 'LISTEN%' AND datname = current_database() AND pid <> pg_backend_pid()`,
      )
    // Ends without a second event: the stream closes, the browser reconnects and refetches.
    const first = await readEvents(await request('/v1/me/events', { headers: { cookie } }), 2, kill)
    expect(first).toEqual(['ready'])

    await new Promise((r) => setTimeout(r, 1_500)) // Listener reconnect delay.
    const payload = JSON.stringify({ user_id: userId, event: { type: 'data' } })
    const second = await readEvents(
      await request('/v1/me/events', { headers: { cookie } }),
      2,
      () => db.execute(sql`SELECT pg_notify('live_events', ${payload})`),
    )
    expect(second).toEqual(['ready', 'data'])
  })

  it('requires a session', async () => {
    expect((await request('/v1/me/events')).status).toBe(401)
  })

  it('delivers events published by another API instance (Postgres NOTIFY)', async () => {
    const { cookie, userId } = await signUp()
    const res = await request('/v1/me/events', { headers: { cookie } })
    // Another instance only shares the database: notify straight from SQL.
    const payload = JSON.stringify({ user_id: userId, event: { type: 'devices' } })
    const events = await readEvents(res, 2, () =>
      db.execute(sql`SELECT pg_notify('live_events', ${payload})`),
    )
    expect(events).toEqual(['ready', 'devices'])
  })
})
