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
- `squad_players` — One row per player per team; composite PK `(team_id, player_id)`. Columns: team_id, player_id, name, age, position, position_pt_br, photo, player_number, source, cached_at. All rows for the same team share the same source + cached_at from the last fetch.

### API Routes (`artifacts/api-server/src/routes/`)
- `GET /api/clubs` → 200 `{clubs, cachedAt}` if fresh (<30 days), 204 if empty/stale
- `PUT /api/clubs` → replaces club list atomically (transaction: DELETE all + INSERT in 200-row chunks)
- `DELETE /api/clubs` → clears club list cache
- `GET /api/squad/:teamId` → 200 `{players, source, cachedAt}` if fresh (<7 days), 204 if empty/stale. Reconstructs SquadResult from individual player rows.
- `PUT /api/squad/:teamId` → replaces squad atomically (transaction: DELETE WHERE team_id + INSERT up to 100 rows per chunk)

### Two-Layer Cache Strategy
1. **Layer 1 localStorage** — instant sync read/write, key `fc-career-manager-clubs` and `fc-career-manager-squad-{teamId}`
2. **Layer 2 PostgreSQL** — async, survives browser cache clears
- On cache miss: localStorage → DB → external API (API-Football / msmc.cc)
- On fresh fetch: write to localStorage + DB (fire-and-forget for DB)
- Vite proxy: `/api` → `http://localhost:8080` (dev only)

### TTLs
- Club list: 30 days
- Squad: 7 days

### Design System (Task #6 Redesign)
- **AnimatedBackground**: 3 CSS-animated gradient blobs (`--blob-1/2/3`) + dot-grid overlay. Fixed `inset-0 -z-10` behind all content.
- **Theme engine** (`themeManager.ts`): hex→HSL conversion, sets 12+ CSS vars (`--club-primary`, `--club-primary-rgb`, `--app-bg`, `--surface`, `--surface-border`, `--glow`, `--blob-1/2/3`, `--club-gradient`, `--club-gradient-subtle`). `resetTheme()` applies default indigo/violet.
- **Glass utilities** (`index.css`): `.glass` = surface bg + border + backdrop blur. `.glass-hover` = hover accent border/bg. Used across all components.
- **Position labels**: `reNormalizePlayers()` in `squadCache.ts` fixes `positionPtBr` on every cache read.
- **FootballPitch**: `pickBestEleven()` selects best 11 by position (1 GK, 4 DEF, 3 MID, 3 ATT); `pickBestElevenIds()` exported for bench derivation. Dashboard `PitchWithBench` and `TeamPreview` both use it for consistent starter/bench split.
- **Club colors**: `clubColors.ts` maps ~70+ clubs to hex primary/secondary. `footballApiMap.ts` maps API-Football names to FC26 names. `Career.clubPrimary`/`clubSecondary` persist resolved colors. `CreateCareerWizard` stores resolved colors in state to avoid race conditions on confirm.
- **Settings.tsx**: Uses glass/theme CSS vars consistently with rest of app.
