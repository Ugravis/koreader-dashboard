import type { AuthSession, AuthUser } from './auth.ts'

export type AppEnv = {
  Variables: {
    user: AuthUser
    session: AuthSession
  }
}
