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

## Tests

Vitest against a real Postgres database (`koreader_dashboard_test`, created and migrated automatically). Override with `TEST_DATABASE_URL`.

```bash
pnpm --filter @koreader-dashboard/api test
```
