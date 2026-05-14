---
phase: 39c-profile-layout-next-16-conformance
plan: "02"
subsystem: profile-cache
tags: [next16, use-cache, server-component, cacheTag, cacheLife, profile]
dependency_graph:
  requires: []
  provides: [ProfileShellResolver]
  affects: [profile-gate-plan-03]
tech_stack:
  added: []
  patterns: ["'use cache' Server Component preamble (PopularCollectors.tsx shape)", "Promise.all owner-scoped DAL fan-in", "cacheTag + cacheLife 300s prerender-qualified cache"]
key_files:
  created:
    - src/app/u/[username]/profile-shell-resolver.tsx
  modified: []
decisions:
  - "Single-tag form cacheTag('profile:${username}') per D-39c-02 — avoids cross-profile fan-out hazard; one cache entry shared across all viewers for same profile"
  - "JSDoc documents Pitfall 1 verbatim (viewerId MUST NOT enter cached scope) — mirrors PopularCollectors.tsx:9-13 pattern"
  - "computeTasteTags runs inside cached scope (pure function, safe per research)"
  - "Pre-existing lint errors in layout.tsx/FilterBar.tsx/test files are out-of-scope; new file has zero lint issues"
metrics:
  duration: "2m 17s"
  completed: "2026-05-14T02:33:21Z"
  tasks_completed: 1
  files_changed: 1
---

# Phase 39c Plan 02: ProfileShellResolver ('use cache' Preamble) Summary

**One-liner:** `ProfileShellResolver` — async Server Component with `'use cache'` + `cacheTag('profile:${username}')` + `cacheLife({ revalidate: 300 })` preamble, fanning into 5 owner-scoped DAL functions via `Promise.all`, returning `{ profile, settings, counts, watches, wearEvents, tasteTags } as const`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Author ProfileShellResolver with 'use cache' preamble + Promise.all DAL fan-in | 5004e1f | src/app/u/[username]/profile-shell-resolver.tsx |

## File Created

**`src/app/u/[username]/profile-shell-resolver.tsx`** (57 lines)

The 4-line cache preamble (verbatim from PopularCollectors.tsx pattern):
```typescript
export async function ProfileShellResolver({ username }: { username: string }) {
  'use cache'
  cacheTag(`profile:${username}`)
  cacheLife({ revalidate: 300 }) // 300s = 5min; qualifies for prerender (cacheLife.md:254-258)
```

Return shapes:
- Early-return (profile not found): `{ profile: null } as const`
- Full return: `{ profile, settings, counts, watches, wearEvents, tasteTags } as const`

Both `as const` — load-bearing for downstream gate's `if (!resolved.profile) notFound()` narrowing.

## T-39c-01 Mitigation — Pitfall 1 Enforcement

Static grep result (verified):
```
grep -nE "getCurrentUser|cookies\(|headers\(|isFollowing|resolveCommonGround|viewerId|viewer\.id" \
  src/app/u/[username]/profile-shell-resolver.tsx
```
Output: 2 matches, both in JSDoc comment lines (the Pitfall 1 warning documentation), **zero code references**.

The JSDoc mentions these symbols to document what NOT to do — identical to the PopularCollectors.tsx:9-13 pattern. No runtime call to any viewer-scoped read exists in the cached scope.

## Single-Tag Decision (D-39c-02)

Plan locks single-tag form: `cacheTag('profile:${username}')`.

Rationale per D-39c-02: single tag avoids cross-profile fan-out hazard. One cache entry per username, shared across all viewers (correct for owner-scoped data). PATTERNS.md open question #1 floated dual-tag (`profile:${id}` + `profile:${username}`) for tolerance — not adopted here; single-tag keeps the cache key minimal and the invalidation surface predictable.

## Note for Downstream Plan 03 (ProfileGate)

The gate calls `await ProfileShellResolver({ username })` to consume the cached aggregate. It must:
1. Resolve `viewerId` OUTSIDE the `ProfileShellResolver` scope (Pitfall 1)
2. Call `notFound()` when `resolved.profile === null`
3. Branch locked vs. public using `resolved.settings.profilePublic` + `isOwner`

The `as const` return shapes are what enable TypeScript narrowing in the gate after the `notFound()` guard.

## Verification

- File presence: 1 new file created
- Static analysis: all acceptance criteria pass (grep-verified)
- T-39c-01 mitigation: explicit, grep-verified — zero code references to viewer-scoped reads
- Build: `npm run build` exits 0 — resolver compiles cleanly as unused module (not yet wired into layout)
- Lint: `npm run lint` — new file has zero lint issues; 58 pre-existing errors in other files are out of scope (scope boundary per deviation rules)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this file is a pure data aggregator. All fields in the return shape are populated from live DAL calls or derived computations. No hardcoded empty values, placeholder text, or unwired props.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The `ProfileShellResolver` is a read-only cached aggregator; it accesses existing DAL functions. T-39c-01 (Information Disclosure via viewer data in cached scope) is explicitly mitigated.

## Self-Check

### Files Exist

- `src/app/u/[username]/profile-shell-resolver.tsx` — FOUND

### Commits Exist

- `5004e1f` feat(39c-02): add ProfileShellResolver with 'use cache' preamble — FOUND

## Self-Check: PASSED
