# Phase 73: Owned-Redirect Route Fix - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can click an "In collection" search result in the add-watch combobox and arrive at a working watch detail page — no 404. The fix replaces the current `router.push('/w/${result.reference}')` (which pushes a model-number string into a UUID-only route guard) with `router.push('/w/${result.catalogId}')` so the unified `/w/[ref]` route's Branch 2 catalog-UUID path resolves the viewer's owned row in-place via the existing D-06 `findViewerWatchByCatalogId` detection.

**Scope is strictly ROUTE-01** — the search-pick owned-redirect bug. No changes to the route handler itself (Phase 59 D-04 contract preserved), no changes to non-owned search-pick branches, no changes to structured-submit or URL-backup flows.

</domain>

<decisions>
## Implementation Decisions

### Fix Approach
- **D-01:** Switch `AddWatchFlow.handleSearchPick` owned branch to `router.push('/w/${result.catalogId}')`. `result.catalogId` is always a UUID and always present on `SearchCatalogWatchResult` — eliminates both the 404 (UUID guard passes) and the null-reference edge case (no longer indexed on reference). Hits Branch 2 of `src/app/w/[ref]/page.tsx` which detects ownership via `findViewerWatchByCatalogId` (line 439) and renders the same-user owned view in-place (D-06, line 472).
- **D-02:** Do NOT loosen the `/w/[ref]` UUID guard at `src/app/w/[ref]/page.tsx:151`. The Phase 59 D-04 "UUID-only" invariant stays — adding a third resolution dimension (lookup-by-reference) would expand the route's surface area for a problem that the caller can solve.
- **D-03:** Do NOT add a `findViewerWatchByCatalogIdAction` round-trip from `handleSearchPick` to fetch `watches.id` for Branch 1. Branch 2's in-place owned detection already does this lookup server-side — adding a client-side round-trip just to land on Branch 1 is wasted latency.

### Null-Reference D-06 Fallback
- **D-04:** DROP the existing D-06 "owned + null reference → confirm-with-banner" branch (`AddWatchFlow.tsx:158-192`). With catalogId-based push the null-reference case ceases to exist for search-picks — `catalogId` is always present. Collapse both owned branches into one:
  ```ts
  if (result.viewerState === 'owned') {
    router.push(`/w/${result.catalogId}`)
    return
  }
  ```
  Remove the associated `resolveDupeContext()` call, `toast.error('Couldn't check your collection — try again')` path, `setConfirmStatus('owned')` setup, and the `setState({ kind: 'confirming', ... })` for the owned-null-ref case. The D-06 "confirm-with-banner" pattern is still in use on the structured-submit branch (`AddWatchFlow.tsx:267-273`) — leave that alone.
- **D-05:** No `encodeURIComponent` needed on the new push (`catalogId` is a plain UUID — no reserved chars). Keep it anyway for defense-in-depth consistency with the previous code.

### Test Coverage
- **D-06:** Update `src/components/watch/AddWatchFlow.test.tsx` only:
  - **T-70-01** assertion changes from `expect(router.push).toBe('/w/REF-001')` → `expect(router.push).toBe('/w/cat-owned')`.
  - **T-70-02** is repurposed: instead of asserting DupeBanner-owned mount on null-ref, assert `expect(router.push).toBe('/w/cat-owned-noref')` (both owned cases now redirect identically). Rename the test description to reflect this collapse.
  - No new test cases needed — these two cover both `viewerState === 'owned'` branches that used to exist.
- **D-07:** No `tests/static/` guard. The unit-test assertion deterministically catches a regression that re-introduces reference-based push; a static AST scan of `router.push` is overkill for a 1-line fix in a 1-file scope.
- **D-08:** No E2E test. Project has no Playwright/Cypress harness — adding one for this phase is scope creep.

### Verification
- **D-09:** Verify in three steps: (1) `npm run build` exits 0 (milestone gate per v8.1 constraints); (2) `vitest run AddWatchFlow.test.tsx` passes with updated assertions; (3) prod click-through after push — open any owned watch in the search combobox, click → confirm `/w/[catalogId]` renders the D-06 in-place owned view (hero + verdict-hidden-on-owned per `verdict_hidden_on_owned_watches` memory + comment thread). If Phase 74 ships in the same session, bundle the deploy.
- **D-10:** No dev-server walkthrough required. Local DB lacks meaningful catalog/owned data for a realistic click-through (test-DB-empty memory). Prod walk is the authoritative manual check.

### Claude's Discretion
- Plan structure (single-plan vs split — likely 1 plan given the 1-file scope).
- Exact commit message wording (follow milestone convention `fix(73): ...`).
- Whether to delete the now-dead `resolveDupeContext` import / `toast` import lines if no other branch uses them (unlikely — wishlist branch still does).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ROUTE-01 defect source
- `.planning/REQUIREMENTS.md` §Routing — ROUTE-01 user-centric requirement (line 22)
- `.planning/milestones/v8.0-phases/70-addwatchflow-state-machine-rewrite-dupe-wiring/70-UAT.md` §Gaps — verbatim user report + planner hypothesis (lines 91-109)
- `.planning/ROADMAP.md` §Phase 73 — goal + 3 success criteria + milestone constraints (lines 244-252)

### Files modified by this phase
- `src/components/watch/AddWatchFlow.tsx` §handleSearchPick (lines 150-249) — owned-branch logic change
- `src/components/watch/AddWatchFlow.test.tsx` §T-70-01 + T-70-02 (lines 333-355) — assertion updates

### Files read but NOT modified
- `src/app/w/[ref]/page.tsx` — read to confirm Branch 2 UUID guard + D-06 in-place owned render path (no change to route handler)
- `src/lib/searchTypes.ts` §SearchCatalogWatchResult — `catalogId: string` (always UUID, always present); `reference: string | null` (model number, nullable)

### Prior phase contracts that constrain this fix
- Phase 59 D-04 unified `/w/[ref]` route — UUID-only resolution (per-user `watches.id` Branch 1, catalog UUID Branch 2). NOT loosened.
- Phase 59 D-02/D-08 — zero server redirects (Router Cache poisoning avoidance). Client-side `router.push` is fine; the route renders in-place, never redirects.
- Phase 70 D-05/D-06 — search-pick owned-branch state machine. D-05 (owned + reference → redirect) is the broken branch being fixed. D-06 (owned + null-ref → confirm-with-banner) becomes dead code on the search-pick path.
- Phase 70 WR-02 — `resolveDupeContext` null-return surfaces `toast.error` instead of silent fallthrough. WR-02 still applies on the wishlist branch (untouched); the owned branch's WR-02 logic is removed alongside D-06.

### Milestone constraints
- `npm run build` (exit 0) is the gate — NOT `tsc --noEmit` or `vitest run` (pre-existing failures unrelated to this phase). Memory: `project_baseline_not_green_build_is_gate`.
- `workflow.use_worktrees = false` permanently — `.env.local` unavailable in worktrees. Memory: `feedback_execute_phase_no_worktree_when_db`.

### Relevant operational memory (durable)
- `project_v7_0_watch_photos` — Variant C unified `/w/[ref]` route is a HARD CUTOVER (legacy routes deleted, no redirect). Confirms the route handler is the only landing surface and cannot fall back to `/watch/[id]`.
- `project_verdict_hidden_on_owned_watches` — `WatchDetailContextBlock` returns null for owned same-user view. Expected after the redirect; the prod click-through walk-through should confirm hero renders without the Collection Fit card.
- `feedback_ppr_cache_fill_no_longer_call_out` — #419 / cache-fill family is resolved infrastructure. Do NOT bake soft-nav #419 checks into the UAT for this phase. The route's static-shell opt-out (`await connection()` + `unstable_instant = false`) is already in place.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`SearchCatalogWatchResult.catalogId: string`** (`src/lib/searchTypes.ts:38`) — the UUID we're switching to. Already populated by the DAL; no new field needed.
- **`/w/[ref]` Branch 2 D-06 in-place owned render** (`src/app/w/[ref]/page.tsx:472-677`) — already detects `viewerOwnedRow` via `findViewerWatchByCatalogId(user.id, ref)` and renders the full owned view (hero + comments + spec trail + rails) without any redirect. The fix is purely a caller change; the receiver is already wired.
- **Test scaffolding `Pick owned` / `Pick owned no-ref` buttons** (`AddWatchFlow.test.tsx:106-137`) — already fire `onPick` with `catalogId: 'cat-owned'` / `'cat-owned-noref'`. Assertions update; mock setup doesn't.
- **`router.push` Next.js client navigation mock** — already in place at `AddWatchFlow.test.tsx` (used by T-70-01). No new mocks needed.

### Established Patterns
- **Client-side `router.push` from add-flow → in-place owned render** (Phase 70 D-05) — the pattern we're keeping, just fixing the slug source. No new navigation strategy introduced.
- **Single-source-of-truth for ownership resolution** (Phase 59 D-04) — the route handler does the lookup, callers just supply a UUID. This phase aligns with that pattern by deferring ownership detection to the route's existing `findViewerWatchByCatalogId` call.
- **Branch collapse when an edge case dissolves** (similar to Phase 70 gap-plan-07 CR-01 collapse) — when the null-reference case ceases to exist (no longer a URL component), the dedicated branch goes too.

### Integration Points
- **Caller:** `handleSearchPick` (`AddWatchFlow.tsx:150-249`) — the only edit site.
- **Receiver:** `/w/[ref]/page.tsx` Branch 2 D-06 — no change. The route already renders D-06 correctly for catalog-UUID requests from viewers who own a row; the bug was purely on the caller never sending it the right slug.
- **State machine ripple:** zero. With both owned branches collapsing to an early-return `router.push`, no state transitions originate from the owned search-pick anymore. The `confirming` state is entered only by structured-submit, URL-backup, and wishlist + null-viewerState search-picks.

</code_context>

<specifics>
## Specific Ideas

- "i think it's using the reference but that doesn't seem to work as the id for /w/[id]" — verbatim user diagnosis from 70-UAT.md, confirmed correct. Reference is a model number; `/w/[ref]` accepts only UUIDs.
- Prod click-through verification on a real owned watch is the authoritative pass — bundles with Phase 74 deploy if same session.

</specifics>

<deferred>
## Deferred Ideas

- **Static AST guard for `router.push` slug provenance** — overkill for 1-file scope this phase; revisit if a future phase reintroduces flexible slug formats and needs a contract guard.
- **Refactor `handleSearchPick` from 4 sequential `if` blocks → a typed `match` on `viewerState`** — out of scope; v8.1 is strict polish, not a refactor milestone.
- **`/w/[ref]` route slug type narrowing** (TypeScript-level "this must be a UUID") — outside Phase 73 scope; Phase 59 contract change.

</deferred>

---

*Phase: 73-owned-redirect-route-fix*
*Context gathered: 2026-05-30*
