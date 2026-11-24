import type { AuthSession, AuthUser } from './auth.ts'

export type AppEnv = {
  Variables: {
    user: AuthUser
    session: AuthSession
    device: { id: string; userId: string }
  }
}
