import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { env } from './env.ts'

export const app = new Hono()

app.use(logger())
app.use('/v1/*', cors({ origin: env.WEB_ORIGIN, credentials: true }))

app.get('/health', (c) => c.json({ status: 'ok' }))
