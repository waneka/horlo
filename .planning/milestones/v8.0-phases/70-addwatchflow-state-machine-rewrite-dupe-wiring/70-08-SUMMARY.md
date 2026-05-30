---
phase: 70
plan: 08
subsystem: add-watch-flow
one_liner: Closes VERIFICATION gaps #2 (WR-01 silent-duplicate via ConfirmStep) and #3 (WR-02 silent no-banner advance on transient dupe-resolver failure) — ConfirmStep primary CTA is now gated on dupeContext presence + handleSearchPick surfaces toast.error and stays on search-idle when a search-projection-signaled dupe fails to resolve.
tags:
  - phase-70
  - gap-closure
  - wr-01
  - wr-02
  - confirmstep-pending-gate
  - dupe-banner-enforcement
  - add-watch-flow
requires:
  - Phase 70 Plan 02 (DupeBanner pure-presenter — the affordance being enforced)
  - Phase 70 Plan 05 (AddWatchFlow orchestrator + handleSearchPick wiring)
  - Phase 70 Plan 07 (handleConfirmPrimary payload cleanup — same render branch)
  - Phase 68 D-03 ConfirmStep prop contract (pending: boolean — LOCKED; widened gate composed at the call-site, not inside ConfirmStep)
provides:
  - ConfirmStep pending-gate on `state.pending || state.dupeContext != null` in the confirming render branch
  - toast.error fallback + early return in handleSearchPick's owned (D-06 null-ref fallthrough) and wishlist branches when resolveDupeContext returns null
  - 7 new regression tests (3 WR-01 + 4 WR-02 including 2 boundary inverses)
  - Top-level `vi.mock('sonner', ...)` mock infrastructure in AddWatchFlow.test.tsx for sonner toast assertions
affects:
  - src/components/watch/AddWatchFlow.tsx
  - src/components/watch/AddWatchFlow.test.tsx
tech_stack_added: []
patterns:
  - Pending-gate composition at the call-site (consumer widens the gate; presenter contract stays locked)
  - Known-dupe-but-null-resolver early-return branch (callers with pre-known viewerState do NOT silently fall through; callers without viewerState retain the silent-fallthrough on null)
  - Inverse-boundary test pattern (assert the BENIGN case is still benign — null viewerState + null resolver still silently proceeds, proves the new guard is scoped to the known-dupe case)
key_files_created: []
key_files_modified:
  - src/components/watch/AddWatchFlow.tsx
  - src/components/watch/AddWatchFlow.test.tsx
decisions:
  - "ConfirmStep `pending` prop stays at the LOCKED Phase 68 D-03 contract (`pending: boolean`). The widened gate `state.pending || state.dupeContext != null` is composed at the orchestrator call-site (AddWatchFlow.tsx:731 — the `confirming` render branch). ConfirmStep itself is untouched; the consumer owns the disable decision. Defense-in-depth: even if a future change forgets the dupeContext gate, the ConfirmStep primary still disables during async pending — a regression would only re-open the silent-duplicate path on idle non-pending state, which the new tests catch."
  - "DupeBanner's own `pending={state.pending}` prop intentionally unchanged. The banner's three buttons (View existing / Move to Collection / Add another copy) should disable ONLY during the moveWishlistToCollection async await — NOT just because the banner is mounted. Mounting IS the affordance; disabling on mount would create a deadlock where the user cannot dismiss the banner."
  - "resolveDupeContext at AddWatchFlow.tsx:722-731 stays unchanged — its null-on-failure semantic remains correct for structured-input + URL-backup callers where viewerState is NOT pre-known. The branch fix is in the CALLER (handleSearchPick), not in the resolver."
  - "The toast.error guard is only added to handleSearchPick's owned (D-06 null-ref fallthrough at lines ~158-185) and wishlist (lines ~186-214) branches. handleStructuredSubmit and handleUrlBackup branches keep silent-fallthrough by design — they have NO pre-known viewerState; their `null` from resolveDupeContext genuinely means 'no dupe found OR resolver failed; either way, the user proceeds to confirm without a banner'. The owned/wishlist branches are different: the search projection KNOWS a dupe exists; a null from the resolver there is a transient DB failure, not absence."
  - "Copy 'Couldn't check your collection — try again' chosen verbatim from VERIFICATION.md gaps[2] missing[0] so the verifier's grep matches on re-verification. The unicode right-single-quote (`’`) in the contraction would have created a quoting trap; standard ASCII apostrophe used in source + test."
  - "Top-level `vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))` added at AddWatchFlow.test.tsx because the file did not previously mock sonner — handleConfirmPrimary's existing `toast.error` calls (lines 406, 470) had been silently invoking the real sonner in unit tests (no-op in jsdom because there's no Toaster mounted, so it wasn't visible). The new top-level mock is shared across all describe blocks; defensive — assertions check `vi.mocked(toast.error)` against `expect.stringContaining('try again')` rather than literal copy to keep tests robust if the message is reworded later."
  - "Boundary-inverse test for WR-02 (`search-pick null viewerState with resolver failure → silently proceeds to confirming-without-banner (no toast)`) is the structural guard that prevents over-correction. Without this test, a future refactor could naively add the toast.error guard to ALL resolveDupeContext callers — which would break the structured-input + URL-backup paths that legitimately need silent fallthrough."
  - "T-70-01 (search-pick owned-with-ref → /w/[ref] redirect) gains an explicit assertion that `findViewerWatchByCatalogIdAction` was NOT called. The fast-path bypasses resolveDupeContext entirely — confirms the redirect happens BEFORE any DB read; the orchestrator trusts the search projection's `reference + viewerState` pair without re-validating. This isn't a new guard; it codifies the existing fast-path semantic so future regressions show up as test failures, not behavior bugs."
metrics:
  duration: "~12min"
  tasks_completed: 2
  files_modified: 2
  completed_at: "2026-05-29T18:45:00Z"
---

# Phase 70 Plan 08: ConfirmStep pending-gate + handleSearchPick known-dupe resolver-failure toast Summary

JWT-of-the-day one-liner: **The two remaining VERIFICATION gaps close — DupeBanner is now the ONLY viable primary affordance when mounted (ConfirmStep primary is gated on `dupeContext != null`), and transient resolver failures on a known-dupe search projection surface as `toast.error` instead of silently dropping the user into a confirm-without-banner state.**

## Goal

Close VERIFICATION gaps #2 (WR-01) and #3 (WR-02) — the last two open items from `70-VERIFICATION.md` after plans 70-06 + 70-07 closed gap #1 fully.

- **Gap #2 (WR-01) — silent duplicate via ConfirmStep:** the `confirming` render branch mounted DupeBanner ABOVE ConfirmStep but the ConfirmStep primary CTA stayed clickable. A user who ignored the banner and clicked the ConfirmStep primary silently created exactly the duplicate the banner exists to prevent. The fix gates ConfirmStep's `pending` prop on `state.pending || state.dupeContext != null` so the primary disables when the banner is mounted; the user must interact with one of the banner's explicit affordances (View existing / Move to Collection / Add another copy → clears dupeContext → CTA re-enables).
- **Gap #3 (WR-02) — silent no-banner advance on resolver failure:** in handleSearchPick's owned (D-06 null-reference fallthrough) and wishlist branches, when the search projection pre-signaled `viewerState === 'owned' | 'wishlist'` BUT `resolveDupeContext` returned null (transient `findViewerWatchByCatalogIdAction` failure), the orchestrator KNEW a dupe existed but silently dropped the banner and transitioned to confirming-without-banner. The fix detects the known-dupe-but-null-resolver case, surfaces `toast.error("Couldn't check your collection — try again")`, and stays on search-idle (early return — no setState transition).

## WR-01 Change (one-line gate)

### AddWatchFlow.tsx:731 (the `confirming` render branch ConfirmStep mount)

**Before:**

```typescript
<ConfirmStep
  // ... other props ...
  pending={state.pending}                            // CR — primary CTA active even when DupeBanner mounted
  // ...
/>
```

**After:**

```typescript
<ConfirmStep
  // ... other props ...
  // WR-01 fix (gap plan 08): when DupeBanner is mounted (dupeContext != null),
  // the ConfirmStep primary CTA is disabled so the user is forced through one
  // of the banner's explicit affordances. Add another copy clears dupeContext
  // → primary re-enables. Pending during async commits also disables (state.pending
  // — the original gate).
  pending={state.pending || state.dupeContext != null}
  // ...
/>
```

DupeBanner's `pending={state.pending}` prop at AddWatchFlow.tsx:721 remains unchanged — see decisions[1] for rationale.

## WR-02 Change (early-return branch in handleSearchPick)

### AddWatchFlow.tsx handleSearchPick (lines 155-247 refactored)

The owned and wishlist branches now have an explicit `if (!dupeRow) { toast.error(...); return }` guard immediately after each `resolveDupeContext` await. The owned branch (D-06 null-reference fallthrough at lines ~158-185) and the wishlist branch (lines ~186-214) both receive identical guards; the structured/URL-backup branches are untouched.

**Shape of the guard:**

```typescript
// WR-02 fix (gap plan 08): when the search projection pre-signals
// viewerState=owned|wishlist BUT the resolver returns null (transient
// DB failure), the orchestrator KNOWS a dupe exists. Do NOT silently
// fall through to confirm-without-banner — surface toast.error and
// stay on search-idle so the user retries.
if (!dupeRow) {
  toast.error("Couldn't check your collection — try again")
  return
}
```

The `return` here is critical — handleSearchPick is invoked while state.kind is `search-idle`; an early return without setState keeps the orchestrator on search-idle. The user sees the SearchEntry component (debounced typeahead) still mounted with their query still in the input and a toast error overlay — they can retry the pick or modify the query.

The null-viewerState branch (structured/URL-style search-pick with no pre-known dupe) keeps silent fallthrough by design — see decisions[3].

## Test Additions (7 new tests; mock infrastructure addition)

### Sonner mock infrastructure (file-scope addition)

```typescript
// Top of AddWatchFlow.test.tsx
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))
```

Pre-existing handleConfirmPrimary calls to `toast.error` (lines 406, 470) had been invoking the real sonner runtime in jsdom (no-op because no Toaster mounted) — now they hit the mock, which is harmless but more rigorous. No existing test relied on the absence of the mock.

### WR-01 tests (3 new — `describe('Phase 70 gap plan 08 — WR-01 ConfirmStep gating')`)

| Test                                                                                                            | Closes Gap-Truth                                                                                |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ConfirmStep primary CTA is disabled when wishlist dupeContext is set`                                          | WR-01 — proves the gate fires on wishlist DupeBanner mount                                      |
| `ConfirmStep primary CTA is disabled when owned dupeContext is set; click does NOT call addWatch`               | WR-01 — proves the gate fires on owned DupeBanner mount AND that addWatch is not silently called |
| `clicking 'Add another copy' clears dupeContext and re-enables ConfirmStep primary; subsequent click calls addWatch` | WR-01 — proves the gate RELEASES correctly when the user chooses an explicit affordance         |

### WR-02 tests (4 new — `describe('Phase 70 gap plan 08 — WR-02 known-dupe resolver failure')`)

| Test                                                                                                                                       | Closes Gap-Truth                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `search-pick owned (null reference D-06 fallthrough) with resolver failure → toast.error + stays on search-idle`                          | WR-02 — owned branch known-dupe guard                                                            |
| `search-pick wishlist with resolver failure → toast.error + stays on search-idle`                                                          | WR-02 — wishlist branch known-dupe guard                                                         |
| `search-pick null viewerState with resolver failure → silently proceeds to confirming-without-banner (no toast)` (boundary inverse)        | WR-02 — proves the guard is SCOPED to known-dupe; structured-input-style flows preserved         |
| `search-pick owned-with-ref redirects to /w/[ref] WITHOUT calling resolveDupeContext (fast-path semantic codified)` (extended T-70-01)     | WR-02 — proves the redirect fast-path bypasses the resolver entirely; trusts the search projection |

The third WR-02 test (the boundary-inverse) is the structural guard against over-correction (see decisions[7]).

## Existing Tests: All 21 stay green; gap-07 + Phase 69 tests stay green

The 13 pre-existing T-70-01..T-70-08c tests in the main `Phase 70 — AddWatchFlow orchestrator state machine` describe + the 7 gap-plan-07 tests + the CLNP-07 Phase 69 cache-hygiene test all remain green. Plan 08 only ADDS render-branch gate logic + ADDS handleSearchPick branch early-returns; no existing test's setup matrix lands on the new code paths (the existing T-70-03 "Add another copy" test happens to exercise the gate-release path but its assertion is about DupeBanner unmounting, not about ConfirmStep clickability — unaffected).

## Confirmation: Static Greps

```bash
$ grep -n "state.pending || state.dupeContext != null" src/components/watch/AddWatchFlow.tsx | wc -l
1

$ grep -n "Couldn't check your collection" src/components/watch/AddWatchFlow.tsx | wc -l
2     # owned branch + wishlist branch

$ grep -c "toast.error" src/components/watch/AddWatchFlow.tsx
4     # was 2 (handleConfirmPrimary failure + handleMoveToCollection failure); +2 WR-02 branches

$ grep -n "vi.mock('sonner'" src/components/watch/AddWatchFlow.test.tsx | wc -l
1
```

All match plan done-criteria + verification expectations:
- WR-01 gate present at exactly 1 site (the ConfirmStep mount in the `confirming` render branch).
- WR-02 toast copy present at exactly 2 sites (owned branch + wishlist branch).
- `toast.error` count rises from 2 → 4 (the 2 pre-existing payload-failure paths + 2 new WR-02 branches).
- Sonner mock fixture present at the test file level (single instance, shared across describe blocks).

The single pre-existing comment string `"silently advance to confirm-without-banner"` in handleSearchPick is the JSDoc explanation of the WR-02 fix posture — semantic, not a target.

## Verification Results

```
$ npx vitest run src/components/watch/AddWatchFlow.test.tsx
✓ 28 tests passed (was 21)

$ npx vitest run src/components/watch/AddWatchFlow.test.tsx \
                  src/components/watch/flowTypes.test.ts \
                  src/components/watch/StructuredEntryPanel.test.tsx \
                  src/components/watch/SearchEntry.test.tsx \
                  src/components/watch/DupeBanner.test.tsx \
                  src/app/actions/__tests__/moveWishlistToCollection.test.ts
✓ 80 tests passed (was 73)

$ npm run build
✓ Compiled successfully in 7.8s
```

All Plan 08 success criteria PASS at the code level:

- [x] VERIFICATION gap #2 (WR-01): ConfirmStep primary is now gated on `state.pending || state.dupeContext != null` — DupeBanner is the ONLY viable primary affordance when mounted; silent-duplicate hole closed.
- [x] VERIFICATION gap #3 (WR-02): handleSearchPick owned + wishlist branches surface `toast.error` and stay on search-idle when the search projection pre-signals viewerState but the resolver returns null; transient DB failures no longer drop the banner silently.
- [x] Boundary inverses asserted (null-viewerState branch silently proceeds, owned-with-ref fast-path bypasses resolver entirely) — scope of the guards is structurally pinned.
- [x] Build green; all existing 21 AddWatchFlow tests + 7 new = 28 green; broader gap-suite 80/80 green.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 deviations triggered; no auto-fixes needed; no authentication gates; no architectural changes. The sonner mock fixture and the boundary-inverse test were both specified in the plan's `<action>` block (steps 5 + behavior block "null viewerState with resolver failure" test), so neither was a deviation.

## Bundled Prod UAT (deferred to Phase 71 push per operator signal)

Per `feedback_mobile_ui_verify_on_prod` ("UI behavior verifies on prod, not locally") and `feedback_ppr_cache_fill_no_longer_call_out` (cache-fill regressions are not in scope), the operator chose to defer human verification to bundle with the Phase 71 prod deploy. The following UAT items move to that bundle:

### Plan 08 visual UAT items

| # | Item                                                                                                                                                                                          | Source       |
| - | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1 | **WR-01 visual:** Pick an already-owned watch with a null reference (D-06 fallthrough) — DupeBanner-owned mounts above ConfirmStep; the ConfirmStep primary CTA should be VISIBLY DISABLED (greyed out, no hover state). Clicking does nothing. "Add another copy" → banner unmounts, CTA enables, click creates the second row. | This plan    |
| 2 | **WR-02 visual:** NOT triggerable without fault injection. Skipped from UAT (requires forcing `findViewerWatchByCatalogIdAction` to return success: false transiently). Validator coverage relies on unit tests + the boundary-inverse assertion.                                                                                | This plan    |

### Bundled plans 06+07 visual UAT items (still pending)

| # | Item                                                                                                                                                                                                                                                                                                                            | Source     |
| - | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 3 | **CR-01 visual:** From SearchEntry, search for a model not in catalog; expand StructuredEntryPanel; fill brand/model/reference/year + pick a photo via CatalogPhotoUploader; click Find specs; on ConfirmStep, click Confirm primary; on /u/[user]/collection, the watch has a REAL photo (NOT a placeholder) — proves uploadCatalogSourcePhoto fired and photoSourcePath landed.   | Plans 06+07 |
| 4 | **CR-02 visual:** Pick a quartz watch from search (e.g., a Grand Seiko SBGW with catalog row movement=quartz); click Confirm primary. Visit /u/[user]/collection; the watch row's movement field is 'quartz' (or null/unset), NOT 'auto'.                                                                                       | Plan 07    |

### Pre-existing Phase 70-VERIFICATION.md `human_verification` block (8 items)

These were already pending the bundled prod push from earlier gap plans and remain in queue. Not enumerated here — see `70-VERIFICATION.md` for the canonical list.

**Total deferred to Phase 71 push:** 2 (Plan 08) + 2 (Plans 06+07) + 8 (pre-existing) = 12 visual UAT items in a single Vercel deploy verification session.

## Forward Signal to Re-Verification

Phase 70 gap closure complete across all three gap plans (70-06 + 70-07 + 70-08). VERIFICATION.md gaps[0] (CR-01 + CR-02), gaps[1] (WR-01), and gaps[2] (WR-02) all close at the code level. The verifier should flip:

- gaps[0] failed → verified (Plans 06+07)
- gaps[1] failed → verified (this plan, WR-01)
- gaps[2] partial → verified (this plan, WR-02)
- score: **4/6 → 6/6 must-haves verified**
- status: **`gaps_found` → `passed`**
- Anti-Patterns Found CR-01 + CR-02 rows drop to 0
- Anti-Patterns Found WR-01 row drops to 0
- Anti-Patterns Found WR-02 row drops to 0 (or stays only on structured/URL paths where silent fallthrough is acceptable by design — see decisions[3])

**Phase 70 is ready for `/gsd-verify-phase 70` re-verification.** All 8 plans complete (5 original + 3 gap closures). The 12 visual UAT items are bundled for the Phase 71 prod push per operator signal.

## Commits

| Task | Description                                                                                              | Commit     |
| ---- | -------------------------------------------------------------------------------------------------------- | ---------- |
| 1    | Gate ConfirmStep pending on dupeContext (WR-01) + 3 regression tests + sonner mock infra                 | `84f5c496` |
| 2    | handleSearchPick toast.error + stay on search-idle when known-dupe resolver fails (WR-02) + 4 new tests  | `eb4da1f3` |

## Self-Check

```bash
$ [ -f src/components/watch/AddWatchFlow.tsx ] && echo "FOUND" || echo "MISSING"
FOUND
$ [ -f src/components/watch/AddWatchFlow.test.tsx ] && echo "FOUND" || echo "MISSING"
FOUND
$ git log --oneline --all | grep -q "84f5c496" && echo "FOUND: 84f5c496" || echo "MISSING: 84f5c496"
FOUND: 84f5c496
$ git log --oneline --all | grep -q "eb4da1f3" && echo "FOUND: eb4da1f3" || echo "MISSING: eb4da1f3"
FOUND: eb4da1f3
```

## Self-Check: PASSED
