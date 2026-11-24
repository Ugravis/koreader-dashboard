import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import * as schema from './schema/index.ts'

export function createDb(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl })
  return drizzle({ client: pool, schema, casing: 'snake_case' })
}

export type Db = ReturnType<typeof createDb>
export { schema }

// Query helpers re-exported so consumers share this package's drizzle-orm instance.
export {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  max,
  sql,
  sum,
} from 'drizzle-orm'

const MIGRATIONS_FOLDER = new URL('../drizzle', import.meta.url).pathname

/** Applies pending migrations from packages/db/drizzle. */
export async function migrateDb(databaseUrl: string) {
  const db = createDb(databaseUrl)
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  } finally {
    await db.$client.end()
  }
}
