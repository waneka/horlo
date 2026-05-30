# Phase 73: Owned-Redirect Route Fix - Research

**Researched:** 2026-05-30
**Domain:** Next.js 16 App Router client-side navigation — 1-line slug-source swap in a single React client component
**Confidence:** HIGH

## Summary

Phase 73 is a confirmation-style research pass. Every locked decision in CONTEXT.md was verified against the actual code. The 1-file scope is correct, the line numbers are correct (with a minor offset noted below), the test scaffolding already exists, and no downstream coupling threatens the dead-code removal. The wishlist branch independently uses `resolveDupeContext` and `toast.error` so neither import goes dead; the `confirming` state is still entered by 4 other paths so removing the owned-null-ref entry leaves the state machine consistent.

The 70-UAT.md ROUTE-01 user report ("i think it's using the reference but that doesn't seem to work as the id for /w/[id]") is exactly diagnosed by D-01: `handleSearchPick` pushes `result.reference` (a model number like `REF-001`) into `/w/[ref]`, but the route's defense-in-depth UUID regex at `src/app/w/[ref]/page.tsx:151` rejects any non-UUID with `notFound()` → blank 404. Swapping to `result.catalogId` (always a UUID per `SearchCatalogWatchResult` type) makes the URL pass the guard, and Branch 2's `findViewerWatchByCatalogId` at line 439 detects the viewer's owned row → renders the in-place D-06 owned view at line 472.

**Primary recommendation:** Single plan, ~30-line edit in `AddWatchFlow.tsx` + 2 test assertion swaps in `AddWatchFlow.test.tsx`. No new dependencies, no new patterns, no route-handler change. Verify via (1) `npm run build` exit 0, (2) `vitest run AddWatchFlow.test.tsx`, (3) prod click-through bundled with Phase 74 deploy.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fix Approach**
- **D-01:** Switch `AddWatchFlow.handleSearchPick` owned branch to `router.push('/w/${result.catalogId}')`. `result.catalogId` is always a UUID and always present on `SearchCatalogWatchResult` — eliminates both the 404 (UUID guard passes) and the null-reference edge case (no longer indexed on reference). Hits Branch 2 of `src/app/w/[ref]/page.tsx` which detects ownership via `findViewerWatchByCatalogId` (line 439) and renders the same-user owned view in-place (D-06, line 472).
- **D-02:** Do NOT loosen the `/w/[ref]` UUID guard at `src/app/w/[ref]/page.tsx:151`. The Phase 59 D-04 "UUID-only" invariant stays — adding a third resolution dimension (lookup-by-reference) would expand the route's surface area for a problem that the caller can solve.
- **D-03:** Do NOT add a `findViewerWatchByCatalogIdAction` round-trip from `handleSearchPick` to fetch `watches.id` for Branch 1. Branch 2's in-place owned detection already does this lookup server-side — adding a client-side round-trip just to land on Branch 1 is wasted latency.

**Null-Reference D-06 Fallback**
- **D-04:** DROP the existing D-06 "owned + null reference → confirm-with-banner" branch (`AddWatchFlow.tsx:158-192`). With catalogId-based push the null-reference case ceases to exist for search-picks — `catalogId` is always present. Collapse both owned branches into one early-return push. Remove the associated `resolveDupeContext()` call, `toast.error` path, `setConfirmStatus('owned')` setup, and the `setState({ kind: 'confirming', ... })` for the owned-null-ref case. The D-06 "confirm-with-banner" pattern is still in use on the structured-submit branch (`AddWatchFlow.tsx:267-273`) — leave that alone.
- **D-05:** No `encodeURIComponent` needed on the new push (`catalogId` is a plain UUID — no reserved chars). Keep it anyway for defense-in-depth consistency with the previous code.

**Test Coverage**
- **D-06:** Update `src/components/watch/AddWatchFlow.test.tsx` only:
  - **T-70-01** assertion changes from `expect(router.push).toBe('/w/REF-001')` → `expect(router.push).toBe('/w/cat-owned')`.
  - **T-70-02** is repurposed: instead of asserting DupeBanner-owned mount on null-ref, assert `expect(router.push).toBe('/w/cat-owned-noref')` (both owned cases now redirect identically). Rename the test description to reflect this collapse.
  - No new test cases needed — these two cover both `viewerState === 'owned'` branches that used to exist.
- **D-07:** No `tests/static/` guard. The unit-test assertion deterministically catches a regression that re-introduces reference-based push; a static AST scan of `router.push` is overkill for a 1-line fix in a 1-file scope.
- **D-08:** No E2E test. Project has no Playwright/Cypress harness — adding one for this phase is scope creep.

**Verification**
- **D-09:** Verify in three steps: (1) `npm run build` exits 0 (milestone gate per v8.1 constraints); (2) `vitest run AddWatchFlow.test.tsx` passes with updated assertions; (3) prod click-through after push — open any owned watch in the search combobox, click → confirm `/w/[catalogId]` renders the D-06 in-place owned view (hero + verdict-hidden-on-owned per `verdict_hidden_on_owned_watches` memory + comment thread). If Phase 74 ships in the same session, bundle the deploy.
- **D-10:** No dev-server walkthrough required. Local DB lacks meaningful catalog/owned data for a realistic click-through (test-DB-empty memory). Prod walk is the authoritative manual check.

### Claude's Discretion
- Plan structure (single-plan vs split — likely 1 plan given the 1-file scope).
- Exact commit message wording (follow milestone convention `fix(73): ...`).
- Whether to delete the now-dead `resolveDupeContext` import / `toast` import lines if no other branch uses them (unlikely — wishlist branch still does).

### Deferred Ideas (OUT OF SCOPE)
- **Static AST guard for `router.push` slug provenance** — overkill for 1-file scope this phase; revisit if a future phase reintroduces flexible slug formats and needs a contract guard.
- **Refactor `handleSearchPick` from 4 sequential `if` blocks → a typed `match` on `viewerState`** — out of scope; v8.1 is strict polish, not a refactor milestone.
- **`/w/[ref]` route slug type narrowing** (TypeScript-level "this must be a UUID") — outside Phase 73 scope; Phase 59 contract change.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTE-01 | User can click an "In collection" search result and be redirected to the watch detail page `/w/[ref]` which renders successfully — no 404. Works for any owned watch regardless of which catalog row backs it (consistent with the v7.0 Phase 59 unified-route contract) | Confirmed: `SearchCatalogWatchResult.catalogId: string` (always UUID, always present) at `src/lib/searchTypes.ts:36`; route UUID regex at `src/app/w/[ref]/page.tsx:151` passes catalogId; Branch 2 ownership detection at line 439 + in-place owned render at line 472 already implements the receiver. Caller swap is the entire fix. [VERIFIED: codebase] |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Next.js 16 App Router only** — no `pages/` directory; this phase touches only an existing client component, no new routes. [VERIFIED: CLAUDE.md]
- **No rewrites** — extend existing patterns. The fix is a slug-source swap, not a structural change. [VERIFIED: CLAUDE.md]
- **AGENTS.md warning** — "This is NOT the Next.js you know"; consult `node_modules/next/dist/docs/` before writing new code. This phase uses an existing pattern (`useRouter().push`) already proven in the same file, so no new API surface to verify. [VERIFIED: AGENTS.md]
- **GSD workflow** — all edits go through GSD commands; this is the standard `/gsd-plan-phase` → `/gsd-execute-phase` flow. [VERIFIED: CLAUDE.md]
- **`workflow.use_worktrees = false`** permanently (from memory `feedback_execute_phase_no_worktree_when_db`). Confirmed in `.planning/config.json`. [VERIFIED: codebase]
- **`npm run build` is the gate, NOT `tsc --noEmit` or `vitest run`** — baseline carries ~77 pre-existing test-file errors and at least one pre-existing vitest failure unrelated to this phase. Memory `project_baseline_not_green_build_is_gate`. [VERIFIED: memory + STATE.md]

## Standard Stack

This phase introduces **no new libraries** and adds **no new versions**. All used APIs are already in the file:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next/navigation` (`useRouter`) | bundled with Next 16.2.3 | Client-side navigation via `router.push(href)` | Already in use at `AddWatchFlow.tsx:154` (line being changed) and lines 515, 544, 567, 573, 594, 613, 778, 783 |
| `vitest` + `@testing-library/react` | per `package.json` | Unit test harness | Already in use across `AddWatchFlow.test.tsx` |

**No installation needed.** No version verification required — no new packages.

## Architecture Patterns

### System Architecture Diagram

```
SearchEntry (combobox child)
    │
    │ onPick(result: SearchCatalogWatchResult)
    │   { catalogId: UUID, reference: string|null, viewerState: 'owned'|'wishlist'|null, ... }
    ▼
AddWatchFlow.handleSearchPick (lines 150-249)
    │
    ├── if viewerState === 'owned'  ───────►  router.push(`/w/${result.catalogId}`)  ◄── THIS PHASE
    │                                              │
    │                                              ▼
    │                                       /w/[ref]/page.tsx (UUID guard line 151)
    │                                              │
    │                                              ▼
    │                                       Branch 1: getWatchByIdForViewer(user.id, ref) → null
    │                                              │ (ref is catalog UUID, not watches.id)
    │                                              ▼
    │                                       Branch 2: findViewerWatchByCatalogId (line 439)
    │                                              │
    │                                              ▼
    │                                       D-06: viewerOwnedRow !== null
    │                                              │
    │                                              ▼
    │                                       In-place owned render (line 472+)
    │
    ├── if viewerState === 'wishlist'  ─────►  resolveDupeContext → confirming + DupeBanner-wishlist
    │
    └── if viewerState === null  ───────────►  confirming (no banner)
```

### Component Responsibilities

| Component / Function | Role | This Phase Changes? |
|---------------------|------|---------------------|
| `SearchEntry` (popup) | Surfaces catalog rows + viewerState hydration | No |
| `AddWatchFlow.handleSearchPick` | Routes pick → next state per viewerState | **YES — owned branch only** |
| `AddWatchFlow.resolveDupeContext` helper (line 818) | Wraps `findViewerWatchByCatalogIdAction` | No (still used by wishlist + structured + URL-backup) |
| `/w/[ref]/page.tsx` route handler | Resolves slug → renders watch | No (receiver is correct as-is) |
| `findViewerWatchByCatalogId` DAL | Server lookup of viewer's row for a catalogId | No |

### Pattern 1: Caller-Owned Slug Provenance

**What:** Add-flow caller computes the URL slug from the most reliable identity field on the source object, not from a user-facing name field.

**When to use:** Any client-side navigation into a UUID-only route.

**Example (after the fix):**
```ts
// Source: src/components/watch/AddWatchFlow.tsx (after Phase 73 edit)
if (result.viewerState === 'owned') {
  router.push(`/w/${encodeURIComponent(result.catalogId)}`)
  return
}
```

**Rationale:** `result.catalogId: string` is the catalog row's primary key — always present, always UUID. `result.reference: string | null` is a brand-supplied model number — nullable, non-unique, free-form. Phase 59 D-04 locked the `/w/[ref]` route to UUID-only; the caller must honor that contract.

### Anti-Patterns to Avoid

- **Pushing a user-facing string into a UUID-only route:** This is the exact bug — `result.reference` is a model number like `REF-001`, fails the route's UUID regex at `src/app/w/[ref]/page.tsx:151`, → `notFound()` → 404. The route is correct; the caller was wrong.
- **Loosening the route's UUID guard to "accept reference fallback":** Rejected per D-02. Adds a third resolution dimension (lookup-by-reference) that creates ambiguity (multiple catalog rows can share a reference) and expands the route's surface area.
- **Adding a client-side round-trip from `handleSearchPick` to `findViewerWatchByCatalogIdAction` just to compute `watches.id` for Branch 1:** Rejected per D-03. Branch 2 already does this lookup server-side; client-side duplication is wasted latency.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client navigation | Custom `window.location.href = ...` | `useRouter().push(href)` from `next/navigation` | Already in use everywhere; preserves Router Cache semantics; needed for client-side transitions in App Router |
| URL encoding | Manual char escaping | `encodeURIComponent(slug)` | Standard JS; already in use at line 154 (the line being edited) |
| Ownership resolution | Add client-side action call to compute `watches.id` for Branch 1 | Let `/w/[ref]` Branch 2 detect via `findViewerWatchByCatalogId` | Receiver-side lookup avoids a round-trip; Branch 2 is already wired (line 439 + 472) |

**Key insight:** The entire fix is removing custom complexity (the D-06 confirm-with-banner branch for the null-ref case) by leaning on infrastructure that already exists (Branch 2 of the route handler).

## Runtime State Inventory

> Not applicable — this is a pure caller-side slug change with no rename, no schema change, no data migration, no service config update, no OS registration. Confirmed: nothing in any of the 5 state categories needs touching.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by inspecting the change (only client navigation slug) | — |
| Live service config | None — verified by inspecting the change | — |
| OS-registered state | None — verified by inspecting the change | — |
| Secrets/env vars | None — verified by inspecting the change | — |
| Build artifacts | None — verified by inspecting the change | — |

## Common Pitfalls

### Pitfall 1: Deleting `resolveDupeContext` import or `toast` import

**What goes wrong:** Build / type-check errors when the wishlist branch (still using both) breaks.

**Why it happens:** The owned-branch collapse removes one call site each for `resolveDupeContext` and `toast.error`, but several other call sites remain. A planner that reads "remove the call" as "remove the import" creates a regression.

**How to avoid:** **Do NOT touch imports.** Confirmed call-site inventory after the planned edit:
- `resolveDupeContext` still called at: line 196 (wishlist branch), line 263 (`handleStructuredSubmit`), line 327 (`handleUrlBackup` cache path), line 379 (`handleUrlBackup` fresh-extract path).
- `toast.error` still called at: line 202 (wishlist WR-02), line 502 (`handleConfirmPrimary` addWatch failure), line 556 (`handleMoveToCollection` failure). `toast.success` at line 564.
- `findViewerWatchByCatalogIdAction` import at line 18 is consumed by `resolveDupeContext` (line 821) — still required.

**Warning signs:** TypeScript "unused import" error or any test in the WR-02 suite (`Phase 70 gap plan 08`) failing.

### Pitfall 2: Forgetting that T-70-02's mock-setup line for `findViewerWatchByCatalogIdAction.mockResolvedValueOnce` is no longer needed (and may now leak into a later test)

**What goes wrong:** T-70-02 currently primes `findViewerWatchByCatalogIdAction` with a mock at lines 345-348 because the owned-null-ref branch awaits `resolveDupeContext`. After the collapse, the click never reaches that resolver. The primed mock will leak to whichever test runs next in the same execution order if `vi.clearAllMocks()` doesn't fire (it does, in the `beforeEach` at line 313 — so leak risk is zero in practice, but the prime is now dead code).

**How to avoid:** Remove the `vi.mocked(findViewerWatchByCatalogIdAction).mockResolvedValueOnce(...)` block (lines 345-348) when repurposing T-70-02. The assertion changes from `await screen.findByTestId('dupe-banner-owned')` to a `pushSpy` assertion mirroring T-70-01's shape.

**Warning signs:** Dead mock setup in the test would not fail anything but signals incomplete cleanup.

### Pitfall 3: WR-02 Test A (line 835) will fail after the collapse

**What goes wrong:** `WR-02 — search-pick owned (D-06 null-ref fallthrough) with resolver failure → toast.error + stay on search-idle` (lines 835-852) explicitly asserts the owned-null-ref resolver-failure path. After D-04, that branch ceases to exist — `Pick owned no-ref` will redirect via `router.push('/w/cat-owned-noref')` regardless of the resolver, so `toast.error` is never called and `findByTestId('search-entry')` will succeed but `pushSpy` will have been called.

**How to avoid:** This test must also be **deleted** as part of the D-06 update (or repurposed — but the WR-02 owned-null-ref case no longer exists, so deletion is correct). CONTEXT.md D-06 only enumerates T-70-01 and T-70-02; the WR-02 Test A deletion is an **implicit consequence** the planner must surface.

**Warning signs:** `vitest run AddWatchFlow.test.tsx` failing on `WR-02 — search-pick owned (D-06 null-ref fallthrough) with resolver failure` after the production code edit but before the test deletion.

**Note:** WR-02 Test B (wishlist resolver failure, line 855), Test C (null viewerState, line 876), and Test D (owned-with-ref fast-path, line 894) all remain valid. Only Test A is invalidated. WR-02 Test D's assertion `expect(pushSpy).toHaveBeenCalledWith('/w/REF-001')` also needs updating to `'/w/cat-owned'` (same logic as T-70-01).

### Pitfall 4: WR-01 Test B mounts via `Pick owned no-ref` — also breaks

**What goes wrong:** `WR-01 Test B` at line 762 (`ConfirmStep primary CTA is disabled when owned dupeContext is set; clicking does NOT call addWatch`) clicks `Pick owned no-ref` and expects `findByTestId('dupe-banner-owned')` to mount. After D-04, that click redirects via `router.push` instead — the banner never mounts.

**How to avoid:** WR-01 Test B must mount the owned banner via a path that still produces it after the collapse. The structured-submit path is the only remaining owned-banner producer (`handleStructuredSubmit` lines 263-289 — calls `resolveDupeContext`, sets `confirmStatus` to `'owned'` when the dupe is owned, mounts the banner). Pivot Test B to use the `Submit structured` button + mock a `status: 'owned'` resolver response (the same pattern as T-70-03 at line 358). **OR** delete Test B entirely if WR-01 Test C (line 781, structured-submit + owned-dupe + Add another copy) already covers the disabled-CTA + no-addWatch outcome — quick read of Test C confirms it asserts both `.toBeDisabled()` and the `Add another copy` re-enable path, but does NOT assert the "clicking the disabled CTA doesn't call addWatch" guard that Test B uniquely covers. **Recommendation: pivot WR-01 Test B to structured-submit path; preserve the click-doesn't-fire-addWatch assertion.**

**Warning signs:** `vitest run AddWatchFlow.test.tsx` failing on `WR-01 — ConfirmStep primary CTA is disabled when owned dupeContext is set; clicking does NOT call addWatch` after the production edit.

### Pitfall 5: Asserting only the push (not the absence of the banner)

**What goes wrong:** Per memory `feedback_test_assert_disappearance_too`, T-70-01 already asserts `expect(screen.queryByTestId('confirm-step')).not.toBeInTheDocument()`. The repurposed T-70-02 should mirror this — assert both directions: `pushSpy.toHaveBeenCalledWith('/w/cat-owned-noref')` AND `screen.queryByTestId('confirm-step').not.toBeInTheDocument()` AND `screen.queryByTestId('dupe-banner-owned').not.toBeInTheDocument()`.

**How to avoid:** Plan must specify all three assertions in T-70-02.

## Code Examples

Verified patterns from the codebase:

### Before (current AddWatchFlow.tsx lines 152-192)
```ts
// Source: src/components/watch/AddWatchFlow.tsx:152-192 (current)
// D-05 — owned + non-null reference → /w/[ref] redirect.
if (result.viewerState === 'owned' && result.reference) {
  router.push(`/w/${encodeURIComponent(result.reference)}`)
  return
}
// D-06 — owned + null reference → confirm with owned-banner.
if (result.viewerState === 'owned') {
  console.warn('[Phase 70] dupeContext: owned existing → confirm-with-banner (null reference fallback)')
  const dupeRow = await resolveDupeContext(result.catalogId)
  if (!dupeRow) {
    toast.error("Couldn't check your collection — try again")
    return
  }
  const dupeContext: DupeContext = {
    existingWatchId: dupeRow.id,
    existingStatus: dupeRow.status,
    existingReference: dupeRow.reference,
  }
  const extracted = searchResultToExtracted(result)
  setConfirmStatus('owned')
  setConfirmReference(result.reference ?? '')
  setConfirmYear(undefined)
  setConfirmPrice(undefined)
  setState({
    kind: 'confirming',
    catalogId: result.catalogId,
    extracted,
    pickedResult: result,
    dupeContext,
    pending: false,
    photoBlob: null,
  })
  return
}
```

### After (per D-01 + D-04)
```ts
// Source: src/components/watch/AddWatchFlow.tsx (after Phase 73 edit)
// Phase 73 ROUTE-01 — both owned branches collapse to a single redirect.
// result.catalogId is always a UUID and always present (SearchCatalogWatchResult contract),
// so /w/[ref] UUID guard passes → Branch 2 finds the viewer's row via
// findViewerWatchByCatalogId → in-place D-06 owned render (no client round-trip).
if (result.viewerState === 'owned') {
  router.push(`/w/${encodeURIComponent(result.catalogId)}`)
  return
}
```

### T-70-01 assertion swap (test file lines 333-341)
```ts
// Source: src/components/watch/AddWatchFlow.test.tsx (after Phase 73 edit)
// T-70-01 — owned-pick → router.push catalogId; no confirm screen.
it('T-70-01 — owned-pick → router.push("/w/cat-owned"); no confirm screen', async () => {
  renderFlow()
  fireEvent.click(screen.getByText('Pick owned'))
  await waitFor(() => {
    expect(pushSpy).toHaveBeenCalledWith('/w/cat-owned')
  })
  expect(screen.queryByTestId('confirm-step')).not.toBeInTheDocument()
})
```

### T-70-02 repurposed (test file lines 343-354)
```ts
// Source: src/components/watch/AddWatchFlow.test.tsx (after Phase 73 edit)
// T-70-02 — owned-pick (null reference) → also router.push catalogId (D-04 collapse).
it('T-70-02 — owned-pick with null reference → router.push("/w/cat-owned-noref"); no confirm, no banner', async () => {
  renderFlow()
  fireEvent.click(screen.getByText('Pick owned no-ref'))
  await waitFor(() => {
    expect(pushSpy).toHaveBeenCalledWith('/w/cat-owned-noref')
  })
  expect(screen.queryByTestId('confirm-step')).not.toBeInTheDocument()
  expect(screen.queryByTestId('dupe-banner-owned')).not.toBeInTheDocument()
})
```

### WR-02 Test D assertion update (test file line 898)
```ts
// Source: src/components/watch/AddWatchFlow.test.tsx (after Phase 73 edit)
// WR-02 inverse Test D: owned-pick fast-path — assertion updated to catalogId.
expect(pushSpy).toHaveBeenCalledWith('/w/cat-owned')  // was: '/w/REF-001'
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Push `result.reference` (model number) into `/w/[ref]` | Push `result.catalogId` (UUID) into `/w/[ref]` | This phase | Aligns caller with Phase 59 D-04 UUID-only route contract |
| Two owned branches (with-ref redirect + null-ref confirm-with-banner) | One owned branch (single redirect for all owned) | This phase | Removes a state machine entry; simplifies handleSearchPick by ~35 lines |

**Deprecated/outdated:**
- The Phase 70 D-06 "owned + null reference → confirm-with-banner" pattern on the search-pick path. Still in use on `handleStructuredSubmit` and `handleUrlBackup` (different code paths, different rationale — no viewerState pre-signal there). Only the search-pick instantiation is removed.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | (none) | — | All claims in this research are verified directly against the codebase or quoted from CONTEXT.md. No assumed/training-data claims. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

## Open Questions (RESOLVED)

1. **Should WR-02 Test A (line 835) be deleted or repurposed?**
   - What we know: The "owned-null-ref + resolver failure → toast.error" path ceases to exist after D-04. The test will fail without code change.
   - What's unclear: CONTEXT.md D-06 enumerates only T-70-01 + T-70-02; the WR-02 Test A consequence is implicit.
   - Recommendation: **Delete** WR-02 Test A. The wishlist version (Test B, line 855) preserves the WR-02 invariant for the only remaining `viewerState`-pre-signal-with-resolver-call path. Surface this in the plan as a documented deletion.

2. **Should WR-01 Test B (line 762) be pivoted or deleted?**
   - What we know: It mounts the owned banner via `Pick owned no-ref`, which after D-04 no longer mounts the banner.
   - What's unclear: Whether WR-01 Test C (line 781) already covers the "click disabled CTA → no addWatch" assertion. Read confirms Test C does NOT assert that — it only asserts `.toBeDisabled()` + the re-enable path. Test B uniquely covers the negative-action assertion.
   - Recommendation: **Pivot** WR-01 Test B to use the `Submit structured` button (mocked with `status: 'owned'` resolver response) so the owned banner still mounts; preserve the "click disabled CTA → addWatch not called" assertion. Surface this in the plan as a required pivot.

3. **Should T-70-02's redundant `findViewerWatchByCatalogIdAction.mockResolvedValueOnce` setup (lines 345-348) be removed?**
   - What we know: After the collapse, T-70-02 never reaches the resolver; the prime is dead code.
   - What's unclear: Nothing — `vi.clearAllMocks()` in `beforeEach` prevents leakage either way.
   - Recommendation: **Yes, remove** for hygiene. Trivial.

## Environment Availability

> Not applicable — this phase is code-only. No external tools, services, runtimes, or CLIs invoked beyond what's already used by `npm run build` and `vitest`, both of which are confirmed working in the repo.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (per `package.json`); React Testing Library |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npx vitest run src/components/watch/AddWatchFlow.test.tsx` |
| Full suite command | `npm run test` (carries pre-existing baseline failures — see baseline memory) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-01 | Owned-pick with non-null reference → router.push('/w/cat-owned') | unit (T-70-01 update) | `npx vitest run src/components/watch/AddWatchFlow.test.tsx -t "T-70-01"` | YES (assertion updates) |
| ROUTE-01 | Owned-pick with null reference → router.push('/w/cat-owned-noref') (no confirm, no banner) | unit (T-70-02 repurpose) | `npx vitest run src/components/watch/AddWatchFlow.test.tsx -t "T-70-02"` | YES (assertion + description change) |
| ROUTE-01 | Prod click-through — owned watch from search popup renders detail page (D-06 in-place view) | manual / human_needed | n/a (prod walk) | n/a |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/watch/AddWatchFlow.test.tsx`
- **Per wave merge:** `npm run build` (the milestone gate per memory)
- **Phase gate:** `npm run build` green + AddWatchFlow.test.tsx green + prod click-through after deploy (bundled with Phase 74 if same session)

### Wave 0 Gaps
- None — existing test infrastructure covers all phase requirements. Two existing test assertions update + 1 dead test deletion (WR-02 Test A) + 1 test pivot (WR-01 Test B) + 1 assertion update on WR-02 Test D. No new test files, no new framework install.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — this phase changes a client navigation slug; auth is unchanged |
| V3 Session Management | no | n/a |
| V4 Access Control | yes (indirect) | The route's existing access control is preserved — `getWatchByIdForViewer` + `findViewerWatchByCatalogId` are user-scoped; switching from a per-user `watches.id` push to a catalog UUID push does NOT expose any other user's data because Branch 2's lookup is also viewer-scoped. **No IDOR risk introduced.** |
| V5 Input Validation | yes | The route's UUID regex at `src/app/w/[ref]/page.tsx:151` validates the slug; catalogId is a UUID, so it passes the same gate. `encodeURIComponent` is preserved per D-05 for defense-in-depth. |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for Next.js client navigation

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL injection via untrusted slug | Tampering | `encodeURIComponent` (already in use); UUID regex at route handler (already in place) |
| Catalog UUID enumeration → infer ownership | Information Disclosure | Branch 2's `findViewerWatchByCatalogId` is viewer-scoped; only the viewer's own row is returned. Enumeration reveals only viewer's own ownership status (no other-user data leak). |

**No new security controls needed.** The fix swaps one valid slug source for another — both are server-validated.

## Sources

### Primary (HIGH confidence)
- `src/components/watch/AddWatchFlow.tsx` — read in full; line numbers in CONTEXT.md confirmed (150-249 is the `handleSearchPick` body; the owned-with-ref branch is 152-156, the owned-null-ref branch is 158-192).
- `src/components/watch/AddWatchFlow.test.tsx` — read in full; T-70-01 at lines 333-341, T-70-02 at lines 343-354, `Pick owned` button at lines 106-121, `Pick owned no-ref` button at lines 122-137. Additional impacted tests identified: WR-01 Test B (lines 762-777) and WR-02 Test A (lines 835-852) + WR-02 Test D (lines 894-902).
- `src/app/w/[ref]/page.tsx` — UUID regex at line 151 confirmed; Branch 2 `findViewerWatchByCatalogId` at line 439 confirmed; D-06 in-place owned render at line 472 confirmed.
- `src/lib/searchTypes.ts` — `SearchCatalogWatchResult.catalogId: string` at line 36 confirmed (non-nullable); `reference: string | null` at line 39 confirmed (nullable).
- `.planning/REQUIREMENTS.md` — ROUTE-01 at line 22 quoted verbatim.
- `.planning/ROADMAP.md` — Phase 73 success criteria at lines 244-252 quoted verbatim.
- `.planning/milestones/v8.0-phases/70-addwatchflow-state-machine-rewrite-dupe-wiring/70-UAT.md` — ROUTE-01 user report at lines 91-109 quoted verbatim.
- `.planning/phases/73-owned-redirect-route-fix/73-CONTEXT.md` — locked decisions copied verbatim.

### Secondary (MEDIUM confidence)
- Memory `project_baseline_not_green_build_is_gate` — `npm run build` is the gate.
- Memory `feedback_execute_phase_no_worktree_when_db` — worktrees disabled.
- Memory `verdict_hidden_on_owned_watches` — D-06 in-place owned view hides verdict for same-user.
- Memory `feedback_test_assert_disappearance_too` — assert both mount + dismiss.

### Tertiary (LOW confidence)
- None. This is a confirmation-style pass — every claim was verified against actual code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; existing APIs in use at the edit site itself.
- Architecture: HIGH — receiver route confirmed at exact line numbers; data flow traced end-to-end.
- Pitfalls: HIGH — all 5 pitfalls derived from reading the actual file, not training data. Pitfalls 3 + 4 (WR-02 Test A invalidation, WR-01 Test B coupling) are findings CONTEXT.md does not enumerate.

**Research date:** 2026-05-30
**Valid until:** ~2026-06-13 (14 days; stable polish target, but planning should happen soon — fresh context wins).
