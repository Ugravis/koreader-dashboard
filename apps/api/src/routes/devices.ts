import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { and, desc, eq, isNull, schema } from '@koreader-dashboard/db'
import { db } from '../db.ts'
import { env } from '../env.ts'
import {
  generateUserCode,
  normalizeUserCode,
  randomToken,
  sha256,
  USER_CODE_LENGTH,
} from '../lib/crypto.ts'
import { errorBody, HttpError } from '../lib/errors.ts'
import { publish } from '../lib/events.ts'
import { errorResponse } from '../lib/openapi.ts'
import { rateLimit } from '../lib/rate-limit.ts'
import { requireDevice } from '../middleware/device.ts'
import { requireSession } from '../middleware/session.ts'
import type { AppEnv } from '../types.ts'

export const PAIRING_TTL_SECONDS = 600
export const POLL_INTERVAL_SECONDS = 5

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
})

// --- Schemas

const PairStartBody = z.object({
  device_name: z.string().trim().min(1).max(100),
  device_model: z.string().trim().max(100).optional(),
})

const PairStartResponse = z
  .object({
    device_code: z.string(),
    user_code: z.string(),
    web_url: z.url(),
    verification_url: z.url(),
    verification_url_complete: z.url(),
    expires_in: z.number().int(),
    interval: z.number().int(),
  })
  .openapi('PairStart')

const PairConfirmBody = z.object({ user_code: z.string().min(USER_CODE_LENGTH).max(16) })
const PairPollBody = z.object({ device_code: z.string().min(1) })
const PairPollResponse = z.object({ device_token: z.string() }).openapi('DeviceToken')

const SYNC_STEPS = ['stats', 'library', 'covers'] as const
/** A "running" state older than this is a sync cut short (device asleep, Wi-Fi lost). */
const SYNC_STALE_MS = 2 * 60_000

const DeviceSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    model: z.string().nullable(),
    last_sync_at: z.iso.datetime().nullable(),
    created_at: z.iso.datetime(),
    syncing: z.boolean().openapi({ description: 'A sync is in progress on the device' }),
    sync_step: z.enum(SYNC_STEPS).nullable(),
    covers_pending: z
      .number()
      .int()
      .nullable()
      .openapi({ description: 'Covers left to send, after the current or last sync' }),
  })
  .openapi('Device')

const SyncStatusBody = z.object({
  state: z.enum(['running', 'idle']),
  step: z.enum(SYNC_STEPS).optional(),
  covers_pending: z.number().int().min(0).optional(),
})

// --- Routes

const pairStart = createRoute({
  method: 'post',
  path: '/pair/start',
  tags: ['devices'],
  request: { body: { content: { 'application/json': { schema: PairStartBody } } } },
  responses: { 200: json(PairStartResponse, 'Pairing started') },
})

const confirmLimit = rateLimit({ windowMs: 60_000, max: 10, key: (c) => c.get('user').id })

const pairConfirm = createRoute({
  method: 'post',
  path: '/pair/confirm',
  tags: ['devices'],
  middleware: [requireSession, confirmLimit] as const,
  request: { body: { content: { 'application/json': { schema: PairConfirmBody } } } },
  responses: {
    204: { description: 'Device linked to the current user' },
    401: errorResponse('Not signed in'),
    404: errorResponse('Unknown code'),
    409: errorResponse('Code already used'),
    410: errorResponse('Code expired'),
    429: errorResponse('Too many attempts'),
  },
})

const pairPoll = createRoute({
  method: 'post',
  path: '/pair/poll',
  tags: ['devices'],
  request: { body: { content: { 'application/json': { schema: PairPollBody } } } },
  responses: {
    200: json(PairPollResponse, 'Device token, returned once'),
    404: errorResponse('Unknown device code'),
    410: errorResponse('Expired or already consumed'),
    428: errorResponse('Waiting for the user to confirm the code'),
  },
})

const listDevices = createRoute({
  method: 'get',
  path: '/',
  tags: ['devices'],
  middleware: [requireSession] as const,
  responses: {
    200: json(z.object({ devices: z.array(DeviceSchema) }), 'Active devices'),
    401: errorResponse('Not signed in'),
  },
})

const revokeDevice = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['devices'],
  middleware: [requireSession] as const,
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: 'Device revoked' },
    401: errorResponse('Not signed in'),
    404: errorResponse('Unknown device'),
  },
})

const CurrentDeviceSchema = z
  .object({ id: z.uuid(), name: z.string(), model: z.string().nullable(), web_url: z.url() })
  .openapi('CurrentDevice')

const getCurrent = createRoute({
  method: 'get',
  path: '/current',
  tags: ['devices'],
  middleware: [requireDevice] as const,
  responses: {
    200: json(CurrentDeviceSchema, 'The calling device, when still linked'),
    401: errorResponse('Missing or revoked device token'),
  },
})

const putSyncStatus = createRoute({
  method: 'put',
  path: '/current/sync',
  tags: ['devices'],
  middleware: [requireDevice] as const,
  request: { body: { content: { 'application/json': { schema: SyncStatusBody } } } },
  responses: {
    204: { description: 'Sync progress stored' },
    401: errorResponse('Missing or revoked device token'),
  },
})

const unlinkCurrent = createRoute({
  method: 'delete',
  path: '/current',
  tags: ['devices'],
  middleware: [requireDevice] as const,
  responses: {
    204: { description: 'The calling device is revoked (unlink from the plugin)' },
    401: errorResponse('Missing or revoked device token'),
  },
})

// --- Handlers

const { devicePairings, devices } = schema

export const deviceRoutes = new OpenAPIHono<AppEnv>()
  .openapi(pairStart, async (c) => {
    const { device_name, device_model } = c.req.valid('json')
    const deviceCode = randomToken('kdc')
    const expiresAt = new Date(Date.now() + PAIRING_TTL_SECONDS * 1000)

    // Retry on the (unlikely) user_code collision.
    for (let attempt = 0; ; attempt++) {
      const userCode = generateUserCode()
      const inserted = await db
        .insert(devicePairings)
        .values({
          deviceCodeHash: sha256(deviceCode),
          userCode,
          deviceName: device_name,
          deviceModel: device_model ?? null,
          expiresAt,
        })
        .onConflictDoNothing({ target: devicePairings.userCode })
        .returning({ id: devicePairings.id })
      if (inserted.length > 0) {
        const verificationUrl = `${env.WEB_ORIGIN}/link`
        return c.json(
          {
            device_code: deviceCode,
            user_code: userCode,
            web_url: env.WEB_ORIGIN,
            verification_url: verificationUrl,
            verification_url_complete: `${verificationUrl}?code=${userCode}`,
            expires_in: PAIRING_TTL_SECONDS,
            interval: POLL_INTERVAL_SECONDS,
          },
          200,
        )
      }
      if (attempt >= 4) throw new Error('Could not allocate a unique user code')
    }
  })
  .openapi(pairConfirm, async (c) => {
    const userCode = normalizeUserCode(c.req.valid('json').user_code)
    const [pairing] = await db
      .select()
      .from(devicePairings)
      .where(eq(devicePairings.userCode, userCode))
    if (!pairing) throw new HttpError(404, 'invalid_code', 'Unknown code')
    if (pairing.consumedAt || pairing.userId) {
      throw new HttpError(409, 'code_used', 'This code has already been used')
    }
    if (pairing.expiresAt <= new Date())
      throw new HttpError(410, 'expired', 'This code has expired')

    const updated = await db
      .update(devicePairings)
      .set({ userId: c.get('user').id })
      .where(and(eq(devicePairings.id, pairing.id), isNull(devicePairings.userId)))
      .returning({ id: devicePairings.id })
    if (updated.length === 0)
      throw new HttpError(409, 'code_used', 'This code has already been used')
    return c.body(null, 204)
  })
  .openapi(pairPoll, async (c) => {
    const hash = sha256(c.req.valid('json').device_code)
    const [pairing] = await db
      .select()
      .from(devicePairings)
      .where(eq(devicePairings.deviceCodeHash, hash))
    if (!pairing) return c.json(errorBody('invalid_device_code', 'Unknown device code'), 404)
    if (pairing.consumedAt) return c.json(errorBody('expired', 'Pairing already completed'), 410)
    if (pairing.expiresAt <= new Date()) {
      return c.json(errorBody('expired', 'Pairing code expired'), 410)
    }
    if (!pairing.userId) {
      return c.json(errorBody('authorization_pending', 'Waiting for confirmation'), 428)
    }
    const userId = pairing.userId

    const deviceToken = randomToken('kdt')
    const created = await db.transaction(async (tx) => {
      // Conditional update: only one concurrent poll can consume the pairing.
      const consumed = await tx
        .update(devicePairings)
        .set({ consumedAt: new Date() })
        .where(and(eq(devicePairings.id, pairing.id), isNull(devicePairings.consumedAt)))
        .returning({ id: devicePairings.id })
      if (consumed.length === 0) return false
      await tx.insert(devices).values({
        userId,
        name: pairing.deviceName,
        model: pairing.deviceModel,
        tokenHash: sha256(deviceToken),
      })
      return true
    })
    if (!created) return c.json(errorBody('expired', 'Pairing already completed'), 410)
    await publish(userId, { type: 'devices' })
    return c.json({ device_token: deviceToken }, 200)
  })
  .openapi(getCurrent, async (c) => {
    const [device] = await db
      .select({ id: devices.id, name: devices.name, model: devices.model })
      .from(devices)
      .where(eq(devices.id, c.get('device').id))
    if (!device) throw new HttpError(401, 'invalid_token', 'Device token revoked or unknown')
    return c.json({ ...device, web_url: env.WEB_ORIGIN }, 200)
  })
  .openapi(putSyncStatus, async (c) => {
    const body = c.req.valid('json')
    const { id, userId } = c.get('device')
    const [d] = await db
      .update(devices)
      .set({
        syncState: body.state,
        syncStep: body.state === 'running' ? (body.step ?? null) : null,
        ...(body.covers_pending === undefined ? {} : { coversPending: body.covers_pending }),
      })
      .where(eq(devices.id, id))
      .returning()
    if (d) {
      await publish(userId, {
        type: 'sync',
        device_id: d.id,
        syncing: body.state === 'running',
        sync_step: d.syncStep,
        covers_pending: d.coversPending,
        last_sync_at: (d.lastSyncAt ?? new Date()).toISOString(),
      })
    }
    return c.body(null, 204)
  })
  .openapi(unlinkCurrent, async (c) => {
    await db
      .update(devices)
      .set({ revokedAt: new Date() })
      .where(eq(devices.id, c.get('device').id))
    await publish(c.get('device').userId, { type: 'devices' })
    return c.body(null, 204)
  })
  .openapi(listDevices, async (c) => {
    const rows = await db
      .select()
      .from(devices)
      .where(and(eq(devices.userId, c.get('user').id), isNull(devices.revokedAt)))
      .orderBy(desc(devices.createdAt))
    return c.json(
      {
        devices: rows.map((d) => ({
          id: d.id,
          name: d.name,
          model: d.model,
          last_sync_at: d.lastSyncAt?.toISOString() ?? null,
          created_at: d.createdAt.toISOString(),
          syncing:
            d.syncState === 'running' &&
            d.lastSyncAt !== null &&
            Date.now() - d.lastSyncAt.getTime() < SYNC_STALE_MS,
          sync_step: d.syncStep,
          covers_pending: d.coversPending,
        })),
      },
      200,
    )
  })
  .openapi(revokeDevice, async (c) => {
    const revoked = await db
      .update(devices)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(devices.id, c.req.valid('param').id),
          eq(devices.userId, c.get('user').id),
          isNull(devices.revokedAt),
        ),
      )
      .returning({ id: devices.id })
    if (revoked.length === 0) throw new HttpError(404, 'not_found', 'Unknown device')
    await publish(c.get('user').id, { type: 'devices' })
    return c.body(null, 204)
  })
