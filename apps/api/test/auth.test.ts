import { beforeEach, describe, expect, it } from 'vitest'
import { request, resetDb, signUp } from './helpers.ts'

describe('auth', () => {
  beforeEach(resetDb)

  it('returns the current user with a session cookie', async () => {
    const { cookie, email } = await signUp()
    const res = await request('/v1/me', { headers: { cookie } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ email })
  })

  it('rejects requests without a session', async () => {
    const res = await request('/v1/me')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Sign in required' },
    })
  })

  it('returns JSON 404 and serves the OpenAPI spec', async () => {
    expect((await request('/nope')).status).toBe(404)
    const spec = await request('/openapi.json')
    expect(spec.status).toBe(200)
    const body = (await spec.json()) as { paths: Record<string, unknown> }
    expect(body.paths).toHaveProperty('/v1/me')
  })
})
