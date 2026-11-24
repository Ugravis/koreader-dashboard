import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import { HttpError } from './errors.ts'
import type { AppEnv } from '../types.ts'

type Options = { windowMs: number; max: number; key: (c: Context<AppEnv>) => string }

/** Fixed-window in-memory rate limiter. Single API instance only. */
export function rateLimit({ windowMs, max, key }: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return createMiddleware<AppEnv>(async (c, next) => {
    const now = Date.now()
    const k = key(c)
    const entry = hits.get(k)
    if (!entry || entry.resetAt <= now) {
      hits.set(k, { count: 1, resetAt: now + windowMs })
    } else if (++entry.count > max) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      throw new HttpError(429, 'rate_limited', 'Too many attempts, try again later')
    }
    await next()
  })
}
