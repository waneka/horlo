---
phase: 03-data-layer-foundation
verified: 2026-04-12T00:00:00Z
status: human_needed
score: 3/4 must-haves verified
overrides_applied: 0
re_verification: false
deferred:
  - truth: "Existing pages fetch data via Server Components calling the DAL; Zustand watchStore narrows to filter-only ephemeral state (no persist middleware)"
    addressed_in: "Phase 5"
    evidence: "Phase 5 SC 3: 'watchStore no longer uses persist middleware and exposes only ephemeral filter state'; SC 4: 'insights page is a Server Component; SimilarityBadge and BalanceChart receive collection + preferences as props'"
  - truth: "Server Actions and DAL are callable end-to-end from a test or REPL against a seeded user (test file evidence)"
    addressed_in: "Phase 5 (test infrastructure) or Phase 6"
    evidence: "RESEARCH.md Wave 0 gaps explicitly listed tests/data/watches.test.ts, tests/data/preferences.test.ts, tests/actions/watches.test.ts, tests/actions/preferences.test.ts as items for the planner to decide whether to include in Phase 3 or defer. No Phase 3 plan claimed these. Phase 6 covers TEST-04/05/06."
human_verification:
  - test: "Confirm Supabase Postgres has users, watches, and user_preferences tables matching the Drizzle schema"
    expected: "Three tables exist with all columns defined in src/db/schema.ts — verifiable in Supabase Dashboard -> Table Editor"
    why_human: "Cannot connect to the hosted Supabase instance without DATABASE_URL; requires developer to open the Supabase Dashboard and visually confirm table structure"
  - test: "Run a DAL function end-to-end against the seeded Supabase database"
    expected: "Calling getWatchesByUser(userId) with a real userId returns an array of Watch objects with no TypeErrors; createWatch creates a row visible in the Supabase Table Editor"
    why_human: "Requires a live DATABASE_URL and a seeded user row. No automated integration test files exist for the DAL. Verifiable via a one-off REPL call or by running the dev server and calling the action."
---

# Phase 03: Data Layer Foundation Verification Report

**Phase Goal:** A server-side data layer and mutation surface exist and work against a real Postgres database, without touching the UI or auth yet.
**Verified:** 2026-04-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A running Supabase Postgres instance has `users`, `watches`, and `user_preferences` tables matching the Drizzle schema | ? UNCERTAIN | Schema file is correct and complete; push was a human-action checkpoint in Plan 01 Task 2. Cannot programmatically verify DB state without live DATABASE_URL. |
| 2 | Every file under `src/data/` imports `server-only` and exposes DAL functions that accept an explicit `userId` and scope all queries by it | ✓ VERIFIED | Both `src/data/watches.ts` and `src/data/preferences.ts` start with `import 'server-only'` (line 2). All 5 watch functions and 2 preferences functions accept `userId` as first parameter. Every SELECT/UPDATE/DELETE includes `eq(watches.userId, userId)` or `eq(userPreferences.userId, userId)` in WHERE clause. |
| 3 | Watch and preference mutations exist as Server Actions under `src/app/actions/` that delegate to the DAL and call `revalidatePath` on success | ✓ VERIFIED | `src/app/actions/watches.ts` exports `addWatch`, `editWatch`, `removeWatch` with `'use server'` at line 1. `src/app/actions/preferences.ts` exports `savePreferences` with `'use server'` at line 1. All three watch actions call `revalidatePath('/')`. Preference action calls `revalidatePath('/preferences')`. All delegate to DAL via `watchDAL.*` / `preferencesDAL.*`. |
| 4 | Existing pages continue to render from Zustand (unchanged) | ✓ VERIFIED | `npm run build` exits 0 with all 8 routes compiled and no errors. No files under `src/components/`, `src/store/`, `src/app/` (pages) were modified. No client component imports DAL files (grep confirms zero results). |

**Score:** 3/4 truths fully verified; 1 requires human confirmation (Supabase DB state)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Existing pages fetch data via Server Components calling the DAL; Zustand watchStore narrows to filter-only ephemeral state | Phase 5 | Phase 5 SC 3 and SC 4 explicitly cover Zustand demotion and Server Component data fetching. Decisions D-18 and D-19 in 03-CONTEXT.md formally deferred this to Phase 5. The REQUIREMENTS.md traceability table assigns DATA-04 to Phase 3, but Phase 3's own SC4 only commits to "continue to render from Zustand unchanged" — the full DATA-04 text is a multi-phase deliverable. |
| 2 | DAL and Server Actions callable end-to-end from automated integration tests | Phase 6 (or earlier) | RESEARCH.md Wave 0 gaps listed 4 integration test files (tests/data/watches.test.ts, tests/data/preferences.test.ts, tests/actions/watches.test.ts, tests/actions/preferences.test.ts). No Phase 3 plan claimed these. RESEARCH.md noted: "The planner should decide whether to include these in Phase 3 or defer to Phase 6." None were planned or executed. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | Drizzle table definitions for users, watches, user_preferences | ✓ VERIFIED | Exports `users`, `watches`, `userPreferences`. All 24 Watch fields present. Phase 2 fields (productionYear, isFlaggedDeal, isChronometer) present. Array fields use `.array().notNull().default(sql\`'{}'::text[]\`)`. UserPreferences normalized columns with jsonb exception for preferredCaseSizeRange. |
| `src/db/index.ts` | Database connection singleton | ✓ VERIFIED | Exports `db` via `drizzle(client, { schema })`. Uses `{ prepare: false }` for Supabase Transaction pooler. Imports `* as schema` from `./schema`. |
| `src/lib/actionTypes.ts` | Shared ActionResult type for Server Actions | ✓ VERIFIED | Exports `ActionResult<T>` discriminated union: `{ success: true; data: T } \| { success: false; error: string }`. |
| `drizzle.config.ts` | Drizzle Kit configuration | ✓ VERIFIED | Uses `defineConfig`, points to `./src/db/schema.ts`, postgresql dialect. Loads `.env.local` via dotenv. |
| `.env.example` | DATABASE_URL documentation | ✓ VERIFIED | Contains `DATABASE_URL=postgresql://postgres.[project-ref]:[password]@...` with usage comment. |
| `src/data/watches.ts` | Watch CRUD DAL functions | ✓ VERIFIED | Exports `getWatchesByUser`, `getWatchById`, `createWatch`, `updateWatch`, `deleteWatch`. Starts with `import 'server-only'`. All functions userId-scoped. |
| `src/data/preferences.ts` | Preferences DAL functions | ✓ VERIFIED | Exports `getPreferencesByUser`, `upsertPreferences`. Starts with `import 'server-only'`. Both functions userId-scoped. |
| `src/app/actions/watches.ts` | Watch Server Actions | ✓ VERIFIED | Starts with `'use server'`. Exports `addWatch`, `editWatch`, `removeWatch`. Zod validation on all inputs. ActionResult return type. revalidatePath('/') on success. |
| `src/app/actions/preferences.ts` | Preference Server Actions | ✓ VERIFIED | Starts with `'use server'`. Exports `savePreferences`. Zod validation. ActionResult return type. revalidatePath('/preferences') on success. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/db/index.ts` | `src/db/schema.ts` | `import * as schema` | ✓ WIRED | Line 3: `import * as schema from './schema'` |
| `drizzle.config.ts` | `src/db/schema.ts` | schema path reference | ✓ WIRED | Line 6: `schema: './src/db/schema.ts'` |
| `src/data/watches.ts` | `src/db/index.ts` | `import { db }` | ✓ WIRED | Line 4: `import { db } from '@/db'` |
| `src/data/watches.ts` | `src/db/schema.ts` | `import { watches }` | ✓ WIRED | Line 5: `import { watches } from '@/db/schema'` |
| `src/data/preferences.ts` | `src/db/index.ts` | `import { db }` | ✓ WIRED | Line 4: `import { db } from '@/db'` |
| `src/app/actions/watches.ts` | `src/data/watches.ts` | DAL delegation | ✓ WIRED | Line 7: `import * as watchDAL from '@/data/watches'`; calls `watchDAL.createWatch`, `watchDAL.updateWatch`, `watchDAL.deleteWatch` |
| `src/app/actions/watches.ts` | `next/cache` | revalidatePath | ✓ WIRED | Line 5: `import { revalidatePath } from 'next/cache'`; called on lines 61, 90, 106 |
| `src/app/actions/preferences.ts` | `src/data/preferences.ts` | DAL delegation | ✓ WIRED | Line 7: `import * as preferencesDAL from '@/data/preferences'`; calls `preferencesDAL.upsertPreferences` |

### Data-Flow Trace (Level 4)

DAL and Server Actions are not rendering-layer components — they are data mutation/access functions with no client-rendered output. Level 4 data-flow trace is not applicable for this phase (no components rendering dynamic data from these sources yet; that wiring is Phase 5).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run build` exits 0 | `npm run build 2>&1 \| tail -5` | All 8 routes compiled, Generating static pages (8/8) | ✓ PASS |
| No client files import DAL | `grep -r "from '@/data/" src/components/ src/store/` | 0 matches | ✓ PASS |
| Both DAL files have server-only | `grep "server-only" src/data/watches.ts src/data/preferences.ts` | Both line 2 | ✓ PASS |
| Both action files have use server | `grep "'use server'" src/app/actions/watches.ts src/app/actions/preferences.ts` | Both line 1 | ✓ PASS |
| revalidatePath called in all mutations | `grep -n "revalidatePath" src/app/actions/*.ts` | Lines 61, 90, 106 in watches; line 55 in preferences | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 03-01-PLAN.md | Drizzle ORM schema defines users, watches, user_preferences tables scoped to Postgres | ✓ SATISFIED | `src/db/schema.ts` exports all three tables with correct Drizzle pg-core column types. Schema verified by file inspection. DB push was human-confirmed in Plan 01 Task 2 (human-action checkpoint). |
| DATA-02 | 03-02-PLAN.md | Data Access Layer in `src/data/` marked server-only; every query scoped to authenticated userId | ✓ SATISFIED | Both `src/data/watches.ts` and `src/data/preferences.ts` start with `import 'server-only'`. Every exported function accepts userId as first param. Every DB query includes userId in WHERE clause. |
| DATA-03 | 03-03-PLAN.md | Watch CRUD and preference mutations move to Server Actions in `src/app/actions/` | ✓ SATISFIED | `src/app/actions/watches.ts` exports addWatch, editWatch, removeWatch. `src/app/actions/preferences.ts` exports savePreferences. All delegate to DAL with Zod validation and return ActionResult. |
| DATA-04 | 03-03-PLAN.md | Existing pages fetch data via Server Components calling the DAL; Zustand watchStore narrows to filter-only ephemeral state | PARTIAL — Phase 3 SC only (see Deferred) | Phase 3 SC4 ("continue to render from Zustand unchanged") is satisfied — build passes, no UI files modified. The full DATA-04 requirement (Server Component data fetching + Zustand demotion) is a Phase 5 deliverable per D-18, D-19, and Phase 5 SCs 3-4. The REQUIREMENTS.md traceability table maps DATA-04 to Phase 3 only, but its full text spans Phase 3 + Phase 5. |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps exactly DATA-01, DATA-02, DATA-03, DATA-04 to Phase 3. All four are accounted for in plans and verified above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/db/index.ts` | 8 | `process.env.DATABASE_URL!` — non-null assertion, no runtime guard | ⚠️ Warning | If DATABASE_URL is missing, driver will throw an opaque error rather than a clear startup message. Not a correctness issue when DATABASE_URL is set (which it must be for the app to work). Flagged in code review as CR-01 with suggested fix. |
| `drizzle.config.ts` | 10 | `process.env.DATABASE_URL!` — same pattern | ⚠️ Warning | Same as above; CLI-facing so the error surface is slightly more user-friendly. |
| `src/data/preferences.ts` | 102-113 | Mixed guard styles (`!== undefined` vs `'in' data`) in update path | ⚠️ Warning | CR-02 from code review: inconsistent guard style is a latent bug factory. Currently benign for existing callers but can cause silent data overwrite if new fields are added with the wrong guard. |
| `src/data/watches.ts` | 41-42 | `isFlaggedDeal: row.isFlaggedDeal ?? undefined` / `isChronometer: row.isChronometer ?? undefined` | ℹ️ Info | WR-03 from code review: schema defines `.default(false)` so DB will always return `false` not `null`; `false ?? undefined` evaluates to `false` (correct). The mapping to `undefined` only happens for null/pre-existing rows without the column. Low risk in practice. |
| `src/data/watches.ts` | 87 | `getWatchesByUser` has no ORDER BY clause | ℹ️ Info | WR-01 from code review: docstring says "ordered by creation date descending" but query has no `orderBy`. Non-deterministic ordering in production. |
| `src/app/actions/watches.ts` | 38 | `imageUrl: z.string().optional()` — no URL validation | ⚠️ Warning | WR-04 from code review: accepts any string including `javascript:` URIs. Not an immediate XSS risk if imageUrl is only rendered in `next/image` (which rejects non-http(s)), but is a defense-in-depth gap. |

None of the anti-patterns are blockers — they are all warnings or info items identified in the existing code review (03-REVIEW.md). The build passes cleanly.

### Human Verification Required

#### 1. Supabase Database Table Existence (Roadmap SC1)

**Test:** Open Supabase Dashboard → Table Editor and confirm all three tables exist with their expected columns.
- Verify `users` table has: id (uuid), email, created_at, updated_at
- Verify `watches` table has all 24+ Watch domain columns plus user_id FK, created_at, updated_at
- Verify `user_preferences` table has all UserPreferences columns with unique constraint on user_id
- Confirm `drizzle-kit push` succeeded (exit 0 from developer's terminal)

**Expected:** All three tables visible with correct column types matching `src/db/schema.ts`

**Why human:** Cannot connect to the hosted Supabase instance from this environment without DATABASE_URL. The drizzle-kit push was a human-action task (Plan 01 Task 2, checkpoint gate), and the Summary says it completed, but automated verification of remote DB state requires a live connection.

#### 2. End-to-End DAL Callable Against Seeded User (Roadmap SC4 partial)

**Test:** With a real user row seeded in the `users` table, call the DAL directly from a Node REPL or temporary script:
```typescript
// From project root with DATABASE_URL set:
import { createWatch } from './src/data/watches'
const result = await createWatch('your-user-id', {
  brand: 'Test', model: 'Verify', status: 'owned',
  movement: 'automatic', complications: [], styleTags: [],
  designTraits: [], roleTags: []
})
console.log(result) // should return a Watch with a generated UUID id
```
Or call `addWatch('your-user-id', { brand: 'Test', model: 'Verify', ... })` from a Server Action test.

**Expected:** Watch row inserted, returned Watch object has all domain fields mapped correctly (no DB-internal fields like userId/createdAt/updatedAt leaking through)

**Why human:** No integration test files exist for the DAL or Server Actions. The RESEARCH.md flagged this as a Wave 0 gap that the planner needed to decide about. The functions are structurally correct and build cleanly, but actual DB execution has not been verified by automated tests.

### Gaps Summary

No automated-verifiable gaps were found. All artifacts exist, are substantive, are wired, and the build passes cleanly.

The two human verification items reflect:
1. **DB state** — the remote Supabase instance must be confirmed to have the three tables (this was a human-action task, not automated)
2. **End-to-end execution** — no integration test files exist to prove the DAL functions execute without runtime errors against a real DB

**Code quality items** (from 03-REVIEW.md — not phase-blocking): CR-01 (DATABASE_URL runtime guard), CR-02 (upsertPreferences guard inconsistency), WR-01 (missing ORDER BY), WR-02 (redundant field mapping), WR-03 (boolean mapping semantics), WR-04 (imageUrl URL validation). These are improvements for the next available phase, not blockers for Phase 3 goal completion.

---

_Verified: 2026-04-12_
_Verifier: Claude (gsd-verifier)_
