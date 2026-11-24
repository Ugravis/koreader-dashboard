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

| Route           | Auth    | Description                            |
| --------------- | ------- | -------------------------------------- |
| `/v1/auth/*`    | —       | Better Auth (email + password, cookie) |
| `GET /v1/me`    | session | Current user                           |
| `/openapi.json` | —       | OpenAPI 3.1 spec                       |

Device routes use `Authorization: Bearer <device_token>`. Only sha256 hashes of tokens and device codes are stored.

### Ingest payload

Mirrors KOReader's `statistics.sqlite3` (`book`, `page_stat_data`). Times are unix seconds.

```json
{
  "books": [
    {
      "md5": "…",
      "title": "…",
      "authors": "…",
      "series": "…",
      "language": "en",
      "pages": 300,
      "notes": 0,
      "highlights": 0,
      "last_open": 1764000000,
      "total_read_time": 3600,
      "total_read_pages": 42
    }
  ],
  "page_stats": [
    { "md5": "…", "page": 12, "start_time": 1764000000, "duration": 35, "total_pages": 300 }
  ]
}
```

`page_stats[].md5` must match a book of the payload or one already stored. `cursor` is the max `start_time` of the batch (all of it is stored once the request succeeds), `null` when `page_stats` is empty.

## Tests

Vitest against a real Postgres database (`koreader_dashboard_test`, created and migrated automatically). Override with `TEST_DATABASE_URL`.

```bash
pnpm --filter @koreader-dashboard/api test
```
