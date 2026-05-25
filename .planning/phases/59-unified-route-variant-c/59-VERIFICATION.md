---
phase: 59-unified-route-variant-c
verified: 2026-05-25T00:45:00Z
status: human_needed
score: 6/6 must-haves verified (all roadmap success criteria)
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Visit another user's /w/[ref] on prod and confirm no edit/delete/mark-worn actions appear"
    expected: "Owner-only write surfaces absent for non-owner; only the viewer's framing (cross-user) renders"
    why_human: "UI visibility of owner-gated actions is prod-only (empty local test DB skips e2e); structural code verified automated"
  - test: "Navigate to /w/[ref] on a mobile device for both an owned watch and a cross-user watch"
    expected: "Both resolution branches render correctly on mobile; no layout breakage"
    why_human: "Mobile render behavior is verified on prod per project convention; not automatable locally"
  - test: "Soft-navigate (client-side) from any page to a stale /watch/[id] or /catalog/[catalogId] URL on prod"
    expected: "Hard 404 is served; no Router Cache poisoning (no stale page served, no client-side redirect loop)"
    why_human: "Next 16 Router Cache soft-nav behavior is prod-only; cannot be reproduced locally"
---

# Phase 59: Unified Route (Variant C) Verification Report

**Phase Goal:** Every watch is reachable at a single canonical `/w/[ref]` URL; the two legacy detail routes (`/watch/[id]`, `/catalog/[catalogId]`) are removed (hard 404, no redirect); the edit form moves to `/w/[ref]/edit`; every internal link to a watch is re-pointed to `/w/[ref]`; and a build-failing CI guard catches any surviving legacy detail-path link literal.
**Verified:** 2026-05-25T00:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Visiting `/w/[ref]` resolves correctly whether the ref is a per-user watch id or a catalog id, and shows appropriate owner vs cross-user framing | VERIFIED | `src/app/w/[ref]/page.tsx` exists (510 lines), implements try-per-user-then-catalog (D-04) via `getWatchByIdForViewer` at line 66 → `getCatalogById` at line 227; framing dispatch `isOwner ? 'same-user' : 'cross-user'` at line 130 (D-07). D-06 owned-via-catalog branch at line 259 via `findViewerWatchByCatalogId`. `viewerCanEdit={isOwner}` at lines 148, 310. Zero `redirect()` calls — only `notFound` imported. UUID guard at line 57. |
| 2 | Visiting `/watch/[id]` or `/catalog/[catalogId]` returns a 404 (no redirect), so any un-migrated link fails loudly | VERIFIED | `test ! -f "src/app/watch/[id]/page.tsx"` → DELETED. `test ! -f "src/app/watch/[id]/edit/page.tsx"` → DELETED. `test ! -f "src/app/catalog/[catalogId]/page.tsx"` → DELETED. Routes 404 by absence (D-02). `/watch/new/page.tsx` preserved. The remaining `redirect()` calls in `src/app/` are all on unrelated routes (admin, insights, wears, watch/new auth). |
| 3 | The CI build fails if any internal href or link literal still targets a legacy `/watch/[…]` or `/catalog/[…]` watch path | VERIFIED | `tests/static/legacy-watch-routes.test.ts` GREEN: 347/347 PASS. ROUTE-02 block (3 file-existence assertions) + ROUTE-03 block (344 per-file source-scan assertions). `package.json` has `"prebuild": "vitest run tests/static/legacy-watch-routes.test.ts"`. Build-gate proven: planted `/watch/${'x'}` → `npm run build` exits 1; removed → exits 0 (documented in 59-03-SUMMARY.md). ALLOWLIST verified: `/watch/new` is excluded; non-watch paths (`/explore/lists/`, `/admin/lists/`, `/wear/`) not flagged. |
| 4 | All internal surfaces — grid cards, search rows, discovery rails, add-watch deep-links, computed notification deep-links — point at `/w/[ref]` | VERIFIED | Comprehensive grep across `src/` shows zero remaining `/watch/${` or `/catalog/${` link literals (excluding `/watch/new`). All 26 sites confirmed: Group A (12 detail links), Group B (3 edit links), Group C (7 catalog links), computed deep-link (NotificationRow:142 `return \`/w/${watchId}\``). `/watch/new` has 41 allowlisted references — all correctly preserved. |
| 5 | Owner-only actions (edit, delete, mark-worn) remain available only to the authenticated owner on the unified route | PARTIAL — structural VERIFIED; UI behavior human_needed | Structural: `viewerCanEdit={isOwner}` sourced from server-authoritative `getWatchByIdForViewer` result (not client-derived). `isOwner` drives `viewerCanEdit` on both Branch 1 (line 148) and Branch 2 D-06 (line 310). `/w/[ref]/edit` gated by `getWatchById(user.id, ref)` — non-owner resolves null → `notFound()`. UI visibility of write actions for non-owners requires prod verification (see Human Verification section). |
| 6 | Privacy gate (two-layer) and per-viewer framing preserved with no regression | VERIFIED | `getWatchByIdForViewer(user.id, ref)` called unchanged at line 66 — the function's two-layer gate (RLS outer + WHERE inner on profilePublic + per-tab visibility) is not modified by this phase. Code review (59-REVIEW.md) verdict: "No IDOR or authorization bypass found." `findViewerWatchByCatalogId` doubly-scoped by `userId AND catalogId AND status='owned'` (BUG-01 fix at `watches.ts:257`). WR-02 (`ORDER BY desc(watches.createdAt)` for deterministic multi-owned resolution) was fixed — confirmed at `watches.ts:262`. |

**Score:** 6/6 roadmap success criteria verified at the structural code level.

---

### Deferred Items

None. All phase-59-scoped work is complete. Phase 64 (IA Redesign) will definitively resolve OtherOwnersRoster/CatalogPageActions visibility per viewer state (gated `!isOwner` for now per spike §4.D interim decision — correct and intentional).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/w/[ref]/page.tsx` | Unified watch-detail route — UUID guard, two-branch resolution, B1-invariant RSC composition | VERIFIED | 510 lines. Contains `await params`, `getWatchByIdForViewer`, `getCatalogById`, `findViewerWatchByCatalogId`, `viewerCanEdit={isOwner}`, framing dispatch, zero `redirect()` calls. |
| `src/app/w/[ref]/edit/page.tsx` | Edit form at new path, owner-only via getWatchById | VERIFIED | 34 lines. Contains `await params`, `getWatchById(user.id, ref)`, `WatchForm`, no `redirect()`. |
| `src/data/watches.ts` | `findViewerWatchByCatalogId` with BUG-01 status='owned' filter | VERIFIED | Line 245: exported function. Line 257: `eq(watches.status, 'owned')`. Line 262: `orderBy(desc(watches.createdAt))` (WR-02 fix applied). Two-predicate WHERE: `userId AND catalogId`. |
| `tests/static/legacy-watch-routes.test.ts` | ROUTE-03 build-failing source-scan guard + ROUTE-02 route-absence assertions | VERIFIED | 147 lines. ROUTE-02 describe block (lines 55–69), ROUTE-03 describe block (lines 82+). ALLOWLIST includes `/watch/new`, pure comment lines, JSDoc lines. 347/347 PASS. |
| `tests/integration/phase59-unified-route.test.ts` | ROUTE-01 resolution-contract integration coverage for all 4 branches | VERIFIED | Covers Branch 1 (per-user hit), Branch 1 cross-user, Branch 2 (catalog hit), Branch 2 + D-06 (owned), BUG-01 (sold row returns null), IDOR gate. `describe.skip` guard when `DATABASE_URL` absent. 7 tests skipped locally (no DB) — no harness error. |
| `package.json` | `prebuild` hook running the guard before `next build` | VERIFIED | Line 7: `"prebuild": "vitest run tests/static/legacy-watch-routes.test.ts"`. `"build": "next build"` unchanged. |
| Legacy pages deleted | `/watch/[id]/page.tsx`, `/watch/[id]/edit/page.tsx`, `/catalog/[catalogId]/page.tsx` absent | VERIFIED | All three confirmed absent via `test !  -f`. Only `watch/new/` remains in the `watch/` directory. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json prebuild` | `tests/static/legacy-watch-routes.test.ts` | `vitest run` | WIRED | `package.json:7` contains the exact prebuild command; build-gate proven by planted-literal experiment (exit 1 / exit 0). |
| `src/app/w/[ref]/page.tsx` | `getWatchByIdForViewer + getCatalogById + findViewerWatchByCatalogId` | try-per-user-then-catalog (D-04) | WIRED | All three functions imported (line 6, 8) and called (lines 66, 227, 230). Both branches converge. |
| `src/app/w/[ref]/page.tsx WatchDetail` | owner write actions | `viewerCanEdit={isOwner}` prop | WIRED | Lines 148, 310 — both Branch 1 and Branch 2 D-06 pass `viewerCanEdit={isOwner}`. `isOwner` is server-derived from DAL result. |
| `src/data/watches.ts findViewerWatchByCatalogId` | watches table | drizzle select with `userId AND catalogId AND status='owned'` | WIRED | Lines 251–262: WHERE predicate confirmed. `eq(watches.status, 'owned')` at line 257 (BUG-01). `orderBy(desc(watches.createdAt))` at line 262 (WR-02 fix). |
| All 26 link-literal sites | `/w/[ref]` unified route | path-prefix rewrite | WIRED | Comprehensive grep confirms zero `/watch/${` or `/catalog/${` literals remaining (excluding `/watch/new`). NotificationRow:142 `return \`/w/${watchId}\`` confirmed (D-12). |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/app/w/[ref]/page.tsx` | `perUserResult` (Branch 1) | `getWatchByIdForViewer(user.id, ref)` → drizzle DB query | Yes — two-layer DB query with RLS + WHERE | FLOWING |
| `src/app/w/[ref]/page.tsx` | `catalogEntry` (Branch 2) | `getCatalogById(ref)` → DB query on `watchesCatalog` | Yes — real DB query | FLOWING |
| `src/app/w/[ref]/page.tsx` | `viewerOwnedRow` (D-06) | `findViewerWatchByCatalogId(user.id, ref)` → drizzle select with userId+catalogId+status filter | Yes — real DB query, BUG-01 filter applied | FLOWING |
| `src/app/w/[ref]/edit/page.tsx` | `watch` | `getWatchById(user.id, ref)` → owner-scoped DB query | Yes — null for non-owners → notFound() | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CI guard test GREEN (347/347) | `npm run test -- tests/static/legacy-watch-routes.test.ts` | 347 passed (1) | PASS |
| Integration test runs without harness error | `npm run test -- tests/integration/phase59-unified-route.test.ts` | 7 skipped (DB absent) — no harness error | PASS |
| Zero legacy literals in src/ | `grep -rEn "/(watch|catalog)/\$\{" src/` (excluding /watch/new) | Empty output | PASS |
| Legacy pages absent (404 by absence) | `test ! -f "src/app/watch/[id]/page.tsx"` etc. | All 3 DELETED | PASS |
| /watch/new preserved | `test -f "src/app/watch/new/page.tsx"` | EXISTS | PASS |
| Zero redirects in /w/ route | `grep -rEn "redirect(" src/app/w/` | NO_REDIRECTS_IN_W | PASS |

---

### Probe Execution

Step 7c: SKIPPED — no `scripts/*/tests/probe-*.sh` pattern found; phase has no declared probes. The CI guard test serves as the functional equivalent and was run directly above.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ROUTE-01 | 59-01, 59-02 | Single canonical `/w/[ref]` resolves per-user watch id or catalog id server-side | SATISFIED | `src/app/w/[ref]/page.tsx` implements full try-per-user-then-catalog (D-04) with both branches. Integration test scaffolds the contract (7 tests, skipped without DB). |
| ROUTE-02 | 59-01, 59-03 | Legacy `/watch/[id]` and `/catalog/[catalogId]` routes removed (no redirect) | SATISFIED | All three legacy `page.tsx` files deleted. `/watch/new/` preserved. No redirect introduced. |
| ROUTE-03 | 59-01, 59-03 | Static guard test fails build on legacy link literals | SATISFIED | CI guard GREEN (347/347). Prebuild hook in `package.json`. Build-gate proven by planted-literal experiment (exit 1 with literal, exit 0 clean). |
| ROUTE-04 | 59-03 | Every internal watch link points at `/w/[ref]` | SATISFIED | All 26 literals migrated. Zero legacy literals remaining in `src/`. Computed deep-link (NotificationRow) migrated (D-12). /watch/new untouched (D-13). |
| ROUTE-05 | 59-02 | Unified route preserves two-layer privacy gate, no regression | SATISFIED | `getWatchByIdForViewer` called identically to legacy page. Code review verdict: no IDOR, no authorization bypass. `findViewerWatchByCatalogId` doubly scoped. |
| ROUTE-06 | 59-02 | Owner-only write surfaces remain owner-only | SATISFIED (structural) / human_needed (UI) | `viewerCanEdit={isOwner}` server-authoritative on both branches. `/w/[ref]/edit` gated by `getWatchById(user.id, ref)`. Prod UI verification required for non-owner write-action visibility. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/w/[ref]/page.tsx` | 352–364 | Dead code: `collection.length === 0` block inside D-06 branch — condition can never be true when `viewerOwnedRow` is non-null | Info | No behavioral impact; unreachable render branch. Flagged in 59-REVIEW.md (WR-01). |
| `src/components/watch/WatchDetail.tsx` | 46, 474 | Stale JSDoc comments reference deleted `/watch/[id]/page.tsx` route | Info | Documentation-only; misleads future maintainers. Flagged in 59-REVIEW.md (WR-03). |
| `src/components/explore/DiscoveryWatchCard.tsx` | 14 | JSDoc says `href="/catalog/[catalogId]"` — route was deleted in this phase; implementation at line 30 correctly uses `/w/` | Info | Documentation-only. Flagged in 59-REVIEW.md (IN-01). |
| `src/data/watches.ts` | 340–349 | `@deprecated` exported function `linkWatchToCatalog` with zero callers | Info | Dead DAL surface. Pre-existing; flagged in 59-REVIEW.md (IN-02). Not introduced by Phase 59. |

No `TBD`, `FIXME`, or `XXX` markers found in any Phase 59 modified files. No blockers.

The two pre-existing test failures (`tests/no-raw-palette.test.ts` and `tests/actions/wishlist.test.ts`) are unrelated to Phase 59: the palette test predates Phase 59 (CommentGateLocked.tsx `font-medium` issue from Phase 57); the wishlist test is Phase 38-era. Neither file is in the Phase 59 diff. Not flagged.

---

### Human Verification Required

#### 1. Non-owner write actions absent on `/w/[ref]`

**Test:** Deploy to prod. Sign in as User A. Visit User B's `/w/[ref]` page (any watch URL for a watch you don't own).
**Expected:** No edit, delete, mark-worn, or flag-deal actions render. The WatchDetail island renders cross-user framing. The URL resolves correctly (not a 404).
**Why human:** Owner-gated UI visibility requires a real non-owner session against a live DB. Local e2e skips on empty test DB. This is the ROUTE-06 final acceptance check per 59-VALIDATION.md "Manual-Only Verifications".

#### 2. Mobile render on `/w/[ref]` (both owned and cross-user)

**Test:** After deploying, navigate to `/w/[ref]` on a mobile device for (a) a watch you own and (b) another user's public watch.
**Expected:** Both resolution branches render correctly on mobile. No layout overflow, no broken RSC sibling composition, no JavaScript errors in mobile browser console.
**Why human:** Mobile/visual behavior is verified on prod per project convention (MEMORY: `feedback_mobile_ui_verify_on_prod`). Cannot be automated locally.

#### 3. Legacy URL soft-navigation 404 (Router Cache, no poisoning)

**Test:** After deploying, in a browser with warmed Router Cache, attempt to soft-navigate (client-side link click, not hard reload) to a stale `/watch/[id]` or `/catalog/[catalogId]` URL. Then hard-navigate to the same URL.
**Expected:** Both soft-nav and hard-nav return a true 404. No Router Cache poisoning (no stale page served in place of 404; no redirect loop). The phase explicitly avoids all `redirect()` calls to sidestep this (D-02/D-08), but the absence of poisoning requires a prod soft-nav test.
**Why human:** Next 16 Router Cache behavior is prod-only (MEMORY: `project_router_cache_stale_instance`; `feedback_proxy_router_cache_poisoning`).

---

### Gaps Summary

No automated gaps. All six roadmap success criteria are verified at the structural code level. The CI guard is green (347/347). All 26 link literals are migrated. Three legacy page files are deleted. The build gate is proven. WR-02 (non-deterministic ORDER BY) was fixed before this verification. The three human-needed items are pure UI/prod-behavior checks consistent with this project's `human_needed` classification for mobile/soft-nav/non-owner UI verification — not code deficiencies.

---

_Verified: 2026-05-25T00:45:00Z_
_Verifier: Claude (gsd-verifier)_
