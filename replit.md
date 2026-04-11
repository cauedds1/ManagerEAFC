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

## Required Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Auto-provisioned via Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Auto-provisioned via Replit AI Integrations
- `API_FOOTBALL_KEY` — User-provided API key for api-football.com (needed to load clubs/squad data)
- `PUBLIC_OBJECT_SEARCH_PATHS` — Comma-separated paths for Replit Object Storage (public)
- `PRIVATE_OBJECT_DIR` — Directory path for Replit Object Storage (private)

## Database

PostgreSQL managed by Replit. Schema managed via Drizzle Kit.
- Push schema: `pnpm --filter @workspace/db run push`
- Force push: `pnpm --filter @workspace/db run push-force`

## API Codegen

The API client is auto-generated from the OpenAPI spec:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Post-merge setup

Script at `scripts/post-merge.sh`:
1. `pnpm install --frozen-lockfile`
2. `pnpm --filter db push`
