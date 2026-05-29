---
phase: 70
plan: 03
subsystem: addwatchflow
tags:
  - addwatchflow
  - phase-70
  - server-action
  - dupe-03
  - move-to-collection
  - security
  - wave-2
requires:
  - 70-01 (findViewerWatchByCatalogId widened with reference)
provides:
  - moveWishlistToCollection(watchId, opts?) named export at src/app/actions/watches.ts
  - 8-case unit suite at src/app/actions/__tests__/moveWishlistToCollection.test.ts
  - T-70-01 IDOR mitigation (Zod uuid + DAL ownership two-layer gate)
  - T-70-02 idempotency mitigation (already-owned race returns priorRow without side-effects)
  - T-70-03 status-whitelist mitigation (sold/grail rejection with template-literal error)
affects:
  - 70-05 (AddWatchFlow orchestrator — DupeBanner.onMoveToCollection wires to this action)
tech-stack:
  added: []
  patterns:
    - "Auth-first gate BEFORE Zod parse (matches addWatch:84 / Phase 25 AUTH-04)"
    - "Two-layer IDOR mitigation: Zod uuid validation + watchDAL.getWatchById(user.id, watchId)"
    - "Idempotent status whitelist branch (priorRow.status === 'owned' → return priorRow no-op)"
    - "Template-literal status-whitelist error: `Cannot move ${priorRow.status} watch to collection`"
    - "Mirror addWatch:247-266 logActivity('watch_added') + addWatch:272-318 overlap notif block verbatim"
    - "Mirror addWatch:319-341 revalidatePath + revalidateTag cache invalidation matrix verbatim"
    - "Operator console.warn replaces type extension for 'wishlist_move' semantic (Pitfall 3 resolution)"
key-files:
  created:
    - src/app/actions/__tests__/moveWishlistToCollection.test.ts
  modified:
    - src/app/actions/watches.ts
decisions:
  - "D-10 (CONTEXT) honored — new Server Action moveWishlistToCollection(watchId, opts?) ships as UPDATE on existing watch row (NOT INSERT); fires logActivity + overlap notifications that editWatch deliberately skips"
  - "T-70-01 IDOR — two-layer gate: Zod uuid validation FIRST, then DAL ownership check via watchDAL.getWatchById(user.id, watchId); test case 6 verifies the second layer catches null returns"
  - "T-70-02 idempotency — priorRow.status === 'owned' early-return preserves T-70-02 against double-click race; verified by test case 4 (updateWatch/logActivity/findOverlapRecipients all NOT called)"
  - "T-70-03 status whitelist — template-literal error `Cannot move ${status} watch to collection` for sold/grail (verified by cases 5a + 5b)"
  - "Pitfall 3 resolution — WatchAddedMetadata is { brand, model, imageUrl } only (activities.ts:23-27); the 'source: wishlist_move' note from CONTEXT D-10 is replaced with operator console.warn ('[Phase 70] moveWishlistToCollection: wishlist→collection', { watchId }) — no type extension needed"
  - "Symmetry kept with addWatch — `if (updatedWatch.status === 'owned')` guard around overlap-notification block retained even though status is owned by definition here; eases future grep-equivalence audits"
  - "Rule 1 auto-fix during Task 2 (build gate) — Watch.pricePaid is `number | undefined` not nullable; plan body's '?? null' fallback violated the static contract; switched to '?? undefined' (semantically equivalent: mapDomainToRow strips undefined keys, preserving prior DB value when opts absent)"
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_modified: 2
  commits: 2
  completed_date: 2026-05-29
---

# Phase 70 Plan 03: moveWishlistToCollection Server Action Summary

**One-liner:** New `moveWishlistToCollection(watchId, opts?)` Server Action commits the wishlist→owned status flip as an UPDATE on the existing watch row (NOT INSERT) and fires the activity-feed + overlap-notification side-effects that `editWatch` deliberately skips, closing the DUPE-03 UI's Move-to-Collection commit path.

## Implementation Shape

### `moveWishlistToCollection` at `src/app/actions/watches.ts:382-490`

Signature (matches the LOCKED D-10 contract):

```typescript
export async function moveWishlistToCollection(
  watchId: string,
  opts?: { pricePaid?: number; notes?: string },
): Promise<ActionResult<Watch>>
```

~108 LOC including docblock. Inserted between `addWatch` (ends at L350) and `editWatch` (begins at L496) per PATTERNS.md "ADD after line 350 (before editWatch)".

Internal sequence — each step has a verified analog citation:

| Step | Behavior                                                                | Analog cited                                  |
| ---- | ----------------------------------------------------------------------- | --------------------------------------------- |
| 1    | `try { user = await getCurrentUser() } catch { return Not authenticated }` | addWatch:84 (auth-first BEFORE Zod)          |
| 2    | `z.object({ watchId: uuid(), pricePaid?, notes? }).safeParse(...)`      | Claude's Discretion schema per CONTEXT       |
| 3    | `priorRow = await watchDAL.getWatchById(user.id, watchId)` null → 'Watch not found' | editWatch:400-403 priorRow null branch |
| 4a   | `priorRow.status === 'owned'` → `{ success: true, data: priorRow }`     | T-70-02 idempotency — new pattern             |
| 4b   | `priorRow.status === 'sold' \| 'grail'` → template-literal error        | T-70-03 status whitelist — new pattern        |
| 5    | `console.warn('[Phase 70] moveWishlistToCollection: wishlist→collection', { watchId })` | Claude's Discretion operator telemetry |
| 6    | `updateWatch(user.id, watchId, { status: 'owned', pricePaid, notes })`  | DAL contract at watches.ts:371                |
| 7    | `logActivity('watch_added', updatedWatch.id, { brand, model, imageUrl })` | addWatch:247-266 'watch_added' branch       |
| 8    | `findOverlapRecipients + logNotification` loop + `viewer:` tag invalidation | addWatch:272-318 verbatim                |
| 9    | `revalidatePath('/')` + `revalidatePath('/u/[username]', 'layout')` + `profile:` + `explore` tags | addWatch:319-341 verbatim |
| 10   | Outer try/catch returns `{ success: false, error: 'Failed to move watch to collection' }` on unexpected error | addWatch:343-349 pattern |

### Watch row delta semantics

`updateWatch` is called with `Partial<Watch> = { status: 'owned', pricePaid: parsed.data.pricePaid ?? undefined, notes: parsed.data.notes ?? priorRow.notes ?? undefined }`:

- `status` flips to `'owned'` — the only required change.
- `pricePaid`: when omitted by caller, falls through to `undefined`. `mapDomainToRow` strips undefined keys, so the DB-side prior value is preserved (consistent with WR-01 server-truth posture — clients can supply, but never erase, server-set values).
- `notes` carries over from the prior wishlist row when the caller omits it — the wishlist-era reasoning ("wanted this since 2019") stays attached to the row when it becomes owned.
- `sortOrder` is **not set** — wishlist sortOrder is no longer relevant once status leaves the wishlist+grail group; Collection-tab reorder is deferred per CONTEXT, so the server has no opinion on owned-group order yet.

## Unit Test Suite

File: `src/app/actions/__tests__/moveWishlistToCollection.test.ts` — 247 LOC, 8 cases (6 specified + sold/grail split + bonus side-effect chain). All green.

### Mock structure (mirrors `reorderWishlist.test.ts:21-43`)

```typescript
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/data/watches', async () => {
  const actual = await vi.importActual<typeof import('@/data/watches')>('@/data/watches')
  return { ...actual, getWatchById: vi.fn(), updateWatch: vi.fn() }
})
vi.mock('@/data/activities', () => ({ logActivity: vi.fn() }))
vi.mock('@/data/notifications', () => ({ findOverlapRecipients: vi.fn() }))
vi.mock('@/lib/notifications/logger', () => ({ logNotification: vi.fn() }))
vi.mock('@/data/profiles', () => ({ getProfileById: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const VALID_UUID = '11111111-1111-4111-8111-111111111111' // RFC 4122 v4 strict
```

### Case-by-case behavior coverage

| # | Case                          | Mock setup                                                        | Assertions                                                                              |
| - | ----------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1 | Auth gate                     | `getCurrentUser` rejects                                          | Returns `{ success: false, error: 'Not authenticated' }`; `getWatchById` NOT called     |
| 2 | Zod gate                      | `getCurrentUser` resolves; pass `'not-a-uuid'`                    | Returns `'Invalid request'`; `getCurrentUser` called, `getWatchById` NOT called          |
| 3 | Happy path                    | priorRow `{ status:'wishlist', brand:'Omega', model:'Speedmaster', notes:'wanted this since 2019' }` | `updateWatch` called with `{status:'owned', notes:'wanted this since 2019'}`; `logActivity` called with `'watch_added'` + `{brand,model}`; no `source:'wishlist_move'` in metadata; `findOverlapRecipients` called |
| 4 | Idempotent already-owned      | priorRow `{ status:'owned' }`                                     | Returns `{success:true, data:priorRow}`; `updateWatch`/`logActivity`/`findOverlapRecipients`/`logNotification` ALL NOT called |
| 5a | Sold rejection               | priorRow `{ status:'sold' }`                                      | Returns `{success:false, error:'Cannot move sold watch to collection'}`; `updateWatch` NOT called |
| 5b | Grail rejection              | priorRow `{ status:'grail' }`                                     | Returns `{success:false, error:'Cannot move grail watch to collection'}`; `updateWatch` NOT called |
| 6 | Not-yours (T-70-01 second layer) | `getWatchById` returns `null`                                  | Returns `'Watch not found'`; `getWatchById` called with `('user-id', VALID_UUID)`; `updateWatch` NOT called |
| 7 | Side-effect chain (bonus)    | recipients `[{userId:'recipient-A'},{userId:'recipient-B'}]`      | `logNotification` called twice; payload contains `actor_username:'actor_user'` + `watch_id:VALID_UUID` |

## Threat mitigations verified

| Threat ID | Category               | Mitigation                                                                                                | Test case |
| --------- | ---------------------- | --------------------------------------------------------------------------------------------------------- | --------- |
| T-70-01   | Elevation of Privilege | Two-layer gate: Zod uuid (`z.string().uuid()`) + DAL ownership (`watchDAL.getWatchById(user.id, watchId)`) | Case 6: cross-user attempt with valid UUID resolves to null at the DAL layer |
| T-70-02   | Tampering              | Idempotent: `priorRow.status === 'owned'` early-return preserves no side-effect re-fire                   | Case 4: explicit `expect(updateWatch).not.toHaveBeenCalled()` + same for logActivity/findOverlap/logNotification |
| T-70-03   | Tampering              | Status whitelist with explicit template-literal error: `Cannot move ${priorRow.status} watch to collection` | Cases 5a + 5b: both sold and grail return the exact-string rejection; `updateWatch` NOT called |

## Pitfall 3 Resolution — `WatchAddedMetadata.source` field

**Confirmed gap:** `WatchAddedMetadata` at `src/data/activities.ts:23-27` declares only `{ brand: string; model: string; imageUrl: string | null }`. CONTEXT D-10's literal text "fire `logActivity(user.id, 'watch_added', watchId, { brand, model, reference, source: 'wishlist_move' })`" would not type-check.

**Resolution applied (per RESEARCH Pitfall 3 recommendation):** Omit `source` from the metadata literal; use the operator-visibility `console.warn('[Phase 70] moveWishlistToCollection: wishlist→collection', { watchId })` ABOVE the `updateWatch` call. Same telemetry intent, zero type-extension cost, zero migration cost (the metadata JSONB column would have accepted the field, but the TypeScript type would have required a deliberate widening — deferred until UAT signal demands per-row differentiation in the feed renderer).

**Test enforcement:** Case 3 includes `expect(logActivity).not.toHaveBeenCalledWith(..., expect.objectContaining({ source: 'wishlist_move' }))` so any future regression where someone tries to add the field will fail the unit suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `pricePaid` type contract mismatch (TS build error)**

- **Found during:** Task 2 build gate (`npm run build`)
- **Issue:** Plan D-10 step 5 specified `pricePaid: opts?.pricePaid ?? null` in the update payload. Build gate caught a TS error: `Type 'number | null' is not assignable to type 'number | undefined'.` `Watch.pricePaid` at `src/lib/types.ts:60` is declared `pricePaid?: number` — undefined-only, not nullable. The plan body pattern was speculative.
- **Fix:** Source switched to `pricePaid: parsed.data.pricePaid ?? undefined`. `mapDomainToRow` strips undefined keys before the DB UPDATE, so the prior row value is preserved when caller omits `pricePaid` — semantically identical to the plan's intent. Test case 3 assertion dropped the `pricePaid: null` literal from the `expect.objectContaining` (the `status` + `notes` assertions remain sufficient to verify the flip + notes-carry-through behavior).
- **Files modified:** `src/app/actions/watches.ts` (line 443), `src/app/actions/__tests__/moveWishlistToCollection.test.ts` (case 3 assertion)
- **Commit:** `151229cb` (Task 2 — Rule 1 fix bundled with regression-guard verification)

No other deviations. No auth gates. No architectural changes. No new files outside the plan scope.

## Regression-Guard Verification (Task 2)

```
$ npx vitest run src/app/actions/__tests__/
 Test Files  5 passed (5)
      Tests  51 passed (51)
```

5 files green: `cms-collectionPaths.test.ts`, `cms-curatedLists.test.ts`, `cms-settings.test.ts`, `reorderWishlist.test.ts`, and the new `moveWishlistToCollection.test.ts`.

```
$ npm run build
   ▲ Next.js 16.2.3
   ✓ Compiled successfully in 6.3s
   ✓ Running TypeScript ...
```

Build gate exit 0 — TypeScript graph compiles end-to-end. `addWatch`, `editWatch`, `removeWatch` UNCHANGED at the source level (only addition is the new function between them); their behaviors are unaffected. No previously-green test in the suite turned red.

## Grep Contract Verifications (done-block)

```
$ grep -n "export async function moveWishlistToCollection" src/app/actions/watches.ts
382:export async function moveWishlistToCollection(

$ grep -n "Cannot move .* watch to collection" src/app/actions/watches.ts
427:        error: `Cannot move ${priorRow.status} watch to collection`,

$ grep -n "moveWishlistToCollection: wishlist→collection" src/app/actions/watches.ts
433:    console.warn('[Phase 70] moveWishlistToCollection: wishlist→collection', {

$ grep -n "source.*wishlist_move" src/app/actions/watches.ts | grep -v "^[0-9]*: \*"
(no matches — only JSDoc prose mentions; Pitfall 3 mitigated)
```

All four grep contracts from the `<done>` block pass.

## Verification

### SC#1 (DUPE-03 wishlist→collection UPDATE — not INSERT) traced

This Server Action IS the UPDATE path. Behavior assertion is "UPDATE, not INSERT" — verified by:

- **Test case 3 (happy path):** `updateWatch` is the mutation, NOT `addWatch` / DAL `createWatch`. The test asserts `updateWatch` was called with the prior row's `watchId` argument.
- **Test case 4 (idempotent already-owned):** `updateWatch` is `expect(...).not.toHaveBeenCalled()` — the action returns `priorRow` directly without a second DB write, proving the UPDATE-not-INSERT semantic also avoids redundant writes on retry.

Plan 05's orchestrator will wire `DupeBanner.onMoveToCollection → moveWishlistToCollection(dupeContext.existingWatchId)` — the existingWatchId comes from Wave 1's `findViewerWatchByCatalogId` return (widened with `reference` in Plan 01, joins watches_catalog server-side per T-70-04).

## Commits

| Task | Hash       | Message                                                                                              |
| ---- | ---------- | ---------------------------------------------------------------------------------------------------- |
| 1    | `cd9f02c5` | feat(70-03): moveWishlistToCollection Server Action + 8-case unit suite (DUPE-03)                    |
| 2    | `151229cb` | fix(70-03): pricePaid undefined-not-null to match Watch type contract (Rule 1)                        |

Task 2 produced a commit because the Rule 1 build-gate fix required modifying both the action source and the matching test assertion — bundling them with the regression-guard verification keeps the commit history coherent.

## Pre-existing Baseline Noise

Per `project_baseline_not_green_build_is_gate`:

- `npm run build` is the authoritative gate — exits 0 cleanly with no errors.
- Full `npm run test` retains the ≥1 pre-existing failures noted in earlier phases (CommentGateLocked font-medium + Phase 69 Plan 04 recurrence-2 SearchEntry palette tests) — NOT attributable to this plan.
- Targeted Server Action test surface (the 5 files under `src/app/actions/__tests__/`) is fully green.

## Known Stubs

None. The action is fully wired:

- `parsed.data.pricePaid` / `parsed.data.notes` flow real values from the typed caller surface.
- `priorRow` flows from the DAL ownership-scoped query.
- `updatedWatch` flows from `updateWatch` returning the actual updated row.
- `actorProfile` flows from `getProfileById(user.id)` — real profile data.
- The `console.warn` is intentional operator telemetry, not a stub.

## Threat Flags

No new threat surface introduced beyond the registered T-70-01 / T-70-02 / T-70-03 (all in the plan's `<threat_model>` and mitigated by the implementation per the verification tables above).

## Self-Check: PASSED

Files exist:

- `FOUND: src/app/actions/watches.ts` (modified — new export at line 382)
- `FOUND: src/app/actions/__tests__/moveWishlistToCollection.test.ts` (created)
- `FOUND: .planning/phases/70-addwatchflow-state-machine-rewrite-dupe-wiring/70-03-SUMMARY.md`

Commits exist on `main`:

- `FOUND: cd9f02c5` — Task 1 (feat — moveWishlistToCollection + 8-case unit suite)
- `FOUND: 151229cb` — Task 2 (fix — Rule 1 pricePaid undefined-not-null + regression-guard pass)
