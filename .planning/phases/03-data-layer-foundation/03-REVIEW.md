---
phase: 03-data-layer-foundation
reviewed: 2026-04-11T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - drizzle.config.ts
  - src/db/schema.ts
  - src/db/index.ts
  - src/lib/actionTypes.ts
  - src/data/watches.ts
  - src/data/preferences.ts
  - src/app/actions/watches.ts
  - src/app/actions/preferences.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-11
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Eight files covering the new Drizzle/Postgres data layer were reviewed: database schema, the db client initializer, Drizzle config, the shared `ActionResult` type, two DAL modules, and two Server Action modules.

The overall structure is sound — `server-only` guards, clean domain mapping, and consistent `ActionResult` wrapping are all in place. However, two critical issues require attention before the layer can be considered production-safe: the `DATABASE_URL` non-null assertion will crash the server process at module load time when the env var is missing, and `upsertPreferences` silently drops `collectionGoal` and `notes` when they are not explicitly present in the incoming `data` object, potentially overwriting user data with defaults on partial saves.

---

## Critical Issues

### CR-01: Non-null assertion on `DATABASE_URL` crashes the process at module load

**File:** `src/db/index.ts:8`

**Issue:** `process.env.DATABASE_URL!` uses a TypeScript non-null assertion, not a runtime guard. At runtime Node.js sees an `undefined` value and passes it to the `postgres()` constructor, which throws (or silently connects to `undefined`). The error message produced by the Postgres driver is opaque; worse, in some versions it throws only on the first query rather than at startup, making the root cause hard to trace. The config file has the same pattern at line 10.

**Fix:**
```ts
// src/db/index.ts — add a runtime guard before instantiating the client
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL environment variable is required but was not set. ' +
    'Copy .env.example to .env.local and add your Supabase connection string.',
  )
}

const client = postgres(databaseUrl, { prepare: false })
export const db = drizzle(client, { schema })
```

Apply the same guard in `drizzle.config.ts:10` (the `drizzle-kit` CLI surfaces this more clearly, but consistency matters):
```ts
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required for drizzle-kit')
export default defineConfig({ ..., dbCredentials: { url } })
```

---

### CR-02: `upsertPreferences` silently overwrites `collectionGoal` and `notes` with `null` on partial updates

**File:** `src/data/preferences.ts:90-95`

**Issue:** When `upsertPreferences` is called with a `data` object that does not contain `collectionGoal` (e.g., a partial save of style tags only), `insertValues.collectionGoal` is set to `null` (line 94: `data.collectionGoal ?? null`). The `onConflictDoUpdate` `set` block then only adds `collectionGoal` to the update set when `'collectionGoal' in data` (line 114) — which is correct for the conflict-update path. **But** Drizzle's `onConflictDoUpdate` merges the entire `set` object; the problem is in the _insert_ path: if this is the first insert, the row will have `null` for `collectionGoal` and `null` for `notes` even when those fields were never touched.

More critically: the `insertValues` fallback logic for `notes` also uses `data.notes ?? null` (line 95) which means a first-time upsert with `{ preferredStyles: ['sport'] }` will permanently clear any `collectionGoal` and `notes` that happened to exist — although since this is an insert-on-first-call that path is safe _today_. However a subtler actual bug exists: the `preferredCaseSizeRange` insert fallback (line 90-92) is:

```ts
preferredCaseSizeRange: 'preferredCaseSizeRange' in data
  ? (data.preferredCaseSizeRange ?? null)
  : null,
```

When the field is **not** in `data`, this inserts `null` — discarding the `defaults.preferredCaseSizeRange` (which is `undefined`, mapping to `null` anyway, so this is a no-op for the _default_ value). This is benign for a first insert. But the **update** path for `overlapTolerance` (line 113) uses `data.overlapTolerance !== undefined` as the guard, meaning if a caller passes `{ overlapTolerance: undefined }` the existing DB value is preserved — inconsistent with how `collectionGoal` and `notes` use `'field' in data` guards. The inconsistency can lead to unexpected behavior if callers spread objects that carry `undefined` values.

The concrete harmful scenario: `savePreferences` is called from multiple UI sections (e.g., dial-color section saves `{ preferredDialColors: [...] }`, not including `overlapTolerance`). Because `overlapTolerance` uses an `!== undefined` guard on the update path, it is correctly preserved. But if the same caller pattern is extended to a new field added with the wrong guard style, data loss will occur. The two guard styles in the same function are a latent bug factory.

**Fix:** Standardize all update-path guards to use `'field' in data` (not `!== undefined`) so that callers can pass partial objects without risk:

```ts
// Update values — use 'in' guards throughout for consistency
if ('overlapTolerance' in data && data.overlapTolerance !== undefined)
  updateValues.overlapTolerance = data.overlapTolerance
// (repeated for every field — replace all `!== undefined` guards)
```

---

## Warnings

### WR-01: `getWatchesByUser` returns watches in insertion order, not a stable order

**File:** `src/data/watches.ts:87`

**Issue:** The query at line 87 has no `orderBy` clause. Postgres does not guarantee row order without `ORDER BY`. The function docstring says "ordered by creation date descending" but the query does not enforce this. The result order will be non-deterministic in practice, especially after updates or vacuums.

**Fix:**
```ts
import { eq, and, desc } from 'drizzle-orm'

export async function getWatchesByUser(userId: string): Promise<Watch[]> {
  const rows = await db
    .select()
    .from(watches)
    .where(eq(watches.userId, userId))
    .orderBy(desc(watches.createdAt))
  return rows.map(mapRowToWatch)
}
```

---

### WR-02: `createWatch` double-sets required fields (maintenance hazard)

**File:** `src/data/watches.ts:107-123`

**Issue:** `mapDomainToRow(data)` already maps `brand`, `model`, `status`, `movement`, `complications`, `styleTags`, `designTraits`, and `roleTags` into `rowData`. Lines 112-119 then explicitly set those same fields again in the `values({})` call. This is redundant but not currently wrong — however it creates a silent inconsistency risk: if a future developer updates `mapDomainToRow` to transform one of these fields (e.g., normalizing `brand` to uppercase), the explicit override on line 112 will silently bypass that transformation for inserts while applying it to updates.

**Fix:** Remove the redundant explicit fields and rely solely on `mapDomainToRow`:
```ts
const inserted = await db
  .insert(watches)
  .values({ ...rowData, userId })
  .returning()
```
If the intent was to ensure required fields are present for TypeScript's benefit, add a runtime assertion or use `createWatch`'s typed parameter (`Omit<Watch, 'id'>`) which already guarantees them.

---

### WR-03: `isFlaggedDeal` and `isChronometer` mapped to `undefined` instead of `false` in domain object

**File:** `src/data/watches.ts:41-42`

**Issue:** Lines 41-42 map `row.isFlaggedDeal ?? undefined` and `row.isChronometer ?? undefined`. The schema defines both columns with `.default(false)`, so from the DB these will always be `true` or `false`, never `null`. But the DAL strips `false` values to `undefined` via `?? undefined` — `false ?? undefined` evaluates to `false` (correct), but `null ?? undefined` evaluates to `undefined`. The real issue is semantic: these are boolean flags whose `false` state is meaningful in the domain type (`isFlaggedDeal?: boolean`). A newly inserted watch will have DB value `false`, which maps to `false` in the domain object — that is correct. However, the domain type declares them optional (`isFlaggedDeal?: boolean`), meaning `undefined` and `false` are both valid and have different semantics in the similarity engine. Returning `undefined` when the DB has `null` (e.g., for rows created before the column was added in a migration that didn't backfill) could cause the similarity engine to behave differently than intended.

**Fix:** Map these fields to `false` as the explicit default rather than `undefined`:
```ts
isFlaggedDeal: row.isFlaggedDeal ?? false,
isChronometer: row.isChronometer ?? false,
```
This matches the schema default and ensures consistent boolean semantics in the domain layer.

---

### WR-04: `imageUrl` not validated as a URL string in `insertWatchSchema`

**File:** `src/app/actions/watches.ts:38`

**Issue:** `imageUrl: z.string().optional()` accepts any string, including `javascript:alert(1)` or `data:text/html,...`. If `imageUrl` is ever rendered as an `<img src={watch.imageUrl}>` or `<a href={...}>` without sanitization, this becomes an XSS vector. The API route already restricts outbound fetch to `http`/`https`, but the watch action accepts imageUrl directly from client-supplied data without the same restriction.

**Fix:**
```ts
imageUrl: z.string().url().optional(),
```
`z.string().url()` rejects non-URL strings and non-http(s) schemes are rejected by most URL parsers. For stricter control:
```ts
imageUrl: z.string().regex(/^https?:\/\//).optional(),
```

---

## Info

### IN-01: `drizzle.config.ts` uses `dotenv` but `src/db/index.ts` does not

**File:** `drizzle.config.ts:1-2`

**Issue:** The config file manually calls `config({ path: '.env.local' })` so that `drizzle-kit` CLI commands pick up `.env.local`. This is correct for CLI use. However it establishes an implicit coupling: developers who add new env vars to `.env.local` may not realize that `src/db/index.ts` relies on Next.js loading that file automatically at runtime. If `src/db/index.ts` is ever used outside a Next.js context (e.g., in a migration script or test), `DATABASE_URL` will be undefined. This is low-risk today but worth a comment.

**Fix:** Add a comment to `src/db/index.ts` noting the env loading dependency:
```ts
// DATABASE_URL must be set in .env.local (loaded by Next.js at runtime).
// For CLI tools (drizzle-kit), see drizzle.config.ts which loads .env.local via dotenv.
```

---

### IN-02: `userId` parameter in Server Actions is caller-supplied (pre-auth placeholder)

**File:** `src/app/actions/watches.ts:3`, `src/app/actions/preferences.ts:3`

**Issue:** Both action files carry `// TODO(Phase 4): Replace userId parameter with session-derived userId`. The current design trusts the caller to supply a valid `userId`. While this is a documented and intentional placeholder, it means any client that can call these Server Actions can supply an arbitrary `userId` and read or modify another user's data. The TODO comments are present, but there is no runtime guard that would cause the action to fail loudly if `userId` is empty/null (e.g., if auth scaffolding is wired up incompletely in Phase 4).

**Fix:** Add a guard now so that when Phase 4 wires in auth and passes an empty/undefined userId due to a session bug, the failure is immediate and obvious:
```ts
if (!userId) {
  return { success: false, error: 'Authentication required' }
}
```

---

### IN-03: `upsertPreferences` return value is not guarded against an empty `returning()` array

**File:** `src/data/preferences.ts:126`

**Issue:** Line 126 accesses `upserted[0]` directly. Drizzle's `insert().onConflictDoUpdate().returning()` should always return a row for a successful upsert, so this is unlikely to fail in practice. However, if the DB driver returns an empty array for any reason (e.g., a future Supabase pooler edge case), this will throw `TypeError: Cannot read properties of undefined`. `createWatch` (watches.ts:123) has the same pattern. Both are low-severity because the failure would be caught by the `try/catch` in the Server Actions layer and returned as `{ success: false, error: '...' }`.

**Fix:** Add an assertion to make a potential empty-result failure explicit rather than a `TypeError`:
```ts
if (!upserted[0]) {
  throw new Error('Upsert returned no rows — unexpected DB state')
}
return mapRowToPreferences(upserted[0])
```

---

_Reviewed: 2026-04-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
