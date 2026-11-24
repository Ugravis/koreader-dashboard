import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'

export const devices = pgTable(
  'devices',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    model: text(),
    // sha256 hex of the device token. The token itself is never stored.
    tokenHash: text().notNull().unique(),
    lastSyncAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('devices_user_id_idx').on(t.userId)],
)

export const devicePairings = pgTable('device_pairings', {
  id: uuid().primaryKey().defaultRandom(),
  // sha256 hex of the device code held by the plugin.
  deviceCodeHash: text().notNull().unique(),
  // 8 chars, unambiguous alphabet, shown to the user.
  userCode: text().notNull().unique(),
  deviceName: text().notNull(),
  deviceModel: text(),
  // Null until the user confirms the code from the web app.
  userId: text().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  consumedAt: timestamp({ withTimezone: true }),
})
