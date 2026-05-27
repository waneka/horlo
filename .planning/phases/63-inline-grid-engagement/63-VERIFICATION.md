---
phase: 63-inline-grid-engagement
verified: 2026-05-27T13:30:00Z
status: human_needed
score: 13/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Tap ♥ chip on another user's collection card"
    expected: "Optimistic flip of liked state and count; no navigation to /w/ detail route"
    why_human: "Touch interaction + optimistic state + Link-navigation interception cannot be tested without a running browser session against prod data"
  - test: "Tap ♥ chip again (unlike)"
    expected: "Optimistic un-flip of liked state and count; silent rollback with no toast on any network failure"
    why_human: "Touch + optimistic rollback path requires prod browser session"
  - test: "Tap 💬 chip on a card where canComment=true"
    expected: "WatchCommentSheet bottom sheet opens; no navigation to detail page"
    why_human: "Sheet open + no-nav behavior requires prod browser session"
  - test: "Post a comment via WatchCommentSheet"
    expected: "Sheet closes; commentCount on chip bumps +1 immediately; 'Comment posted' toast appears"
    why_human: "Full optimistic-update and toast flow requires prod browser session against real DB"
  - test: "Tap card body (not on a chip)"
    expected: "Navigates to /w/[ref] detail page"
    why_human: "Navigation interplay between chip stopPropagation and card Link requires prod browser"
  - test: "Visit own profile — owner view of collection/wishlist cards"
    expected: "No ♥/💬 chips visible; no scrim; static count line (e.g. '♥ 2 · 💬 1') is the only engagement display"
    why_human: "Owner path visual requires prod browser session as the authenticated owner"
  - test: "View wishlist of a non-mutual user"
    expected: "♥ chip visible on each card; 💬 chip absent (gate enforced); card still navigates on body tap"
    why_human: "Requires prod browser session with a non-mutual follow relationship to confirm canComment=false path"
  - test: "Navigate away from profile and back"
    expected: "Liked state is fresh from server (not stale cache); count reflects server truth"
    why_human: "Cache-tag revalidation and navigate-back re-hydration requires prod browser session"
---

# Phase 63: Inline Grid Engagement Verification Report

**Phase Goal:** A viewer can like a watch and post a short comment directly from a profile collection or wishlist grid card without opening the detail page; count badges update optimistically and the GATE-03 wishlist comment gate is enforced per card.
**Verified:** 2026-05-27T13:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | getBatchedWatchCounts/getBatchedWatchCountsCached return shape extended per-viewer with `liked` (true for watches the viewer has liked) | ✓ VERIFIED | `WatchCounts` interface at `src/data/reactions.ts:158-163` has `liked: boolean` and `canComment: boolean`; Q6 at :292-296 runs `inArray(watchLikes.watchId, watchIds)` filtered by `eq(watchLikes.userId, viewerId)` — single batched query, no N+1 |
| 2 | getBatchedWatchCounts returns per-viewer `canComment` (= allowedSet membership; false for non-mutual viewer on a foreign wishlist watch) | ✓ VERIFIED | `canComment: allowedSet.has(id)` at :307; `allowedSet` built from the existing mutualSet logic at :251-256 — zero new queries |
| 3 | getBatchedWatchCounts query budget stays ≤6 (one added inArray query, no N+1) | ✓ VERIFIED | Docstring at :179 documents Q1–Q6; two actual `inArray(watchLikes.watchId, ...)` code hits: Q4 (like counts, line 265) and Q6 (viewer liked, line 295) — both are batched group queries; 30/30 target tests pass including the ≤6 budget assertion |
| 4 | toggleLikeAction revalidates the `viewer:{userId}:counts` tag | ✓ VERIFIED | `revalidateTag(\`viewer:${user.id}:counts\`, 'max')` at `src/app/actions/reactions.ts:111` inside the `if (ownerProfile?.username)` block; original `updateTag(\`viewer:${user.id}:reactions\`)` at :115 preserved |
| 5 | addCommentAction revalidates the `viewer:{userId}:counts` tag | ✓ VERIFIED | `revalidateTag(\`viewer:${user.id}:counts\`, 'max')` at `src/app/actions/comments.ts:167` inside the `if (ownerProfile?.username)` block |
| 6 | A compose-only bottom sheet exists that posts a watch-target comment without rendering the thread | ✓ VERIFIED | `src/components/watch/WatchCommentSheet.tsx` (113 lines); `grep -c "CommentList\|CommentThread"` returns 0; `addCommentAction({ type: 'watch', id: watch.id, body })` at line 51; `key={composeKey}` at line 104 |
| 7 | The sheet shows watch identity (thumbnail + brand + model); clears on success, keeps text on failure | ✓ VERIFIED | Watch identity header at :85-99 (thumbnail + brand + model); `setComposeKey((k) => k + 1)` on success at :68; composeKey NOT incremented on failure at :52-65; `toast.error(...)` on failure (D-08 + WR-03 gate-specific message) |
| 8 | Non-owner viewer sees ♥/💬 overlay chips on grid cards; owner sees none | ✓ VERIFIED | Chip block at `ProfileWatchCard.tsx:155` gated on `!isOwner` (2 occurrences confirmed); ♥ always present for non-owner; 💬 gated on `canComment &&` at :186 |
| 9 | Chip overlay has scrim (bg-black/55) and 44px touch targets | ✓ VERIFIED | `bg-black/55 pointer-events-none` at :159; `min-h-[44px] min-w-[44px]` on both chip buttons (:172-173, :191) |
| 10 | Chip taps call preventDefault+stopPropagation so the wrapping Link does not navigate | ✓ VERIFIED | `e.preventDefault()` + `e.stopPropagation()` in both `handleLikeClick` (:84-85) and `handleCommentClick` (:106-107) |
| 11 | ♥ chip fires toggleLikeAction with optimistic flip + silent rollback | ✓ VERIFIED | Optimistic flip at :86-89; `toggleLikeAction({ type: 'watch', id: watch.id })` at :91; silent rollback (no toast) on `!result.success` at :92-97; reconcile on success at :100-101 |
| 12 | viewerId + liked + canComment threaded from page.tsx RSC through CollectionTabContent and WishlistTabContent | ✓ VERIFIED | `viewerId={viewerId}` at page.tsx lines 391 and 405 (Collection + Wishlist); `liked` and `canComment` threaded in both tab content props interfaces and card renders; SortableProfileWatchCard (owner drag path) intentionally omits liked/canComment (line 275-283) — D-03 preserved |
| 13 | ProfileTabContent NOT marked 'use cache'; unstable_instant = false untouched | ✓ VERIFIED | `grep -c "'use cache'" page.tsx` = 5 (baseline, unchanged — confirmed by 03-SUMMARY); `unstable_instant = false` at page.tsx line 100 — confirmed untouched |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/data/reactions.ts` | WatchCounts widened with liked+canComment; Q6 inArray query; result Map carries new fields | ✓ VERIFIED | `liked: boolean` at line 161; `canComment: boolean` at line 162; Q6 at lines 292-296; viewerLikedSet built; both new fields in result.set at lines 306-307 |
| `src/app/actions/reactions.ts` | viewer:{userId}:counts revalidation inside if(ownerProfile?.username) block | ✓ VERIFIED | `revalidateTag(\`viewer:${user.id}:counts\`, 'max')` at line 111 |
| `src/app/actions/comments.ts` | viewer:{userId}:counts revalidation inside if(ownerProfile?.username) block | ✓ VERIFIED | `revalidateTag(\`viewer:${user.id}:counts\`, 'max')` at line 167 |
| `src/components/watch/WatchCommentSheet.tsx` | Compose-only bottom sheet: Sheet + watch identity header + CommentCompose; calls addCommentAction with watch target; NO CommentList/CommentThread | ✓ VERIFIED | 113 lines; 'use client'; watch identity header; CommentCompose rendered; no CommentList/CommentThread; addCommentAction({ type: 'watch' }) |
| `src/app/u/[username]/[tab]/page.tsx` | Widened counts type (liked+canComment) threaded with viewerId into both tab contents; ProfileTabContent NOT marked 'use cache' | ✓ VERIFIED | viewerId at lines 391 + 405; widened Map type at line 377; 5 'use cache' occurrences (unchanged baseline) |
| `src/components/profile/CollectionTabContent.tsx` | viewerId + liked + canComment threaded into each ProfileWatchCard | ✓ VERIFIED | Props interface includes `liked: boolean; canComment: boolean`; card render passes liked/canComment at lines 197-198 |
| `src/components/profile/WishlistTabContent.tsx` | viewerId + liked + canComment threaded into non-owner ProfileWatchCard; owner Sortable path unchanged | ✓ VERIFIED | Non-owner path: canComment at line 110; owner Sortable path: SortableProfileWatchCard at lines 275-283 has only likeCount/commentCount (no liked/canComment) |
| `src/components/profile/ProfileWatchCard.tsx` | Overlay ♥/💬 chips (non-owner only) with scrim; optimistic like; sheet trigger; gated 💬 | ✓ VERIFIED | !isOwner gate; bg-black/55 scrim; 44px chips; handleLikeClick/handleCommentClick; canComment && gate; WatchCommentSheet rendered (2 occurrences: import + JSX) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/data/reactions.ts getBatchedWatchCounts` | watchLikes table | single `inArray(watchLikes.watchId, watchIds)` + `eq(watchLikes.userId, viewerId)` query (Q6) | ✓ WIRED | Line 295; confirmed single query — not a per-watch loop |
| `src/app/actions/reactions.ts toggleLikeAction` | viewer:{userId}:counts cache tag | `revalidateTag` inside `if (ownerProfile?.username)` block | ✓ WIRED | Line 111; inside owner-username guard; before updateTag(:115) |
| `src/app/actions/comments.ts addCommentAction` | viewer:{userId}:counts cache tag | `revalidateTag` inside `if (ownerProfile?.username)` block | ✓ WIRED | Line 167; inside owner-username guard |
| `page.tsx ProfileTabContent` | CollectionTabContent + WishlistTabContent | viewerId prop + counts Record carrying liked/canComment | ✓ WIRED | viewerId={viewerId} at lines 391 + 405 |
| `ProfileWatchCard.tsx ♥ chip` | toggleLikeAction | onClick → preventDefault+stopPropagation → optimistic flip → toggleLikeAction in useTransition | ✓ WIRED | handleLikeClick at :83-103; toggleLikeAction({ type: 'watch', id: watch.id }) at :91 |
| `ProfileWatchCard.tsx 💬 chip` | WatchCommentSheet | onClick → preventDefault+stopPropagation → setSheetOpen(true); sheet gated on canComment | ✓ WIRED | handleCommentClick at :105-109; WatchCommentSheet at :199-205 inside !isOwner block |
| `WatchCommentSheet` | addCommentAction | handleSubmit fires addCommentAction({ type: 'watch', id: watch.id, body }) inside useTransition | ✓ WIRED | Line 51; type: 'watch' confirmed |
| `getBatchedWatchCountsCached` | viewer:{viewerId}:counts cache tag | cacheTag at :339 | ✓ WIRED | `cacheTag(\`viewer:${viewerId}:counts\`)` — matches revalidateTag strings in both actions exactly |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ProfileWatchCard.tsx` (likedState) | `likedState` seeded from `liked` prop | `getBatchedWatchCounts` Q6: `db.select from watchLikes where userId=viewerId AND watchId IN watchIds` | Yes — real DB query against watch_likes table | ✓ FLOWING |
| `ProfileWatchCard.tsx` (canComment) | chip hidden when `!canComment` | `getBatchedWatchCounts` allowedSet: `mutualSet` computed from Q2+Q3 follows queries | Yes — real DB queries against follows table | ✓ FLOWING |
| `ProfileWatchCard.tsx` (likeCountState) | `likeCountState` seeded from `likeCount` prop | `getBatchedWatchCounts` Q4: grouped count from watchLikes | Yes — real DB group-by query | ✓ FLOWING |
| `ProfileWatchCard.tsx` (commentCountState) | `commentCountState` seeded from `commentCount` prop | `getBatchedWatchCounts` Q5: grouped count from comments (gated by allowedWatchIds) | Yes — real DB group-by query with gate applied | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 63 target tests (30 cases) | `npx vitest run tests/data/getBatchedWatchCounts.test.ts tests/actions/reactions.test.ts tests/actions/comments.test.ts` | 30/30 passed | ✓ PASS |
| WatchCommentSheet GRID-04 boundary | `grep -c "CommentList\|CommentThread" src/components/watch/WatchCommentSheet.tsx` | 0 | ✓ PASS |
| Cache tag key match | cacheTag in getBatchedWatchCountsCached (:339) vs revalidateTag in both actions | `viewer:${viewerId}:counts` matches `viewer:${user.id}:counts` — same format, different scope variable but both resolve to the acting user | ✓ PASS |
| Optimistic state driven static line (WR-01 fix) | Static count line at :232 uses `likeCountState`/`commentCountState` | Confirmed from source — NOT raw props; desync is fixed | ✓ PASS |
| WR-03 gate message | `addCommentAction` returns `code: 'gate'` at comments.ts:152; WatchCommentSheet branches on `result.code === 'gate'` at :59 | Both sides of the contract verified | ✓ PASS |

### Probe Execution

No declared probes for Phase 63. Conventional probe path (`scripts/*/tests/probe-*.sh`) not applicable — phase is a UI + data-layer phase, not a migration/tooling phase.

Step 7c: SKIPPED (no probes declared or conventionally applicable)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GRID-01 | 63-01, 63-03 | Viewer can like from a profile grid card (one tap, optimistic) | ✓ SATISFIED | Q6 seeds `liked`; ♥ chip wired to `toggleLikeAction` with optimistic flip; `likedState` initialized from `liked` prop |
| GRID-02 | 63-02, 63-03 | Viewer can post a comment from a grid card via lightweight inline composer without opening detail | ✓ SATISFIED | WatchCommentSheet exists as compose-only; 💬 chip opens it via setSheetOpen; addCommentAction wired with type:'watch' |
| GRID-03 | 63-01, 63-03 | Card's ♥ N · 💬 M counts update optimistically after inline like or comment | ✓ SATISFIED | likeCountState/commentCountState with optimistic flip in handleLikeClick and handleCommentSuccess; static line driven from same state (WR-01 fix) |
| GRID-04 | 63-02, 63-03 | Full comment thread requires opening detail page (inline is compose-only) | ✓ SATISFIED | WatchCommentSheet has no CommentList/CommentThread; sheet is opened by 💬 chip tap (not Link navigation); full thread only at /w/[ref] |
| GRID-05 | 63-01, 63-03 | GATE-03 wishlist mutual-follow comment gate enforced per card; gated cards do not expose inline composer | ✓ SATISFIED | `canComment` = `allowedSet.has(id)` from getBatchedWatchCounts; `{canComment && <button ...>}` gates 💬 chip in ProfileWatchCard; ♥ chip always visible for non-owner (D-04/D-09); server-side `createComment` re-checks `canViewerCommentOnTarget` as the real guard |

All 5 GRID requirements satisfied. No orphaned requirements for Phase 63 in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No `TBD`, `FIXME`, or `XXX` markers in any Phase 63 modified files. No empty stubs, placeholder returns, or hardcoded empty data collections in the implementation path.

**Code review warnings from 63-REVIEW.md — all three resolved:**
- WR-01 (static count desync): Fixed — static line now reads likeCountState/commentCountState (commit 53c9575)
- WR-02 (docstring contradiction): Fixed — docstring reconciled to "constant 6-query budget" (commit 9d54657)
- WR-03 (misleading gate error message): Fixed — WatchCommentSheet branches on `result.code === 'gate'` (commit 8720399)

### Human Verification Required

The following behaviors require prod verification (one bundled deploy: push origin main → Vercel).
See `.planning/phases/63-inline-grid-engagement/63-VALIDATION.md` for full test scripts.

#### 1. Like chip — optimistic flip and no-nav

**Test:** As a non-owner authenticated viewer, visit another user's /u/[username]/collection. Tap the ♥ chip on any card.
**Expected:** Heart fills immediately (optimistic), count increments; page does NOT navigate to /w/[ref].
**Why human:** Touch interaction + Link interception + optimistic state requires a live browser against prod data.

#### 2. Unlike — silent rollback

**Test:** Tap the liked (filled) ♥ chip again.
**Expected:** Heart unfills immediately (optimistic), count decrements; no toast on any failure path.
**Why human:** Silent-rollback path (no failure toast on D-05) requires network conditions to verify.

#### 3. Comment chip opens sheet without navigating

**Test:** Tap the 💬 chip on a card where canComment=true (mutual-follow relationship exists).
**Expected:** WatchCommentSheet slides up from bottom; watch identity header shows; page does NOT navigate to /w/[ref].
**Why human:** Sheet open + no-nav behavior requires prod browser session.

#### 4. Post a comment via sheet

**Test:** Type a comment in the sheet textarea and tap Post.
**Expected:** Sheet closes; 💬 count on the chip increments by 1 immediately; 'Comment posted' toast appears.
**Why human:** Full optimistic-update and toast flow requires prod browser session against real DB.

#### 5. Card body navigation preserved

**Test:** Tap the image area or text above the chips (not on a chip).
**Expected:** Navigates to /w/[ref] detail page.
**Why human:** Navigation interplay between chip stopPropagation and card Link wrapper requires prod browser.

#### 6. Owner view — no chips

**Test:** Sign in and visit your own profile collection or wishlist.
**Expected:** No ♥/💬 chips visible; no dark scrim overlay on images; static count line (e.g. '♥ 2 · 💬 1') remains as the only engagement indicator.
**Why human:** Owner path visual requires prod browser as the authenticated owner.

#### 7. Gated foreign-wishlist viewer — comment gate

**Test:** View the wishlist of a user you do not mutually follow.
**Expected:** ♥ chip visible on each card; 💬 chip absent (gate enforced).
**Why human:** Requires prod browser with a non-mutual follow relationship to trigger canComment=false.

#### 8. Navigate-back shows fresh state

**Test:** Like a watch from the grid, then navigate to another tab (e.g. wishlist→notes), then return to collection.
**Expected:** The liked state from the server is correct (not stale); the cache-tag revalidation (D-12) worked.
**Why human:** Cache-tag revalidation + navigate-back re-hydration requires prod browser session with real cache lifecycle.

### Gaps Summary

No gaps. All 13 machine-verifiable must-haves are confirmed in the codebase. All 5 GRID requirements are satisfied. All 3 code-review warnings were resolved before submission. The 8 human-verification items are behavioral/visual behaviors that require a prod browser session (per project convention — MEMORY `feedback_mobile_ui_verify_on_prod`).

---

_Verified: 2026-05-27T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
