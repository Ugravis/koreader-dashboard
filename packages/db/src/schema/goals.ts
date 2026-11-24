import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth.ts'

// Reading goals set on the website, one row per user. Null means no goal.
export const readingGoals = pgTable('reading_goals', {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  yearlyBooks: integer(),
  dailyMinutes: integer(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})
