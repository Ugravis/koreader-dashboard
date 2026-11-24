import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.url(),
  // Public URL of this API, used by Better Auth for cookies and callbacks.
  API_URL: z.url().default('http://localhost:8787'),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().min(32),
})

export const env = EnvSchema.parse(process.env)
export type Env = typeof env
