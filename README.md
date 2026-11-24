# KOReader Dashboard

Sync your [KOReader](https://koreader.rocks) reading statistics to the cloud and explore them on a web dashboard, from your computer or phone.

## Repository layout

```
apps/
  koplugin/   KOReader plugin (Lua)
  api/        Backend API (Hono, Drizzle)
  web/        Public site and user dashboard (Next.js, Tailwind, shadcn/ui)
packages/
  db/                 Drizzle schema, migrations and client (used by api only)
  typescript-config/  Shared tsconfig presets
docs/
```

## Requirements

- Node.js 22 (`.nvmrc`), pnpm 10
- [OrbStack](https://orbstack.dev) for local infrastructure (Postgres, Adminer)

## Getting started

```bash
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

pnpm db:up   # Postgres + Adminer (OrbStack)
pnpm dev     # api + web, run natively on the host
```

| Service  | URL                                                                                          |
| -------- | -------------------------------------------------------------------------------------------- |
| Web      | http://localhost:3000                                                                        |
| API      | http://localhost:8787 (`/health`)                                                            |
| Adminer  | http://localhost:8081 (server `postgres`, user/password `koreader`, db `koreader_dashboard`) |
| Postgres | `localhost:5432`                                                                             |

## Scripts

| Command                       | Description                       |
| ----------------------------- | --------------------------------- |
| `pnpm dev`                    | Run all apps in dev mode          |
| `pnpm check`                  | Lint and typecheck all packages   |
| `pnpm format`                 | Format with Prettier              |
| `pnpm db:up` / `pnpm db:down` | Start / stop local infrastructure |
| `pnpm --filter <app> <cmd>`   | Run a command in one package      |

## Plugin

See [apps/koplugin/README.md](apps/koplugin/README.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[AGPL-3.0](LICENSE)
