# @koreader-dashboard/db

Drizzle schema and migrations for Postgres. Only `apps/api` imports this package.

## Tables

- Better Auth: `user`, `session`, `account`, `verification`.
- `devices`, `device_pairings`: device authorization flow. Only sha256 hashes of tokens and device codes are stored.
- `books`, `page_stats`: mirror KOReader's `statistics.sqlite3` tables `book` and `page_stat_data` (schema `20221111`), scoped per user. Every KOReader column is kept.

## Migrations

`DATABASE_URL` is read from the shell, or from `apps/api/.env` when not set.

```bash
pnpm db:up        # start Postgres + Adminer (OrbStack)
pnpm db:generate  # after a schema change: writes packages/db/drizzle/*.sql
pnpm db:migrate   # apply pending migrations
```

Equivalent: `pnpm --filter @koreader-dashboard/db db:migrate`.

Check the tables in Adminer: http://localhost:8081 (server `postgres`, user/password/db from `.env.example`).
