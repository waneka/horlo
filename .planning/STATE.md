---
gsd_state_version: 1.0
milestone: between
milestone_name: ""
status: between_milestones
stopped_at: v7.0 Watch Photos & Detail Redesign SHIPPED 2026-05-28; awaiting /gsd-new-milestone
last_updated: "2026-05-28T19:00:00.000Z"
last_activity: 2026-05-28
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-28 — v7.0 SHIPPED, full milestone-close evolution)

**Core value:** A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.
**Current focus:** Between milestones — v7.0 (Watch Photos & Detail Redesign) SHIPPED 2026-05-28. Next: `/gsd-new-milestone` for **v8.0 Add-Watch Redesign** (SEED-010, search-first add flow) — the planted next milestone.

## Current Position

Phase: — (between milestones)
Plan: — (between milestones)
Status: v7.0 SHIPPED + archived (7 phases / 29 plans / 34 reqs); .planning/phases/ empty; ready for /gsd-new-milestone
Next step: `/gsd-new-milestone` for v8.0 Add-Watch Redesign (SEED-010) or another seed
Last activity: 2026-05-28

Progress: — (no active milestone)

## Performance Metrics

- v7.0: 7 phases (59-65), 29 plans, 4 days, 244 commits
- 34/34 v7.0 requirements shipped (ROUTE 6, PHOTO 9, WPIC 6, GRID 5, PAGE 4, FOLL 4)
- src/ +5,057 / −628 LOC across 65 files; tests/ +3,982 / −502 LOC across 33 files
- Phase 65 prod UAT: 9 pass / 1 skip / 0 issues
- Blockers encountered: 0
- v6.0 (prior): 8 phases (53-58 + 56A + 57.1), 37 plans, 3 days; 34/34 reqs shipped

## Accumulated Context

### Key Decisions

- **WatchDetailHero JSDoc prose must avoid "import.*CommentThread" word sequence** — the PAGE-03 static guard (`expect(content).not.toMatch(/import.*CommentThread/)`) is a full-content scan; prose in JSDoc matching the regex is a false-positive; reword to "CommentThread is NOT referenced in this file" (Phase 64 Plan 02).
- **vi.hoisted() required for vitest mock error classes** — vi.mock factories are hoisted before top-level let/const initialization; error class stubs must live inside vi.hoisted() (Phase 61 Plan 01 lesson).
- **getWatchPhotosForWatch has no userId param** — ownership resolved by RSC before calling; pure read by watchId; signing happens at page level per PATTERNS.md.
- **Variant C is a hard cutover** (operator decision 2026-05-25) — legacy `/watch/[id]` + `/catalog/[catalogId]` routes are REMOVED (no redirect); un-migrated links fail loudly; CI guard is the completeness guarantee (ROUTE-03).
- **`watches_catalog` is NOT wipeable** — in-place ALTER only for photo schema; data migrations keyed by (brand, model, reference), not id (ids diverge local/prod).
- **`workflow.use_worktrees = false` is permanent** — this project is build-gated + DB-touching; `.env.local` unavailable in worktrees.
- **DB migrations**: `drizzle-kit push` LOCAL ONLY; prod uses `supabase db push --linked`.
- **Phase ordering is locked**: 59 (route merge) → 60 (photo schema/DAL) → 61 (photo UI) → 62 (wear pics surfacing) → 63 (grid engagement, depends on 59 only) → 64 (IA redesign, depends on 61+62+63).
- **`unstable_instant = false` on `/u/[username]/[tab]` is PERMANENT** — do not re-enable (Phase 52 lesson).
- **Phase 64 must preserve Phase 51/52 Cache Components structure** — CommentThread stays an uncached Suspense sibling.
- **OtherOwnersRoster + CatalogPageActions on unified route are cross-user only** — gated on `!isOwner` per spike §4.D; Phase 64 IA redesign resolves definitively.
- **Build-gate proven (ROUTE-03/D-11)** — `npm run build` exits 1 with any `/watch/${` literal; exits 0 clean. Vercel will block deploys with missed link migrations.
- **Tests for deleted legacy pages removed** — `tests/app/catalog-page.test.ts` and `tests/app/watch-page-verdict.test.ts` deleted (imported the now-deleted pages); unified route integration coverage in `tests/integration/phase59-unified-route.test.ts` from Plan 01.
- **watch_photos Supabase migration is authoritative** — backfill + lossless assert + DROP COLUMN + RLS + bucket live in `20260525000000_phase60_watch_photos.sql`; Drizzle migration `0013_phase60_watch_photos.sql` is local-sync only; prod push is Plan 04.
- **src/data/watches.ts temporarily broken on row.imageUrl** — RESOLVED in Plan 03 (mappers repointed; cover subquery across all 3 read paths).
- **Cover subquery returns raw storagePath** — Phase 61 signs URLs; DAL stays admin-client-free (D-04/D-06 Open Q1 decision).
- **embla v8 uses watchDrag (not draggable) in reInit()** — PLAN referenced `draggable` but embla v8 renames to `watchDrag`; auto-fixed in Phase 61 Plan 02 (functionally identical).
- **signedPhotos is optional in WatchDetailProps** — backward compat; RSC always passes it; old image block in `else` branch for non-Phase-61 callers.
- **WatchPhotoStep imports PhotoDropzone** — reuses Plan 02 upload pipeline instead of inlining (avoids ~100 lines of duplication; plan explicitly permitted this).
- **onWatchCreated callback intercepts WatchForm create-success** — optional prop fires with (watchId, dest) instead of router.push; all other WatchForm callers are backward compatible.
- **signCoverUrls must be called outside 'use cache' scope** — createSupabaseServerClient reads cookies() which is unavailable in cached context; resolveProfileShellSigned wrapper added outside cached scope in profile-shell-resolver.tsx (Phase 61 Plan 04).
- **D-07 Cover badge edit-mode only** — `isCover && editMode` gate in SortablePhotoThumb; no Cover span in WatchPhotoSection view-mode filmstrip (Plan 05 UAT-confirmed revision).
- **Immediate optimistic delete uses aborted-signal pattern** — `signal.aborted = true` + no-op transition flushes `useOptimistic` on Undo; `setDeletedIds` fires at click time, `deleteWatchPhotoAction` only after 5s timeout (Plan 05 gap #6).
- **PhotoDropzone id prop** — allows filmstrip +Add tile to trigger full-width dropzone below filmstrip via `document.getElementById` click (Plan 05 gap #2).
- **WatchForm onWatchCreated suppresses success toast** — when onWatchCreated is present on create-mode commit, pass {} opts to run() so no Sonner toast action-button can navigate away from the photos-pending step; WatchPhotoStep onDone/onSkip own all navigation (Plan 06 gap #9 fix).
- **P61-BUG-01 static guard** — tests/static/ppr-dynamic-before-use-cache.test.ts with @vitest-environment node encodes the durable ordering rule for the two fixed PPR routes; prevents silent recurrence of the React #419 soft-nav regression (Plan 06 gap #1 guard).
- **hideWearPic/unhideWearPic use dual-layer ownership** — server action re-checks via watchDAL.getWatchById; DAL adds a second layer via sql`` subquery WHERE watch_id IN (SELECT id FROM watches WHERE user_id = ?); defense in depth for T-62-04 IDOR threat.
- **WearEventLite.photoUrl propagates through WornTabContent** — added photoUrl to WornTabContent's local WearEventLite (the intermediary type) so TypeScript enforces the chain from page.tsx RSC through to WornTimeline and WornCalendar.
- **Option A pre-fetch for wear-pic social state** — all wear-pic like/comment state fetched per-pic in the page RSC via Promise.all; avoids client waterfall; consistent with CommentThread pattern (Phase 62 Plan 04).
- **SignedWearPic kept distinct from SignedPhoto** — union would collapse discriminant needed for badge/social-row conditional rendering in WatchPhotoSection (Phase 62 Plan 04).
- **eye/hide toggle uses onPointerDown** — consistent with Phase 61 editMode toggle; avoids Router Cache stale-instance issue (Phase 62 Plan 04).
- **Per-slide wear-pic social overlay uses wp loop var** — each slide's LikeButton target and comment count use `wp.wearEventId` (not `activeWearPic`) so every slide is independently interactive; JSX-position-only relocation closes WPIC-06 UAT Test 4 cosmetic gap (Phase 62 Plan 05).
- **Social comment button keeps onClick** — fresh-per-interaction controls are not subject to the Router-Cache stale-instance onPointerDown mitigation; that mitigation applies only to one-shot editMode / eye-hide toggles (Phase 62 Plan 05).
- **Q6 single inArray query for viewer liked set** — `inArray(watchLikes.watchId, watchIds) + eq(watchLikes.userId, viewerId)` is a single batched query; `viewerLikedSet = new Set(rows.map(r => r.watchId))`; no N+1 (Phase 63 Plan 01).
- **canComment reuses existing allowedSet** — `getBatchedWatchCounts` already computes `allowedSet` for Q5 comment-count gate; `canComment = allowedSet.has(id)` adds zero new queries (Phase 63 Plan 01).
- **D-12 gap closed in both engagement actions** — `revalidateTag('viewer:{user.id}:counts','max')` added inside `if(ownerProfile?.username)` block in `toggleLikeAction` and `addCommentAction`; matches `getBatchedWatchCountsCached` cacheTag scope (Phase 63 Plan 01).
- **text-destructive used for liked Heart chip** — no-raw-palette test forbids `text-red-\d`; `text-destructive` is the design token matching LikeButton; plan specified `text-red-400` but test enforcement required the token (Phase 63 Plan 03 Rule 1 auto-fix).
- **MAX_LOOKAHEAD = 70 in ppr-guard** — Branch 1 of /w/[ref]/page.tsx has 59-line gap between createSupabaseAdminClient and getLikesForTargetCached; 50 was too tight (Phase 64 Plan 01 auto-fix).
- **Privacy guard uses exact-line-match for directive detection** — CRITICAL prose comment in CommentThread.tsx lines 1-3 contains 'use client'/'use cache' as text; regex match would false-positive; trim() === directive form is the correct check (Phase 64 Plan 01 auto-fix).
- **WatchDetailTrailing comment reworded to avoid grep false-positive** — initial header comment `// NO 'use client'` contained the literal string `'use client'`; the plan's RSC assertion `! grep -q "use client"` matched the prose; reworded to `// Pure RSC — no client directive` to let the grep pass while preserving intent (Phase 64 Plan 03).
- **Branch 2-D06 omits OtherOwnersRoster + CatalogPageActions** — cross-user-only components; Phase-64 TODO at ~595 resolved by absence; not a gap (Phase 64 Plan 04).
- **Branch 3 container upgraded to space-y-8 (D-14 parity)** — OtherOwnersRoster + CatalogPageActions surfaced high near verdict (D-13 resolved); Phase-64 TODO comments removed (Phase 64 Plan 04).
- **Task 3 prod human-verify auto-approved in chain mode** — actual prod check (push → Vercel, wait for cache fill, verify desktop 2-col, mobile collapse, jump scroll, soft-nav #419, catalog branch, owner gates) is PENDING / human_needed (Phase 64 Plan 04).
- **FollowedOwnersModule locked as pure RSC** — `tests/static/followed-owners-module-rsc.test.ts` (// @vitest-environment node) fires CI tripwire if 'use client' or 'use cache' appears in first 5 lines; protects /w/[ref] PPR boundary from silent React #419 soft-nav regression once Plan 03 wires the component into WatchDetailHero (Phase 65 Plan 02).
- **FollowedOwner is type-only across the client/server boundary** — Plan 02 component imports `import type { FollowedOwner } from '@/data/follows'` and NEVER `getFollowedOwnersForCatalog`; preserves Plan 03's ability to thread the prop through `WatchDetailHero` ('use client' island) without dragging server-only DAL across the boundary (Phase 65 Plan 02 D-11 enforcement).

### Pending Todos

None.

### Blockers/Concerns

None. Phase 60 COMPLETE — all 4 plans, verification passed (10/10 must-haves), prod migration applied + verified.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-05-28 (v7.0):

| Category | Item | Status |
|----------|------|--------|
| debug_session | knowledge-base | unknown (empty/stale) |
| debug_session | mobile-title-above-fold | diagnosed (resolved by Phase 64-05) |
| uat_gap | Phase 59 — 59-HUMAN-UAT.md | passed (false-positive — 0 pending) |
| uat_gap | Phase 62 — 62-UAT.md | resolved (false-positive — 0 pending) |
| verification_gap | Phase 61 — 61-VERIFICATION.md | human_needed (false-positive — phase prod-verified 2026-05-26, see project_phase_61_complete memory) |
| quick_task | 260413-qp3-price-prominence-and-filter-collapse | missing |
| quick_task | 260421-rdb-fix-404-on-watch-detail-pages-for-watche | missing |
| quick_task | 260421-srx-wrap-follower-following-counts-in-link-o | missing |
| quick_task | 260424-nk2-fix-phase-15-uat-bug-wywt-rail-and-overl | missing |
| quick_task | 260513-hvu-hotfix-search-watches-tab-returns-empty- | missing |
| quick_task | 260513-m31-fix-otherownersroster-count-label-always | missing |
| quick_task | 260519-08p-fix-next-js-image-aspect-ratio-console-w | missing |
| quick_task | 260519-d69-fix-4-collection-path-ui-issues-in-pathc | missing |
| quick_task | 260519-g4v-fu-02-fix-explore-brands-a-z-letter-anch | missing |
| quick_task | 260519-ga9-fu-01-expose-brand-era-genre-archetype-f | missing |
| seed | SEED-001-catalog-hierarchy-and-attributes | dormant |
| seed | SEED-002-hybrid-recommender | dormant |
| seed | SEED-003-onboarding-cold-start-flow | dormant |
| seed | SEED-004-v5-discovery-north-star | dormant (shipped — re-classify) |
| seed | SEED-005-v6-market-value | dormant (planted for future post-v8) |
| seed | SEED-007-market-pricing-api-spike | dormant |
| seed | SEED-008-v5.1-explore-redesign | active (shipped — re-classify) |
| seed | SEED-010-v5.3-add-watch-redesign | dormant (planted for v8.0) |
| seed | SEED-012-v6.0-social-interaction | active (shipped — re-classify) |
| seed | SEED-013-v7.0-watch-photos | dormant (shipped this milestone — re-classify) |
| seed | SEED-014-cache-components-canonical-sweep | dormant |
| seed | SEED-015-inline-grid-engagement | dormant (shipped — Phase 63 — re-classify) |
| seed | SEED-016-watch-detail-redesign | dormant (shipped — Phases 64+65 — re-classify) |

**Total deferred:** 28 (2 debug, 3 false-positive UAT/verification, 10 quick-task backlog, 13 seeds).
**Notes:** Quick-task backlog has rolled past v5.2, v6.0, and now v7.0 closes — most were superseded by later phases. Seeds marked "shipped" should be promoted/closed by `/gsd-new-milestone` housekeeping or a one-off seeds audit.

## Session Continuity

Last activity: 2026-05-28 — `/gsd-complete-milestone` v7.0 EXECUTED. Archived `milestones/v7.0-ROADMAP.md` + `milestones/v7.0-REQUIREMENTS.md`; hand-wrote MILESTONES.md v7.0 entry (extractor garbage avoided — 4th milestone running per memory `project_next_clear_operational_debt`); rewrote ROADMAP.md from scratch with proper `# Roadmap` / `## Milestones` / `## Phases` skeleton + v7.0 collapsed `<details>` entry (was found truncated to 44 lines, no headers, missing Phase 65 from Progress table); fully evolved PROJECT.md (Current State now reads v7.0 shipped, v7.0 validated entries appended to Validated list, v7.0 Key Decisions section added, Context LOC bumped to ~55,320, Last updated footer fresh); appended v7.0 milestone section + cross-milestone trends + 6 new top-lessons (#22-#27) to RETROSPECTIVE.md; **git mv'd all 7 v7.0 phase dirs (59-65) to `.planning/milestones/v7.0-phases/` per the recurring `feedback_milestone_close_phase_dir_archival_miss` memory** — `.planning/phases/` is now empty and safe for `/gsd-new-milestone`'s `phases.clear --confirm`; 28 pre-close artifact-audit items acknowledged as deferred (above in this STATE — mostly stale noise: false-positive UAT/verification, prior-milestone quick-task backlog, dormant seeds including 5 that actually shipped).
Stopped at: v7.0 milestone archived; awaiting safety commit + `git rm REQUIREMENTS.md` + git tag `v7.0`
Next action: `/gsd-new-milestone` for **v8.0 Add-Watch Redesign** (SEED-010) — the planted next milestone per memory `project_v7_0_watch_photos`. Future-after-that: Catalog Expansion (SEED-009, unscheduled), Market Value (SEED-005, needs SEED-007 pricing spike first).
