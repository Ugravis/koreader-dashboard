import {
  bigint,
  customType,
  date,
  index,
  integer,
  real,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth.ts'

// Mirrors KOReader's statistics.sqlite3 `book` table (schema 20221111), scoped per user,
// plus the per-book sidecar data (metadata.<ext>.lua) sent by the plugin.
// Identity is (md5, title, authors) like KOReader: one md5 can be cached for two books.
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
    // Sidecar (doc_props, summary, percent_finished), null until the plugin sends it.
    seriesIndex: real(),
    keywords: text(),
    identifiers: text(),
    description: text(),
    filePath: text(),
    // KOReader summary.status: reading | complete | abandoned.
    status: text(),
    statusModified: date({ mode: 'string' }),
    percentFinished: real(),
    rating: integer(),
    review: text(),
    libraryUpdatedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('books_identity_unique').on(t.userId, t.md5, t.title, t.authors).nullsNotDistinct(),
  ],
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

// Highlights and notes from the sidecar `annotations`. Replaced per book on each library sync.
export const annotations = pgTable(
  'annotations',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    bookId: uuid()
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    text: text(),
    note: text(),
    chapter: text(),
    pageno: integer(),
    // Device local time, as KOReader stores it ("YYYY-MM-DD HH:MM:SS").
    datetime: timestamp({ mode: 'string' }),
    datetimeUpdated: timestamp({ mode: 'string' }),
    color: text(),
    drawer: text(),
    pos0: text(),
    pos1: text(),
  },
  (t) => [index('annotations_book_id_idx').on(t.bookId)],
)

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })

// Cover image extracted from the book file by the plugin, resized by the API (JPEG).
// Keyed by file (md5 + path), not by book row: it survives the row being re-created, and two
// files sharing a md5 (a sidecar copied from another book) keep their own cover.
export const bookCovers = pgTable(
  'book_covers',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    md5: text().notNull(),
    filePath: text().notNull(),
    image: bytea().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.md5, t.filePath] })],
)
