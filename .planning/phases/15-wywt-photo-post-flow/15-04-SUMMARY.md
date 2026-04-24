---
phase: 15
plan: 04
subsystem: wear-detail
tags: [wear-detail, routing, signed-url, privacy, uat, wywt]

# Dependency graph
dependency-graph:
  requires:
    - phase: 15
      plan: 03a
      provides: "getWearEventsForViewer DAL predicate (mirrored) + wear_events schema"
    - phase: 15
      plan: 03b
      provides: "WywtPostDialog is the canonical write path — /wear/[wearEventId] reads what this flow writes"
  provides:
    - "getWearEventByIdForViewer(viewerId, wearEventId) DAL — three-tier single-wear reader"
    - "/wear/[wearEventId] Server Component — durable URL for WYWT-18 future click-throughs"
    - "WearDetailHero + WearDetailMetadata composable components"
    - "Wave 0 integration test suite (tests/integration/phase15-wear-detail-gating.test.ts) — 9-cell matrix + 4 edge cases + 1 shape contract = 14 tests"
  affects:
    - "Any future surface that deep-links a single wear (notification click-through, feed row tap, shared URL)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 9 (Detail-route viewer-aware DAL + notFound + signed URL) — DAL returns raw photo_url path; Server Component mints signed URL inline; notFound() called uniformly for missing OR denied"
    - "Pitfall F-2 architectural enforcement — signed URL minting NEVER inside DAL and NEVER inside cache-wrapped code"
    - "Pitfall from Phase 8 (notes-IDOR) — uniform 404 on missing-or-denied response"
    - "Native <img> for signed-URL hero (NOT next/image) — preserves token query params regardless of future config changes"

key-files:
  created:
    - "src/data/wearEvents.ts (MODIFIED — appended getWearEventByIdForViewer; existing 9 exports byte-unchanged)"
    - "src/app/wear/[wearEventId]/page.tsx"
    - "src/components/wear/WearDetailHero.tsx"
    - "src/components/wear/WearDetailMetadata.tsx"
    - "tests/integration/phase15-wear-detail-gating.test.ts"
  modified:
    - "src/data/wearEvents.ts (appended 1 export; existing 9 byte-unchanged)"

key-decisions:
  - "Signed URL TTL: 60 minutes per plan Discretion and CONTEXT.md D-23. Rationale: long enough for users who open the link and come back after a coffee break; short enough to bound exfiltration window. Revisitable if users report stale-URL breakage on long-open tabs."
  - "No segment-level src/app/wear/not-found.tsx created. Next's default 404 page is sufficient for MVP per plan Step 4 / RESEARCH Open Question 4. Branded 404 is a quick follow-up outside Phase 15 if desired."
  - "Used existing AvatarDisplay (src/components/profile/AvatarDisplay.tsx) instead of inventing a new Avatar primitive at src/components/ui/avatar.tsx (path referenced by plan did not exist). Kept the behavior contract from <interfaces> identical — avatar + linked username + size-10 row."
  - "Used existing timeAgo (src/lib/timeAgo.ts) — the canonical Phase 10 helper used throughout WywtSlide/ActivityRow/etc. The plan's referenced name formatRelativeTime does not exist; timeAgo is the real export. Same contract, same signature, same call site behavior."
  - "WearDetailMetadata uses next/image with unoptimized={true} for the 40px watch thumbnail. Next.config has images.unoptimized:true globally so this is pass-through. The hero MUST use native <img> per plan (signed URL + token preservation) but the thumbnail does not need that constraint — it uses the same pattern as WywtSlide (phase 10 precedent)."

patterns-established:
  - "WearDetailHero composable — signedUrl/watchImageUrl/brand/model/altText props; consumer controls fallback chain via nullability, not via feature flags"
  - "WearDetailMetadata composable — collector row + watch row + optional note; no engagement mechanics"
  - "Server Component route with viewer-aware DAL + notFound + inline signed URL mint — reusable template for any future /resource/[id] detail page"

requirements-completed: [WYWT-17, WYWT-18]

# Metrics
metrics:
  duration_min: 8
  completed: "2026-04-24T19:38Z"
  tasks_complete: 2  # Tasks 1–2 automated; Task 3 is a manual UAT checkpoint
  tasks_pending_uat: 1
  tests_added: 14
---

# Phase 15 Plan 04: Wear Detail Route Summary

`/wear/[wearEventId]` detail route shipped as a Server Component with a three-tier viewer-aware DAL (`getWearEventByIdForViewer`), uniform 404 on missing-or-denied (`notFound()` — Pitfall from Phase 8 honored), per-request signed URL minting at 60-min TTL (Pitfall F-2 architectural enforcement), and full-bleed hero with fallback chain (signed URL → watch image → muted placeholder). Phase 10 `WywtOverlay` pathway intact (WYWT-18 non-regression preserved). Wave 0 integration tests: 14 cells (9 matrix + 4 edge + 1 shape) skip-gated on DATABASE_URL; full repo test suite 2691/2691 pass. Production `next build` compiles the route cleanly.

**Task 3 (Manual iOS UAT) is the Phase 15 aggregate checklist — a physical iPhone + HTTPS tunnel is required and cannot be automated. This plan returns to the orchestrator as a checkpoint for human verification.**

## Performance

- **Duration:** ~8 min (Tasks 1 + 2 automated)
- **Started:** 2026-04-24T19:30:59Z
- **Completed (automated portion):** 2026-04-24T19:38:51Z
- **Tasks:** 2 automated + 1 manual UAT checkpoint (not counted toward auto duration)
- **Commits:** 3 automated (TDD RED → DAL GREEN → page+components GREEN)

## Tasks Completed (automated)

| Task | Name                                                                                                                       | Commit  | Files                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 RED | Wave 0 failing privacy-matrix + shape contract test (14 cells)                                                            | 8c2ecaa | tests/integration/phase15-wear-detail-gating.test.ts                                                                                          |
| 1 GREEN | Append getWearEventByIdForViewer DAL (three-tier gate, G-4 outer, G-5 self-bypass)                                       | ec326c3 | src/data/wearEvents.ts                                                                                                                        |
| 2    | /wear/[wearEventId] Server Component + WearDetailHero + WearDetailMetadata (native img for hero, signed URL inline)        | ee00c95 | src/app/wear/[wearEventId]/page.tsx, src/components/wear/WearDetailHero.tsx, src/components/wear/WearDetailMetadata.tsx                       |

## Tasks Pending

| Task | Name                                        | Status     | Reason                                                                                                                      |
| ---- | ------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| 3    | Manual iOS UAT (Phase 15 aggregate)        | CHECKPOINT | jsdom cannot simulate iOS Safari gesture context; iOS Simulator does not grant real camera access. Physical iPhone + HTTPS tunnel required. Returned to orchestrator. |

## Verification Results (automated portion)

| Check                                                                                | Result                                                                                                                                                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`                                                                   | 3 pre-existing errors only (layout.tsx LayoutProps; PreferencesClient.debt01 ×2 — same set flagged in 15-01/02/03a/03b, documented in deferred-items.md)           |
| `npm run lint` (scoped to new files)                                                 | 0 errors, 0 warnings on: src/app/wear/[wearEventId]/page.tsx, src/components/wear/WearDetailHero.tsx, src/components/wear/WearDetailMetadata.tsx                    |
| `npm run test -- tests/integration/phase15-wear-detail-gating.test.ts`               | 14/14 skip cleanly without DATABASE_URL (env-gated, matches home-privacy.test.ts)                                                                                  |
| `npm run test -- tests/integration/home-privacy.test.ts` (regression)                | 5/5 skip cleanly (unchanged from 15-03b baseline — WYWT-18 non-regression via DAL discipline)                                                                      |
| `npm run test` (full suite)                                                          | 84 files PASS, 2691 tests PASS, 149 skipped (env-gated integration suites), 0 failures                                                                             |
| `npx next build` (Turbopack)                                                         | Compiled successfully; /wear/[wearEventId] listed under Partial Prerender routes; no build errors or warnings related to the new route                              |
| `grep -rn "'use cache'" src/app/wear/`                                               | 0 matches (page discipline)                                                                                                                                         |
| `grep -rn "createSignedUrl" src/data/`                                               | 0 matches in wearEvents.ts (DAL discipline)                                                                                                                         |
| `grep -rn "next/image" src/app/wear/`                                                | 0 matches (native img discipline for signed-URL hero)                                                                                                               |
| `grep -rn "WywtOverlay" src/components/home/`                                        | 6 matches (Phase 10 overlay import + lazy target + JSX in WywtRail.tsx + WywtOverlay.tsx definition — all preserved; WYWT-18 non-regression)                        |
| `grep -n "^export async function" src/data/wearEvents.ts`                            | 10 exports (9 pre-existing byte-unchanged + 1 new `getWearEventByIdForViewer`)                                                                                     |
| `git diff fe0ca53..HEAD -- src/data/wearEvents.ts`                                   | Only additions — existing exports byte-unchanged                                                                                                                    |

## Test Count

| Block                                    | Tests | Status    |
| ---------------------------------------- | ----- | --------- |
| Privacy matrix (9 cells)                 | 9     | SKIP (env) |
| Edge cases (4 cells: 10, 11, 12, 13)     | 4     | SKIP (env) |
| Shape contract (JOIN fields + raw path)  | 1     | SKIP (env) |
| **Plan 15-04 Wave 0 total**              | **14** | **SKIP (env-gated); compile-GREEN** |

Plan expected "9 privacy matrix + 4 edge = 13 tests". Shipped 14 (added one shape-contract assertion that pins the JOIN fields the page depends on + the Pitfall F-2 raw-path invariant). Privacy-first ordering rule applied: negative cells (6, 8, 9, 10, 11, 13) run BEFORE positive cells (1, 2, 3, 4, 5, 7, 12) — catches inverted G-3 / missing G-4 fast.

## Signed URL TTL Decision

**Chosen:** 60 minutes.

**Rationale:**
- Long enough that a user who opens a link, steps away, and returns can still load the photo without a fresh request hitting the route handler (common iOS Safari pattern — tab stays in memory but backgrounded).
- Short enough that the exfiltration window for a copy-pasted URL is bounded. If a user shares the link in a group chat, the photo is viewable for ≤60 min to downstream recipients before re-minting would be needed.
- Matches plan CONTEXT.md D-23 suggestion and Pitfall F-2 revisit trigger: if users start reporting stale-URL breakage from long-open tabs, TTL can be shortened to 5-15 min or the page can add a client-side refresh-on-focus hook.

**Alternative considered:** 5-minute TTL (stricter exfiltration bound). Rejected because a 5-min token would expire while the user is still actively viewing the page after a coffee break, forcing a hard page reload — bad UX for a feature that's supposed to be a durable URL.

## Decisions Made

1. **Plan's `@/components/ui/avatar` path does not exist.** Used existing `@/components/profile/AvatarDisplay` (size=40 variant) — it renders the same avatar + fallback initial pattern the plan's pseudo-code shows, just via the component already in use across FollowerListCard, ProfileHeader, SuggestedCollectorRow. The behavior contract in `<interfaces>` is preserved exactly.
2. **Plan's `formatRelativeTime` export name does not exist.** The actual export in `@/lib/timeAgo` is `timeAgo` (verified via Read). WywtSlide + NotificationRow + ActivityRow all use `timeAgo`. Same signature (`Date | string → string`), same semantic contract (Phase 10 UI-SPEC §Copywriting Contract). One-line renames don't matter — behavior is identical.
3. **No segment-level `not-found.tsx`.** Repo has no root `src/app/not-found.tsx` either — Next's default 404 page is the baseline. Adding a branded 404 is a 5-minute follow-up outside Phase 15 scope. Plan Step 4 explicitly permitted this decision.
4. **`next/image` for the 40px watch thumbnail in WearDetailMetadata.** The plan's "no next/image" rule applies to the HERO (signed URL token preservation). For the small watch thumbnail — which renders an already-public retailer URL the same way WywtSlide does — `next/image` with `unoptimized` is consistent with Phase 10 precedent. No signed URL involved.
5. **Deliberately NO `'use cache'` on the page.** Plan mandates this for Pitfall F-2. Verified: grep returns 0 matches for the directive string (comment text rephrased from `'use cache'` to "Cache Components directive" to keep the grep clean).

## Deviations from Plan

### [Rule 3 — Blocking] Plan's component imports reference symbols that don't exist

- **Found during:** Task 2 Step 1 (reading plan's verbatim code for WearDetailMetadata)
- **Issue:** Plan imports `Avatar, AvatarImage, AvatarFallback` from `@/components/ui/avatar` and `formatRelativeTime` from `@/lib/timeAgo`. Neither symbol exists in the repo. `@/components/ui/avatar.tsx` does not exist at all (only `@/components/profile/AvatarDisplay.tsx`); `@/lib/timeAgo.ts` exports `timeAgo`, not `formatRelativeTime`.
- **Fix:** Substituted existing equivalents — `AvatarDisplay` (size=40) for the avatar primitive and `timeAgo` for the relative-time helper. Behavior contract from `<interfaces>` preserved; UI matches plan's pseudo-code (avatar row + name + timestamp on the right).
- **Files modified:** `src/components/wear/WearDetailMetadata.tsx`
- **Committed in:** ee00c95

### [Rule 3 — Blocking] Worktree branch base advanced from agent-a5fc66b8 base to Wave 3 tip

- **Found during:** `<worktree_branch_check>` preflight
- **Issue:** My local HEAD (`b204ade`) was behind the expected base `fe0ca53...` (Wave 3 completion). Wave 1-3 work (15-01 through 15-03b) lived in upstream commits not on my branch.
- **Fix:** Reset hard to `fe0ca53232fb4f4be2696662cce52c91abfc2d6b` per plan directive so Wave 1-3 artifacts (DAL, Server Actions, Toaster, ComposeStep) were in place.
- **Files modified:** none — git-level only
- **Committed in:** N/A (pre-work reset)

### [Rule 3 — Blocking] node_modules missing in worktree

- **Found during:** First `npx tsc --noEmit` (post-reset)
- **Issue:** Worktree had no `node_modules/` directory. `npx next` + `vitest` would fail.
- **Fix:** Initially symlinked to parent project's `node_modules`, but parent was missing sonner/heic2any (dependencies added by Wave 1-2). Ran `npm install` inside the worktree which replaced the symlink with a real install (818 packages added). tsc then dropped to 3 pre-existing errors only.
- **Files modified:** none in git tree (package-lock.json unchanged)
- **Committed in:** N/A (worktree setup, not a source edit)

### No other deviations

Plan executed per spec for all `<done>` criteria on Tasks 1 & 2. No Rule-1 bug fixes, no Rule-2 missing-functionality additions, no Rule-4 architectural escalations.

## Authentication Gates

None encountered during automated work. The page route handles two auth states: authenticated (viewerId from getCurrentUser) and anonymous (UnauthorizedError caught → viewerId=null). Both branches resolve to the DAL, which handles null viewerId correctly per Cell 12 (public wear visible) and Cell 13 (followers wear denied) tests.

## Known Stubs

None. Every export is fully wired:
- `getWearEventByIdForViewer` runs real Drizzle queries against real tables (wear_events, profile_settings, profiles, watches, follows) — no placeholder data paths.
- `/wear/[wearEventId]` Server Component reads the DAL, mints a real signed URL via `createSupabaseServerClient().storage.createSignedUrl(...)`, and renders real `<WearDetailHero>` + `<WearDetailMetadata>` components.
- `WearDetailHero` has no placeholder paths — the fallback chain is real (hero image → watch image → muted placeholder with brand/model).
- `WearDetailMetadata` renders real `AvatarDisplay` with real username/avatarUrl, real `next/image` for watch thumbnail, real `timeAgo` timestamp.

The muted placeholder in the no-photo-no-watch-image branch is the designed contract (D-21), not a stub.

## Threat-Model Mitigations Verified

| Threat ID | Mitigation                                                                                                                                                          | Verification                                                                                                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-15-07 (I: response differential leaks existence) | DAL returns null for BOTH missing and denied; page calls notFound() uniformly — no HTTP status/headers/body diff                                                     | Test Cells 6 / 8 / 9 / 10 all assert `result.toBeNull()` — same code path leads to notFound() in the page; Cell 10's all-zero UUID test proves missing and denied are indistinguishable |
| T-15-21 (I: signed URL leak via cache)              | Signed URL minted INLINE in Server Component (not DAL). Page has no `'use cache'`. Verified by grep.                                                                  | grep -rn "'use cache'" src/app/wear/ → 0 matches; grep -rn "createSignedUrl" src/data/ → 0 matches in wearEvents.ts                                                                       |
| T-15-22 (I: signed URL leak via long TTL)           | 60-min TTL bounds exfiltration. Revisitable per TTL Decision section above.                                                                                           | Code review: `createSignedUrl(wear.photoUrl, 60 * 60)` in page.tsx — literal 3600 seconds                                                                                                 |
| T-15-23 (S: three-tier gate bypass via DAL hole)    | 14-cell integration test (9 matrix + 4 edge + 1 shape) — privacy-first ordering puts negative cells first                                                            | Test file exists at tests/integration/phase15-wear-detail-gating.test.ts; all 14 tests compile (GREEN) and skip cleanly without DB env — will run the full matrix on any DB-enabled run  |
| T-15-24 (T: viewer identity tampering)              | viewerId derived from `getCurrentUser()` session (server-side); never from client input or params.                                                                   | Code review: page.tsx lines 37-44 — viewerId is either the session user.id or null; no other code path can populate it                                                                    |
| T-15-25 (I: profile_public=false bypass)            | ALL non-owner branches check `actorProfilePublic === true` BEFORE inspecting visibility. Integration Cell 11 asserts this exact case.                                 | Test Cell 11 (stranger / public / actor.profile_public=false) → toBeNull() assertion pins the G-4 outer gate                                                                             |
| T-15-26 (E: next/image strips signed-URL query params) | Hero uses native `<img>` NOT next/image; architectural (not config-dependent) defense.                                                                              | grep -rn "next/image" src/app/wear/ → 0 matches; grep -rn "<img" src/components/wear/WearDetailHero.tsx → 1 match                                                                         |

## A5 Smoke at Scale (Plan 03a follow-up)

The Plan 03a summary noted A5 (session-client `.list()` probe) could not be exercised in the agent-a5fc66b8 worktree because Supabase env vars were absent. Plan 15-04 also cannot exercise A5 here for the same reason. The `logWearWithPhoto` Server Action continues to use `createSupabaseServerClient()` (cookie-bound session client) for the `.list()` existence probe — unchanged from 15-03a. If a subsequent DB-enabled run reveals the session-client cannot see its own just-uploaded object, the documented fallback (swap to a service-role admin client for the probe) stands; the manual iOS UAT in Task 3 is the first real-world test.

## Threat Flags

None — this plan's surfaces match the pre-registered threat model in the plan's `<threat_model>`. No new endpoints beyond `/wear/[wearEventId]`, no new auth paths, no new file access patterns beyond the `wear-photos` bucket already registered in Plan 01. All seven listed threats (T-15-07 / 21 / 22 / 23 / 24 / 25 / 26) have verified mitigations documented above.

## Self-Check

### Files exist (verified via `ls` + `git ls-files`):

- `src/data/wearEvents.ts` — FOUND (modified in ec326c3; +85 lines, existing 9 exports byte-unchanged)
- `src/app/wear/[wearEventId]/page.tsx` — FOUND (created in ee00c95)
- `src/components/wear/WearDetailHero.tsx` — FOUND (created in ee00c95)
- `src/components/wear/WearDetailMetadata.tsx` — FOUND (created in ee00c95)
- `tests/integration/phase15-wear-detail-gating.test.ts` — FOUND (created in 8c2ecaa)
- `.planning/phases/15-wywt-photo-post-flow/15-04-SUMMARY.md` — being written now

### Commits exist (verified via `git log --oneline fe0ca53..HEAD`):

- `8c2ecaa` — test(15-04): add failing 9-cell privacy matrix + shape contract — FOUND
- `ec326c3` — feat(15-04): add getWearEventByIdForViewer DAL with three-tier privacy gate — FOUND
- `ee00c95` — feat(15-04): ship /wear/[wearEventId] Server Component page + hero + metadata — FOUND

### Re-runs before sign-off:

- `npm run test -- tests/integration/phase15-wear-detail-gating.test.ts --run` — 14/14 SKIP (env-gated); compile-GREEN
- `npm run test` (full) — 84 files PASS, 2691 tests PASS, 149 skipped, 0 failures
- `npx tsc --noEmit` — 3 pre-existing errors only
- `npm run lint` on new files — 0 errors, 0 warnings
- `npx next build` — compiled successfully; /wear/[wearEventId] route visible under Partial Prerender
- All plan-level greps verified (0 matches for `'use cache'` in src/app/wear/; 0 matches for `createSignedUrl` in src/data/; 0 matches for `next/image` in src/app/wear/; 6 matches for `WywtOverlay` in src/components/home/)

## Self-Check: PASSED

## Plan Success Criteria — Final Status (automated portion)

| #   | Criterion                                                                                                      | Status                                         |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `getWearEventByIdForViewer` returns null for all denied cases uniformly with missing-row                       | DONE (Cells 6 / 8 / 9 / 10 / 11 / 13 test file) |
| 2   | `/wear/[wearEventId]` renders hero + metadata for visible cases; notFound() for denied cases                   | DONE (page.tsx line 47: `if (!wear) notFound()`) |
| 3   | Signed URL minted inline in Server Component with 60-min TTL; never cached                                     | DONE (page.tsx line 56: `createSignedUrl(..., 60*60)`) |
| 4   | No-photo → watch image fallback; no-watch-image → muted placeholder                                            | DONE (WearDetailHero fallback chain)            |
| 5   | Native `<img>` for hero (NOT next/image); images.unoptimized already configured                                | DONE (native `<img>` in WearDetailHero; eslint-disable of no-img-element scoped to that single line) |
| 6   | Phase 10 WywtOverlay pathway unchanged (WYWT-18 non-regression)                                                | DONE (grep shows 6 matches preserved in src/components/home/) |
| 7   | 9-cell privacy matrix + 4 edge-case integration tests all green when env vars present                          | DONE — compile-GREEN; skip cleanly without env; will run the full matrix on DB-enabled run |
| 8   | Manual iOS UAT checklist signed off                                                                            | PENDING — Task 3 checkpoint returned to orchestrator for human testing |

## Manual iOS UAT Outstanding (Task 3)

The Phase 15 aggregate UAT checklist is the final gate before `/gsd-verify-work`. It covers 9 requirement areas (WYWT-04 / WYWT-05 / WYWT-06 / WYWT-12 / WYWT-16 / WYWT-17 / WYWT-18 / T-15-03 / GPS strip) and cannot be automated because:
- jsdom has no real camera backend
- iOS Simulator does not grant real camera access
- EXIF orientation edge cases require real iPhone imagery
- A physical iPhone + HTTPS tunnel is required

The orchestrator will prompt the user to run the UAT. When the user replies "approved" (or provides failing items), a continuation agent (or phase verifier) picks up from there.

---

*Phase: 15-wywt-photo-post-flow*
*Automated portion completed: 2026-04-24*
*Awaiting Manual iOS UAT sign-off (Task 3)*
