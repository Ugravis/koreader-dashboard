import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// Reuse the API env file when DATABASE_URL is not exported in the shell.
const apiEnv = new URL('../../apps/api/.env', import.meta.url)
if (!process.env.DATABASE_URL && existsSync(apiEnv)) process.loadEnvFile(apiEnv)

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: { url },
  casing: 'snake_case',
})
