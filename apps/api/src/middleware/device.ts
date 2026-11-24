import { and, eq, isNull, schema } from '@koreader-dashboard/db'
import { createMiddleware } from 'hono/factory'
import { db } from '../db.ts'
import { sha256 } from '../lib/crypto.ts'
import { HttpError } from '../lib/errors.ts'
import type { AppEnv } from '../types.ts'

/** Requires `Authorization: Bearer <device token>` of a non-revoked device. Sets `device`. */
export const requireDevice = createMiddleware<AppEnv>(async (c, next) => {
  const match = /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '')
  if (!match?.[1]) throw new HttpError(401, 'invalid_token', 'Missing device token')

  const [device] = await db
    .update(schema.devices)
    .set({ lastSyncAt: new Date() })
    .where(and(eq(schema.devices.tokenHash, sha256(match[1])), isNull(schema.devices.revokedAt)))
    .returning({ id: schema.devices.id, userId: schema.devices.userId })
  if (!device) throw new HttpError(401, 'invalid_token', 'Device token revoked or unknown')

  c.set('device', device)
  await next()
})
