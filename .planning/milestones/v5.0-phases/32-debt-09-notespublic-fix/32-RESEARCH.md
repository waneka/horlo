# Phase 32: DEBT-09 notesPublic Fix - Research

**Researched:** 2026-05-06
**Domain:** Server Action regression repair (Next.js 16 App Router + Zod + Drizzle)
**Confidence:** HIGH (the fix is locked by CONTEXT.md decisions; the test scaffold IS the contract)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use `revalidatePath('/u/[username]', 'layout')` — NOT the ROADMAP wording `'/u/[username]/[tab]', 'page'`. The test scaffold (the GREEN contract — success criterion #1, the highest-priority criterion) literally asserts `'/u/[username]', 'layout'` at `tests/actions/watches.notesPublic.test.ts:131,158`. Phase 23 D-19 contract (`23-VERIFICATION.md:143`) specified the same. The `notes.ts` WR-07 finding (lines 53–58, 108–113) explicitly documents that `'/u/[username]/notes'` with `'page'` selector silently no-ops because the actual route template uses a dynamic `[tab]` segment. Codebase precedent: 5/6 sibling actions (`notes.ts` ×2, `profile.ts` ×2, `follows.ts` ×2) use the layout pattern; only `wishlist.ts:206` uses the tab/page pattern. Layout-scoped invalidation correctly bubbles to all tabs (notes, collection, stats) where the pill could render.
- **D-02:** Fire `revalidatePath('/u/[username]', 'layout')` UNCONDITIONALLY on every successful `addWatch`/`editWatch` — not gated on `'notesPublic' in parsed.data`. ROADMAP success criterion #4 specifies "after every successful write" (unconditional). All three sibling action files (`notes.ts`, `profile.ts`, `follows.ts`) call their layout revalidate unconditionally.
- **D-03:** Place the new revalidate alongside the existing `revalidatePath('/')` calls — `addWatch` line 267, `editWatch` line 340. Order: `revalidatePath('/')` → `revalidatePath('/u/[username]', 'layout')` → existing `revalidateTag('explore', 'max')`.
- **D-04:** `removeWatch` is intentionally NOT modified. DEBT-09 names "addWatch and editWatch" precisely.
- **D-05:** Edit `.planning/ROADMAP.md` Phase 32 success criterion #4 inline this phase to read `revalidatePath('/u/[username]', 'layout')` instead of `'/u/[username]/[tab]', 'page'`.
- **D-06:** No new tests authored in this phase. The 4 existing tests in `tests/actions/watches.notesPublic.test.ts` are the GREEN target as-is.

### Claude's Discretion

User said "you can choose for this phase" on all four surfaced gray areas. Decisions D-01 through D-06 above were made by Claude and locked into CONTEXT.md so the planner and executor act without re-asking.

### Deferred Ideas (OUT OF SCOPE)

- **`removeWatch` parity revalidate** — When a watch with a note is deleted, `/u/{username}/notes` keeps stale rows until a hard refresh. Not named in DEBT-09 scope. Capture as a follow-up: separate `/gsd-quick` ticket or v4.2/v5.x polish.
- **`wishlist.ts:206` pattern divergence** — sole holdout using `'/u/[username]/[tab]', 'page'`. Not addressed this phase. Worth revisiting in a future hygiene pass.
- **Cross-action revalidate audit** — broader sweep across all server actions to verify none have the same dynamic-segment pitfall WR-07 documents.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-09 | `addWatch` and `editWatch` Server Actions must persist `notesPublic` (Zod schema accepts `notesPublic: z.boolean().optional()`) and call the cross-page revalidate after every successful write so the per-row `<NoteVisibilityPill>` on `/u/{username}/notes` reflects the form's choice without a hard navigation. The existing RED scaffold `tests/actions/watches.notesPublic.test.ts` (4/4 FAIL) reaches 4/4 GREEN. | Insertion sites verified at `src/app/actions/watches.ts:54` (schema close) and lines 267/340 (revalidate call sites). DAL persistence path already correct (`src/data/watches.ts:84`). DB column already exists (`src/db/schema.ts:95`). Domain type already declares the field (`src/lib/types.ts:53`). Form already submits the field (`src/components/watch/WatchForm.tsx:83,127,648–665`). The action layer is the only broken segment. |

**Note on ROADMAP wording:** Phase 32 success criterion #4 in ROADMAP.md (line 126) currently reads `revalidatePath('/u/[username]/[tab]', 'page')`. Per D-05 the planner must include a task that corrects this to `revalidatePath('/u/[username]', 'layout')`. The test scaffold is the contract; the ROADMAP is the doc to fix.
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive | Source | How it constrains this phase |
|-----------|--------|------------------------------|
| Tech stack: Next.js 16 App Router — no rewrites | CLAUDE.md | Use existing `next/cache` primitives (`revalidatePath`, `revalidateTag`); do not introduce new caching abstractions. |
| Data model: Watch and UserPreferences types are established — extend, don't break | CLAUDE.md | `notesPublic` already exists in the domain type — schema fix is purely additive at the action layer. |
| **This is NOT the Next.js you know** | AGENTS.md | The two-arg `revalidatePath(path, type)` signature is verified against `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` — `type` parameter is REQUIRED for paths containing dynamic segments like `[username]`. Confirmed via the actual route template `/u/[username]/[tab]` and the WR-07 finding. |
| Personal first; <500 watches per user | CLAUDE.md | No-op extra `revalidatePath` call on edits that don't touch visibility-relevant fields is acceptable at this scale (D-02). |
| Pre-existing `LayoutProps` TS error in `src/app/u/[username]/layout.tsx:21` | REQUIREMENTS.md "Future Requirements" | Not introduced by this phase; do not let `npx tsc --noEmit` flag this as a regression — it pre-dates v3.0. |
| GSD Workflow Enforcement | CLAUDE.md | All edits in this phase route through `/gsd-execute-phase` after planning. |

## Summary

This is a precision regression fix in `src/app/actions/watches.ts`, not a feature build. CONTEXT.md decisions D-01 through D-06 lock every gray-area choice; the test file `tests/actions/watches.notesPublic.test.ts` is the literal contract (4 RED tests must turn 4 GREEN). The mechanical edit is three lines:

1. Add `notesPublic: z.boolean().optional(),` inside `insertWatchSchema` (z.object body, lines 17–54).
2. Add `revalidatePath('/u/[username]', 'layout')` between the existing `revalidatePath('/')` and `revalidateTag('explore', 'max')` calls in `addWatch` (between lines 267 and 277).
3. Add the same call in `editWatch` (between lines 340 and 348).

Plus a one-line ROADMAP.md correction at line 126 (D-05) and a verification pass that the rest of the suite stays GREEN (success criterion #5).

Regression risk is minimal but non-zero: any test that asserts `revalidatePath` call counts or arg sequences for `addWatch`/`editWatch` would break when the new call is added. Audit findings: **no such assertions exist on `main`**. The only file asserting on `revalidatePath` for the watches-action surface is the notesPublic test itself (which is the GREEN target). All other action tests that mock `next/cache` (`watches.test.ts`, `addwatch-catalog-resilience.test.ts`, `add-watch-photo.test.ts`, `phase17-addwatch-wiring.test.ts`, `wishlist.test.ts`, `preferences.test.ts`, `follows.test.ts`, `notifications.test.ts`) either make zero `revalidatePath` assertions for the watches actions, or assert on a different action entirely.

**Primary recommendation:** Treat the fix as a single 4-line code change plus a 1-line doc change. Author one task in the plan: schema add + dual revalidate insert + ROADMAP edit, with a verification step running `npx vitest run tests/actions/watches.notesPublic.test.ts` (RED → GREEN) followed by `npm test` (full suite GREEN).

## Phase Boundary Recap

DEBT-09 is a Phase 23-era data-loss regression: the WatchForm pill UI ships and works (`src/components/watch/WatchForm.tsx:648–665`), the DB column exists with the right default (`src/db/schema.ts:95`), the domain type declares the field (`src/lib/types.ts:53`), and the DAL maps it both directions (`src/data/watches.ts:43, 84`). The only broken segment is the action layer — `insertWatchSchema` in `src/app/actions/watches.ts` lacks `notesPublic`, so Zod's `safeParse` silently drops the value before it reaches `mapDomainToRow`, and neither `addWatch` nor `editWatch` calls the cross-page revalidate that the per-row `<NoteVisibilityPill>` on `/u/{username}/notes` needs to update without a hard navigation. Phase 23 SUMMARY claimed commit `4d362ff` shipped the fix; `git merge-base --is-ancestor 4d362ff HEAD` returns 1 — that commit never reached `main`. This phase reintroduces the missing schema field + revalidate, turns the existing 4 RED tests in `tests/actions/watches.notesPublic.test.ts` GREEN, holds the rest of the test suite at zero regressions, and corrects the ROADMAP.md wording inline (criterion #4) to match the test scaffold's literal assertion. Out of scope: WatchForm UI, removeWatch parity, schema/types changes, DAL changes, sibling action files (notes/profile/follows/wishlist).

## Implementation Mechanics

### Verified Insertion Sites (line numbers re-checked against current `main` 2026-05-06)

| What | File | Line | Current state | Action |
|------|------|------|---------------|--------|
| `insertWatchSchema` z.object body | `src/app/actions/watches.ts` | 17–54 | Lacks `notesPublic` field | Insert one new line `notesPublic: z.boolean().optional(),` |
| `updateWatchSchema = insertWatchSchema.partial()` | `src/app/actions/watches.ts` | 57 | Derives all fields from `insertWatchSchema` automatically | No edit — change to insert auto-flows via `.partial()` |
| `addWatch` `revalidatePath('/')` | `src/app/actions/watches.ts` | 267 | Single revalidate path call | Insert NEW line immediately AFTER (line 268 in new file) |
| `addWatch` `revalidateTag('explore', 'max')` | `src/app/actions/watches.ts` | 277 | Tag fan-out call | Stays at line 278 in new file (after the new revalidate) |
| `editWatch` `revalidatePath('/')` | `src/app/actions/watches.ts` | 340 | Single revalidate path call | Insert NEW line immediately AFTER (line 341 in new file) |
| `editWatch` `revalidateTag('explore', 'max')` | `src/app/actions/watches.ts` | 348 | Tag fan-out call | Stays at line 349 in new file |
| `removeWatch` `revalidatePath('/')` | `src/app/actions/watches.ts` | 372 | NOT MODIFIED (D-04) | Confirmed unchanged in this phase |

Verification command run for line-number drift check (output matches CONTEXT.md):

```
$ grep -n "revalidatePath\|insertWatchSchema\|updateWatchSchema\|revalidateTag" src/app/actions/watches.ts
3:import { revalidatePath, revalidateTag } from 'next/cache'
17:const insertWatchSchema = z.object({
57:const updateWatchSchema = insertWatchSchema.partial()
69:  const parsed = insertWatchSchema.safeParse(data)
234:            // complete before revalidateTag — otherwise the bell refetch could
258:            revalidateTag(`viewer:${recipient.userId}`, 'max')
267:    revalidatePath('/')
272:    // semantics via revalidateTag(tag, 'max') — Pitfall 4. Granularity is
277:    revalidateTag('explore', 'max')
299:  const parsed = updateWatchSchema.safeParse(data)
340:    revalidatePath('/')
348:    revalidateTag('explore', 'max')
372:    revalidatePath('/')
377:    // removal. Fan-out via revalidateTag(tag, 'max') — Pitfall 4.
378:    revalidateTag('explore', 'max')
```

All line numbers in CONTEXT.md (D-03) match `main` exactly. No drift.

### Diff Hunk 1 — Schema field insertion

**Goal:** Add `notesPublic: z.boolean().optional()` inside `insertWatchSchema` so both `addWatch` (validates against `insertWatchSchema`) and `editWatch` (validates against `updateWatchSchema = insertWatchSchema.partial()`) accept the field.

**Suggested location:** Immediately after the `notes: z.string().optional(),` line (currently line 40). Grouping `notesPublic` with `notes` matches the domain type ordering at `src/lib/types.ts:52–53` and reads well.

```diff
   notes: z.string().optional(),
+  notesPublic: z.boolean().optional(),
   imageUrl: z.string().optional(),
```

Equivalent acceptable placements (any line inside `insertWatchSchema` z.object body works — the file does not enforce field order):
- After line 40 (`notes`) — recommended, matches domain type grouping
- After line 53 (`photoSourcePath` close, just before line 54 `})`) — also acceptable
- Anywhere between lines 18 and 53

After the edit, line 57 (`const updateWatchSchema = insertWatchSchema.partial()`) inherits the new optional field automatically — no second edit needed for editWatch.

### Diff Hunk 2 — `addWatch` revalidate insertion (between lines 267 and 277)

```diff
     revalidatePath('/')
+    revalidatePath('/u/[username]', 'layout')

     // Phase 18 DISC-05 / DISC-06 — fan out 'explore' tag so the global
     // Trending + Gaining Traction rails (and the per-viewer Popular Collectors
     // rail, which also tags 'explore') recompute on next render. Cross-user
     // semantics via revalidateTag(tag, 'max') — Pitfall 4. Granularity is
     // intentionally broad (just 'explore') rather than per-rail, per RESEARCH
     // §Pattern 6 recommendation. Fires once regardless of status because
     // both Trending (owners + 0.5*wishlist) and Gaining Traction read the
     // denormalized counts from the catalog.
     revalidateTag('explore', 'max')
```

The new line is added BEFORE the existing comment block that explains `revalidateTag('explore', 'max')`. This preserves the intent of D-03 (group path revalidates first, then tag fan-out) and keeps the explanatory comments adjacent to the call they document.

### Diff Hunk 3 — `editWatch` revalidate insertion (between lines 340 and 348)

```diff
     const watch = await watchDAL.updateWatch(user.id, watchId, updatePayload)
     revalidatePath('/')
+    revalidatePath('/u/[username]', 'layout')

     // Phase 18 DISC-05 / DISC-06 — same fan-out as addWatch. editWatch can
     // change status (owned ↔ wishlist ↔ sold ↔ grail), and each transition
     // shifts the catalog's denormalized counts (owners_count, wishlist_count)
     // on the next pg_cron refresh. Even non-status edits (brand/model fixes)
     // can affect Trending if they re-link the watch to a different catalog
     // row via the upsert path. Fan-out is the safe default.
     revalidateTag('explore', 'max')
```

Same pattern as addWatch: insert immediately after `revalidatePath('/')`, before the `revalidateTag('explore', 'max')` comment block.

### Optional explanatory comment

The fix is small enough that a brief comment on the new revalidate is welcome but not required. If the executor wants to add one (matching the WR-07 commentary style on `notes.ts`), suggested wording:

```typescript
revalidatePath('/')
// DEBT-09 (Phase 32) — invalidate the user-scoped layout so the per-row
// <NoteVisibilityPill> on /u/{username}/notes reflects the new notesPublic
// value without a hard refresh. Layout selector (NOT 'page') because the
// route template is /u/[username]/[tab] — see notes.ts WR-07 commentary.
revalidatePath('/u/[username]', 'layout')
revalidateTag('explore', 'max')
```

The planner can choose: bare insertion (matches sibling action minimalism in `profile.ts`/`follows.ts`) or commented insertion (matches `notes.ts` WR-07 verbosity). Both are acceptable.

## Test Mocking Surface Analysis (Regression Risk per File)

The risk vector: adding a third `revalidatePath` call to `addWatch`/`editWatch` could break tests that assert call counts or argument signatures. Audit ran `grep -n "revalidatePath\|toHaveBeenCalled" <file>` against every test file that imports `next/cache` or imports addWatch/editWatch.

### Files importing addWatch/editWatch AND mocking next/cache

| File | Mocks `next/cache`? | Asserts on `revalidatePath` for watches actions? | Risk |
|------|---------------------|--------------------------------------------------|------|
| `tests/actions/watches.notesPublic.test.ts` | YES (line 39) | YES — asserts `revalidatePath` was called with `'/u/[username]', 'layout'` (lines 131, 158). 4 RED tests = the GREEN target. | **TARGET** (intentional). |
| `tests/actions/watches.test.ts` | YES (line 17) | NO. Only asserts on `revalidateTag` calls (lines 161, 220, 254, 286 for `'explore'` and `'viewer:...'`). Has `findOverlapRecipients`/`logNotification` `toHaveBeenCalledTimes(1)` assertions (lines 139, 145), but ZERO assertions on `revalidatePath` call counts or arguments. | **NONE** — the new `revalidatePath('/u/[username]', 'layout')` call is invisible to all assertions in this file. |
| `tests/actions/addwatch-catalog-resilience.test.ts` | YES (line 37) | NO. Only asserts `result.success === true`, console.error matching, and `linkWatchToCatalog` not called. ZERO `revalidatePath` assertions. | **NONE**. |
| `tests/integration/phase17-addwatch-wiring.test.ts` | YES (line 29) | NO. Mocks `revalidatePath` but never asserts on it. Real DB integration test gated on `DATABASE_URL`; checks DB state via SQL. | **NONE**. |
| `tests/integration/add-watch-photo.test.ts` | YES (line 49) | NO. Mocks `revalidatePath` but never asserts on it. Real DB integration test gated on `DATABASE_URL`; checks `watches_catalog` row state via SQL. | **NONE**. |

### Files mocking next/cache that do NOT import watches actions

| File | Imports addWatch/editWatch? | Risk |
|------|----------------------------|------|
| `tests/actions/wishlist.test.ts` | NO — imports `addToWishlistFromWearEvent` from `wishlist.ts` (different action). Asserts `revalidatePath('/')` 5× (lines 218, 279, 337). The wishlist action's revalidate call site is line 148 of `wishlist.ts` — unaffected by this phase. | **NONE**. |
| `tests/actions/preferences.test.ts` | NO — imports `savePreferences` from `preferences.ts`. | **NONE**. |
| `tests/actions/follows.test.ts` | NO — imports `followUser`/`unfollowUser` from `follows.ts`. Asserts `revalidatePath` `toHaveBeenCalledTimes(1)` with `'/u/[username]', 'layout'` (lines 120–121, 295–296) — but these target the `follows.ts` action's existing call site, not the watches action. | **NONE** (different action surface). |
| `tests/actions/notifications.test.ts` | NO — imports notification actions. Mocks `revalidatePath` (line 23) but only asserts on `updateTag`/`revalidateTag`. | **NONE**. |
| `tests/components/explore/*.test.tsx` (4 files) | NO — component tests; mock `next/cache` only because the components transitively import server modules. | **NONE**. |
| `tests/components/home/CollectorsLikeYou.test.tsx` | NO — same as above. | **NONE**. |
| `tests/integration/phase15-wywt-photo-flow.test.ts` | NO — imports WYWT-specific actions. Mocks `revalidatePath` inline 3× (lines 297, 332, 669) but in `vi.doMock` per-describe blocks for separate test scopes; never asserts on it for the watches action surface. | **NONE**. |
| `tests/data/isolation.test.ts` | Likely YES (data-layer test) but does not import server actions; mocks `next/cache` defensively. | **NONE**. |

### Conclusion

Every `revalidatePath` call-count assertion on `main` either targets the notesPublic GREEN contract (the intent of this phase) or targets a different action file (`follows.ts`, `wishlist.ts`) whose call sites are NOT modified by this phase. **Adding a third `revalidatePath` call to `addWatch`/`editWatch` is safe — no existing test will go RED from the addition.**

Snapshot tests: none found in the repo (`.snap` extension not present in `tests/`).

Order-sensitive assertions: none. The only ordering-related assertion is in `watches.test.ts` test "addWatch fires `revalidateTag('explore', 'max')` on success" — it asserts `revalidateTag` was called with the right args after `addWatch` returns, which is unaffected by adding an earlier `revalidatePath` call.

## WR-07 Commentary Excerpt (verbatim from `src/app/actions/notes.ts`)

The `notes.ts` action file documents the exact dynamic-segment pitfall that justifies D-01. Both `updateNoteVisibility` (lines 53–58) and `removeNote` (lines 108–113) carry the same comment verbatim:

```typescript
// WR-07: the actual route template is `/u/[username]/[tab]` (the tab
// segment is dynamic). Revalidating `/u/[username]/notes` with a 'page'
// selector silently no-ops because it does not match a compiled route
// entry. Revalidate the layout so sibling tabs (Stats, Collection) also
// reflect the mutation without a hard navigation.
revalidatePath('/u/[username]', 'layout')
```

This is the canonical reasoning for D-01: revalidating `/u/[username]/notes` (literal path) or `/u/[username]/[tab]` with `'page'` selector both fail to match the compiled route entry because the `[tab]` segment is dynamic. The layout-scoped revalidate at `'/u/[username]'` correctly invalidates everything beneath the layout, including all `[tab]` variants. The Next.js 16 docs confirm this behavior (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` §"Revalidating a Layout path"):

> This will cause pages beneath with the same layout to be invalidated and revalidated on the next visit. For example, in the above case, `/blog/[slug]/[another]` would also be invalidated and revalidated on the next visit.

## Sibling-Action Call Sites (Codebase Pattern Survey)

Five other server actions already use the layout-scoped revalidate pattern this phase introduces. These are reference-only — out of scope to modify, but useful for the planner/executor to verify the pattern is well-established.

| File | Function | Line | Call |
|------|----------|------|------|
| `src/app/actions/notes.ts` | `updateNoteVisibility` | 58 | `revalidatePath('/u/[username]', 'layout')` |
| `src/app/actions/notes.ts` | `removeNote` | 113 | `revalidatePath('/u/[username]', 'layout')` |
| `src/app/actions/profile.ts` | `updateProfile` | 34 | `revalidatePath('/u/[username]', 'layout')` |
| `src/app/actions/profile.ts` | `updateProfileSettings` | 83 | `revalidatePath('/u/[username]', 'layout')` |
| `src/app/actions/follows.ts` | `followUser` | 53 | `revalidatePath('/u/[username]', 'layout')` |
| `src/app/actions/follows.ts` | `unfollowUser` | 118 | `revalidatePath('/u/[username]', 'layout')` |

The lone divergent file (NOT a pattern this phase follows):

| File | Function | Line | Call |
|------|----------|------|------|
| `src/app/actions/wishlist.ts` | `reorderWishlist` | 206 | `revalidatePath('/u/[username]/[tab]', 'page')` |

Per Deferred Idea #2 in CONTEXT.md, `wishlist.ts:206` is captured as a future hygiene fix — likely WR-07 generalizes and this site silently no-ops too. Out of scope for Phase 32.

## ROADMAP.md Edit Hunk (verbatim, D-05)

Current state of `.planning/ROADMAP.md` (line 126, verified 2026-05-06):

```
  4. Both Server Actions call `revalidatePath('/u/[username]/[tab]', 'page')` after every successful write
```

Required state after edit:

```
  4. Both Server Actions call `revalidatePath('/u/[username]', 'layout')` after every successful write
```

Diff hunk:

```diff
   3. Both Server Actions persist `notesPublic` to the database on every write
-  4. Both Server Actions call `revalidatePath('/u/[username]/[tab]', 'page')` after every successful write
+  4. Both Server Actions call `revalidatePath('/u/[username]', 'layout')` after every successful write
   5. No new test failures introduced; full test suite remains GREEN
```

Single-line edit. No surrounding doc structure changes. Ships in the same commit/PR as the action change so the contradiction between ROADMAP and test never appears in tree state.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 (`devDependencies` per `package.json`) |
| Config file | `vitest.config.ts` (jsdom environment, globals enabled, setupFiles `./tests/setup.tsx`, alias `@/* → src/*`, `server-only` shimmed for jsdom) |
| Quick run command | `npx vitest run tests/actions/watches.notesPublic.test.ts` |
| Action-suite scoped run | `npx vitest run tests/actions/` |
| Full suite command | `npm test` (resolves to `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-09 | `addWatch` accepts `notesPublic` and persists it through `createWatch` | unit | `npx vitest run tests/actions/watches.notesPublic.test.ts -t "addWatch accepts notesPublic"` | ✓ (line 82) |
| DEBT-09 | `editWatch` accepts `notesPublic` and revalidates `/u/[username]` layout | unit | `npx vitest run tests/actions/watches.notesPublic.test.ts -t "editWatch accepts notesPublic"` | ✓ (line 115) |
| DEBT-09 | `addWatch` revalidates `/u/[username]` layout on success | unit | `npx vitest run tests/actions/watches.notesPublic.test.ts -t "addWatch revalidates"` | ✓ (line 134) |
| DEBT-09 | Zod rejects non-boolean `notesPublic` | unit | `npx vitest run tests/actions/watches.notesPublic.test.ts -t "rejects non-boolean"` | ✓ (line 161) |
| DEBT-09 | No regression in companion suite | regression | `npx vitest run tests/actions/watches.test.ts` | ✓ |
| DEBT-09 | Full suite stays GREEN | regression | `npm test` | ✓ |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/actions/watches.notesPublic.test.ts tests/actions/watches.test.ts` (the targeted RED-GREEN file plus the immediate regression neighbor; ~2s wall time)
- **Per wave merge:** `npm test` (full suite; ~30–60s wall time at current scale)
- **Phase gate:** Full suite green + `npx tsc --noEmit` clean (modulo the pre-existing `LayoutProps` carryover) before `/gsd-verify-work`

### Wave 0 Gaps

None. Per D-06, no new tests are authored in this phase. The 4 existing RED tests are the contract; existing test infrastructure (`vitest.config.ts`, `tests/setup.tsx`) covers the test runtime needs. No new framework install, no new fixtures, no new mocks required.

### Falsifiability — How Each Criterion Could Fail

For every success criterion in CONTEXT.md, document an explicit failure mode the validation must catch:

| Criterion | Failure mode the validation must catch |
|-----------|----------------------------------------|
| #1 — 4/4 GREEN in `tests/actions/watches.notesPublic.test.ts` | Schema field added but revalidate omitted → tests 2 and 3 fail. Revalidate added but schema field omitted → tests 1 and 4 fail. Both added but revalidate uses wrong selector (e.g., `'page'` instead of `'layout'`) → tests 2 and 3 fail with arg-mismatch error. Both added but revalidate placed inside the `try { … }` catalog-await block (lines 119–192) where it might not run on early-return paths → tests 2 and 3 may still pass on the happy-path mock but a logic bug ships. |
| #2 — Zod schema accepts `notesPublic: z.boolean().optional()` | Schema field added with wrong type (e.g., `z.string()`) → test 4 fails on accept side, test 1 fails on persist side. Schema field added without `.optional()` → existing watches.test.ts validWatch fixture (which omits notesPublic) breaks because `safeParse` rejects payloads without the field. |
| #3 — Both actions persist `notesPublic` to DB | Schema added but `mapDomainToRow` somehow regresses → test 1 fails (DAL receives undefined). Confirmed via re-reading `src/data/watches.ts:84` that this path is intact today. |
| #4 — Both actions call `revalidatePath('/u/[username]', 'layout')` | Wrong path string (e.g., `'/u/[username]/[tab]'`) → tests 2 and 3 fail on arg mismatch. Wrong selector (e.g., `'page'`) → tests 2 and 3 fail. Call gated on `'notesPublic' in parsed.data` (against D-02) → test 2 still passes (sends notesPublic in payload) but tests 3's `addWatch` call with `notesPublic: true` would still pass; the gate would only manifest on writes that don't touch notesPublic — those are not in the RED scaffold so the bug ships silently. **Defense:** D-02 lock + verification step confirms no conditional gate exists. |
| #5 — No new test failures | Full suite run catches any unexpected regression. Specifically guards against snapshot drift, unanticipated `revalidatePath` call-count assertions (audit found none — see Test Mocking Surface Analysis), and TS errors in adjacent files. |

### Manual Trace Verification

After the edit, trace test #2 (line 115) manually:

1. `editWatch('w-1', { notesPublic: false })` invoked.
2. `updateWatchSchema.safeParse({ notesPublic: false })` succeeds because `insertWatchSchema` now has `notesPublic: z.boolean().optional()` and `.partial()` propagates the optional.
3. `cleanData = { notesPublic: false }` (sortOrder strip is a no-op here).
4. `updatePayload = cleanData` (status not in `['wishlist', 'grail']`, so the maxSort branch is skipped).
5. `watchDAL.updateWatch(user.id, 'w-1', { notesPublic: false })` invoked — mock returns the canned watch.
6. `revalidatePath('/')` invoked (existing line 340, now 341 in edited file).
7. **NEW:** `revalidatePath('/u/[username]', 'layout')` invoked.
8. `revalidateTag('explore', 'max')` invoked.
9. Returns `{ success: true, data: <mock watch> }`.
10. Test assertion at line 131: `expect(revalidatePath).toHaveBeenCalledWith('/u/[username]', 'layout')` PASSES.

Same trace for test #3 (`addWatch` line 134) — the path through `addWatch` reaches line 268 (the new revalidate) on every success; all the catalog/enrichment/notification fire-and-forget paths are awaited but their failures are swallowed and do not affect the revalidate call.

## Regression Risk Inventory

A third `revalidatePath` call in `addWatch`/`editWatch` could theoretically break tests in these categories. Each is audited below.

1. **Tests asserting `revalidatePath` call counts on watches actions.** None found. `tests/actions/watches.test.ts` asserts on `revalidateTag` and `findOverlapRecipients`/`logNotification` call counts but never on `revalidatePath`. The notesPublic test asserts `toHaveBeenCalledWith` (existence with args) but not `toHaveBeenCalledTimes` (call count) — adding a second matching call would still pass. Confirmed: lines 131, 158 use `toHaveBeenCalledWith`, not `toHaveBeenCalledTimes`.

2. **Tests asserting `revalidatePath` argument arrays on watches actions.** None found. The notesPublic test's `toHaveBeenCalledWith('/u/[username]', 'layout')` is matched by the new call (this is the GREEN target). The pre-existing `revalidatePath('/')` call still fires; both assertions are independent.

3. **Snapshot tests.** None found in `tests/`. No `.snap` files exist in the repo. Vitest's `toMatchSnapshot()` is not used for action tests.

4. **Fire-and-forget side-effect tests** (CONTEXT.md `<code_context>` Integration Points). Each is unaffected:
   - **Catalog wiring** (lines 119–134) — runs before the revalidate; the added line is downstream.
   - **Taste enrichment** (lines 142–192) — runs before the revalidate; downstream.
   - **Activity logging** (lines 195–213) — runs before the revalidate; downstream.
   - **Overlap notifications** (lines 219–265) — runs before the revalidate; downstream. The recipient-side `revalidateTag('viewer:${recipient.userId}', 'max')` at line 258 is the only earlier `revalidatePath`/`revalidateTag` call inside the success path; it is unrelated to the new layout-scoped path call.
   - **Explore tag fan-out** (line 277) — runs AFTER the new revalidate. D-03 explicitly orders the new revalidate BEFORE the tag fan-out.

5. **Order-sensitive assertions.** None. The closest candidate — `tests/actions/watches.test.ts` line 161 (`expect(revalidateTag).toHaveBeenCalledWith('viewer:${recipientUserId}', 'max')`) — does not depend on call ordering relative to `revalidatePath`. The mock's `toHaveBeenCalledWith` only checks that SOMEWHERE among the recorded calls, the argument tuple matches.

6. **Integration test SQL state checks.** `tests/integration/phase17-addwatch-wiring.test.ts` and `tests/integration/add-watch-photo.test.ts` query DB state after `addWatch`. These run only when `DATABASE_URL` is set; the new `revalidatePath` call has no DB side effect, so they remain green.

7. **Type checking.** `npx tsc --noEmit` may flag the pre-existing `LayoutProps` error in `src/app/u/[username]/layout.tsx:21` — that is carryover from v3.0 (per REQUIREMENTS.md "Future Requirements") and is not introduced by this phase. The new `revalidatePath` call has correct types per the Next.js 16 signature `revalidatePath(path: string, type?: 'page' | 'layout'): void`.

8. **Lint.** `npm run lint` (`eslint`) — no rule should fire on a single-arg-string + tuple-pair call to a typed import.

9. **Build.** `npm run build` — same as TS check; one new line of identical shape to existing calls.

10. **Phase 19.1 D-07 byte-lock on `extractWithLlm()`.** Untouched. This phase does not modify `src/lib/extractors/llm.ts`.

**Summary risk score: LOW.** The edit is a single new line in two places, plus one schema field, plus one ROADMAP wording fix. No existing test, type check, lint rule, or build step has a known dependency on the absence of this call.

## CLI Verification Commands

Run order (each must pass before moving to the next):

| Step | Command | Expected outcome |
|------|---------|------------------|
| 1. Targeted RED → GREEN | `npx vitest run tests/actions/watches.notesPublic.test.ts` | `Test Files 1 passed (1) / Tests 4 passed (4)`. Was `1 failed / 4 failed` on `main` per v4.1 audit. |
| 2. Adjacent regression check (action neighbors) | `npx vitest run tests/actions/watches.test.ts tests/actions/addwatch-catalog-resilience.test.ts` | All previously-passing tests still pass. |
| 3. All action tests | `npx vitest run tests/actions/` | All previously-passing tests still pass. |
| 4. Full suite | `npm test` | Zero net new failures. (Some integration tests skip without `DATABASE_URL` — that is by design.) |
| 5. Type check | `npx tsc --noEmit` | Zero NEW errors. The pre-existing `LayoutProps` error in `src/app/u/[username]/layout.tsx:21` is carryover and acceptable per REQUIREMENTS.md "Future Requirements". |
| 6. Lint | `npm run lint` | Zero errors. |
| 7. Build smoke | `npm run build` (optional pre-push gate) | Build succeeds. Not strictly required for this phase since the change is server-action-only and exercised by step 4. |

The `package.json` `test` script is `vitest run` — both `npm test` and `npx vitest run` produce equivalent output. There is no separate `typecheck` script; use `npx tsc --noEmit` directly.

## Out-of-Scope Reminder

The planner's `must_haves`, the executor's `read_first` / `acceptance_criteria`, and the verifier's gate must enforce these scope boundaries (restated from CONTEXT.md and Deferred Ideas):

- **DO NOT modify** `src/components/watch/WatchForm.tsx` — the form already collects and submits `notesPublic` correctly (lines 83, 127, 648–665).
- **DO NOT modify** `removeWatch` (CONTEXT D-04) — adding revalidate to deletion is real-but-smaller bug; deferred.
- **DO NOT modify** `src/db/schema.ts` — the column exists with the right default (line 95).
- **DO NOT modify** `src/data/watches.ts` — `mapDomainToRow` already maps `notesPublic` (line 84).
- **DO NOT modify** `src/lib/types.ts` — `notesPublic` already declared on the domain `Watch` interface (line 53).
- **DO NOT modify** sibling action files (`notes.ts`, `profile.ts`, `follows.ts`, `wishlist.ts`) — referenced as patterns only. `wishlist.ts:206`'s tab/page divergence is a Deferred Idea, not this phase.
- **DO NOT add new tests** (CONTEXT D-06). The 4 RED tests in `tests/actions/watches.notesPublic.test.ts` are the only assertions that need to flip to GREEN.

If the executor encounters a test failure outside `tests/actions/watches.notesPublic.test.ts` after the edit, that is a regression signal — investigate before proceeding. The expected outcome is **strictly additive**: 4 newly-GREEN tests, all other test states unchanged.

## Open Questions

None. CONTEXT.md decisions D-01 through D-06 lock every gray-area choice. The test scaffold is the literal contract. All insertion sites are verified line-for-line against `main`. The regression risk audit found zero blocking dependencies. The Next.js 16 docs (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`) confirm the two-arg signature semantics. The fix is mechanically straightforward and the planner can produce a single-task plan with high confidence.

If the planner finds ambiguity that this research did not anticipate, escalate to discuss-phase rather than relitigating CONTEXT.md decisions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | — |

All claims in this research are verified against either CONTEXT.md, the test scaffold, the source files on `main` (line numbers re-checked 2026-05-06), the v4.1 audit evidence, or the bundled Next.js 16 docs. No `[ASSUMED]` entries — no user confirmation needed beyond the existing CONTEXT.md decisions.

## Sources

### Primary (HIGH confidence)

- `.planning/phases/32-debt-09-notespublic-fix/32-CONTEXT.md` — locked decisions D-01 through D-06; canonical refs; code context
- `tests/actions/watches.notesPublic.test.ts` — 4 RED tests; the literal GREEN contract (lines 131, 158 carry the assertion strings)
- `tests/actions/watches.test.ts` — companion suite; verified zero `revalidatePath` call-count assertions (greps for `revalidatePath` and `toHaveBeenCalledTimes` both reviewed)
- `src/app/actions/watches.ts` — line numbers verified 2026-05-06 against CONTEXT.md (D-03)
- `src/app/actions/notes.ts` — WR-07 commentary verbatim at lines 53–58 and 108–113
- `src/app/actions/profile.ts` — sibling pattern at lines 34, 83
- `src/app/actions/follows.ts` — sibling pattern at lines 53, 118
- `src/app/actions/wishlist.ts:206` — divergent pattern (out of scope)
- `src/data/watches.ts` — `mapDomainToRow` confirms `notesPublic` mapping at line 84
- `src/db/schema.ts:95` — column exists with `.notNull().default(true)`
- `src/lib/types.ts:53` — domain type declares `notesPublic?: boolean`
- `.planning/milestones/v4.0-phases/23-settings-sections-schema-field-ui/23-VERIFICATION.md` — D-19 contract at line 143; FEAT-07 GAP row at line 46
- `.planning/milestones/v4.1-MILESTONE-AUDIT.md` — DEBT-09 reproducible evidence at lines 58–67, 165–177
- `.planning/REQUIREMENTS.md` line 15 — DEBT-09 full text
- `.planning/ROADMAP.md` lines 118–128 — Phase 32 success criteria; line 126 needs D-05 wording fix
- `.planning/STATE.md` — current position confirmed Phase 32, planning status
- `package.json` — vitest 2.1.9, npm test = `vitest run`, no `typecheck` script
- `vitest.config.ts` — jsdom environment, `@/* → src/*` alias, `server-only` shim
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` (Next.js 16.2.3 bundled docs) — confirms `revalidatePath(path: string, type?: 'page' | 'layout'): void` and layout-selector cascade semantics

### Secondary (MEDIUM confidence)

- `tests/integration/phase17-addwatch-wiring.test.ts` — verified mocks but no `revalidatePath` assertions
- `tests/integration/add-watch-photo.test.ts` — verified mocks but no `revalidatePath` assertions
- `tests/actions/addwatch-catalog-resilience.test.ts` — verified mocks but no `revalidatePath` assertions
- `tests/actions/wishlist.test.ts`, `tests/actions/preferences.test.ts`, `tests/actions/follows.test.ts`, `tests/actions/notifications.test.ts` — verified scope (no addWatch/editWatch imports)

### Tertiary (LOW confidence)

- (none — every claim has a primary or secondary source)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Next.js 16.2.3 + Zod 4.3.6 + vitest 2.1.9 are pinned in `package.json`; `revalidatePath` two-arg signature confirmed against bundled Next.js docs.
- Architecture: HIGH — sibling action precedent (5 of 6 server actions use the layout pattern); WR-07 commentary documents the exact pitfall; Next.js docs confirm the layout cascade.
- Pitfalls: HIGH — test mocking surface fully audited; zero blocking call-count assertions; integration tests don't assert on `revalidatePath`.
- Regression risk: LOW — single new line in two locations; no existing test depends on absence; all out-of-scope files explicitly identified.

**Research date:** 2026-05-06
**Valid until:** 2026-05-13 (7 days — fast-moving because adjacent code in `actions/watches.ts` could shift line numbers if any other phase lands first; verify line numbers if Phase 32 sits in queue >7 days)
