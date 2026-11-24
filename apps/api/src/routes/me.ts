import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { errorResponse } from '../lib/openapi.ts'
import { requireSession } from '../middleware/session.ts'
import type { AppEnv } from '../types.ts'

const MeSchema = z.object({ id: z.string(), email: z.string(), name: z.string() }).openapi('Me')

const getMe = createRoute({
  method: 'get',
  path: '/',
  middleware: [requireSession] as const,
  responses: {
    200: { content: { 'application/json': { schema: MeSchema } }, description: 'Current user' },
    401: errorResponse('Not signed in'),
  },
})

export const meRoutes = new OpenAPIHono<AppEnv>().openapi(getMe, (c) => {
  const { id, email, name } = c.get('user')
  return c.json({ id, email, name }, 200)
})
