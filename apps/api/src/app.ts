import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { auth } from './auth.ts'
import { env } from './env.ts'
import { errorBody, onError } from './lib/errors.ts'
import { deviceRoutes } from './routes/devices.ts'
import { ingestRoutes } from './routes/ingest.ts'
import { libraryRoutes } from './routes/library.ts'
import { meRoutes } from './routes/me.ts'
import type { AppEnv } from './types.ts'

export function createApp() {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const message = result.error.issues
          .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
          .join('; ')
        return c.json(errorBody('invalid_request', message), 400)
      }
    },
  })

  if (env.NODE_ENV !== 'test') app.use(logger())
  app.use(
    '/v1/*',
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    }),
  )

  app.get('/health', (c) => c.json({ status: 'ok' }))
  app.on(['GET', 'POST'], '/v1/auth/*', (c) => auth.handler(c.req.raw))
  app.route('/v1/me', meRoutes)
  app.route('/v1/devices', deviceRoutes)
  app.route('/v1/ingest', ingestRoutes)
  app.route('/v1/library', libraryRoutes)

  app.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'KOReader Dashboard API', version: '0.1.0' },
  })

  app.notFound((c) => c.json(errorBody('not_found', 'Not found'), 404))
  app.onError(onError)

  return app
}

export const app = createApp()
