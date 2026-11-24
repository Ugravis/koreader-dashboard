import { schema } from '@koreader-dashboard/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db.ts'
import { env } from './env.ts'

export const auth = betterAuth({
  baseURL: env.API_URL,
  basePath: '/v1/auth',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_ORIGIN],
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  rateLimit: { enabled: env.NODE_ENV === 'production' },
})

export type AuthUser = typeof auth.$Infer.Session.user
export type AuthSession = typeof auth.$Infer.Session.session
