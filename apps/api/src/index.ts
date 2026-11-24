import { serve } from '@hono/node-server'
import { app } from './app.ts'
import { env } from './env.ts'

serve({ fetch: app.fetch, hostname: env.HOST, port: env.PORT }, (info) => {
  console.log(`API listening on http://${env.HOST}:${info.port}`)
})
