import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth.ts'

// Mirrors KOReader's statistics.sqlite3 `book` table (schema 20221111), scoped per user.
export const books = pgTable(
  'books',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // KOReader partial md5 of the document.
    md5: text().notNull(),
    title: text().notNull(),
    authors: text(),
    series: text(),
    language: text(),
    pages: integer(),
    notes: integer(),
    highlights: integer(),
    lastOpen: timestamp({ withTimezone: true }),
    // Totals as computed by KOReader (seconds, pages).
    totalReadTime: bigint({ mode: 'number' }),
    totalReadPages: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique('books_user_id_md5_unique').on(t.userId, t.md5)],
)

// Mirrors KOReader's `page_stat_data` table.
export const pageStats = pgTable(
  'page_stats',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    bookId: uuid()
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    page: integer().notNull(),
    startTime: timestamp({ withTimezone: true }).notNull(),
    // Seconds spent on the page.
    duration: integer().notNull(),
    totalPages: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.bookId, t.page, t.startTime] }),
    index('page_stats_user_id_start_time_idx').on(t.userId, t.startTime),
  ],
)
