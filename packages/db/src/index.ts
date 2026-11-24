import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema/index.ts'

export function createDb(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl })
  return drizzle({ client: pool, schema, casing: 'snake_case' })
}

export type Db = ReturnType<typeof createDb>
export { schema }
