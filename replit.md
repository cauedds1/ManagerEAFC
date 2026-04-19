# FC Career Manager

A full-stack web application for managing football career mode progress, inspired by EA Sports FC. Users can track careers, manage squads, organize seasons, and generate AI-powered news content.

## Project Structure

This is a pnpm monorepo with the following packages:

### Applications (`artifacts/`)
- **`fc-career-manager/`** — React + Vite frontend (port 3000, preview path `/`)
- **`api-server/`** — Express.js backend API (port 8080, mounted at `/api`)
- **`mockup-sandbox/`** — UI component prototyping environment

### Shared Libraries (`lib/`)
- **`db/`** — Drizzle ORM + PostgreSQL database layer
- **`api-spec/`** — OpenAPI spec + Orval codegen configuration
- **`api-client-react/`** — Auto-generated React Query hooks
- **`api-zod/`** — Auto-generated Zod validation schemas
- **`integrations-openai-ai-server/`** — Server-side OpenAI integration
- **`integrations-openai-ai-react/`** — React-side OpenAI integration

## Tech Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, TanStack Query, Framer Motion, Shadcn UI
- **Backend**: Express.js 5, Node.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (provisioned)
- **Object Storage**: Replit Object Storage (via sidecar)
- **Monorepo**: pnpm workspaces

## Running Services

- Frontend dev server: `pnpm --filter @workspace/fc-career-manager run dev` (port 3000)
- Backend API: `pnpm --filter @workspace/api-server run dev` (port 8080)
- Frontend proxies `/api/*` to the backend via Vite proxy config

## Authentication

JWT-based authentication (email + password). No third-party provider needed.
- Backend: bcryptjs (password hashing) + jsonwebtoken (JWT signing)
- Token stored in `localStorage` under key `fc_auth_token`
- All `/api/careers*` and `/api/seasons*` routes require `Authorization: Bearer <token>` header
- First user to register claims all orphaned careers (user_id=null) — migration-safe for existing data
- Routes: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`

### Multi-tenancy
- `careers.user_id` column (nullable) links careers to users
- GET /api/careers returns only careers where `user_id = :me` OR `user_id IS NULL`
- POST /api/careers sets `user_id` from JWT payload

## Required Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Auto-provisioned via Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Auto-provisioned via Replit AI Integrations
- `API_FOOTBALL_KEY` — User-provided API key for api-football.com (needed to load clubs/squad data)
- `PUBLIC_OBJECT_SEARCH_PATHS` — Comma-separated paths for Replit Object Storage (public)
- `PRIVATE_OBJECT_DIR` — Directory path for Replit Object Storage (private)
- `JWT_SECRET` — Secret for signing JWTs (set in Railway for production; defaults to dev secret locally)

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

## Post-merge setup

Script at `scripts/post-merge.sh`:
1. `pnpm install --frozen-lockfile`
2. `pnpm --filter db push`
