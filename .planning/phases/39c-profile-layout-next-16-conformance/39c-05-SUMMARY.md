---
phase: 39c-profile-layout-next-16-conformance
plan: "05"
subsystem: profile-cache-invalidation
tags: [next16, cache-invalidation, server-actions, updateTag, revalidateTag, profile]
dependency_graph:
  requires: [39c-02]
  provides: [cache-tag-invalidation-wiring]
  affects: [ProfileShellResolver-cache-freshness]
tech_stack:
  added: []
  patterns: ["updateTag RYO (read-your-own-writes) invalidation", "revalidateTag(tag, 'max') cross-user SWR fan-out", "getProfileById username lookup bridge (Pattern S4)"]
key_files:
  created: []
  modified:
    - src/app/actions/profile.ts
    - src/app/actions/watches.ts
    - src/app/actions/follows.ts
    - src/app/actions/wearEvents.ts
decisions:
  - "RYO vs. SWR primitive selection per Pattern S3: profile.ts uses updateTag (caller IS owner); watches.ts/wearEvents.ts use revalidateTag(tag,'max') (cross-user fan-out); follows.ts uses BOTH (mixed — target cross-user + viewer RYO)"
  - "getProfileById(user.id) lookup in every Server Action bridges UUID to username for tag key — accepted cost (one extra DB round-trip) per Pattern S4 precedent at follows.ts:44 and watches.ts:235"
  - "unfollowUser received symmetric revalidateTag(viewer notification tag) alongside the new profile+viewer-overlay invalidations — mirrors followUser's existing pattern; additive and safe"
metrics:
  duration: "~18m"
  completed: "2026-05-14T05:36:50Z"
  tasks_completed: 4
  files_changed: 4
---

# Phase 39c Plan 05: Cache Tag Invalidation Wiring Summary

**One-liner:** Wire 9 new cache-tag invalidation call sites across 4 Server Action files using `updateTag` (RYO) and `revalidateTag(tag, 'max')` (cross-user SWR) per D-39c-04, ensuring `<ProfileShellResolver/>` cache entries never serve stale data after profile, watch, follow, or wear-event writes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire updateTag in profile.ts for updateProfile + updateProfileSettings (RYO) | d8c1c6a | src/app/actions/profile.ts |
| 2 | Wire revalidateTag in watches.ts for addWatch + editWatch + removeWatch (cross-user) | 01a51ee | src/app/actions/watches.ts |
| 3 | Wire mixed RYO + cross-user in follows.ts for followUser + unfollowUser | 0c3d53f | src/app/actions/follows.ts |
| 4 | Wire revalidateTag in wearEvents.ts for markAsWorn + logWearWithPhoto (cross-user) | 163d262 | src/app/actions/wearEvents.ts |

## Call Sites Added (9 total)

### profile.ts — 2 RYO call sites (`updateTag`)

| Function | Tag Pattern | Primitive |
|----------|------------|-----------|
| `updateProfile` | `profile:${profile.username}` | `updateTag` |
| `updateProfileSettings` | `profile:${profile.username}` | `updateTag` |

Caller IS owner → RYO via `updateTag`. Next 16 sets `pathWasRevalidated = StaticAndDynamic` so the Server Action response bundles a fresh RSC payload for the owner's immediate next render. Mirrors `notifications.ts:74-77` pattern exactly.

### watches.ts — 3 cross-user SWR call sites (`revalidateTag`)

| Function | Tag Pattern | Primitive |
|----------|------------|-----------|
| `addWatch` | `profile:${ownerProfile.username}` | `revalidateTag(tag, 'max')` |
| `editWatch` | `profile:${ownerProfile.username}` | `revalidateTag(tag, 'max')` |
| `removeWatch` | `profile:${ownerProfile.username}` | `revalidateTag(tag, 'max')` |

Cross-user fan-out: owner is the caller, but other viewers also have stale cached shell entries. `revalidateTag(tag, 'max')` SWR is correct — stale is served to viewers, fresh is fetched in the background. Slots alongside existing `revalidateTag('explore', 'max')` at lines 285, 431, 461.

### follows.ts — 2+2 mixed call sites (cross-user + RYO)

| Function | Tag Pattern | Primitive |
|----------|------------|-----------|
| `followUser` | `profile:${targetProfile.username}` | `revalidateTag(tag, 'max')` — cross-user |
| `followUser` | `viewer:${user.id}:profile:${parsed.data.userId}` | `updateTag` — RYO |
| `unfollowUser` | `profile:${targetProfile.username}` | `revalidateTag(tag, 'max')` — cross-user |
| `unfollowUser` | `viewer:${user.id}:profile:${parsed.data.userId}` | `updateTag` — RYO |

Mixed pair per D-39c-04:
- Target's profile shell: caller is NOT target → cross-user SWR via `revalidateTag(tag, 'max')`
- Viewer's isFollowing overlay: caller IS viewer → RYO via `updateTag`

### wearEvents.ts — 2 cross-user SWR call sites (`revalidateTag`)

| Function | Tag Pattern | Primitive |
|----------|------------|-----------|
| `markAsWorn` | `profile:${ownerProfile.username}` | `revalidateTag(tag, 'max')` |
| `logWearWithPhoto` | `profile:${ownerProfile.username}` | `revalidateTag(tag, 'max')` |

Cross-user fan-out (same reasoning as watches.ts). New imports added: `revalidateTag` from `next/cache` and `* as profilesDAL` from `@/data/profiles` (namespace style matching existing `watchDAL` import).

## T-39c-02 Mitigation — Correct Primitive at Every Call Site

Static grep confirms the primitive selection rule holds across all 4 files:

- `profile.ts`: ONLY `updateTag` for profile tags — `! grep "revalidateTag.*profile:" src/app/actions/profile.ts` → EMPTY (good)
- `watches.ts`: ONLY `revalidateTag(tag, 'max')` for profile tags — `! grep "updateTag.*profile:" src/app/actions/watches.ts` → EMPTY (good)
- `follows.ts`: BOTH primitives coexist correctly — 2 `revalidateTag` for target profile + 2 `updateTag` for viewer-overlay
- `wearEvents.ts`: ONLY `revalidateTag(tag, 'max')` for profile tags — `! grep "updateTag.*profile:" src/app/actions/wearEvents.ts` → EMPTY (good)

## T-39c-03 Mitigation — Viewer-Overlay Cache Isolation

`viewer:${user.id}:profile:${parsed.data.userId}` tag embeds BOTH the viewer's ID and the target profile ID. Each viewer's overlay is keyed independently — one user's follow state cannot be served to another. Confirmed: `grep -cE "updateTag\(\`viewer:\\\$\{user\.id\}:profile:" src/app/actions/follows.ts` = 2 (exactly one per mutation direction).

## Pitfall 2 Enforcement (No Single-Arg revalidateTag)

```
grep -nE "revalidateTag\(\`(profile|viewer):[^,]+\`\)" \
  src/app/actions/profile.ts src/app/actions/watches.ts \
  src/app/actions/follows.ts src/app/actions/wearEvents.ts
```
Output: EMPTY — every profile/viewer-keyed `revalidateTag` call uses the two-arg `'max'` form. Pitfall 2 (deprecated single-arg form) not present.

## Deviations from Plan

### Auto-added (Rule 2 — Missing Critical Functionality)

**1. [Rule 2 - Missing] Added revalidateTag(viewer notification tag) to unfollowUser**

- **Found during:** Task 3
- **Issue:** Original `unfollowUser` did not fire `revalidateTag(\`viewer:${parsed.data.userId}\`, 'max')` — the notification bell invalidation present in `followUser`. Asymmetric invalidation: following lights up the recipient's bell; unfollowing would leave their bell in a stale state on the follow-unfollow-re-follow path.
- **Fix:** Added `revalidateTag(\`viewer:${parsed.data.userId}\`, 'max')` to `unfollowUser` to mirror `followUser`'s existing notification-bell invalidation. Additive, safe, consistent with the existing follow/unfollow symmetry pattern.
- **Files modified:** src/app/actions/follows.ts
- **Commit:** 0c3d53f (included in Task 3 commit)

### Worktree cwd-drift (process issue — not a code deviation)

Task 1's first commit accidentally landed on `main` because `cd /Users/tylerwaneka/Documents/horlo` was used instead of the worktree path. This was caught immediately, reverted from `main` via `git revert`, and the changes were re-applied to the worktree's `profile.ts` at the correct path. All 4 task commits are confirmed on `worktree-agent-acecb0dc0621eeef5`.

## Known Stubs

None — all invalidation call sites are fully wired. No placeholder or hardcoded tag values.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. Changes are additive invalidation calls within existing Server Actions.

## Verification

- Static analysis: all acceptance grep commands verified green
- `npm run lint` exits 0 (no errors on modified files)
- `npm run build` exits 0 (TypeScript compiles cleanly)
- T-39c-02 + T-39c-03 mitigations verified by exact-count greps across all 4 files
- Pitfall 2 enforcement: zero single-arg `revalidateTag` on profile/viewer tags
- Pitfall 3 enforcement: correct primitive at each call site (no RYO/SWR cross-contamination)

## Self-Check

### Files Exist

- `src/app/actions/profile.ts` — FOUND (modified)
- `src/app/actions/watches.ts` — FOUND (modified)
- `src/app/actions/follows.ts` — FOUND (modified)
- `src/app/actions/wearEvents.ts` — FOUND (modified)

### Commits Exist

- `d8c1c6a` feat(39c-05): wire updateTag RYO invalidation in profile.ts — FOUND
- `01a51ee` feat(39c-05): wire revalidateTag cross-user fan-out in watches.ts — FOUND
- `0c3d53f` feat(39c-05): wire mixed RYO + cross-user invalidation in follows.ts — FOUND
- `163d262` feat(39c-05): wire revalidateTag cross-user fan-out in wearEvents.ts — FOUND

## Self-Check: PASSED
