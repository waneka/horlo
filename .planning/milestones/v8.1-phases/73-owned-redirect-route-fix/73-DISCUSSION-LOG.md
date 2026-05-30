# Phase 73: Owned-Redirect Route Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 73-owned-redirect-route-fix
**Areas discussed:** Fix approach, Owned + null-ref fallback, Test coverage, Verify scope

---

## Fix approach — catalogId vs other

| Option | Description | Selected |
|--------|-------------|----------|
| Push /w/[catalogId] (Recommended) | Change AddWatchFlow.handleSearchPick to router.push(`/w/${result.catalogId}`). Branch 2 of the route already detects ownership via findViewerWatchByCatalogId and renders D-06 in-place owned view. catalogId always present → no edge case. Aligns with Phase 59 D-04 contract. | ✓ |
| Loosen /w/[ref] guard | Allow non-UUID slugs and add a 3rd resolution dimension (lookup-by-reference). Breaks the Phase 59 D-04 "UUID-only" invariant; adds DAL surface area; doesn't structurally fix the null-reference edge case. | |
| Fetch watches.id, push that | Call findViewerWatchByCatalogIdAction in handleSearchPick, then push /w/${watches.id}. Hits Branch 1 directly. Adds extra round-trip on every owned pick — worse latency than Option 1. | |

**User's choice:** Push /w/[catalogId]
**Notes:** Architecturally aligns with the unified-route D-04 contract; eliminates the null-reference edge case as a structural side effect.

---

## Owned + null-ref D-06 fallback — keep or drop

| Option | Description | Selected |
|--------|-------------|----------|
| Drop the branch (Recommended) | Collapse both owned branches into one: `if (result.viewerState === 'owned') router.push(/w/${result.catalogId})`. Removes resolveDupeContext call, toast.error path, setConfirmStatus('owned') setup. Simpler state machine, fewer code paths, fewer tests. | ✓ |
| Keep it as defensive code | Leave the branch in place behind a guard (e.g. only triggered if catalogId is unexpectedly null). Adds paranoia tax: dead code that confuses future readers and still needs a test covering it. | |

**User's choice:** Drop the branch
**Notes:** The D-06 confirm-with-banner pattern is still in use on the structured-submit branch (`AddWatchFlow.tsx:267-273`) — leave that alone. Only the search-pick owned-null-ref branch is collapsed.

---

## Test coverage — regression scope

| Option | Description | Selected |
|--------|-------------|----------|
| Unit tests only (Recommended) | Update T-70-01 to assert router.push('/w/cat-owned'). Update T-70-02 to assert router.push('/w/cat-owned-noref') (no longer DupeBanner). Delete obsolete D-06 confirm-with-banner assertion. jsdom catches the slug source change deterministically. | ✓ |
| Unit + static guard | Above plus a tests/static/ guard that scans for router.push(`/w/${...}`) in src/ and fails if the slug source variable isn't UUID-shaped. More upfront cost; durable insurance. | |
| Unit + static + E2E | Add a Playwright (or similar) end-to-end test. Highest confidence, but the project doesn't have an E2E harness — scope creep. | |

**User's choice:** Unit tests only
**Notes:** Two test updates in one file. No new test cases needed.

---

## Verify scope — unit only or prod click-through

| Option | Description | Selected |
|--------|-------------|----------|
| Build + unit + prod click-through (Recommended) | npm run build (exit 0 gate) → jsdom unit tests pass → push to main → 1 prod click-through on real owned watch confirms /w/[catalogId] renders. Bundles cleanly with Phase 74 deploy if timing aligns. | ✓ |
| Build + unit only | Skip prod walk. Unit assertion + UUID-shaped catalogId on result schema is deterministic; route works for catalog UUIDs (Phase 59 verified). | |
| Build + unit + dev-server walk | Add local /watch/new walkthrough on dev server before merge. Local DB might not have meaningful data (test-DB-empty memory). | |

**User's choice:** Build + unit + prod click-through
**Notes:** Prod walk is the authoritative manual check; local DB lacks meaningful catalog/owned data.

---

## Claude's Discretion

- Plan structure (single-plan vs split — likely 1 plan given the 1-file scope)
- Exact commit message wording (follow milestone convention `fix(73): ...`)
- Whether to delete the now-dead `resolveDupeContext` / `toast` imports if no other branch uses them (likely no — wishlist branch still does)

## Deferred Ideas

- Static AST guard for `router.push` slug provenance — overkill for 1-file scope this phase
- Refactor `handleSearchPick` from 4 sequential `if` blocks → typed `match` on `viewerState` — out of scope; v8.1 is strict polish
- `/w/[ref]` route slug type narrowing (TypeScript "this must be a UUID") — outside Phase 73 scope; Phase 59 contract change
