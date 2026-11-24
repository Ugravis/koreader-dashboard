import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.url(),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
})

export const env = EnvSchema.parse(process.env)
export type Env = typeof env
