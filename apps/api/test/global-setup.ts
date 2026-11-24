import { migrateDb } from '@koreader-dashboard/db'
import { Client } from 'pg'

/** Creates the test database if missing, then applies migrations. */
export default async function setup() {
  const url = new URL(
    process.env.TEST_DATABASE_URL ??
      'postgres://koreader:koreader@localhost:5432/koreader_dashboard_test',
  )
  const name = url.pathname.slice(1)
  const admin = new Client({ connectionString: new URL('/postgres', url).toString() })
  await admin.connect()
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${name}"`)
  await admin.end()

  await migrateDb(url.toString())
}
