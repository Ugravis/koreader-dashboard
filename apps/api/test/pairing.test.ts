import { eq, schema } from '@koreader-dashboard/db'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'
import { sha256, USER_CODE_ALPHABET } from '../src/lib/crypto.ts'
import { onError } from '../src/lib/errors.ts'
import { requireDevice } from '../src/middleware/device.ts'
import type { AppEnv } from '../src/types.ts'
import { db, pairDevice, request, resetDb, signUp } from './helpers.ts'

type PairStart = { device_code: string; user_code: string; verification_url_complete: string }

const start = async () =>
  (await (
    await request('/v1/devices/pair/start', {
      body: { device_name: 'Kindle', device_model: 'Paperwhite' },
    })
  ).json()) as PairStart

const poll = (device_code: string) => request('/v1/devices/pair/poll', { body: { device_code } })
const confirm = (user_code: string, cookie: string) =>
  request('/v1/devices/pair/confirm', { body: { user_code }, headers: { cookie } })

describe('device pairing', () => {
  beforeEach(resetDb)

  it('pairs a device: pending, confirm, token once', async () => {
    const { cookie } = await signUp()
    const s = await start()
    expect(s.user_code).toMatch(new RegExp(`^[${USER_CODE_ALPHABET}]{8}$`))
    expect(s.verification_url_complete).toContain(`?code=${s.user_code}`)
    expect(s).toMatchObject({ web_url: 'http://localhost:3000' })

    expect((await poll(s.device_code)).status).toBe(428)

    // Code input is case and dash insensitive.
    const pretty = `${s.user_code.slice(0, 4)}-${s.user_code.slice(4)}`.toLowerCase()
    expect((await confirm(pretty, cookie)).status).toBe(204)

    const ok = await poll(s.device_code)
    expect(ok.status).toBe(200)
    const { device_token } = (await ok.json()) as { device_token: string }

    // Only the hash is stored, and the token is returned once.
    const [device] = await db.select().from(schema.devices)
    expect(device?.tokenHash).toBe(sha256(device_token))
    expect(device?.model).toBe('Paperwhite')
    expect((await poll(s.device_code)).status).toBe(410)
  })

  it('rejects unknown, reused and expired codes', async () => {
    const { cookie } = await signUp()
    expect((await confirm('ZZZZZZZZ', cookie)).status).toBe(404)

    const s = await start()
    expect((await confirm(s.user_code, '')).status).toBe(401)
    expect((await confirm(s.user_code, cookie)).status).toBe(204)
    expect((await confirm(s.user_code, cookie)).status).toBe(409)

    const late = await start()
    await db
      .update(schema.devicePairings)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.devicePairings.userCode, late.user_code))
    expect((await confirm(late.user_code, cookie)).status).toBe(410)
    expect((await poll(late.device_code)).status).toBe(410)
    expect((await poll('kdc_unknown')).status).toBe(404)
  })

  it('lists and revokes devices, revoked tokens are rejected', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)

    const probe = new Hono<AppEnv>()
      .get('/', requireDevice, (c) => c.json(c.get('device')))
      .onError(onError)
    const call = (t: string) => probe.request('/', { headers: { authorization: `Bearer ${t}` } })
    expect((await call(token)).status).toBe(200)
    expect((await call('kdt_wrong')).status).toBe(401)

    const list = (await (await request('/v1/devices', { headers: { cookie } })).json()) as {
      devices: { id: string; last_sync_at: string | null }[]
    }
    expect(list.devices).toHaveLength(1)
    const id = list.devices[0]!.id
    expect(list.devices[0]!.last_sync_at).not.toBeNull()

    const other = await signUp()
    const del = (c: string) =>
      request(`/v1/devices/${id}`, { method: 'DELETE', headers: { cookie: c } })
    expect((await del(other.cookie)).status).toBe(404)
    expect((await del(cookie)).status).toBe(204)
    expect((await call(token)).status).toBe(401)
  })

  it('lets a device read its status and unlink itself', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie, 'Kindle PW')
    const auth = { authorization: `Bearer ${token}` }

    const current = await request('/v1/devices/current', { headers: auth })
    expect(current.status).toBe(200)
    expect(await current.json()).toMatchObject({
      name: 'Kindle PW',
      web_url: 'http://localhost:3000',
    })

    expect((await request('/v1/devices/current', { method: 'DELETE', headers: auth })).status).toBe(
      204,
    )
    expect((await request('/v1/devices/current', { headers: auth })).status).toBe(401)
    const list = (await (await request('/v1/devices', { headers: { cookie } })).json()) as {
      devices: unknown[]
    }
    expect(list.devices).toHaveLength(0)
  })

  it('stores the sync progress reported by the device', async () => {
    const { cookie } = await signUp()
    const token = await pairDevice(cookie)
    const report = (json: unknown) =>
      request('/v1/devices/current/sync', {
        method: 'PUT',
        body: json,
        headers: { authorization: `Bearer ${token}` },
      })
    const sync = async () =>
      (
        (await (await request('/v1/devices', { headers: { cookie } })).json()) as {
          devices: { syncing: boolean; sync_step: string | null; covers_pending: number | null }[]
        }
      ).devices[0]

    expect(await sync()).toMatchObject({ syncing: false, sync_step: null, covers_pending: null })
    expect((await report({ state: 'running', step: 'covers', covers_pending: 12 })).status).toBe(
      204,
    )
    expect(await sync()).toMatchObject({ syncing: true, sync_step: 'covers', covers_pending: 12 })
    await report({ state: 'idle', covers_pending: 2 })
    expect(await sync()).toMatchObject({ syncing: false, sync_step: null, covers_pending: 2 })
    expect((await report({ state: 'paused' })).status).toBe(400)
  })
})
