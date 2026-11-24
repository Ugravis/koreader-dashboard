import { sql } from '@koreader-dashboard/db'
import { app } from '../src/app.ts'
import { db } from '../src/db.ts'

export { app, db }

export async function resetDb() {
  await db.execute(
    sql`TRUNCATE "page_stats", "books", "device_pairings", "devices", "session", "account", "verification", "user" CASCADE`,
  )
}

type JsonInit = { method?: string; body?: unknown; headers?: Record<string, string> }

export function request(path: string, init: JsonInit = {}) {
  const headers: Record<string, string> = { origin: 'http://localhost:3000', ...init.headers }
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  return app.request(path, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

/** Signs up a fresh user and returns its session cookie header. */
export async function signUp(email = `u${Date.now()}${Math.random()}@test.dev`) {
  const res = await request('/v1/auth/sign-up/email', {
    body: { email, password: 'password1234', name: 'Test' },
  })
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`)
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  return { cookie, email }
}

type PairStart = { device_code: string; user_code: string; verification_url_complete: string }

/** Runs the whole pairing flow for a signed-in user and returns the device token. */
export async function pairDevice(cookie: string, deviceName = 'Kindle') {
  const start = (await (
    await request('/v1/devices/pair/start', { body: { device_name: deviceName } })
  ).json()) as PairStart
  await request('/v1/devices/pair/confirm', {
    body: { user_code: start.user_code },
    headers: { cookie },
  })
  const poll = await request('/v1/devices/pair/poll', { body: { device_code: start.device_code } })
  const { device_token } = (await poll.json()) as { device_token: string }
  return device_token
}
