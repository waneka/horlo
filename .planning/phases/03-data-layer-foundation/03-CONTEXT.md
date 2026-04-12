---
doc_type: phase-context
phase: "03"
phase_name: data-layer-foundation
gathered: 2026-04-11
status: ready-for-planning
source: discuss-phase auto
---

# Phase 03: Data Layer Foundation — Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase --auto`

<domain>
## Phase Boundary

Phase 3 builds the server-side data layer: Drizzle ORM schema, a `server-only` DAL in `src/data/`, and Server Actions in `src/app/actions/`. Everything runs against a real Supabase Postgres instance. No UI changes, no auth — the existing Zustand-powered UI continues unchanged. The DAL and Server Actions must be callable end-to-end from a test or REPL against a seeded user.

**Requirement IDs in scope:** DATA-01, DATA-02, DATA-03, DATA-04

**Phase goal:** A server-side data layer and mutation surface exist and work against a real Postgres database, without touching the UI or auth yet.

</domain>

<decisions>
## Implementation Decisions

### Schema mapping (DATA-01)

- **D-01:** Array fields (`styleTags`, `designTraits`, `roleTags`, `complications`, `preferredStyles`, `dislikedStyles`, etc.) stored as **Postgres text arrays** via Drizzle's `text('...').array()`. Simpler than junction tables for <500 watches; avoids N+1 joins; Drizzle supports array operations.
- **D-02:** `UserPreferences` stored as **normalized columns** (not a single JSON blob). Each preference field gets its own column — type-safe queries, individual column updates, Drizzle schema mirrors the TypeScript interface. Array preferences use Postgres arrays per D-01.
- **D-03:** Tables: `users` (id, email, created_at, updated_at), `watches` (all Watch fields + userId FK), `user_preferences` (all UserPreferences fields + userId FK, one row per user). The `users` table is minimal — Supabase Auth owns the real user record; this is a shadow table for FK integrity.
- **D-04:** Schema location: `src/db/schema.ts`. Drizzle config at project root `drizzle.config.ts`.
- **D-05:** New Phase 2 fields (`productionYear`, `isFlaggedDeal`, `isChronometer`) included in the watches table schema from day one.

### DAL design (DATA-02)

- **D-06:** DAL lives in `src/data/` with `server-only` import at the top of every file. Two main files: `src/data/watches.ts` and `src/data/preferences.ts`.
- **D-07:** Every DAL function accepts an explicit `userId` parameter — no session reading. Phase 4 adds auth; Phase 3 DAL is auth-agnostic.
- **D-08:** DAL functions **throw errors** for unexpected failures. Server Actions catch and shape errors for the client. DAL is internal API — not a user-facing boundary.
- **D-09:** DAL functions return **domain types** (`Watch`, `UserPreferences`) directly — mapping from Drizzle row shapes happens inside the DAL. Consumers never see database column names.
- **D-10:** All queries are scoped by `userId` in the WHERE clause — even without auth enforcement, the data model is multi-user-ready from the start.

### Server Actions (DATA-03)

- **D-11:** Server Actions in `src/app/actions/watches.ts` and `src/app/actions/preferences.ts`. Each action delegates to the DAL.
- **D-12:** Actions return `{ success: boolean, data?: T, error?: string }` objects — no throwing across the server/client boundary. Works cleanly with `useActionState`.
- **D-13:** Revalidation: `revalidatePath('/')` for watch mutations, `revalidatePath('/preferences')` for preference mutations. Simple, correct for current routing.
- **D-14:** Input validation with Zod schemas in each Server Action — validate before passing to DAL.

### Supabase setup

- **D-15:** Local dev uses **Supabase CLI** (`supabase init` + `supabase start`) with local Postgres. No hosted Supabase dependency for development.
- **D-16:** Schema sync via `drizzle-kit push` against local Supabase Postgres during development. Production migrations via `drizzle-kit generate` + `drizzle-kit migrate` when deploying.
- **D-17:** Connection string from `DATABASE_URL` env var. `.env.local` for local, `.env.example` documents the variable.

### Pages unchanged (DATA-04)

- **D-18:** Existing pages continue rendering from Zustand — no Server Component data fetching in this phase. The Server Actions and DAL exist and are testable but are not wired into the UI yet.
- **D-19:** Phase 5 does the Zustand demotion and UI rewire. Phase 3 only builds the backend surface.

### Claude's Discretion

- Exact Drizzle column types for numeric fields (integer vs real for caseSizeMm, etc.)
- Index strategy — add indexes on `watches.userId` and `user_preferences.userId` at minimum; additional indexes at planner's discretion
- Whether to use a single `src/data/db.ts` connection file or inline per-DAL-file — standard Drizzle patterns apply
- Zod schema structure for Server Action validation — can mirror or derive from Drizzle schema

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Next.js 16 docs (CRITICAL)
- `node_modules/next/dist/docs/` — Next.js 16 has breaking changes. Read Server Actions docs, `proxy.ts` docs, and App Router conventions before writing any framework code. This is NOT the Next.js from training data.

### Project context
- `.planning/PROJECT.md` — core value, constraints (Next.js 16, <500 watches, extend don't break)
- `.planning/REQUIREMENTS.md` — DATA-01 through DATA-04 acceptance criteria
- `CLAUDE.md` + `AGENTS.md` — project instructions and Next.js 16 warning

### Existing code (affected)
- `src/lib/types.ts` — `Watch`, `UserPreferences` types that the Drizzle schema must map to
- `src/store/watchStore.ts` — current CRUD logic (reference for what Server Actions must replicate)
- `src/store/preferencesStore.ts` — current preference mutations (reference for preference Server Actions)
- `.env.example` — needs `DATABASE_URL` and `SUPABASE_*` vars documented

### Phase 2 artifacts (foundation)
- `.planning/phases/02-feature-completeness-test-foundation/02-CONTEXT.md` — Phase 2 decisions including new fields (productionYear, isFlaggedDeal, isChronometer) that must be in the schema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/types.ts` — `Watch` and `UserPreferences` interfaces are the source of truth for schema design
- `src/store/watchStore.ts` — CRUD operations (`addWatch`, `updateWatch`, `deleteWatch`, `getFilteredWatches`) define the mutation surface Server Actions must replicate
- `src/store/preferencesStore.ts` — `updatePreferences` with partial updates is the pattern to mirror

### Established Patterns
- All state currently flows through Zustand stores with `persist` middleware (localStorage)
- 14 files import from `useWatchStore` / `usePreferencesStore` — these stay untouched in Phase 3
- `generateId()` in watchStore already uses `crypto.randomUUID()` (Phase 2) — DAL should use the same or DB-generated UUIDs

### Integration Points
- `src/app/api/extract-watch/route.ts` — currently creates watch data client-side after extraction; Phase 4+ will need to call Server Actions instead
- No existing `src/data/` or `src/app/actions/` directories — all new code
- `drizzle.config.ts` at project root — new file
- `src/db/schema.ts` — new file for Drizzle schema
- `src/db/index.ts` — new file for Drizzle client/connection

</code_context>

<specifics>
## Specific Ideas

- DAL must be testable without the full Next.js server — plain function calls with a userId parameter
- Shadow `users` table is minimal (id, email, timestamps) — Supabase Auth owns the real record
- Watches table includes ALL current Watch fields plus Phase 2 additions (productionYear, isFlaggedDeal, isChronometer)
- Server Actions use Zod validation before DAL calls
- `revalidatePath` keeps it simple — no granular `revalidateTag` needed at <500 watches

</specifics>

<deferred>
## Deferred Ideas

- **UI rewire to Server Components** — Phase 5 (after auth exists)
- **Zustand demotion** — Phase 5 (after migration flow exists)
- **Auth enforcement in DAL** — Phase 4 (this phase just accepts userId)
- **Production Supabase setup** — deployment concern, not Phase 3 scope
- **Database seeding script** — nice to have for dev, planner's discretion

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-data-layer-foundation*
*Context gathered: 2026-04-11 via `/gsd-discuss-phase --auto`*
