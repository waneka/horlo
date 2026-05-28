---
phase: 64-detail-page-ia-redesign
verified: 2026-05-27T17:10:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "DESKTOP (>= 1024px) — open a populated per-user watch at /w/[ref]"
    expected: "Hero is a 2-column grid: carousel left, verdict + title + like right; CollectionFitCard verdict reads near the top; comments appear directly below the hero, ABOVE the full spec cards and rails"
    why_human: "Responsive viewport breakpoint and visual layout cannot be verified without rendering; local test DB is empty so e2e skips (MEMORY feedback_mobile_ui_verify_on_prod)"
  - test: "MOBILE (< 1024px) — open the same /w/[ref] page on a narrow viewport"
    expected: "Hero collapses to single column: carousel on top, then title/verdict/like/actions; order remains hero -> comments -> spec cards -> rails -> footer"
    why_human: "Viewport collapse is a CSS breakpoint behavior; requires browser rendering to confirm"
  - test: "JUMP LINK — tap/click the hero comment count badge"
    expected: "Page smooth-scrolls (or jumps on reduced-motion) to the #comments section"
    why_human: "Browser scroll behavior requires interactive verification; id=comments anchor is present in code but scroll behavior depends on runtime"
  - test: "SOFT-NAV #419 CHECK — navigate to a /w/[ref] page via an in-app link, then navigate to another and back"
    expected: "No React #419/404 error; unstable_instant=false + await connection() fix holds after cache fills (verify AFTER cache warms, not on cold read)"
    why_human: "PPR/cache-resume behavior is prod-only; empty local test DB and different cache semantics locally; MEMORY project_ppr_dynamic_before_use_cache"
  - test: "CATALOG BRANCH — open a catalog-only /w/[ref] (a ref you do not own)"
    expected: "Verdict-forward hero; OtherOwnersRoster + CatalogPageActions sit high near the verdict; no comments and no multi-photo carousel"
    why_human: "Visual positioning and conditional section visibility require a populated prod catalog entry"
  - test: "OWNER ACTIONS — verify as owner vs non-owner viewer"
    expected: "As owner: Mark-as-Worn / Edit / Delete present in the hero. As non-owner viewer: those controls absent"
    why_human: "Cross-user access control visibility requires a prod session with two distinct accounts; viewerCanEdit=isOwner is set in code but UI appearance requires a real session"
  - test: "SKELETON visual match — throttle network and observe the loading skeleton on /w/[ref]"
    expected: "Skeleton layout matches the new hero/order: hero grid (left carousel placeholder, right column), comment skeleton, spec-cards skeleton"
    why_human: "Skeleton visual fidelity is a subjective rendering check; requires browser with throttled network"
  - test: "Overall intentional hierarchy feel — does the page feel intentionally ordered on a populated watch?"
    expected: "Comments are reachable without scrolling past all rails; the carousel and verdict are the primary visuals above the fold on a desktop viewport"
    why_human: "Subjective hierarchy perception requires a human on a populated prod watch (PAGE-01)"
---

# Phase 64: Detail Page IA Redesign — Verification Report

**Phase Goal:** The `/w/[ref]` page presents an intentional information hierarchy — carousel, verdict, like, comments, rails, footer — rather than append-order stacking; comments have a deliberate, reachable position; the Phase 51/52 Cache Components structure is fully preserved.
**Verified:** 2026-05-27T17:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PAGE-01: Server-tree child order in Branches 1 & 2 is WatchDetailHero → CommentThread → WatchDetailTrailing → SameFamilyRail → LineageRail | VERIFIED | page.tsx lines 323/557 (hero), 346/580 (CommentThread Suspense), 360/594 (WatchDetailTrailing), 368/602 (SameFamilyRail); watch-detail-ia-order.test.ts 426/426 PASS |
| 2 | PAGE-02: CommentThread occupies a deliberate, reachable position directly below the hero — not buried after all rails | VERIFIED | page.tsx: CommentThread Suspense at lines 346-357 (Branch 1) and 580-591 (Branch 2), immediately after WatchDetailHero; no CSS flex-reverse tricks found |
| 3 | PAGE-03: Cache Components structure preserved — unstable_instant=false at module scope, await connection() first in page body, CommentThread has no 'use client' / 'use cache', hero does not import CommentThread, admin client signing precedes getLikesForTargetCached | VERIFIED | page.tsx line 49: `export const unstable_instant = false`; line 95: `await connection()`; CommentThread.tsx: no 'use client' or 'use cache' directive; WatchDetailHero.tsx: no import of CommentThread; PPR guard 426/426 PASS with createSupabaseAdminClient + absent-cookie-client assertions |
| 4 | PAGE-04: WatchPhotoSection carousel is the primary visual in the hero left column | VERIFIED | WatchDetailHero.tsx line 180: `<WatchPhotoSection … />` in the left column of `grid gap-8 lg:grid-cols-[3fr_2fr]`; watch-detail-ia-order.test.ts asserts WatchPhotoSection present |

**Score:** 4/4 truths verified

### Deferred Items

None identified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/watch/WatchDetailHero.tsx` | Hero client island: 'use client', carousel left, verdict+like+comments-anchor right, no CommentThread import | VERIFIED | Line 1: `'use client'`; imports WatchPhotoSection, CollectionFitCard, LikeButton; href="#comments" at line 263; viewerCanEdit=false default (WR-01 fixed); no CommentThread import |
| `src/components/watch/WatchDetailTrailing.tsx` | Pure RSC with four spec cards, gap-fill, notes; no 'use client'; computeGapFill; timeZone UTC | VERIFIED | No 'use client'; `export function WatchDetailTrailing`; computeGapFill at line 53; timeZone:'UTC' in formatDate; no useState/useTransition/onClick |
| `src/components/watch/SpecsSublabel.tsx` | Shared RSC-compatible component, no 'use client', exported | VERIFIED | `export function SpecsSublabel`; no 'use client'; imported by page.tsx at line 38; no local duplicate in page.tsx (grep returns 0) |
| `src/components/comment/CommentThread.tsx` | section id="comments"; no 'use client'; no 'use cache'; export async function | VERIFIED | Line 66: `<section id="comments" …>`; no directives (CRITICAL comment prose confirmed not a false positive per plan 01 fix) |
| `src/app/w/[ref]/page.tsx` | All three branches re-ordered; WatchDetailHero imported; TODO comments removed; WatchPageSkeleton updated | VERIFIED | WatchDetailHero at lines 19, 323, 557; Branch 3: OtherOwnersRoster/CatalogPageActions before rails (lines 704-719); zero matches for "Phase 64 IA redesign will resolve"; skeleton uses lg:grid-cols-[3fr_2fr] at line 111 |
| `tests/static/watch-detail-ia-order.test.ts` | Vitest node env; asserts IA child order; B1 no-CommentThread-import; PAGE-04 WatchPhotoSection present | VERIFIED | First line: `// @vitest-environment node`; 426/426 PASS in static suite |
| `tests/static/comment-thread-no-client.test.ts` | Vitest node env; asserts no 'use client'/'use cache' in CommentThread directive zone | VERIFIED | First line: `// @vitest-environment node`; 426/426 PASS |
| `tests/static/ppr-dynamic-before-use-cache.test.ts` | createSupabaseAdminClient pattern (not ServerClient); also asserts createSupabaseServerClient absent | VERIFIED | Lines 151+: `createSupabaseAdminClient(` pattern; line 191-195: asserts createSupabaseServerClient absent (WR-02 fixed); 426/426 PASS |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| WatchDetailHero.tsx | CommentThread section#comments | href="#comments" anchor | VERIFIED | Line 263: `href="#comments"` present; commentCount prop hides when 0 |
| WatchDetailHero.tsx | WatchPhotoSection | carousel in left column | VERIFIED | Line 180-195: WatchPhotoSection in the left column of the 2-col grid |
| WatchDetailHero.tsx | CollectionFitCard | verdict prop in right column | VERIFIED | Line 25: imported; rendered conditionally in right column |
| page.tsx Branch 1+2 | WatchDetailHero → CommentThread → WatchDetailTrailing → rails | server-tree order | VERIFIED | Lines 323→346→360→368 (Branch 1); lines 557→580→594→602 (Branch 2) |
| page.tsx Branch 3 | OtherOwnersRoster + CatalogPageActions | surfaced above SameFamilyRail/LineageRail | VERIFIED | Lines 704→709→718 (Roster→Actions→SameFamilyRail); D-13 TODOs removed |
| page.tsx | unstable_instant=false + await connection() | PPR opt-out plumbing | VERIFIED | Line 49: module-scope; line 95: first statement in UnifiedWatchPage export |
| createSupabaseAdminClient | getLikesForTargetCached | admin client precedes each cached call | VERIFIED | PPR guard passes (426/426); WR-02 fix adds absent-cookie-client assertion |

### Data-Flow Trace (Level 4)

Not applicable — this phase is a pure layout/IA recompose with no new data sources. All data flows are preserved from prior phases (verdict, likeState, commentCount, signedPhotos, wearPics all resolved server-side in page.tsx RSC and passed as props). No new static/disconnected sources introduced.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Static test suite (14 files, 426 tests) | `npx vitest run tests/static/ --reporter=verbose` | 14 passed, 426 passed, exit 0 | PASS |
| IA child order asserted by watch-detail-ia-order.test.ts | included in static suite above | PASS (all 5 IA assertions green) | PASS |
| CommentThread no-client privacy guard | included in static suite above | PASS | PASS |
| PPR guard (admin client + absent cookie client) | included in static suite above | PASS | PASS |
| Build gate | Not run live (build-gated project; per MEMORY project_baseline_not_green_build_is_gate, `npm run build` exit 0 is the authoritative gate; SUMMARY confirms exit 0 after all four plans) | PASS (per SUMMARY 64-04) | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files declared or found for this phase. The static test suite and build gate serve as the automated verification contract.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PAGE-01 | 64-01, 64-02, 64-03, 64-04 | Intentional IA hierarchy (carousel, verdict, like, comments, rails, footer) | VERIFIED | Server-tree order hero→comments→trailing→rails confirmed in page.tsx; watch-detail-ia-order.test.ts GREEN |
| PAGE-02 | 64-01, 64-04 | Comments at deliberate, reachable position | VERIFIED | CommentThread Suspense immediately after WatchDetailHero in all per-user branches; no rail burial |
| PAGE-03 | 64-01, 64-02, 64-04 | Phase 51/52 Cache Components structure preserved | VERIFIED | unstable_instant=false (line 49), await connection() (line 95), CommentThread no-client guard GREEN, WatchDetailHero no CommentThread import, admin-client ordering guard GREEN |
| PAGE-04 | 64-02, 64-04 | Photo carousel as primary visual element | VERIFIED | WatchPhotoSection in the hero left column (2fr of 3fr_2fr grid); watch-detail-ia-order.test.ts WatchPhotoSection assertion GREEN |

All four PAGE-01 through PAGE-04 requirements are satisfied structurally.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/watch/WatchDetailHero.tsx` | 39-47 | `formatDate` duplicated across WatchDetailHero, WatchDetailTrailing, WatchDetail.tsx | Info | WR-03: acknowledged as advisory; timeZone:'UTC' present in all three copies; no live #418 bug; deferred to a follow-up refactor |
| `src/components/watch/WatchDetail.tsx` | — | Old monolith retained (rendered nowhere) | Info | IN-01: intentionally retained because two pre-existing tests reference it; accepted known state |
| `src/app/w/[ref]/page.tsx` | 280-282 | Double `getCommentsForTarget` DB round-trip (count + thread) | Info | IN-02: performance note; out of scope; acknowledged |

No TBD/FIXME/XXX debt markers found. No stubs. No placeholder returns. No unreferenced markers requiring blockers.

### Human Verification Required

#### 1. Desktop 2-column hero layout

**Test:** Push origin main, wait for Vercel deploy and cache fill. Open a populated per-user watch at `/w/[ref]` on a desktop viewport (>= 1024px).
**Expected:** Hero shows a 2-column grid: carousel fills the left, verdict (CollectionFitCard) + title + like + owner actions fill the right. The verdict reads near the top of the right column. Comments appear directly below the hero, above spec cards and rails.
**Why human:** Responsive CSS breakpoint and visual proportions cannot be verified programmatically; requires browser rendering on a populated prod watch.

#### 2. Mobile single-column collapse

**Test:** Open the same `/w/[ref]` on mobile (< 1024px viewport).
**Expected:** Hero collapses to single column — carousel on top, then title/verdict/like/actions. Order remains hero → comments → spec cards → rails → footer.
**Why human:** CSS breakpoint collapse requires browser rendering; local test DB is empty.

#### 3. Jump-to-comments scroll behavior

**Test:** Tap the comment count in the hero badge.
**Expected:** Page smooth-scrolls (or jumps on reduced-motion) to the `#comments` section. The `id="comments"` anchor is present on `<section>` in CommentThread.
**Why human:** Browser scroll behavior requires interactive session; anchor target is structurally correct but smooth-scroll depends on CSS scroll-behavior runtime.

#### 4. Soft-nav #419 absence

**Test:** Navigate to a `/w/[ref]` page via an in-app link (not hard refresh), then navigate to another page and back.
**Expected:** No React #419/404 error; page renders correctly. Verify after cache fills (cold read is a false positive).
**Why human:** PPR/cache-resume behavior is prod-specific; `unstable_instant=false` + `await connection()` is structurally correct but the #419 pattern only manifests on prod after cache warms.

#### 5. Catalog branch layout

**Test:** Open a catalog-only `/w/[ref]` (a reference the viewer does not own).
**Expected:** Verdict-forward hero; OtherOwnersRoster + CatalogPageActions high near the verdict; no comments section and no multi-photo carousel.
**Why human:** Branch 3 rendering requires a catalog entry in prod; local test DB is empty.

#### 6. Owner vs non-owner actions

**Test:** View a `/w/[ref]` as the owner, then as a different logged-in user.
**Expected:** Owner sees Mark-as-Worn / Edit / Delete in the hero; non-owner sees those controls absent.
**Why human:** Cross-user access control visibility requires two prod sessions; `viewerCanEdit={isOwner}` is correct in code but the UI appearance requires a real session.

#### 7. WatchPageSkeleton visual match

**Test:** Throttle network to "Slow 3G" and navigate to `/w/[ref]`.
**Expected:** Loading skeleton shows a 2-column hero grid on the left (carousel placeholder) and right column placeholders, then a comment skeleton, then a spec-cards skeleton.
**Why human:** Skeleton visual fidelity requires a browser with network throttling.

#### 8. Overall "intentional hierarchy" feel

**Test:** Browse a populated watch detail page on prod.
**Expected:** Comments are reachable without scrolling past all rails; the carousel and verdict are the primary visuals above the fold on desktop.
**Why human:** Subjective perception of intentional hierarchy is a qualitative judgment; requires a populated prod watch and a human reviewer (PAGE-01 intent).

### Gaps Summary

No structural gaps. All four PAGE-01 through PAGE-04 must-haves are verified in the codebase:

- The server-tree reorder is complete and guard-enforced (426/426 static tests GREEN).
- CommentThread is at position 2 (directly below hero) with no CSS tricks.
- The Phase 51/52 Cache Components plumbing (`unstable_instant=false`, `await connection()`, admin-client signing, uncached CommentThread, no CommentThread import into the hero) is intact and guard-enforced.
- WatchPhotoSection carousel is the primary visual in the hero left column.
- Post-review fixes CR-01 (isOwner gate on CTA block), WR-01 (viewerCanEdit default false), and WR-02 (absent-cookie-client assertion) are all confirmed in the codebase.
- No debt markers (TBD/FIXME/XXX) found in phase-modified files.

Eight prod-visual and behavioral items are classified `human_needed` per project convention (MEMORY `feedback_mobile_ui_verify_on_prod`): responsive layout, jump-scroll, soft-nav #419, catalog branch appearance, owner-action gating, skeleton visual, and the subjective IA quality check. These cannot be verified locally due to the empty test DB and prod-only PPR behavior.

---

_Verified: 2026-05-27T17:10:00Z_
_Verifier: Claude (gsd-verifier)_
