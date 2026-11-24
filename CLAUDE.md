# Project Guidelines

## Stack & Commands

- Stack:
  - Plugin: Lua.
  - Front: Nextjs, Tailwind, Shadcn/ui, Orbstack.
  - API: Hono, Drizzle.
  - DB: Postgres.
  - Admin: SPA Vite + React.
- PM: pnpm (use `pnpm --filter <app> <cmd>`), Turborepo.
- Monorepo: `apps/{koplugin,api,web}`, `packages/{db,typescript-config}`. Only `apps/api` imports `packages/db`.
- Infra: OrbStack runs only Postgres + Adminer (`pnpm db:up`). Apps run natively on the Mac (`pnpm dev`).
- Ports: web 3000, api 8787, Adminer 8081, Postgres 5432.
- Checks: `pnpm check` (lint + typecheck), `pnpm format:check`, `luacheck --config apps/koplugin/.luacheckrc apps/koplugin`.
- Plugin: tested directly on Kindle Paperwhite 2024 (KOReader 2026.07.1) over USB. No emulator.
- Current plan: `docs/plans/v0.1.0.md`.
- Strict TS, mobile-first, responsive, skeleton loaders, SOLID principles.

## Interaction & Git

- Language: French for discussion, English for code/docs/commits.
- Git: Gitflow, Conventional Commits (no AI/Claude mentions). User validates PRs.

## File Inspection & Token Guardrails

- Source code: Max 150 lines per read. If > 150 lines, locate targets via `grep -n` and inspect using `offset`/`limit`.
- Configs/Locks/Data: NEVER read full lockfiles, logs, GeoJSON, GPX, or Docker files. Use `jq`, `yq`, `grep`, `head`, `tail`.
- Tests: Run targeted files only (never full suite). Silence linters (`--quiet`).

## Output Rules

- Output changed lines only (minimal diff style).
- No unrequested architectural overhauls or passive code echoes.

## Task Delegation

Spawn subagents to isolate context, parallelize independent work, or offload bulk mechanical tasks. Don't spawn when the parent needs the reasoning, when synthesis requires holding things together, or when spawn overhead dominates.

Pick the cheapest model that can do the subtask well:

- Haiku: bulk mechanical work, no judgment
- Sonnet: scoped research, code exploration, in-scope synthesis
- Opus: subtasks needing real planning or tradeoffs

If a subagent realizes it needs a higher tier than itself, return to the parent.

Parent owns final output and cross-spawn synthesis. User instructions override.
