# FC Career Manager

A full-stack web application for managing football career mode progress, inspired by EA Sports FC. Users can track careers, manage squads, organize seasons, and generate AI-powered news content.

## Project Structure

This is a pnpm monorepo with the following packages:

### Applications (`artifacts/`)
- **`fc-career-manager/`** — React + Vite frontend (port 5000, preview path `/`)
- **`api-server/`** — Express.js backend API (port 8080, mounted at `/api`)
- **`fc-career-manager-mobile/`** — Expo React Native mobile app (port 8099, Expo Go via QR)
- **`mockup-sandbox/`** — UI component prototyping environment

### Shared Libraries (`lib/`)
- **`db/`** — Drizzle ORM + PostgreSQL database layer
- **`api-spec/`** — OpenAPI spec + Orval codegen configuration
- **`api-client-react/`** — Auto-generated React Query hooks
- **`api-zod/`** — Auto-generated Zod validation schemas
- **`integrations-openai-ai-server/`** — Server-side OpenAI integration
- **`integrations-openai-ai-react/`** — React-side OpenAI integration

## Tech Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, TanStack Query, Framer Motion, Shadcn UI, vite-plugin-pwa (PWA/installable)
- **Mobile**: Expo SDK 53, React Native 0.79, expo-router 5, TanStack Query, expo-secure-store (JWT), dark theme with dynamic club colors
- **Backend**: Express.js 5, Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (provisioned)
- **Object Storage**: Replit Object Storage (via sidecar)
- **Monorepo**: pnpm workspaces

## Running Services

- Frontend dev server: `pnpm --filter @workspace/fc-career-manager run dev` (port 5000)
- Backend API: `PORT=8080 NODE_ENV=development node ... dist/index.mjs` (port 8080)
- Expo Metro Bundler: `pnpm --filter @workspace/fc-career-manager-mobile run start -- --port 8099` (port 8099)
- Frontend proxies `/api/*` to the backend via Vite proxy config

### Mobile App (Expo)
- Located at `artifacts/fc-career-manager-mobile`
- Package: `@workspace/fc-career-manager-mobile`
- Stack: Expo SDK 53 + React Native 0.79 + expo-router 5
- Navigation: Root Stack → (auth) login/register → career-select → (tabs) home/matches/squad/news/more + stack routes: match-detail, transfers, injuries, financeiro, trophies, diretoria
- Auth: JWT stored via expo-secure-store (SecureStore), falls back to localStorage on web
- API: calls `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:8080`), set to backend HTTPS URL in workflow
- Theme: Dark — background `#0B0714`, card `#120E1F`, primary `#8B5CF6` + dynamic club color overrides
- To test natively: scan the QR code in the Expo Mobile App workflow console with Expo Go app
- Screens: Dashboard, Partidas (matches list + detail), Elenco (squad with search/filter/bottom sheet), Notícias (news feed), Mais (links hub), Perfil
- Stack screens (from Mais tab): Transferências, Lesões, Financeiro, Troféus, Diretoria
- Push notifications: `services/notifications.ts` — expo-notifications 0.31.x, permission request, local scheduling
- Offline cache: `hooks/useOfflineCache.ts` — AsyncStorage-backed TTL cache

## Authentication

JWT-based authentication (email + password). No third-party provider needed.
- Backend: bcryptjs (password hashing) + jsonwebtoken (JWT signing)
- Token stored in `localStorage` under key `fc_auth_token`
- All `/api/careers*`, `/api/seasons*`, `/api/data/season/*`, `/api/data/career/*` routes require `Authorization: Bearer <token>` header
- First user to register claims all orphaned careers (user_id=null) — migration-safe for existing data
- Routes: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`

### Multi-tenancy
- `careers.user_id` column (nullable) links careers to users
- GET /api/careers returns only careers where `user_id = :me` OR `user_id IS NULL`
- POST /api/careers sets `user_id` from JWT payload
- `/api/data/career/:id/*` and `/api/data/season/:id/*` verify that the career belongs to the authenticated user (or is orphaned)

## Data Security Architecture

Game data is stored in PostgreSQL via `career_data` and `season_data` key-value tables.

### In-memory session store (`sessionStore.ts`)
- All game data is read from a module-level in-memory Map (not localStorage)
- localStorage cannot be tampered via browser console to affect game data
- On session start (`syncSeasonFromDb` / `syncCareerFromDb`): data is loaded from PostgreSQL → written to sessionStore
- On mutations: data is written to sessionStore + async `PUT /api/data/*/` call to PostgreSQL
- On logout: `sessionClear()` wipes all in-memory data
- Momentos (diary photos) and UI state (cooldowns, pending meetings, auto-news handled events) remain in localStorage since they are cosmetic/ephemeral

### What's stored in DB (both season_data and career_data)
Season-level: matches, player_stats, transfers, league_position, finances, news, injuries, rivals, rivalsLocked, fan_mood
Career-level: overrides, lineup, benchOrder, formation, diretoria_members, diretoria_meetings, diretoria_notifications, conv_*, trophies, comp_results, customPlayers, formerPlayers, hiddenPlayerIds

## Payments (Stripe)

The app has full Stripe integration code already in place (`artifacts/api-server/src/lib/stripeClient.ts`). It is coded to use the Replit Stripe integration first, then falls back to `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` env vars.

**NOTE:** The Stripe Replit integration was not connected during migration (user dismissed). To enable payments, either:
1. Connect the Stripe integration via the Integrations panel in Replit (recommended), OR
2. Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` as secrets in the environment

Stripe initialization is non-fatal — the app runs fully without it; only subscription/checkout features are affected.

## Required Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Auto-provisioned via Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Auto-provisioned via Replit AI Integrations
- `API_FOOTBALL_KEY` — User-provided API key for api-football.com (needed to load clubs/squad data)
- `PUBLIC_OBJECT_SEARCH_PATHS` — Comma-separated paths for Replit Object Storage (public)
- `PRIVATE_OBJECT_DIR` — Directory path for Replit Object Storage (private)
- `JWT_SECRET` — Secret for signing JWTs (set in Railway for production; defaults to dev secret locally)

## Ongoing Career Import (AI)

Users can import an existing EA FC career instead of starting fresh. In the career creation wizard, the pre-step "Career Type" lets users choose:
- **New Career**: start from scratch with neutral moods.
- **Ongoing Career**: describe their current situation in free text; the AI (`POST /api/careers/parse-ongoing-context`) extracts `boardMood`, `fanMood`, `currentSeason`, `projeto`, `narrativeSummary`, and `confidence`. A preview card shows the extracted values before the user continues.

The parsed context seeds the career with:
- `backstory` (narrativeSummary) — stored in DB (`careers.backstory` column, migration `0012_career_backstory.sql`).
- `initialBoardMood` / `initialFanMood` — stored in the `Career` object and seeded into board/fan mood on first Dashboard load (sessionStorage key `fc-mood-seeded-{careerId}`).
- `projeto` — pre-populates the project field in the setup step.
- `backstory` is forwarded to all AI news generation calls (noticias/generate, generate-rumor, generate-welcome) to enrich the narrative context.

## Admin Push Notification System

Admin can send pop-up notifications to all users or specific users from the admin panel (Notifications tab). On the user side, after login + DB sync, the app checks for unread notifications and shows a modal popup.

- **DB tables**: `notifications`, `notification_targets`, `notification_reads` (migration `0009_notifications.sql`)
- **Admin routes** (require admin JWT): `POST/GET/DELETE /api/admin-panel/notifications`
- **User routes** (require Bearer auth): `GET /api/notifications/pending`, `POST /api/notifications/:id/read`
- Responses from users are saved as bug reports with page label `📣 Notificação: {title}`
- Component: `artifacts/fc-career-manager/src/components/NotificationPopup.tsx`

## Database

PostgreSQL managed by Replit. Schema managed via Drizzle Kit.
- Push schema: `pnpm --filter @workspace/db run push`
- Force push: `pnpm --filter @workspace/db run push-force`
- Migration `0002_users_multitenancy.sql`: adds `users` table + `user_id` column to `careers`
- Migrations are applied on server startup when `MIGRATIONS_PATH` env var is set

## API Codegen

The API client is auto-generated from the OpenAPI spec:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Match snapshot semantics (IMPORTANT — do not break)

Registered matches are **immutable historical records**. Future edits on the
Elenco/club screen (retraining, renaming, transfers) MUST NOT alter how a past
match is displayed. The contract is:

- `MatchRecord.formation` — the formation key (e.g. `"4-3-3"`) used at
  registration. Always set, even when the user used the "lista" lineup mode
  (falls back to the saved club formation at registration time).
- `MatchRecord.playerSnapshot[id]` — frozen `{ name, photo, positionPtBr,
  number }` for every starter, sub, and MOTM at registration time. Captured
  with **trained-position overrides applied** so Smith (MID→DEF) is recorded
  as DEF in matches registered after the training.

Rendering rules (web `MatchDetailPage`, mobile `match-detail`):
- When `playerSnapshot` exists, the snapshot's fields **win** over the current
  squad's fields for known players. Future edits to the player are invisible
  to past matches.
- When `formation` exists, it is the source of truth for the pitch layout and
  for `sortedStarterIds` (no dynamic `pickBestEleven` fallback).

Auto-fill / pickBestEleven rules (`ElencoView`, `RegistrarPartidaModal`):
- Always call `applyOverridesToPlayers(players, overrides)` from
  `playerStatsStorage.ts` BEFORE invoking `pickBestEleven`. Otherwise trained
  positions are ignored and the field appears to "reset".

## Post-merge setup

Script at `scripts/post-merge.sh`:
1. `pnpm install --frozen-lockfile`
2. `pnpm --filter db push`

## Stripe webhook (production)

The webhook URL in production is:
`https://managereafc-production.up.railway.app/api/stripe/webhook`

### Secret resolution (the source of truth)
The handler in `artifacts/api-server/src/app.ts` accepts events signed by
EITHER of two secrets (DB first, env as fallback):
1. **Primary**: `stripe._managed_webhooks.secret` for the current Stripe
   account, populated by `stripeSync.findOrCreateManagedWebhook(...)` on
   every server boot. This is the source of truth.
2. **Fallback**: `STRIPE_WEBHOOK_SECRET` env var. Only used when the DB
   secret fails verification. A warning is logged whenever this fallback
   succeeds, because it means the env var is out of sync with the
   managed webhook and should be removed or updated.

`findOrCreateManagedWebhook` is idempotent: it reuses the existing
endpoint when status is `enabled`, deletes and recreates it (with a new
secret) when Stripe has marked it `disabled`, and dedupes endpoints
pointing at any other URL for the same account.

### If Stripe disables the endpoint again
1. Check Railway logs for `Webhook signature verification failed against
   all candidate secrets` and the `tried` array of secret fingerprints.
2. In Stripe Dashboard → Developers → Webhooks, confirm only one
   endpoint points at `…/api/stripe/webhook`. Delete duplicates.
3. Click `Enable endpoint` (or `Send test webhook`) in the dashboard.
4. The next API server restart on Railway will refresh
   `stripe._managed_webhooks.secret` automatically.
5. If a stale `STRIPE_WEBHOOK_SECRET` is set in Railway env, prefer
   removing it so the DB-managed secret is the single source of truth.

A `GET /api/stripe/webhook` route returns 200 for manual healthchecks
(not used by Stripe itself).
