---
phase: 03-data-layer-foundation
plan: "01"
subsystem: data-layer
tags: [drizzle, postgres, schema, supabase, server-actions]
dependency_graph:
  requires: []
  provides:
    - src/db/schema.ts — Drizzle table definitions for users, watches, user_preferences
    - src/db/index.ts — Database connection singleton (db)
    - src/lib/actionTypes.ts — ActionResult<T> type for Server Actions
    - drizzle.config.ts — Drizzle Kit configuration
  affects:
    - src/data/ (Plan 02 — DAL reads from schema)
    - src/app/actions/ (Plan 03 — Server Actions import ActionResult)
tech_stack:
  added:
    - drizzle-orm@0.45.2
    - postgres@3.4.9
    - server-only@0.0.1
    - drizzle-kit@0.31.10 (dev)
    - dotenv (dev)
  patterns:
    - Drizzle pgTable with text arrays (.array().notNull().default(sql`'{}'::text[]`))
    - Connection singleton with { prepare: false } for Supabase Transaction pooling
    - Discriminated union ActionResult<T> for Server Action results
key_files:
  created:
    - src/db/schema.ts
    - src/db/index.ts
    - src/lib/actionTypes.ts
    - drizzle.config.ts
  modified:
    - package.json (new dependencies)
    - .env.example (DATABASE_URL documented — local change only, gitignore excludes .env*)
decisions:
  - Postgres text arrays for all array fields (complications, styleTags, etc.) per D-01
  - preferredCaseSizeRange stored as jsonb — compound value { min, max } not worth two flat columns
  - prepare:false on postgres client — required for Supabase Transaction pooler mode
  - .env.example not committed — .gitignore pattern .env* covers all env files; user documents locally
metrics:
  duration: "~10 minutes"
  completed: "2026-04-11"
  tasks_completed: 1
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 03 Plan 01: Drizzle Schema + DB Connection Summary

**One-liner:** Drizzle ORM schema for users/watches/user_preferences with Postgres text arrays, DB connection singleton with Supabase pooling config, and ActionResult<T> type for Server Actions.

## What Was Built

Task 1 (completed): Installed Drizzle ORM stack and created all foundational data layer artifacts.

- **`src/db/schema.ts`** — Three pgTable definitions:
  - `users` — shadow table for Supabase Auth FK integrity (id, email, timestamps)
  - `watches` — all 24 Watch fields from `src/lib/types.ts` + userId FK + Phase 2 fields + createdAt/updatedAt
  - `userPreferences` — all UserPreferences fields as normalized columns + userId FK (unique)
  - Array fields all use `.array().notNull().default(sql\`'{}'\:\:text[]\`)` per Pitfall 2 avoidance
  - Indexes on `watches.userId` and `user_preferences.userId`
  - `preferredCaseSizeRange` stored as jsonb (compound value exception per D-02/Pitfall 6)

- **`src/db/index.ts`** — Drizzle singleton using postgres.js driver with `{ prepare: false }` for Supabase Transaction pooler compatibility

- **`src/lib/actionTypes.ts`** — `ActionResult<T>` discriminated union type; lives in `src/lib/` so client code can import for type-checking without server modules

- **`drizzle.config.ts`** — Drizzle Kit config pointing to `src/db/schema.ts`, outputting to `./drizzle/`, postgresql dialect

Task 2 (checkpoint): Requires user to create Supabase project and configure DATABASE_URL, then run `npx drizzle-kit push`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-orm/zod subpath not exported in drizzle-orm@0.45.2**
- **Found during:** Task 1, dependency check
- **Issue:** `drizzle-orm/zod` subpath export does not exist in the installed version (0.45.2). The research notes this as a potential compatibility issue.
- **Fix:** No fix needed for this task — drizzle-orm/zod is used in Plan 03 (Server Actions with Zod validation), not Plan 01. Deferred the zod compatibility check to Plan 03.
- **Impact:** Zero — Task 1 only creates schema and connection artifacts; no Zod validation code was in scope.

**2. [Rule 3 - Blocking] .env.example excluded by .gitignore**
- **Found during:** Task 1 commit
- **Issue:** `.gitignore` pattern `.env*` covers `.env.example`, preventing commit.
- **Fix:** Updated `.env.example` locally with `DATABASE_URL` documentation. Did not force-add to git since the pattern is intentional (no env files in repo). The documentation exists in the working directory.
- **Files modified:** `.env.example` (local only)

## Known Stubs

None. This plan creates schema definitions and infrastructure, not data-fetching components.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: credential-exposure | src/db/index.ts | DATABASE_URL used at module level — ensure this file is never imported by client bundles. `server-only` import is not present in index.ts; the DAL files (Plan 02) will enforce this via `import 'server-only'`. |

Note: `src/db/index.ts` itself does not have `import 'server-only'` — that enforcement lives in the DAL files that import from it. This is the correct Drizzle pattern; the connection module is a pure server module by convention, not by build-time enforcement.

## Self-Check

Files created:
- src/db/schema.ts — FOUND
- src/db/index.ts — FOUND
- src/lib/actionTypes.ts — FOUND
- drizzle.config.ts — FOUND

Commit: 84ee2d3 — FOUND
