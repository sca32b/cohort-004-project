# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (http://localhost:5173)
pnpm build            # Production build
pnpm typecheck        # Generate route types + run tsc
pnpm test             # Run all tests (vitest)
pnpm test:watch       # Watch mode
npx vitest run app/services/courseService.test.ts  # Single test file

pnpm db:migrate       # Run Drizzle migrations
pnpm db:seed          # Seed database (destructive — recreates data.db)
pnpm db:generate      # Generate new migration from schema changes
```

## Architecture

This is a course platform (mini Udemy) with React Router v7 (SSR), SQLite via Drizzle ORM, and Tailwind CSS 4.

**Routing:** React Router v7 file-based routes defined in `app/routes.ts`. Route files use the `loader`/`action` convention for server data. Type-safe route params come from generated types in `.react-router/types/`.

**Database:** SQLite file (`data.db`) accessed via Drizzle ORM. Schema lives in `app/db/schema.ts`, connection in `app/db/index.ts`. Migrations are in `drizzle/`. The database uses WAL mode with foreign keys enabled.

**Services layer (`app/services/`):** All database logic lives here — one service file per domain entity. Services are plain functions that import `db` from `~/db` and are called directly from route loaders/actions.

**Testing:** Tests live alongside service files (`*.test.ts`). Each test creates an in-memory SQLite database via `createTestDb()` from `~/test/setup` and mocks `~/db` with `vi.mock`. Use `seedBaseData(testDb)` for common fixtures (user, instructor, category, course).

**UI:** shadcn/ui components (new-york style) in `app/components/ui/`. Custom components in `app/components/`. Uses Tailwind CSS 4 with `@tailwindcss/vite` plugin.

**Auth (dev mode):** Cookie-based session (`app/lib/session.ts`) with a user-switcher UI — no real auth system. Users are switched via the dev UI panel.

**Path alias:** `~/` maps to `./app/` (configured in tsconfig paths and vite-tsconfig-paths).
