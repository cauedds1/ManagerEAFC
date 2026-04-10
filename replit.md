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
- `GET /api/proxy/image?url=...` → proxies images from allowed domains (media.api-sports.io, cdn.sofifa.net) with CORS headers. Cached 24h.
- `POST /api/noticias/generate` → AI-generated news post. Body: `{description, clubName, source?, category?}`. Uses OpenAI gpt-5.2 via Replit AI Integrations (env vars: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`). Returns: `{source, sourceHandle, sourceName, category, title?, content, likes, commentsCount, sharesCount, comments[]}`.

### AI Integration
- Provider: OpenAI via Replit AI Integrations proxy (`@workspace/integrations-openai-ai-server`)
- Model: `gpt-5.2` for news generation
- Env vars auto-provisioned — no API key required from user

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
- **Club colors**: `clubColors.ts` maps ~760 club entries (with aliases) to hex primary/secondary, covering Premier League, Championship, League One/Two, Bundesliga, 2. Bundesliga, Ligue 1, Serie A/B, LaLiga 1/2, Eredivisie, Liga Portugal, Belgian Pro League, Scottish Premiership, Turkish Süper Lig, Saudi Pro League, Argentine Liga Profesional, MLS, Swiss/Austrian/Polish/Scandinavian leagues, K League, A-League, Chinese Super League, Liga MX, Brasileirão, Romanian Liga 1, and League of Ireland. `footballApiMap.ts` maps API-Football names to FC26/internal names. `Career.clubPrimary`/`clubSecondary` persist resolved colors. `CreateCareerWizard` stores resolved colors in state to avoid race conditions on confirm.
- **Image proxy**: `GET /api/proxy/image?url=...` proxies images from `media.api-sports.io` and `cdn.sofifa.net` to bypass CORS. Used by `extractColorsFromImage()` in `themeManager.ts` as fallback for clubs not in the color map.
- **Settings.tsx**: Uses glass/theme CSS vars consistently with rest of app.

### Financeiro (Task #13)
- `TransferRecord` extended: `type?: "compra" | "venda"`, `toClub?: string` — backward-compatible (no type = compra).
- `financeiroStorage.ts`: `FinanceiroSettings` (transferBudget, salaryBudget) persisted in localStorage. `computeFinancialSnapshot()` computes spent/earned/netSpend/remainingBudget/wageBill/wageRoom from transfers.
- `FinanceiroView.tsx`: Budget editors, 4 summary KPI cards, progress bars for budget & wage usage, top earners list, record deals list.
- `ClubeView.tsx`: Added "Financeiro 💰" sub-tab. Now accepts `career` and `transfers` props.
- `TransferenciasView.tsx`: Added venda/compra toggle in form. "Registrar Venda" button. VENDA badge on sale cards. `toClub` field for sales. Updated club flow arrows accordingly.
- `DiretoriaView.buildClubContext()`: Injects financial snapshot (transferBudget, remainingTransferBudget, currentWageBill, salaryBudget, wageRoom, netSpend) into context sent to all Diretoria API routes.
- Backend `ClubContext` extended with financial fields. `buildClubContext()` string now shows budget lines. `check-triggers` fires gestor notification at 90%+ budget use; meeting trigger if budget exceeded; gestor notification if wage bill exceeded. `suggest-transfer` uses remainingTransferBudget as budget hint.

### Career Start Flow (Task #14)
- `Career` type extended: `projeto?: string`, `competitions?: string[]`, `clubDescription?: string`, `clubTitles?: ClubTitle[]`.
- `careerStorage.createCareer()` accepts optional `CareerExtras` for projeto/competitions/clubInfo.
- `CreateCareerWizard` is now 4-step: Técnico → Clube → Preview → Configurar.
- **Step 3 (TeamPreview) redesigned**: Hero card with logo/name/league/country/stadium/founded; AI-powered club info card (description + trophy badges loaded from `/api/club-info`); compact squad grid grouped by position (Goleiros/Defensores/Meio-Campistas/Atacantes) with internal scroll — no bench cut-off; "Configurar Carreira" next button.
- **Step 4 (CareerSetupStep)**: Projeto textarea (career objective affecting Diretoria/internal only, not fans); Competições chips (add/remove, league-based suggestions). Both are optional.
- `POST /api/club-info` endpoint: given clubName + clubLeague + clubCountry, returns `{description, titles[]}` via AI.
- `ClubContext` backend extended with `projeto?`; `buildClubContext()` injects projeto as "PROJETO DO TÉCNICO" line for board member AI.
- `DiretoriaView.buildClubContext()` passes `career.projeto` to the API context.
- `RegistrarPartidaModal` accepts `competitions?: string[]` prop; uses them as tournament chips (falls back to hardcoded TOURNAMENT_CHIPS if empty).
- `PartidasView` passes `career.competitions` down to the modal via Dashboard.
