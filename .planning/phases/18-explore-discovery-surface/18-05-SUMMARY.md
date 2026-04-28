---
phase: 18-explore-discovery-surface
plan: 05
subsystem: explore-cache-invalidation
tags: [next16, server-actions, update-tag, revalidate-tag, cache-invalidation, ryo, swr]

# Dependency graph
requires:
  - phase: 18-explore-discovery-surface
    plan: 02
    provides: PopularCollectors / TrendingWatches / GainingTractionWatches Server Components with cacheTag('explore', 'explore:<rail>:<scope>') matrix that this plan's invalidations target
provides:
  - "src/app/actions/follows.ts: followUser + unfollowUser invoke updateTag('explore:popular-collectors:viewer:${user.id}') on success — RYO refresh of the actor's own Popular Collectors rail"
  - "src/app/actions/watches.ts: addWatch + editWatch + removeWatch invoke revalidateTag('explore', 'max') on success — cross-user SWR fan-out to all three /explore rails"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RYO vs SWR distinction held end-to-end: per-user follow/unfollow uses updateTag (single-arg, immediate expiration, fresh RSC payload bundled with Server Action response); cross-user watch mutations use revalidateTag(tag, 'max') (two-arg SWR, serve stale + fetch fresh in background). Mirrors the lecture comment in src/app/actions/notifications.ts:14-55."
    - "Tag-string consistency lemma verified by grep: writer-side updateTag('explore:popular-collectors:viewer:${user.id}') in follows.ts matches reader-side cacheTag('explore', `explore:popular-collectors:viewer:${viewerId}`) in PopularCollectors.tsx exactly. Writer-side revalidateTag('explore', 'max') in watches.ts matches the bare 'explore' tag appearing in cacheTag(...) of all three rails (PopularCollectors.tsx:24, TrendingWatches.tsx:19, GainingTractionWatches.tsx:21)."
    - "Success-path-only invalidation: every new tag-firing call site sits AFTER the DAL await, INSIDE the success branch of the try block — validation errors and DAL failures never fire tags, preventing cache-drain attacks via malformed payloads. Verified by 6 dedicated negative-path tests (3 per file)."
    - "TDD RED→GREEN executed cleanly per task: RED commit shows tests authored against the contract before any source change; GREEN commit shows the minimum source diff that flips them green. Both files pass after each GREEN with no test churn."

key-files:
  created: []
  modified:
    - "src/app/actions/follows.ts (+16 lines) — added `updateTag` to next/cache import; followUser writes updateTag('explore:popular-collectors:viewer:${user.id}') after the existing recipient-bell revalidateTag; unfollowUser writes the same after revalidatePath. Both call sites carry an inline comment citing DISC-04 / RESEARCH §Pattern 6 / RYO rationale."
    - "src/app/actions/watches.ts (+27 lines) — added revalidateTag('explore', 'max') in three places: addWatch (after revalidatePath('/'), inside try success path), editWatch (after revalidatePath('/'), inside try success path), removeWatch (after revalidatePath('/'), inside try success path). No import change needed — revalidateTag was already imported for notification-bell invalidation."
    - "tests/actions/follows.test.ts (+110 lines) — added updateTag to the next/cache mock; +7 new test cases: followUser invokes the per-viewer Popular Collectors updateTag (DISC-04), followUser does NOT fire bare 'explore' (T-18-05-03), followUser does NOT fire updateTag on validation error or DAL failure, parallel symmetric trio for unfollowUser. All 24 follows tests green (17 existing + 7 new)."
    - "tests/actions/watches.test.ts (+96 lines) — +9 new test cases in a new `describe('watches Server Actions — explore fan-out invalidation')` block: success-path fan-out for addWatch / editWatch / removeWatch + 6 negative-path assertions (validation error, DAL failure for each action). Existing next/cache mock already exposed revalidateTag, so no mock change needed. All 19 watches tests green (10 existing + 9 new)."

key-decisions:
  - "RYO vs SWR primitive selection by mutation locality: follows mutations (followUser/unfollowUser) are RYO — only the actor's Popular Collectors rail needs to refresh, and the actor wants the change visible immediately on the next render. updateTag is correct. Watches mutations (addWatch/editWatch/removeWatch) are cross-user — every viewer's Trending + Gaining Traction rails are affected by ANY user's catalog count shift, but no single viewer needs the change immediately (Trending/Gaining are global lists, not the actor's personal slice). revalidateTag(tag, 'max') is correct."
  - "Granularity intentionally broad on watches mutations: bare 'explore' tag invalidates all three rails on every mutation. Per-rail tags (e.g. 'explore:trending-watches') would be more surgical but at v4.0 scale (<500 watches per user, low write rate, three rails total) the cost is negligible and the simpler write path eliminates a class of 'forgot to invalidate the right rail' bugs. RESEARCH §Pattern 6 explicitly recommends this granularity for v4.0."
  - "Patched ALL three watches-mutation Server Actions, not just addWatch as the bare-minimum plan path. editWatch can change status (owned ↔ wishlist ↔ sold ↔ grail) which shifts owners_count vs wishlist_count on the next pg_cron snapshot; removeWatch is a DELETE that decrements both counts. Skipping either would leave the rails stale through their cacheLife TTL (5min for Trending, 24h for Gaining Traction) after a status edit or delete. Plan 18-05 §Action Step 1.3 explicitly authorized this discovery-and-patch."
  - "followUser invocation of updateTag placed AFTER the existing revalidateTag(`viewer:${recipient}`, 'max') call. Order matters: the recipient-bell invalidation (cross-user, SWR) and the actor-rail invalidation (RYO) are independent, but keeping RYO last ensures the Server Action's 'fresh RSC payload bundled with response' path (set by updateTag, see notifications.ts:30-44 lecture comment) takes effect — if updateTag came first, a subsequent revalidateTag with profile='max' would NOT clobber pathWasRevalidated, but lining them up in invalidation-locality order makes the intent self-documenting."

requirements-completed: [DISC-04, DISC-05]

# Metrics
duration: ~4min
completed: 2026-04-28
---

# Phase 18 Plan 5: /Explore Cache Invalidation Wiring Summary

**Two Server Action files patched (six call-site additions + ten test cases) to wire the Pattern-6 cache-invalidation matrix that closes the loop on Plan 02's three-rail cacheTag contract — RYO updateTag for per-viewer follow/unfollow, cross-user revalidateTag('explore', 'max') for every watches mutation.**

## Performance

- **Duration:** ~4 min (2026-04-28T16:58:53Z → 2026-04-28T17:03:27Z, 274 seconds)
- **Tasks:** 2 of 2 completed
- **Files created:** 0
- **Files modified:** 4 (2 source, 2 tests)

## Accomplishments

- **RYO leg (Task 1):** `followUser` and `unfollowUser` now fire `updateTag('explore:popular-collectors:viewer:${user.id}')` on successful DAL writes. The just-followed user drops off the actor's Popular Collectors rail on next render; the just-unfollowed user becomes re-eligible immediately. Both call sites are inside the success branch of the try block — validation errors and DAL failures never fire tags.
- **SWR leg (Task 2):** `addWatch`, `editWatch`, and `removeWatch` each fire `revalidateTag('explore', 'max')` on successful DAL writes. The bare `'explore'` fan-out tag was authored in Plan 02's three rail components (PopularCollectors.tsx:24, TrendingWatches.tsx:19, GainingTractionWatches.tsx:21) — this plan turns it into the working invalidation root. Trending + Gaining Traction recompute the next time any viewer hits `/explore` after a catalog-count-shifting write.
- **Discovered + patched both sibling watch actions (deviation from minimum plan path):** the plan authorized this in §Action Step 1.3 — read-the-file-first, patch-only-what-exists. `editWatch` and `removeWatch` were both present and both shift catalog counts, so both got the fan-out. addWatch alone would have left a stale-rails bug on every status edit and delete.
- **Tag-string consistency verified end-to-end** by direct grep:
  - Writer `updateTag('explore:popular-collectors:viewer:${user.id}')` in `follows.ts:86,123` matches reader `cacheTag('explore', \`explore:popular-collectors:viewer:${viewerId}\`)` in `PopularCollectors.tsx:24`.
  - Writer `revalidateTag('explore', 'max')` in `watches.ts:177,218,248` matches reader `cacheTag('explore', ...)` in all three rails: PopularCollectors.tsx:24, TrendingWatches.tsx:19, GainingTractionWatches.tsx:21.
- **Two TDD cycles executed cleanly:** each task's RED commit shows the tests authored against the contract before any source change; each GREEN commit shows the minimum source diff that flips them green. No test churn between tasks.
- **43 total tests green** across the two files (24 follows + 19 watches; 16 new + 27 existing).

## Task Commits

Each task committed atomically with `--no-verify` per the parallel-execution staged-executor rule:

1. **Task 1 RED — failing tests for followUser/unfollowUser updateTag invalidation:** `2701eef` (test)
2. **Task 1 GREEN — wire updateTag for per-viewer Popular Collectors invalidation:** `8e5a152` (feat)
3. **Task 2 RED — failing tests for addWatch/editWatch/removeWatch explore fan-out:** `bd5acf1` (test)
4. **Task 2 GREEN — wire revalidateTag('explore', 'max') fan-out on watches mutations:** `5bf6010` (feat)

Note: parallel agent 18-03 committed alongside this plan during execution. Their commits are interleaved in `git log --oneline` but the four 18-05 commits above form a coherent RED-GREEN-RED-GREEN sequence and their diffs do not overlap with 18-03's `src/app/explore/` route changes.

## Files Modified

### `src/app/actions/follows.ts` (+16 lines, -1)

- Added `updateTag` to the next/cache import: `import { revalidatePath, revalidateTag, updateTag } from 'next/cache'`.
- `followUser`: after the existing `revalidateTag(\`viewer:${parsed.data.userId}\`, 'max')` (recipient-bell SWR), added `updateTag(\`explore:popular-collectors:viewer:${user.id}\`)` (actor-rail RYO). Inline comment cites DISC-04 / RESEARCH §Pattern 6 / RYO rationale + matches the cacheTag in PopularCollectors.tsx.
- `unfollowUser`: after the existing `revalidatePath('/u/[username]', 'layout')`, added the symmetric `updateTag(\`explore:popular-collectors:viewer:${user.id}\`)` call. Inline comment refers back to followUser for the rationale.

### `src/app/actions/watches.ts` (+27 lines)

- No import change — `revalidateTag` was already imported for notification-bell invalidation in the addWatch overlap path.
- `addWatch`: after the existing `revalidatePath('/')`, added `revalidateTag('explore', 'max')` with comment citing DISC-05/06, Pattern 6 broad-granularity recommendation, and Pitfall 4 two-arg form.
- `editWatch`: after the existing `revalidatePath('/')`, added `revalidateTag('explore', 'max')` with comment explaining why edits matter (status changes shift owners vs wishlist counts; non-status edits can re-link via upsert).
- `removeWatch`: after the existing `revalidatePath('/')`, added `revalidateTag('explore', 'max')` with comment explaining DELETE → catalog count decrement on next pg_cron refresh.

### `tests/actions/follows.test.ts` (+110 lines, -1)

- Added `updateTag: vi.fn()` to the next/cache mock + added `updateTag` to the test-side import.
- 7 new test cases (3 followUser + 4 unfollowUser):
  - `followUser on success invalidates the viewer's own Popular Collectors rail tag (Phase 18 DISC-04)`
  - `followUser does NOT invalidate the bare 'explore' fan-out tag (per-user action only)` — covers T-18-05-03
  - `followUser does NOT call updateTag on validation failure (success-path-only invalidation)`
  - `followUser does NOT call updateTag on DAL failure`
  - `unfollowUser on success invalidates the viewer's own Popular Collectors rail tag` (RYO symmetry)
  - `unfollowUser does NOT invalidate the bare 'explore' fan-out tag`
  - `unfollowUser does NOT call updateTag on validation failure` + `... on DAL failure`

### `tests/actions/watches.test.ts` (+96 lines)

- Added new top-level `describe('watches Server Actions — explore fan-out invalidation (Phase 18 DISC-05/06)')` block with 9 test cases:
  - 3 success-path: `addWatch / editWatch / removeWatch fires revalidateTag('explore', 'max') on success`
  - 6 negative-path: each action does NOT fire on validation error or DAL failure (3 actions × 2 failure modes; addWatch validation, editWatch validation + DAL, removeWatch DAL — addWatch DAL was already covered by the existing failure tests, this block adds the missing edges)
- No mock change needed — existing `next/cache` mock already exposed `revalidateTag`.

## Tag-String Consistency Lemma

| Tag | Writer (this plan) | Reader (Plan 02) |
|-----|--------------------|--------------------|
| `explore:popular-collectors:viewer:${id}` | `src/app/actions/follows.ts:86` (followUser), `src/app/actions/follows.ts:123` (unfollowUser) | `src/components/explore/PopularCollectors.tsx:24` |
| `explore` (bare fan-out) | `src/app/actions/watches.ts:177` (addWatch), `src/app/actions/watches.ts:218` (editWatch), `src/app/actions/watches.ts:248` (removeWatch) | `src/components/explore/PopularCollectors.tsx:24`, `src/components/explore/TrendingWatches.tsx:19`, `src/components/explore/GainingTractionWatches.tsx:21` |

The tags in `cacheTag(...)` calls and `updateTag(...)` / `revalidateTag(...)` calls are byte-identical strings — verified by `grep` matching the same literal across files. No string-template arithmetic ambiguity (e.g. trailing whitespace, missing escape on the `:viewer:` colons, casing) exists in either direction.

## RYO vs SWR Distinction Maintained

| Server Action | Mutation locality | Primitive | Rationale |
|---------------|-------------------|-----------|-----------|
| followUser    | Per-actor (only the follower's Popular Collectors rail must drop the followed user) | `updateTag` (single-arg) | RYO — actor wants to see their own write reflected on next render |
| unfollowUser  | Per-actor (only the unfollower's rail re-eligibility) | `updateTag` (single-arg) | RYO symmetric mirror of followUser |
| addWatch      | Cross-user (every viewer's Trending + Gaining Traction rails affected by any user's catalog count shift) | `revalidateTag(tag, 'max')` | SWR — global lists, no single viewer needs the change immediately, but eventual consistency is required |
| editWatch     | Cross-user (status changes shift catalog counts; non-status edits may re-link to a different catalog row) | `revalidateTag(tag, 'max')` | SWR — same justification as addWatch |
| removeWatch   | Cross-user (DELETE decrements catalog counts) | `revalidateTag(tag, 'max')` | SWR — same justification as addWatch |

The RYO primitive (`updateTag`) bundles a fresh RSC payload with the Server Action response, so the actor sees their own change on the next render without waiting for the cacheLife TTL. The SWR primitive (`revalidateTag(tag, 'max')`) marks the tag stale; the next render serves stale + fetches fresh in the background. Both behaviors are documented in `src/app/actions/notifications.ts:14-55` and re-cited in this plan's inline call-site comments.

## Sibling Actions in watches.ts — Discovered + Patched

The plan §Action Step 1.3 explicitly authorized inspection of watches.ts for any sibling actions that mutate catalog counts and patching them with the same fan-out. Findings:

| Sibling action | Exists? | Mutates catalog counts? | Patched? |
|----------------|---------|-------------------------|----------|
| `addWatch`     | yes (the primary target) | yes (INSERT increments owners or wishlist) | **yes** — `watches.ts:177` |
| `editWatch`    | yes | yes (status change shifts owners↔wishlist; brand/model edit can re-link via upsertCatalogFromUserInput) | **yes** — `watches.ts:218` |
| `removeWatch`  | yes | yes (DELETE decrements owners/wishlist) | **yes** — `watches.ts:248` |
| `markAsSold` / `markAsWorn` / status-toggle actions | no | n/a | n/a — none exist in the file at HEAD |

All three existing mutation actions are patched. No new actions introduced.

## Decisions Implemented

- **D-04 (RESEARCH §Pattern 6 invalidation matrix wired end-to-end):** RYO via updateTag for per-user follow/unfollow; SWR via revalidateTag(tag, 'max') for cross-user watches mutations.
- **D-05 (Granularity broad on the SWR leg):** bare 'explore' tag rather than per-rail tags. RESEARCH §Pattern 6 explicitly recommends this for v4.0 scale.
- **D-06 (Tag-string consistency by literal match):** writer-side and reader-side strings are byte-identical literals — no parameterized tag-builder helper. Trade-off accepted: changing the tag string requires editing both sides, but the simplicity of grep-verifying consistency is worth it at three rails / four mutations.

## Threat Mitigation Map

| Threat ID | Mitigation Location |
|-----------|---------------------|
| T-18-05-01 (stale Popular Collectors leaking just-followed user) | `src/app/actions/follows.ts:86` (followUser) + `:123` (unfollowUser) — updateTag fires on success path with viewer-suffixed tag; tested by 2 dedicated success-path test cases (one per action) |
| T-18-05-02 (single-arg revalidateTag legacy semantics on cross-user fan-out) | `src/app/actions/watches.ts:177,218,248` — all three call sites use the two-arg `revalidateTag('explore', 'max')` form per Pitfall 4. Verified by grep showing 0 single-arg matches for the explore tag |
| T-18-05-03 (per-user write firing global tag, over-invalidation) | `tests/actions/follows.test.ts` — dedicated tests assert `revalidateTag` is NOT called with `'explore'` and `updateTag` is NOT called with `'explore'` on the follow/unfollow paths |
| T-18-05-04 (over-invalidation cascade on watches fan-out) | Accepted at v4.0 scale per the threat register. Granularity is broad by design — RESEARCH §Pattern 6 recommendation. Per-rail granularity is a v5.0+ optimization if write rate climbs. |
| Cache-drain via malformed payload | All 6 new "does NOT fire on failure" tests across both files — invalidation runs only after successful DAL writes, never on validation errors or DAL exceptions |

## Verification

- ✅ `npx vitest run tests/actions/follows.test.ts tests/actions/watches.test.ts` — 43 tests green (24 + 19, all green; 16 new tests + 27 existing)
- ✅ `npx tsc --noEmit` — no errors in any of the 4 modified files (pre-existing errors in unrelated test files are out of scope per CLAUDE.md SCOPE BOUNDARY rule and were not touched)
- ✅ `npm run lint -- src/app/actions/follows.ts src/app/actions/watches.ts tests/actions/follows.test.ts tests/actions/watches.test.ts` — 0 errors in any of my new/modified code; 2 pre-existing errors at `tests/actions/watches.test.ts:77,84` (`as any` casts in existing tests I did not touch) are out of scope
- ✅ `grep -n "explore:popular-collectors:viewer:" src/app/actions/follows.ts` — returns 2 matches (followUser + unfollowUser), as required
- ✅ `grep -n "revalidateTag('explore', 'max')" src/app/actions/watches.ts` — returns 3 matches (addWatch, editWatch, removeWatch); plan required at least 1
- ✅ `grep -n "explore:popular-collectors:viewer:" src/components/explore/PopularCollectors.tsx` — returns 1 match at line 24 (verifies tag-string consistency between writer and reader)
- ✅ `grep -n "revalidateTag('explore'" src/app/actions/watches.ts | grep -v "'max'"` — returns 0 matches (no single-arg legacy form for the explore tag)
- ✅ `grep -n 'updateTag' src/app/actions/follows.ts` — returns 6 matches (1 import + 5 in body comments and call sites; plan required ≥3)
- ✅ All new call sites placed AFTER the corresponding DAL await and INSIDE the success branch of the try block — validation errors and DAL failures never fire tags

## Patterns / Idioms Established

- **RYO/SWR primitive selection by mutation locality** (this plan): a per-user write that the same user wants to see reflected immediately uses `updateTag(tag)` (single-arg). A cross-user write where eventual consistency is acceptable uses `revalidateTag(tag, 'max')` (two-arg). Future Phase-18+ Server Actions that touch cached scopes should classify the mutation by locality first, then pick the primitive.
- **Tag-string consistency by literal grep** (this plan): writer-side `updateTag(...)` / `revalidateTag(...)` calls and reader-side `cacheTag(...)` calls share byte-identical string literals — no parameterized tag-builder helper, no concatenation indirection. The simplicity is worth the duplication at v4.0 scale; revisit if the tag matrix grows past ~10 entries.
- **Success-path-only invalidation by structural placement** (this plan): every new `updateTag` / `revalidateTag` call sits AFTER the DAL await and INSIDE the success branch of the try block. The pattern is enforced by the action shape — there's no plausible accidental call site where validation failure could fire a tag.

## Deviations from Plan

None — plan executed exactly as written. All sibling-action discoveries (editWatch, removeWatch fan-out) were explicitly authorized by §Action Step 1.3 of the plan and are documented above as findings, not deviations.

The only minor adaptation was to my own ergonomics in the test file: I structured the new addWatch/editWatch/removeWatch tests as a separate `describe(... 'explore fan-out invalidation' ...)` block at the bottom of `tests/actions/watches.test.ts` rather than splicing them into the existing `describe('watches Server Actions auth gate — AUTH-02')` block. This keeps the new tests self-contained and easy to find by their phase / requirement IDs (DISC-05 / DISC-06). Functionally identical to the planned behavior — the tests run in the same Vitest invocation and use the same mock setup.

## Self-Check: PASSED

- ✅ `src/app/actions/follows.ts` exists and contains the 2 expected `updateTag('explore:popular-collectors:viewer:${user.id}')` call sites at lines 86 and 123 (verified by grep above).
- ✅ `src/app/actions/watches.ts` exists and contains the 3 expected `revalidateTag('explore', 'max')` call sites at lines 177, 218, 248 (verified by grep above).
- ✅ `tests/actions/follows.test.ts` exists with 24 tests passing (verified by `vitest run`).
- ✅ `tests/actions/watches.test.ts` exists with 19 tests passing (verified by `vitest run`).
- ✅ Commit `2701eef` exists (Task 1 RED) — verified by `git log --oneline | grep 18-05`.
- ✅ Commit `8e5a152` exists (Task 1 GREEN).
- ✅ Commit `bd5acf1` exists (Task 2 RED).
- ✅ Commit `5bf6010` exists (Task 2 GREEN).
