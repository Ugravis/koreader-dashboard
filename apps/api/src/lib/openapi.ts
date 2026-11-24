import { z } from '@hono/zod-openapi'

export const ErrorSchema = z
  .object({ error: z.object({ code: z.string(), message: z.string() }) })
  .openapi('Error')

export const errorResponse = (description: string) => ({
  content: { 'application/json': { schema: ErrorSchema } },
  description,
})
