---
phase: 56-like-ui
verified: 2026-05-23T18:26:00Z
status: passed
human_verified: 2026-05-22
human_uat: 56-HUMAN-UAT.md (4/4 passed on prod)
score: 9/9 must-haves verified
overrides_applied: 0
human_uat_resolution: |
  All 4 human-verification items passed on prod (horlo.app) 2026-05-22.
  NOTE on item 3 (anon wear): the wear page is auth-gated by src/proxy.ts (PUBLIC_PATHS
  only), so anon never reaches the like button — the security intent (anon cannot like,
  redirected to /login) is satisfied at the page guard. User PREFERS this. CONTEXT D-10
  ("anon sees count on wear") is SUPERSEDED — wear detail is auth-only like watch detail.
  6 enhancement notes (EN-1..6) captured in 56-HUMAN-UAT.md for a follow-up polish round
  (not blockers; phase goal verified).
human_verification:
  - test: "Visit a wear page WITH a signed photo. Confirm: avatar + username + relative timestamp render top-left over a scrim gradient; brand/model render bottom-left over a scrim gradient; photo displays at 4:5 aspect ratio. Click the heart in the footer to confirm toggle + count."
    expected: "Overlays are readable, positioned correctly, and not visible over the PhotoSkeleton during the CDN propagation window. The heart toggles fill and count updates immediately."
    why_human: "Absolute-overlay + aspect-ratio/object-fit + gradient scrim positioning is not observable in jsdom. This is the Phase 30 regression surface per feedback_ui_spec_css_chain_blind_spot memory."
  - test: "Visit a wear page on the no-photo bg-muted fallback (no photo, no watchImageUrl). Confirm: the same overlays (avatar/username/timestamp top-left, brand/model bottom-left) render with text-foreground (not text-white). Confirm the OLD centered brand/model plain text is absent."
    expected: "Overlays render with text-foreground on the muted background. No centered brand/model plain-text fallback remains. The same structural overlay layout is visible without a photo."
    why_human: "Same jsdom limitation. This is the explicit Phase 30 regression case that a passing checker shipped broken."
  - test: "Load a wear page while logged out (anonymous viewer). Confirm the heart icon and count are visible. Click the heart and confirm redirect to /login?next=<wear-page-path>."
    expected: "Heart + count visible pre-click. After click, browser navigates to /login?next= with the wear page pathname encoded correctly. No action fires."
    why_human: "Router.push is unit-tested but the full browser redirect flow with correct next-param encoding is a behavioral integration check."
  - test: "Cross-viewer cache isolation (SEC-05). While logged in as viewer A, like a watch. In a separate browser session as viewer B, visit the same watch. Confirm viewer B does NOT see the watch as liked."
    expected: "Viewer B's LikeButton shows the updated count but is NOT in the liked state. The viewerId-keyed cache entry isolates per-viewer liked state."
    why_human: "Per-viewer Next.js cache key isolation is observable only against a running app with a real cache layer. Verified structurally (viewerId as explicit arg) but runtime confirmation requires two concurrent sessions."
---

# Phase 56: Like UI Verification Report

**Phase Goal:** Any authenticated viewer can like or unlike individual watches and wear posts from the detail pages, with optimistic UI that reflects their action immediately and rolls back cleanly on failure — like counts are visible next to the control and hidden when zero.
**Verified:** 2026-05-23T18:26:00Z
**Status:** human_needed (all automated checks VERIFIED; 4 items require human browser testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A viewer can toggle liked state on LikeButton; Heart fill toggles (outline/filled), flip is optimistic (LIKE-01, LIKE-03, D-01) | VERIFIED | `LikeButton.tsx:69-74` — `setLiked(nextLiked); setCount(nextCount)` before `startTransition`; `Heart fill={liked ? 'currentColor' : 'none'}` at line 112. 15/15 unit tests GREEN including "flips aria-pressed to true and increments count synchronously before action resolves" |
| 2 | Anon viewer (viewerId null) clicking LikeButton is bounced to /login?next=; toggleLikeAction is NOT called (LIKE-02, D-10) | VERIFIED | `LikeButton.tsx:63-67` — explicit `if (viewerId === null)` guard with `router.push('/login?next=...')` + `return`. Unit test "click calls router.push with /login?next=... and does NOT call toggleLikeAction" passes |
| 3 | On Server Action failure the button rolls back to pre-click liked/count with no error toast (console.error only) (LIKE-03, SC#4) | VERIFIED | `LikeButton.tsx:78-84` — `if (!result.success) { setLiked(liked); setCount(count); console.error(...); return }`. Unit test "rolls back to pre-click state on success:false, logs console.error, no alert" passes — asserts `screen.queryByRole('alert')` is null |
| 4 | Count renders as inline bare number to the right of the heart; hidden when count===0 and not liked; shown when liked or count>0 (LIKE-04, D-02) | VERIFIED | `LikeButton.tsx:114` — `{(liked \|\| count > 0) && (<span ...>{count}</span>)}`. Three unit tests confirm: zero+not-liked hides; count>0 shows; liked+zero shows |
| 5 | On success the button reconciles liked/count to result.data values (LIKE-04, Phase 55 D-08) | VERIFIED | `LikeButton.tsx:87-89` — `setLiked(result.data.liked); setCount(result.data.count)`. Unit test "reconciles count to result.data.count (9) rather than local optimistic value (4)" passes |
| 6 | getLikesForTargetCached attaches reactions:{type}:{id} and viewer:{viewerId}:reactions cache tags inside 'use cache' (SEC-05) | VERIFIED | `reactions.ts:149-151` — first line `'use cache'`, then `cacheTag(\`reactions:${target.type}:${target.id}\`, \`viewer:${viewerId}:reactions\`)`. viewerId is explicit function arg (not resolved internally). No auth helpers in cached scope. `grep -rc wear_event src/data/reactions.ts` returns 0 |
| 7 | Every authenticated viewer of /watch/[id] sees LikeButton under brand/model title regardless of watch status; separate from owner-only actions (LIKE-01, D-03, D-09, GATE-02) | VERIFIED | `WatchDetail.tsx:154` — `{viewerId !== undefined && initialLikeState !== undefined && ...}` renders LikeButton at line 156. First `viewerCanEdit &&` block is at line 166 — LikeButton (L153) precedes it. `watch/[id]/page.tsx:85-86` passes `viewerId={user.id}` and `initialLikeState={{...}}` |
| 8 | Initial liked/count are server-hydrated via getLikesForTargetCached in watch/[id]/page.tsx (LIKE-01, LIKE-04) | VERIFIED | `watch/[id]/page.tsx:40` — `const likeState = await getLikesForTargetCached(user.id, { type: 'watch', id })` after the `if (!result) notFound()` guard (L32-34). Props wired at L85-86 |
| 9 | Footer action row at /wear/[wearEventId] hosts LikeButton for every viewer; anon sees count and bounces on click; count hidden at zero (LIKE-02, LIKE-04, D-04, D-10) | VERIFIED | `wear/[wearEventId]/page.tsx:89-98` — footer row with `LikeButton viewerId={viewerId}` (null for anon). `ANON_SENTINEL='__anon__'` passed to `getLikesForTargetCached` at L64. `viewerId` (string\|null) passes straight through to LikeButton whose null-guard handles the bounce |

**Score:** 9/9 truths verified

---

### Deferred Items

None — all phase-56 truths verified in codebase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/components/shared/LikeButton.test.tsx` | Wave 0 unit suite — 8+ test groups covering LIKE-01..04, SC#4, a11y | VERIFIED | 15 tests, 9 describe groups (8 original + 1 discriminator test added by WR-01 fix). `describe(` and >= 8 `it(` confirmed |
| `src/components/shared/LikeButton.tsx` | Shared optimistic Heart toggle button | VERIFIED | 127 lines. `'use client'` at L1. Full implementation: useState + useTransition + rollback + reconcile + anon bounce + count visibility |
| `src/data/reactions.ts` | getLikesForTargetCached — 'use cache' wrapper with Phase-55 tags | VERIFIED | Function at L145-152. `'use cache'` at L149, `cacheTag(...)` at L150, delegate to `getLikesForTarget` at L151 |
| `src/components/watch/WatchDetail.tsx` | LikeButton rendered under title block; viewerId + initialLikeState props | VERIFIED | Import at L23, props at L51-54, conditional render at L153-163 |
| `src/app/watch/[id]/page.tsx` | getLikesForTargetCached hydration read passed into WatchDetail | VERIFIED | Import at L8, await at L40, props wired at L85-86 |
| `src/components/wear/WearDetailHero.tsx` | relative photo container + photo overlays (no-photo fallback path) | VERIFIED | Both containers have `relative` (L135, L157). `WearPhotoOverlays` exported at L54. `absolute inset-x-0 top-0` and `absolute inset-x-0 bottom-0` present. `hasPhoto ? 'text-white' : 'text-foreground'` at L63 |
| `src/components/wear/WearPhotoClient.tsx` | relative on 2 fallback containers + photo overlays; overlays suppressed during pending | VERIFIED | `relative` on L83 (failed+watchImageUrl) and L105 (failed+no-photo). Signed-URL happy-path (L125) preserves existing `relative` at end of class string. Happy-path overlays gated on `{status !== 'pending' && ...}` at L153 (CR-01 fix verified) |
| `src/components/wear/WearDetailMetadata.tsx` | Gutted to note-only caption | VERIFIED | 23 lines total. Only prop is `{ note: string \| null }`. Returns null when no note. No username/avatarUrl/brand/watchImageUrl props remain |
| `src/app/wear/[wearEventId]/page.tsx` | Anon-guarded like hydration + footer action row with LikeButton | VERIFIED | `getLikesForTargetCached` import at L6, `LikeButton` import at L12, ANON_SENTINEL at L63, footer row at L89-98 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `LikeButton.tsx` | `toggleLikeAction` | `import from @/app/actions/reactions`, called inside `startTransition` | VERIFIED | L7 import; L77 `await toggleLikeAction({ type: target.type, id: target.id })` |
| `reactions.ts:getLikesForTargetCached` | `next/cache cacheTag` | `cacheTag(reactions:..., viewer:...)` inside `'use cache'` | VERIFIED | L3 import; L149 `'use cache'`; L150 `cacheTag(...)` with both tags |
| `watch/[id]/page.tsx` | `getLikesForTargetCached` | `await getLikesForTargetCached(user.id, { type: 'watch', id })` | VERIFIED | L8 import; L40 call after notFound() guard |
| `WatchDetail.tsx` | `LikeButton` | import + render under title block | VERIFIED | L23 import; L153-163 conditional render before first `viewerCanEdit &&` block |
| `wear/[wearEventId]/page.tsx` | `getLikesForTargetCached` | `await getLikesForTargetCached(viewerId ?? ANON_SENTINEL, { type: 'wear', id: wearEventId })` | VERIFIED | L6 import; L64 call |
| `wear/[wearEventId]/page.tsx` | `LikeButton` | rendered in footer action row, target type 'wear' | VERIFIED | L12 import; L92-97 render with `target={{ type: 'wear', id: wearEventId }}` |
| `WearPhotoClient.tsx` | `WearPhotoOverlays` | `import { WearPhotoOverlays } from './WearDetailHero'`, used in all 3 photo containers | VERIFIED | L6 import; used at L91, L109, L154. Happy-path gated on `status !== 'pending'` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `LikeButton.tsx` | `liked`, `count` state | `initialLiked`/`initialCount` props from server hydration; reconciled from `result.data` after action | Yes — server hydrates from DB aggregate query (`count(*)::int`, `bool_or(...)`) in `getLikesForTarget`; action returns server-confirmed values | FLOWING |
| `WatchDetail.tsx` | `initialLikeState` prop | `getLikesForTargetCached(user.id, { type: 'watch', id })` in page.tsx L40 | Yes — delegated to `getLikesForTarget` which runs a real Drizzle DB aggregate query | FLOWING |
| `wear/[wearEventId]/page.tsx` | `likeState` | `getLikesForTargetCached(viewerId ?? '__anon__', { type: 'wear', ... })` L64 | Yes — same DB path; anon sentinel returns count=real, viewerHasLiked=false | FLOWING |
| `WearPhotoOverlays` in `WearDetailHero.tsx` | `username`, `displayName`, `avatarUrl`, `createdAt`, `brand`, `model` | Props threaded from `getWearEventByIdForViewer` result via WearPhotoStreamed | Yes — DAL returns real DB row data; WearPhotoStreamed forwards all 6 fields | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| LikeButton 15/15 unit tests pass | `npx vitest run tests/components/shared/LikeButton.test.tsx` | 15 passed, exit 0 | PASS |
| No TypeScript errors in phase-touched files | `npx tsc --noEmit 2>&1 \| grep -E "LikeButton\|reactions\|WatchDetail\|WearDetail\|WearPhoto\|WearMeta\|watch/\[id\]\|wear/\[wearEventId\]"` | (empty — 0 errors) | PASS |
| No wear_event discriminator in any touched file | `grep -rc "wear_event" src/components/shared/LikeButton.tsx src/data/reactions.ts src/components/watch/WatchDetail.tsx src/app/watch/[id]/page.tsx src/components/wear/WearDetailHero.tsx src/components/wear/WearPhotoClient.tsx src/components/wear/WearDetailMetadata.tsx src/app/wear/[wearEventId]/page.tsx` | All 0 (WatchDetail.tsx:1 match is a comment referencing the DB table name, not a discriminator) | PASS |
| All 5 aspect-[4/5] containers include relative | `grep -n "aspect-\[4/5\]" WearDetailHero.tsx WearPhotoClient.tsx` | WearDetailHero: L135, L157 (both start with `relative`); WearPhotoClient: L83, L105 (both start with `relative`), L125 (ends with `relative` — original position) | PASS |
| LikeButton appears before first viewerCanEdit block | Compare line numbers in WatchDetail.tsx | LikeButton at L153; first `viewerCanEdit &&` at L166 | PASS |
| Overlays suppressed during pending in WearPhotoClient | `grep -n "status !== 'pending'" WearPhotoClient.tsx` | L153: `{status !== 'pending' && (` wraps the WearPhotoOverlays call in the signed-URL path (CR-01 fix) | PASS |
| cacheTag viewerId arg isolation (SEC-05) | `grep -n "cacheTag\|use cache" src/data/reactions.ts` | L149: `'use cache'`, L150: `cacheTag(\`reactions:${target.type}:${target.id}\`, \`viewer:${viewerId}:reactions\`)` — viewerId is function argument | PASS |

---

### Probe Execution

Step 7c: No explicit probe files declared in PLAN.md or SUMMARY.md. No `scripts/*/tests/probe-*.sh` files found for this phase. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LIKE-01 | 56-01, 56-02 | User can like/unlike individual watch; control reflects viewer like state | SATISFIED | LikeButton optimistic toggle verified; WatchDetail hydrated from getLikesForTargetCached; server reconcile confirmed |
| LIKE-02 | 56-01, 56-03 | User can like/unlike any wear post; anon bounced to /login | SATISFIED | Wear page footer LikeButton verified; ANON_SENTINEL path tested; null-viewerId bounce in LikeButton unit-tested |
| LIKE-03 | 56-01 | Like state and count update optimistically and roll back on server failure | SATISFIED | Optimistic flip before startTransition resolves; rollback on `!result.success`; console.error only; 3 unit tests cover this |
| LIKE-04 | 56-01 | Like count shows next to control; hidden when zero | SATISFIED | `(liked \|\| count > 0)` conditional at LikeButton L114; 3 unit tests cover visibility rules; server reconcile to `result.data.count` verified |
| GATE-02 (referenced) | 56-02 | Likes open to any authenticated user on all watches including wishlist | SATISFIED | LikeButton rendered outside all `viewerCanEdit &&` gates in WatchDetail; explicitly at L153 before L166 |

No orphaned Phase 56 requirements found in REQUIREMENTS.md. Traceability table maps LIKE-01..04 to Phase 56 Complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/wear/WearDetailHero.tsx` | 16 | Word "placeholder" in comment describing the UI fallback concept | Info | Comment describes the no-photo UI pattern — not a stub marker. No stub behavior |
| `src/components/wear/WearPhotoClient.tsx` | 27 | Word "placeholder" in comment | Info | Same — describes fallback chain in state machine comment. Not a stub |
| `src/components/watch/WatchDetail.tsx` | 37 | "wear_event" in comment (`// sourced from wear_events by server page`) | Info | References DB table name `wear_events`, not the discriminator. Not a discriminator leak |

No TBD, FIXME, or XXX markers found in any file touched by Phase 56. No empty implementations, return-null stubs, or hardcoded empty data in rendering paths.

---

### Human Verification Required

#### 1. Wear overlay CSS chain — signed-photo path

**Test:** Run `rm -rf .next && npm run dev`. Visit a wear page with a signed photo (a wear event that has an uploaded photo).
**Expected:** Avatar + username + relative timestamp render top-left over a dark-to-transparent gradient scrim; brand + model render bottom-left over a bottom-to-transparent gradient scrim; photo is 4:5 aspect ratio; overlays do NOT appear during the PhotoSkeleton loading shimmer.
**Why human:** Absolute-overlay positioning + aspect-ratio/object-fit is not observable in jsdom. This is the Phase 30 CSS-chain regression surface (feedback_ui_spec_css_chain_blind_spot memory).

#### 2. Wear overlay CSS chain — no-photo bg-muted fallback

**Test:** Visit a wear page that has no photo and no watchImageUrl (both null). Alternatively visit a page whose signed URL fails after MAX_RETRIES.
**Expected:** The same overlay structure renders with `text-foreground` (not `text-white`) on the `bg-muted` background. The OLD centered `{brand} {model}` plain-text fallback is NOT present.
**Why human:** Same jsdom limitation. This specific path (no-photo fallback with text-foreground) is the exact regression the D-08 constraint was introduced to prevent — structural code is correct but visual rendering needs browser confirmation per the Phase 30 precedent.

#### 3. Anon click → /login?next= full browser flow

**Test:** Open a wear page in a logged-out browser tab. Click the heart icon in the footer action row.
**Expected:** Browser navigates to `/login?next=%2Fwear%2F<wearEventId>` (the wear page pathname URL-encoded in the next param). No toggleLikeAction fires. After logging in, the user is redirected back to the wear page.
**Why human:** The unit test confirms `mockPush` receives `/login?next=` prefix but the full browser redirect flow including the encoded pathname and post-login redirect is a behavioral integration check.

#### 4. Cross-viewer SEC-05 cache isolation

**Test:** Log in as viewer A and like a watch. In a separate browser session (different browser or incognito), log in as viewer B and visit the same watch.
**Expected:** Viewer B sees the updated like count (if count was 0 before A liked, now shows 1) but the LikeButton is NOT in the liked state for B — `aria-pressed=false`, heart outline, no `text-destructive`.
**Why human:** Per-viewer cache key isolation is structurally verified (`viewerId` as explicit function arg to `getLikesForTargetCached`) but can only be confirmed against a running app with a real Next.js cache layer in two concurrent sessions.

---

### Gaps Summary

No automated gaps. All 9 must-have truths are VERIFIED. All review findings (CR-01, WR-01, WR-02) are confirmed fixed in the codebase. The 4 human verification items above are residual visual/runtime checks that jsdom cannot cover — they are the documented mandatory post-merge steps from the plan's own verification section and 56-VALIDATION.md.

---

_Verified: 2026-05-23T18:26:00Z_
_Verifier: Claude (gsd-verifier)_
