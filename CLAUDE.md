# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NiChan is a Vietnamese event management platform (wedding/event planning SaaS). The repo uses npm workspaces with Turborepo to run the React frontend and Node.js backend side by side.

## Repository Structure

```
docs/             # Project docs, API specs, database design, SRS, backlog
NiChan-backend/   # Express + Prisma API server (Node >=22, TypeScript)
NiChan-event/     # React + Vite frontend (TypeScript, Tailwind, shadcn/ui)
tests/            # Repo-level manual/E2E test cases
```

The root `package.json` defines workspaces for `NiChan-event` and `NiChan-backend`; each app also keeps its own package scripts.

## Development Commands

### Frontend (`NiChan-event/`)

```bash
npm run dev          # Vite dev server on port 8080, proxies /api → localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest watch mode
```

### Backend (`NiChan-backend/`)

```bash
npm run dev              # tsx watch src/server.ts (hot reload, port 3000)
npm run build            # tsc
npm run start            # node dist/server.js
npm run check            # Type-check only
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio
npm run db:seed          # Seed database
```

## Architecture

### Frontend

- **Entry:** `src/main.tsx` -> `App.tsx` with React Router v6
- **Path alias:** `@/` -> `./src/`
- **Auth:** JWT in localStorage (`nichan_token` / `nichan_user`), verified via `GET /api/auth/me`. Three roles: `admin`, `organizer`, `customer`
- **API client:** `src/services/apiClient.ts` - fetch wrapper, auto-attaches Bearer token
- **UI:** shadcn/ui (Radix primitives) + Tailwind with custom design tokens
- **State:** TanStack Query v5 for server state, React Context for auth
- **Routes use Vietnamese slugs:** `/dich-vu`, `/dang-nhap`, `/ban-to-chuc/*`, `/admin/*`, etc.
- **TypeScript is loose:** `noImplicitAny: false`, `strictNullChecks: false`

### Backend

- **Entry:** `src/server.ts` - Express + HTTP server + Socket.IO
- **Module-based routing:** `src/modules/{auth,public,customer,organizer,admin,shared,reports}/`
- **Database:** PostgreSQL via Prisma 6. Schema at `prisma/schema.prisma`
- **Real-time:** Socket.IO with JWT auth, rooms per chat thread (`thread:<id>`)
- **Middleware:** `src/middleware/` - auth (JWT verify + role guard), Zod validation, error handler
- **File uploads:** Multer -> Cloudinary
- **Env vars required:** `DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_*` credentials

### Communication Between Services

The frontend Vite config proxies `/api` requests to the backend at `localhost:3000` during development. In production, configure a reverse proxy accordingly.

## Testing

- **Frontend:** Vitest + Testing Library + jsdom. Setup in `src/test/setup.ts`. E2E via Playwright.
- **Backend:** No test framework configured.

## Key Conventions

- Vietnamese language used in UI text, route slugs, and some documentation
- Zod used for validation on both frontend (forms) and backend (request bodies)
- Backend modules follow pattern: `router.ts` defines routes, handlers call Prisma directly or through service functions
- Frontend pages live in `src/pages/`, layouts in `src/layouts/`, base UI in `src/components/ui/`, layout chrome in `src/components/layout/`, and business components in `src/components/features/`
