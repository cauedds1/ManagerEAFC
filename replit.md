# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db exec tsc --build` — rebuild DB type declarations (required after schema changes)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## FC Career Manager

Brazilian Portuguese companion app for EA FC 26 career mode.

### Database Schema (`lib/db/src/schema/index.ts`)
- `clubs` — Club list cache (id PK = API-Football team ID, name, logo_url, league, league_id, country, cached_at)
- `squads` — Squad cache per team (team_id PK, players jsonb, source, cached_at)

### API Routes (`artifacts/api-server/src/routes/`)
- `GET /api/clubs` → 200 `{clubs, cachedAt}` if fresh (<30 days), 204 if empty/stale
- `PUT /api/clubs` → upserts club list (transaction: DELETE all + INSERT in 200-row chunks)
- `DELETE /api/clubs` → clears club list cache
- `GET /api/squad/:teamId` → 200 `{players, source, cachedAt}` if fresh (<7 days), 204 if empty/stale
- `PUT /api/squad/:teamId` → upserts squad (ON CONFLICT DO UPDATE)

### Two-Layer Cache Strategy
1. **Layer 1 localStorage** — instant sync read/write, key `fc-career-manager-clubs` and `fc-career-manager-squad-{teamId}`
2. **Layer 2 PostgreSQL** — async, survives browser cache clears
- On cache miss: localStorage → DB → external API (API-Football / msmc.cc)
- On fresh fetch: write to localStorage + DB (fire-and-forget for DB)
- Vite proxy: `/api` → `http://localhost:8080` (dev only)

### TTLs
- Club list: 30 days
- Squad: 7 days
