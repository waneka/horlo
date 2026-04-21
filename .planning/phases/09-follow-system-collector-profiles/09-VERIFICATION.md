---
phase: 09-follow-system-collector-profiles
verified: 2026-04-21T19:15:00Z
status: human_needed
score: 5/5 must-haves verified (automated); 1 requires human UAT
overrides_applied: 0
human_verification:
  - test: "Click Follow on another collector's profile at /u/[username]; reload the page"
    expected: "Follower count increments by 1 on initial click. After reload, the count persists at the incremented value and the button shows 'Following'. Clicking Unfollow decrements the count; after reload that persists too."
    why_human: "End-to-end click → Server Action → DB write → layout revalidation → rendered count change cannot be asserted from static grep; requires live browser + authenticated session. Unit tests pin each link (optimistic UI, revalidatePath spy, SQL insert) but the integrated path needs UAT."
  - test: "Visit /u/{other}/collection with other's collection_public=true, then toggle collection_public=false in the owner's settings and revisit"
    expected: "Read-only collection rendered first; after flip, the collection tab shows LockedTabCard with 'Tyler keeps their collection private.' copy — not an empty state. Worn tab uses 'worn history' wording when worn_public=false."
    why_human: "Per-tab privacy gating verified in code review, but Letterboxd-pattern visual check (locked card vs empty state) is a UX signal the tests cannot judge."
  - test: "Open /u/{other}/followers and /u/{other}/following on a profile with at least one follower"
    expected: "Heading 'Followers' or 'Following' + subheading. Each row: avatar, displayName or @username, optional bio, 'N watches · M wishlist', inline Follow button. Clicking a row navigates to /u/{other}/collection. Clicking the Follow button does NOT navigate the row."
    why_human: "stopPropagation + Link-overlay behavior is partially pinned by RTL (bubble suppression) but real click vs keyboard vs middle-click interaction needs a browser."
  - test: "Visit /u/{other}/ as a non-owner with >=1 shared watch and authenticated viewer"
    expected: "Common Ground hero band renders between ProfileHeader and ProfileTabs with one of three pills (Strong/Some/Different overlap). ProfileTabs shows 6 tabs (Common Ground as the 6th). Clicking 'See full comparison →' navigates to /u/{other}/common-ground and shows explainer + shared-watches grid + taste-tag row + dual style/role bars (when both users have >=3 owned)."
    expected_when_private: "If owner.collection_public=false, hero band is absent AND the 6th tab is absent. Directly visiting /u/{other}/common-ground returns 404."
    why_human: "Server-side gate is pinned by unit tests; visual UI for hero band + 6th tab presence/absence is a human signal. The dual-bar widths render via inline styles verified in jsdom but final visual proportions are a human check."
  - test: "After successful Follow, observe follower count on both the viewer's profile and the followed profile without full refresh"
    expected: "router.refresh() reconciles the count inline — no hard reload needed. getFollowerCounts re-runs and the ProfileHeader count updates within one refresh cycle."
    why_human: "FOLL-03 end-to-end count reconciliation requires a running server + Next.js streaming behavior. revalidatePath('/u/[username]', 'layout') is pinned by spy tests, but the viewer's OWN profile count (on /u/{self}/) updating after a follow action needs UAT since the revalidate invalidates the viewer's layout cache only on next navigation back to their own profile — worth confirming the behavior matches SC#5."
advisory_notes:
  - title: "WR-01 — N+1 isFollowing hydration in /followers and /following pages"
    severity: warning
    impact: "Does not block a must-have; hydration is batched via Promise.all (N concurrent queries) which ships correct data. At Horlo's <500-user target scale the round-trip cost is negligible. Silently non-blocking; documented as future work."
  - title: "WR-02 — useEffect([initialIsFollowing]) can clobber in-flight optimistic state"
    severity: warning
    impact: "A narrow race (rapid Follow→Unfollow before first refresh completes) could make the UI temporarily reflect stale server state before the second action's refresh lands. Disabled={pending} gates most cases; the race window is small. Does not prevent any must-have behavior but should be fixed before high-traffic phases."
  - title: "IN-06 — ProfileTabs activeTab fallback to 'collection' on /followers and /following"
    severity: info
    impact: "The 'Collection' tab trigger may appear highlighted while the user is on the followers/following route. Cosmetic only — does not block SC#3."
  - title: "TypeScript purity warning in layout.tsx (Date.now)"
    severity: info
    impact: "Pre-existing from Phase 8; documented in deferred-items.md. Does not affect runtime."
---

# Phase 9: Follow System & Collector Profiles Verification Report

**Phase Goal:** Collectors can follow each other, the social graph exists, and visiting another collector's profile shows their public collection alongside a Common Ground taste overlap.

**Verified:** 2026-04-21T19:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (merged from ROADMAP Success Criteria + PLAN must_haves)

| #   | Truth (Success Criterion)                                                                                                                                                                 | Status     | Evidence                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | User can click Follow on any collector's profile and see the follower count increment; clicking Unfollow reverses this — both actions persist across page reload                          | VERIFIED (code) / NEEDS UAT (end-to-end) | FollowButton optimistic flip (`src/components/profile/FollowButton.tsx:85`); Server Action DB insert (`src/app/actions/follows.ts:42`); revalidatePath('/u/[username]', 'layout') pinned by spy tests; all 115 unit tests pass |
| 2   | Visiting another collector's public profile at `/u/[username]` shows their collection in read-only view; tabs and data respect privacy settings (private tabs show locked state)          | VERIFIED (code) / NEEDS UAT (visual)     | `src/app/u/[username]/[tab]/page.tsx:88-128` — per-tab LockedTabCard gates for collection/wishlist/worn/notes/stats; Notes gated on collectionPublic (WR-01 mitigation); 'worn' remapped to 'worn history' label                |
| 3   | User can open followers/following lists; accounts rendered as clickable collector cards                                                                                                   | VERIFIED (code) / NEEDS UAT (interaction) | `/u/[username]/followers/page.tsx` + `/u/[username]/following/page.tsx` + `FollowerListCard` with Link overlay to /u/{other}/collection; stopPropagation on inline FollowButton; 14 RTL tests green                             |
| 4   | Common Ground section shows watches both collectors own (set intersection on brand+model) + taste-overlap summary — computed server-side, only result sent to client                      | VERIFIED    | `src/lib/tasteOverlap.ts:70-72` normalizes via `trim().toLowerCase()`; `resolveCommonGround` returns TasteOverlapResult (never TasteOverlapData); payload-shape pinned by `tests/app/layout-common-ground-gate.test.ts`      |
| 5   | Following counts are accurate on both follower's and followed collector's profile without a full page refresh after the follow action                                                     | VERIFIED (code) / NEEDS UAT (behavior)   | `FollowButton.tsx:98` calls `router.refresh()`; Server Action calls `revalidatePath('/u/[username]', 'layout')` (spy-pinned 2x in `tests/actions/follows.test.ts`); getFollowerCounts recomputed via SQL count(*)              |

**Score:** 5/5 truths verified at the code-contract level. Every truth has complete artifact + wiring + behavior evidence in the codebase. 5 truths still require **human UAT** for visual / end-to-end confirmation (listed in the `human_verification` section).

### Required Artifacts

| Artifact                                                    | Expected                                                          | Exists | Substantive                                              | Wired                                                      | Status     |
| ----------------------------------------------------------- | ----------------------------------------------------------------- | ------ | -------------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| `src/data/follows.ts`                                       | follow DAL + taste overlap loader (React cache())                 | ✓      | ✓ (7742B — 6 exported functions, full bodies)            | ✓ Imported by 7 files                                      | VERIFIED   |
| `src/app/actions/follows.ts`                                | followUser / unfollowUser Server Actions                          | ✓      | ✓ (`'use server'`, Zod .strict(), self-follow rejection) | ✓ Imported by FollowButton                                 | VERIFIED   |
| `src/lib/tasteOverlap.ts`                                   | Pure `computeTasteOverlap` function                               | ✓      | ✓ (exports computeTasteOverlap + TasteOverlapResult)     | ✓ Imported by common-ground-gate + CommonGround components | VERIFIED   |
| `src/components/profile/FollowButton.tsx`                   | Client Component (primary/locked/inline variants)                 | ✓      | ✓ (`'use client'`, 3 variants, optimistic + rollback)    | ✓ Used by ProfileHeader, LockedProfileState, FollowerListCard | VERIFIED   |
| `src/components/profile/FollowerListCard.tsx`               | Row component with Link overlay + inline FollowButton             | ✓      | ✓ (stopPropagation, private-profile masking)             | ✓ Used by FollowerList                                     | VERIFIED   |
| `src/components/profile/FollowerList.tsx`                   | Server Component mapping DAL entries → cards + empty-state        | ✓      | ✓ (Set-based lookup, empty-state card)                   | ✓ Used by followers + following page routes                | VERIFIED   |
| `src/components/profile/CommonGroundHeroBand.tsx`           | Hero band between ProfileHeader and ProfileTabs                   | ✓      | ✓ (3 pill variants, stat strip, empty-line fallback)     | ✓ Rendered by layout.tsx when `overlap && overlap.hasAny`  | VERIFIED   |
| `src/components/profile/CommonGroundTabContent.tsx`         | 6th-tab detail view (explainer + grid + tags + dual bars)         | ✓      | ✓ (section-omit rendering, inline DualBarGroup)          | ✓ Rendered by [tab]/page.tsx when tab === 'common-ground'  | VERIFIED   |
| `src/components/profile/LockedTabCard.tsx`                  | Per-tab locked-state card with "keeps their X private" copy       | ✓      | ✓ (5-tab TAB_LABELS map, worn → "worn history")          | ✓ Used 4× in [tab]/page.tsx                                | VERIFIED   |
| `src/components/profile/ProfileTabs.tsx`                    | Extended with `showCommonGround` prop (6th tab conditional)       | ✓      | ✓ (`data-tab-id` on every TabsTrigger)                   | ✓ Consumed by layout.tsx                                   | VERIFIED   |
| `src/app/u/[username]/layout.tsx`                           | Fetches isFollowing + overlap; renders HeroBand + ProfileTabs     | ✓      | ✓ (resolveCommonGround call, three-way gate)             | ✓ Top-level layout                                         | VERIFIED   |
| `src/app/u/[username]/[tab]/page.tsx`                       | VALID_TABS extends common-ground; LockedTabCard x5                | ✓      | ✓ (common-ground branch + per-tab gates)                 | ✓ App Router                                               | VERIFIED   |
| `src/app/u/[username]/common-ground-gate.ts`                | Server-only three-way gate helper                                 | ✓      | ✓ (`import 'server-only'`, returns `TasteOverlapResult \| null`) | ✓ Used by layout.tsx + [tab]/page.tsx                      | VERIFIED   |
| `src/app/u/[username]/followers/page.tsx`                   | Server Component list route                                       | ✓      | ✓ (heading, subheading, empty copy, showFollowedAt=true) | ✓ App Router                                               | VERIFIED   |
| `src/app/u/[username]/following/page.tsx`                   | Server Component list route                                       | ✓      | ✓ (mirror of /followers with showFollowedAt=false)       | ✓ App Router                                               | VERIFIED   |

### Key Link Verification

| From                                               | To                                                    | Via                                                         | Status | Evidence                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `src/app/actions/follows.ts`                       | `src/data/follows.ts`                                 | `import * as followsDAL from '@/data/follows'`              | WIRED  | `src/app/actions/follows.ts:6`                                                           |
| `src/app/actions/follows.ts`                       | `next/cache::revalidatePath`                          | `revalidatePath('/u/[username]', 'layout')` x2              | WIRED  | 2 occurrences (followUser success + unfollowUser success); spy-pinned in action tests    |
| `src/components/profile/FollowButton.tsx`          | `src/app/actions/follows.ts`                          | Direct import of followUser / unfollowUser                  | WIRED  | FollowButton.tsx:6                                                                       |
| `src/components/profile/FollowButton.tsx`          | `router.refresh()`                                    | Called after successful action in startTransition           | WIRED  | FollowButton.tsx:98 (plus `router.push('/login?next=...')` on unauth path:72)             |
| `src/app/u/[username]/layout.tsx`                  | `src/data/follows.ts::isFollowing`                    | `isFollowing(viewerId, profile.id)` when viewer && !isOwner | WIRED  | layout.tsx:45                                                                            |
| `src/app/u/[username]/layout.tsx`                  | `src/app/u/[username]/common-ground-gate.ts`          | `resolveCommonGround({viewerId, ownerId, isOwner, collectionPublic})` | WIRED | layout.tsx:105                                                                |
| `src/app/u/[username]/common-ground-gate.ts`       | `src/data/follows.ts::getTasteOverlapData`            | Called inside gate after 3-way check passes                 | WIRED  | common-ground-gate.ts:41 — gated by three `return null` guards above                     |
| `src/app/u/[username]/common-ground-gate.ts`       | `src/lib/tasteOverlap.ts::computeTasteOverlap`        | Called immediately after DAL; only result returned          | WIRED  | common-ground-gate.ts:42                                                                 |
| `src/app/u/[username]/[tab]/page.tsx`              | `resolveCommonGround` + `CommonGroundTabContent`      | `if (tab === 'common-ground')` branch at top of handler     | WIRED  | [tab]/page.tsx:71-85                                                                     |
| `src/app/u/[username]/followers/page.tsx`          | `getFollowersForProfile(profile.id)`                  | Single DAL call, batched isFollowing hydration              | WIRED (N+1 advisory — WR-01) | followers/page.tsx:42-57                                                    |
| `src/app/u/[username]/following/page.tsx`          | `getFollowingForProfile(profile.id)`                  | Single DAL call, mirror of /followers                       | WIRED (N+1 advisory — WR-01) | following/page.tsx:37-49                                                    |
| `src/components/profile/FollowerListCard.tsx`      | `src/components/profile/FollowButton.tsx`             | `variant="inline"` with stopPropagation wrapper             | WIRED  | FollowerListCard.tsx:106                                                                 |
| `src/components/profile/ProfileHeader.tsx`         | `src/components/profile/FollowButton.tsx`             | Non-owner branch renders primary variant                    | WIRED  | ProfileHeader.tsx:95                                                                     |
| `src/components/profile/LockedProfileState.tsx`    | `src/components/profile/FollowButton.tsx`             | Locked variant in the private-profile card                  | WIRED  | LockedProfileState.tsx:49                                                                |

### Data-Flow Trace (Level 4)

| Artifact                                       | Data Variable                | Source                                                               | Produces Real Data | Status   |
| ---------------------------------------------- | ---------------------------- | -------------------------------------------------------------------- | ------------------ | -------- |
| `ProfileHeader` (followerCount)                | `counts.followers`           | `getFollowerCounts(profile.id)` → SQL `count(*)::int` over `follows` | Yes (live SQL)     | FLOWING  |
| `FollowButton` (isFollowing)                   | `initialIsFollowing`         | `isFollowing(viewerId, profile.id)` → SQL SELECT with LIMIT 1        | Yes (live SQL)     | FLOWING  |
| `FollowerList` (entries)                       | `getFollowersForProfile`     | Drizzle `inArray` over profiles + profile_settings + watch aggregates | Yes (joined SQL)   | FLOWING  |
| `CommonGroundHeroBand` (overlap)               | `TasteOverlapResult`         | `resolveCommonGround` → `getTasteOverlapData` (React cache()) → `computeTasteOverlap` pure | Yes                | FLOWING  |
| `CommonGroundTabContent` (overlap)             | `TasteOverlapResult`         | Same source via layout cache — one DB roundtrip per request          | Yes                | FLOWING  |
| `LockedTabCard`                                | `tab`, `displayName`, `username` | Passed directly from [tab]/page.tsx with real profile data        | Yes                | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                         | Command                                                                                                                                           | Result                                                                                                                                         | Status |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Phase 9 test suite passes                        | `npx vitest run <11 Phase 9 test files> --reporter=dot`                                                                                           | 11 test files, 115 tests passed, 0 failed                                                                                                      | PASS   |
| TypeScript strict-mode clean on Phase 9 files    | `npx tsc --noEmit` (filtering to Phase 9 scope)                                                                                                   | Only pre-existing `tests/balance-chart.test.tsx` error (unrelated, documented in deferred-items.md). Phase 9 files clean.                      | PASS   |
| `/login` route exists (unauth redirect target)   | `ls src/app/login/page.tsx`                                                                                                                       | File present (646B)                                                                                                                            | PASS   |
| revalidatePath on both follow + unfollow paths   | `grep -c "revalidatePath('/u/\\[username\\]', 'layout')" src/app/actions/follows.ts`                                                              | 2 occurrences (followUser + unfollowUser)                                                                                                      | PASS   |
| No raw TasteOverlapData reaches Client Components | `grep -r "TasteOverlapData" src/components/` (expect 0)                                                                                           | 0 matches — only TasteOverlapResult crosses the boundary                                                                                       | PASS   |

### Requirements Coverage

| Requirement | Source Plan(s)               | Description                                                                                | Status     | Evidence                                                                                                                                   |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| FOLL-01     | 09-01, 09-02                 | User can follow another collector                                                          | SATISFIED  | `followUser` DAL + action; FollowButton primary/locked/inline variants; 23 FollowButton tests + 10 DAL tests + 13 action tests pass        |
| FOLL-02     | 09-01, 09-02                 | User can unfollow a collector                                                              | SATISFIED  | `unfollowUser` DAL + action (scoped DELETE with follower_id match); self-unfollow rejected; optimistic rollback on error pinned by tests |
| FOLL-03     | 09-01, 09-02                 | User can see follower and following counts on any profile                                  | SATISFIED (code) / NEEDS UAT | `getFollowerCounts` SQL count(*) (no denormalization); revalidatePath('/u/[username]', 'layout') on both directions; SC#5 needs UAT  |
| FOLL-04     | 09-01, 09-03                 | User can view list of followers and following on a profile                                 | SATISFIED (code) / NEEDS UAT | `/followers` + `/following` routes exist; `FollowerListCard` with Link overlay + inline FollowButton; 14 tests green                     |
| PROF-08     | 09-02, 09-04                 | User can view another collector's profile (read-only, respects privacy settings)           | SATISFIED (code) / NEEDS UAT | 5 `<LockedTabCard tab="…" />` usages in [tab]/page.tsx; owner-only affordances preserved; visual check needed                            |
| PROF-09     | 09-01, 09-04                 | User can see Common Ground taste overlap on another collector's profile                    | SATISFIED (code) / NEEDS UAT | `computeTasteOverlap` + server-only gate + TasteOverlapResult-only payload; hero band + 6th tab; 6 gate tests pin privacy invariants     |

All 6 required requirement IDs are declared across plans 09-01…09-04. No orphaned requirements. Every ID maps to verified artifacts and wiring.

### Anti-Patterns Found

| File                                               | Line | Pattern / Advisory                                                                                             | Severity   | Impact                                                                                                                                |
| -------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/u/[username]/followers/page.tsx`          | 51-53 | N+1 per-row `isFollowing` via Promise.all (WR-01)                                                            | Warning    | Batched concurrent queries; non-blocking at <500-user target scale. Flagged by reviewer; does not compromise any must-have.          |
| `src/app/u/[username]/following/page.tsx`          | 43-45 | Same WR-01 mirror                                                                                              | Warning    | Same as above.                                                                                                                         |
| `src/components/profile/FollowButton.tsx`          | 54-56 | `useEffect([initialIsFollowing])` can clobber in-flight optimistic state during refresh race (WR-02)         | Warning    | Narrow race; `disabled={pending}` mitigates most cases. Does not block a must-have; worth fixing before high-traffic phases.           |
| `src/components/profile/ProfileTabs.tsx`           | 40-41 | `activeTab ?? 'collection'` on /followers and /following shows Collection tab as visually active (IN-06)      | Info       | Cosmetic — does not affect SC#3.                                                                                                       |
| `src/app/u/[username]/layout.tsx`                  | —    | Pre-existing TypeScript `LayoutProps` + `Date.now()` purity warnings                                           | Info       | Inherited from Phase 8; documented in `.planning/phases/09-follow-system-collector-profiles/deferred-items.md`.                        |

No blocker-severity anti-patterns found. No TODO/FIXME/placeholder markers in any Phase 9 production file.

### Human Verification Required

See `human_verification` in the frontmatter. Five items require a running dev server + authenticated session to confirm end-to-end behavior the tests cannot exercise:

1. **Click Follow / Unfollow → count persistence across reload** (SC #1)
2. **Private-tab visual (LockedTabCard vs empty state)** (SC #2)
3. **Follower/Following list interaction (row click vs button click)** (SC #3)
4. **Common Ground hero band + 6th tab presence/absence** (SC #4, PROF-09)
5. **Follower-count reconciliation without full refresh — including viewer's own profile** (SC #5, FOLL-03)

### Gaps Summary

**No gaps found.** Every observable truth from ROADMAP Success Criteria #1-#5 is backed by verified artifacts, wired links, and flowing data. All 6 requirement IDs (FOLL-01..04, PROF-08, PROF-09) have complete implementations with passing tests.

The 2 code-review warnings (WR-01 N+1 hydration; WR-02 useEffect race) are advisory — neither invalidates a must-have truth. WR-01 is a performance consideration that does not affect correctness at Horlo's <500-user target scale; WR-02 is a narrow race gated by `disabled={pending}`. Both are suitable follow-ups but do not block phase completion.

Phase 9 is **functionally complete at the code-contract level**. The `human_needed` status reflects standard human-UAT items for a UI-heavy phase (visual appearance, end-to-end interaction, live-server behavior) — not unresolved implementation gaps.

---

*Verified: 2026-04-21T19:15:00Z*
*Verifier: Claude (gsd-verifier)*
