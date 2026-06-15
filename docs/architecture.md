# Architecture

## Phase 1 Scope

The current implementation establishes the application shell and persistence foundation only:

- Next.js App Router for the web surface
- TypeScript for shared static typing
- Tailwind CSS for styling
- Drizzle ORM as the only database schema source
- Neon Postgres as the target database runtime

## Runtime Flow

1. The client renders through Next.js App Router.
2. Server-side modules validate environment configuration.
3. Route handlers or server actions will use `requireUser()` once auth is wired in a later phase.
4. Repository and service code will use `lib/db/client.ts` for database access.
5. Drizzle migrations are generated from `db/schema.ts` and applied through `db/migrate.ts`.

## Intentional Omissions

Phase 1 does not include:

- Item or record CRUD flows
- Report generation
- AI insights
- Offline sync
- Background jobs, queues, Redis, or microservices
