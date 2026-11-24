# @koreader-dashboard/api

Hono API on port 8787. OpenAPI spec at `/openapi.json`.

## Setup

```bash
cp apps/api/.env.example apps/api/.env   # set BETTER_AUTH_SECRET (openssl rand -hex 32)
pnpm db:up && pnpm db:migrate
pnpm --filter @koreader-dashboard/api dev
```

`HOST=0.0.0.0` lets the Kindle reach the API over Wi-Fi (`http://<mac-lan-ip>:8787`).

## Routes

| Route                           | Auth    | Description                                                                                                                                   |
| ------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/v1/auth/*`                    | —       | Better Auth (email + password, cookie)                                                                                                        |
| `GET /v1/me`                    | session | Current user                                                                                                                                  |
| `GET /v1/me/summary`            | session | `{ books_count, finished_count, total_read_seconds, total_pages_read }`                                                                       |
| `GET /v1/me/books`              | session | Books grouped by title + authors, most recently active first (status, progress, reading time, highlight counts, ISBN)                         |
| `GET /v1/me/books/:id`          | session | One book (group) with its highlights and notes                                                                                                |
| `POST /v1/devices/pair/start`   | —       | Start pairing: `device_code`, `user_code`, `web_url`, `verification_url(_complete)`, `expires_in` (600 s), `interval` (5 s)                   |
| `POST /v1/devices/pair/confirm` | session | Link `user_code` to the user (10 req/min)                                                                                                     |
| `POST /v1/devices/pair/poll`    | —       | `428 authorization_pending`, `410 expired`, `200 { device_token }` once                                                                       |
| `GET /v1/devices`               | session | Active devices                                                                                                                                |
| `DELETE /v1/devices/:id`        | session | Revoke a device                                                                                                                               |
| `GET /v1/devices/current`       | device  | Calling device + `web_url`, `401` once revoked                                                                                                |
| `DELETE /v1/devices/current`    | device  | Revoke the calling device (unlink from the plugin)                                                                                            |
| `POST /v1/ingest`               | device  | KOReader `book` rows (request-local `ref`) and `page_stats` (`book_ref`, max 5,000, `ON CONFLICT DO NOTHING`). Returns `{ accepted, cursor }` |
| `POST /v1/library`              | device  | Sidecar data per book and its full `annotations` (replaced per book). Max 100 books, 4,000 annotations                                        |
| `/openapi.json`                 | —       | OpenAPI 3.1 spec                                                                                                                              |

Device routes use `Authorization: Bearer <device_token>`. Only sha256 hashes of tokens and device codes are stored.

### Book identity

Books are identified by `(md5, title, authors)`, like KOReader's `book` table: KOReader can cache one md5 for two books (stale `partial_md5_checksum` in a sidecar) and record one book under two md5. Read endpoints group books by title + authors.

### Ingest payload

Mirrors KOReader's `statistics.sqlite3` (`book`, `page_stat_data`). Times are unix seconds.

```json
{
  "books": [
    { "ref": "6", "md5": "…", "title": "…", "authors": "…", "pages": 300, "total_read_time": 3600 }
  ],
  "page_stats": [
    { "book_ref": "6", "page": 12, "start_time": 1764000000, "duration": 35, "total_pages": 300 }
  ]
}
```

`cursor` is the max `start_time` of the batch, `null` when `page_stats` is empty.

### Library payload

Per book: identity, `series`, `series_index`, `language`, `keywords`, `identifiers`, `description`, `pages`, `file_path`, `status` (`reading` / `complete` / `abandoned`), `status_modified`, `percent_finished`, `rating`, `review`, `highlights`, `notes`, `annotations[]` (`text`, `note`, `chapter`, `pageno`, `datetime`, `datetime_updated`, `color`, `drawer`, `pos0`, `pos1`). A book sent without `annotations` has none.

## Tests

Vitest against a real Postgres database (`koreader_dashboard_test`, created and migrated automatically). Override with `TEST_DATABASE_URL`.

```bash
pnpm --filter @koreader-dashboard/api test
```
