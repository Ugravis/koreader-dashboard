import { createMiddleware } from 'hono/factory'
import { auth } from '../auth.ts'
import { HttpError } from '../lib/errors.ts'
import type { AppEnv } from '../types.ts'

/** Requires a Better Auth cookie session. Sets `user` and `session`. */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!result) throw new HttpError(401, 'unauthorized', 'Sign in required')
  c.set('user', result.user)
  c.set('session', result.session)
  await next()
})
