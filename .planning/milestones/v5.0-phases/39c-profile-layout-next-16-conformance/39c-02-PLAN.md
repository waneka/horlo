---
phase: 39c-profile-layout-next-16-conformance
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/u/[username]/profile-shell-resolver.tsx
autonomous: true
requirements: [NEXT16-CONFORMANCE]
threat_refs: [T-39c-01]
must_haves:
  truths:
    - "A cached Server Component owns the owner-scoped reads (profile, settings, counts, watches, wearEvents, tasteTags) keyed on username only"
    - "viewerId is NEVER read inside the cached scope (Pitfall 1)"
    - "Owner-scoped cache invalidates via the `profile:${username}` tag family"
    - "Cache lifetime is 300s (qualifies for prerender per cacheLife.md:254-258)"
  artifacts:
    - path: "src/app/u/[username]/profile-shell-resolver.tsx"
      provides: "ProfileShellResolver({ username }) — async function with 'use cache' / cacheTag('profile:${username}') / cacheLife({ revalidate: 300 }) preamble, returning { profile | null, settings, counts, watches, wearEvents, tasteTags } as const"
      contains: "export async function ProfileShellResolver"
  key_links:
    - from: "src/app/u/[username]/profile-shell-resolver.tsx"
      to: "@/data/profiles"
      via: "named imports getProfileByUsername, getProfileSettings, getFollowerCounts"
      pattern: "from '@/data/profiles'"
    - from: "src/app/u/[username]/profile-shell-resolver.tsx"
      to: "@/data/watches and @/data/wearEvents"
      via: "named imports getWatchesByUser, getAllWearEventsByUser"
      pattern: "from '@/data/(watches|wearEvents)'"
    - from: "src/app/u/[username]/profile-shell-resolver.tsx"
      to: "@/lib/tasteTags"
      via: "computeTasteTags (pure, safe inside cache scope)"
      pattern: "computeTasteTags"
---

<objective>
Author the `'use cache'` `<ProfileShellResolver/>` Server Component that holds all owner-scoped reads behind the Next 16 cache layer. Implements D-39c-03. Mirrors `src/components/explore/PopularCollectors.tsx` shape verbatim for the 4-line cache preamble.

Purpose: This resolver is the static-shell-friendly aggregator that the new `<ProfileGate/>` (Plan 03) will call. Caching here is what makes prefetching safe: the cache key is `username` only, so the same cached entry is served to all viewers of the same profile. Viewer-scoped reads (`isFollowing`, `resolveCommonGround`) live in the gate, NOT here — Pitfall 1.

Output: 1 new file. Independent of Plan 01 (the skeleton has no data deps) and Plan 05 (Server Action invalidation can wire in parallel).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-RESEARCH.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md

<interfaces>
<!-- Canonical analog — mirror this preamble verbatim -->

From src/components/explore/PopularCollectors.tsx:22-29:
```
export async function PopularCollectors({ viewerId }: { viewerId: string }) {
  'use cache'
  cacheTag('explore', `explore:popular-collectors:viewer:${viewerId}`)
  cacheLife({ revalidate: 300 })

  const collectors = await getMostFollowedCollectors(viewerId, { limit: 5 })
  if (collectors.length === 0) return null
```

<!-- DAL signatures the resolver depends on (verified during research) -->

From src/data/profiles.ts:
```
export async function getProfileByUsername(username: string): Promise<Profile | null>
export async function getProfileSettings(userId: string): Promise<ProfileSettings>
export async function getFollowerCounts(userId: string): Promise<{ followers: number; following: number }>
```

From src/data/watches.ts:
```
export async function getWatchesByUser(userId: string): Promise<WatchWithWear[]>
```

From src/data/wearEvents.ts:
```
export async function getAllWearEventsByUser(userId: string): Promise<WearEvent[]>
```

From src/lib/tasteTags.ts:
```
export function computeTasteTags(input: { watches: ..., totalWearEvents: number, collectionAgeDays: number }): TasteTag[]
```

<!-- Verified Next 16 API shapes from RESEARCH.md §Sources -->

From next/cache (verified at use-cache.md, cacheTag.md, cacheLife.md):
- `'use cache'` directive must be the FIRST statement of the function body, before any `await`s
- `cacheTag(tag1, tag2, ...)` accepts variadic string args; idempotent (cacheTag.md:88); 256-char limit per tag; 128-tag limit per scope
- `cacheLife({ revalidate: 300 })` inline profile is valid (cacheLife.md:218-238); `revalidate >= 300` qualifies for prerender (cacheLife.md:254-258)
- NEVER call `cookies()` / `headers()` / `getCurrentUser()` inside a `'use cache'` scope (use-cache.md:194-196) — Pitfall 1
- Arguments and return values must be serializable (use-cache.md:113-119); `username: string` and plain row objects pass
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author ProfileShellResolver with 'use cache' preamble + Promise.all DAL fan-in</name>
  <files>src/app/u/[username]/profile-shell-resolver.tsx</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-02 + §D-39c-03 (locked decisions: tag taxonomy + resolver shape)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-RESEARCH.md §Architecture Patterns → Pattern 1 + §Code Examples → Example 1 (the verbatim resolver pattern with verified Next 16 source references)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/app/u/[username]/profile-shell-resolver.tsx` section + §Pattern S1 (the 4-line preamble invariants)
    - src/components/explore/PopularCollectors.tsx (full file — canonical pattern; especially lines 1-29 for imports + JSDoc + cached preamble; lines 7-21 for the Pitfall 1 doc-comment structure to mirror)
    - src/components/notifications/NotificationBell.tsx (alternate analog with viewer-scoped tag — confirms Pitfall 1 propagation across the codebase)
    - src/app/u/[username]/layout.tsx lines 31-46 (current uncached fan-in shape — extract the data flow the resolver replaces; specifically the Promise.all at lines 38-46 and the computeTasteTags call after)
    - src/data/profiles.ts (verify the exact named exports getProfileByUsername / getProfileSettings / getFollowerCounts)
    - src/lib/tasteTags.ts (verify computeTasteTags is pure/sync — safe inside cached scope)
  </read_first>
  <action>
    Create `src/app/u/[username]/profile-shell-resolver.tsx`. Imports (verbatim mirror of PopularCollectors.tsx:1-5, adapted to this resolver's DAL surface):
    - `import { cacheLife, cacheTag } from 'next/cache'`
    - `import { getProfileByUsername, getProfileSettings, getFollowerCounts } from '@/data/profiles'`
    - `import { getWatchesByUser } from '@/data/watches'`
    - `import { getAllWearEventsByUser } from '@/data/wearEvents'`
    - `import { computeTasteTags } from '@/lib/tasteTags'`

    Do NOT add `import 'server-only'` — `'use cache'` already implies server-only and the analog (PopularCollectors.tsx) does not import it.

    Write a JSDoc block (10-15 lines) above the function. Mirror the structure of PopularCollectors.tsx:7-21: one-line purpose ("ProfileShellResolver — owner-scoped cached aggregator for the profile shell (D-39c-03)"); a CRITICAL block citing Pitfall 1 verbatim ("viewerId MUST NOT be read inside this scope — viewer-scoped reads live in `<ProfileGate/>`"); cache profile description ("per-username 5min revalidate; tag `profile:${username}` is invalidated by Server Actions in profile.ts / watches.ts / follows.ts / wearEvents.ts per D-39c-04"); empty-state policy ("if profile lookup returns null, return `{ profile: null } as const` — the gate calls `notFound()`").

    Export `async function ProfileShellResolver({ username }: { username: string })`. The function body MUST start with these four statements in this exact order (per Pattern S1 in PATTERNS.md and verified at PopularCollectors.tsx:22-25):
    1. `'use cache'` (string-literal directive, no `const`/`let`, no quotes-style variation beyond the project's existing single-quote convention)
    2. `cacheTag('profile:${username}')` — single tag (NOT two-tag — D-39c-02 specifies one tag per scope to avoid the cross-profile fan-out hazard documented in Pitfall 4); use a template literal so the tag includes the username verbatim
    3. `cacheLife({ revalidate: 300 })` — exactly 300s; documents in inline comment that this is the prerender-qualified threshold (cacheLife.md:254-258)
    4. (then) sequential profile lookup with early-return null branch

    Body shape:
    - `const profile = await getProfileByUsername(username)`
    - `if (!profile) return { profile: null } as const`
    - `const [settings, counts, watches, wearEvents] = await Promise.all([getProfileSettings(profile.id), getFollowerCounts(profile.id), getWatchesByUser(profile.id), getAllWearEventsByUser(profile.id)])`
    - Compute `earliestDate` (`watches.map(w => w.acquisitionDate).filter((d): d is string => Boolean(d)).sort()[0]`) and `collectionAgeDays` (`earliestDate ? Math.max(1, Math.floor((Date.now() - new Date(earliestDate).getTime()) / 86400000)) : 30`) per RESEARCH.md Example 1 lines 488-494
    - `const tasteTags = computeTasteTags({ watches, totalWearEvents: wearEvents.length, collectionAgeDays })`
    - `return { profile, settings, counts, watches, wearEvents, tasteTags } as const`

    The `as const` on both return paths is load-bearing: it lets the gate (Plan 03) narrow `profile` to non-null via the `if (!resolved.profile) notFound()` pattern.

    PROHIBITED inside this file (Pitfall 1 — T-39c-01 mitigation):
    - `import` of `getCurrentUser`, `UnauthorizedError`, `cookies`, `headers`, `isFollowing`, `resolveCommonGround`
    - Any reference to `viewerId`, `viewer.id`, `auth()`, `getCurrentUser`
    - Per D-39c-03: "Cache key is `username` only — that's correct for owner-scoped data."
  </action>
  <verify>
    <automated>test -f src/app/u/[username]/profile-shell-resolver.tsx && grep -c "'use cache'" src/app/u/[username]/profile-shell-resolver.tsx && grep -n "cacheTag(\`profile:" src/app/u/[username]/profile-shell-resolver.tsx && grep -n "cacheLife({.*revalidate:.*300" src/app/u/[username]/profile-shell-resolver.tsx && ! grep -nE "getCurrentUser|cookies\\(|headers\\(|isFollowing|resolveCommonGround|viewerId" src/app/u/[username]/profile-shell-resolver.tsx && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/app/u/[username]/profile-shell-resolver.tsx` exits 0
    - `grep -n "'use cache'" src/app/u/[username]/profile-shell-resolver.tsx` returns 1 match, and that match is the FIRST non-comment / non-brace statement of the function body (verify by reading the file — Task 1 verifier should inspect lines manually if grep order is ambiguous)
    - `grep -nE "cacheTag\\(\`profile:\\\$\\{username\\}\`\\)" src/app/u/[username]/profile-shell-resolver.tsx` returns 1 match (single-tag form per D-39c-02; template literal with `username` interpolation)
    - `grep -nE "cacheLife\\(\\{.*revalidate:\\s*300" src/app/u/[username]/profile-shell-resolver.tsx` returns 1 match (300s exactly)
    - `grep -n "export async function ProfileShellResolver" src/app/u/[username]/profile-shell-resolver.tsx` returns 1 match
    - `grep -nE "username\\s*:\\s*string" src/app/u/[username]/profile-shell-resolver.tsx` returns >= 1 match (the prop type signature)
    - `grep -n "Promise.all" src/app/u/[username]/profile-shell-resolver.tsx` returns 1 match
    - `grep -c "as const" src/app/u/[username]/profile-shell-resolver.tsx` returns 2 (both return paths)
    - `grep -n "computeTasteTags" src/app/u/[username]/profile-shell-resolver.tsx` returns >= 1 match (the resolver runs taste tag computation inside the cached scope per RESEARCH Example 1)
    - **T-39c-01 mitigation — Pitfall 1 enforcement (load-bearing):** `! grep -nE "getCurrentUser|cookies\\(|headers\\(|isFollowing|resolveCommonGround|viewerId|viewer\\.id" src/app/u/[username]/profile-shell-resolver.tsx` (NO viewer-scoped read inside the cached scope)
    - `! grep -n "'use client'" src/app/u/[username]/profile-shell-resolver.tsx` (Server Component — `'use cache'` implies server-only)
    - `npm run lint` exits 0
    - `npm run build` exits 0 (the resolver compiles standalone; it is not yet wired into the layout — that lands in Plan 03)
  </acceptance_criteria>
  <done>
    `src/app/u/[username]/profile-shell-resolver.tsx` exists with the 4-line cached preamble (`'use cache'` + `cacheTag('profile:${username}')` + `cacheLife({ revalidate: 300 })` + Promise.all), fans into the 5 owner-scoped DAL functions, computes tasteTags inside the cached scope, returns the aggregate `{ profile, settings, counts, watches, wearEvents, tasteTags } as const` shape, and proves T-39c-01 mitigation by static grep (no viewer-scoped read).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Request → cached resolver | Username (route param, untrusted user input) crosses into the cached scope. The cache key derives from `username` only — viewer identity NEVER enters the key. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-39c-01 | Information Disclosure | `<ProfileShellResolver/>` cached scope | mitigate | Resolver MUST NOT call `getCurrentUser()` / `cookies()` / `headers()` / `isFollowing()` / `resolveCommonGround()`. If any of those leak into the cached scope, the cache key omits viewer identity and the first viewer's overlay data is served to subsequent viewers (Pitfall 1 / use-cache.md:194-196). Static-analysis grep in Task 1 acceptance criteria enforces absence: `! grep -nE "getCurrentUser\|cookies\\(\|headers\\(\|isFollowing\|resolveCommonGround\|viewerId\|viewer\\.id" src/app/u/[username]/profile-shell-resolver.tsx`. |
</threat_model>

<verification>
- File presence: 1 new file
- Static analysis: all Task 1 acceptance criteria green
- T-39c-01 mitigation verified by absence-grep
- Build: `npm run build` exits 0 (resolver compiles cleanly even before the gate wires it — TypeScript treats it as an unused module which is fine at the build level)
</verification>

<success_criteria>
- New file: 1 (resolver)
- All acceptance criteria green
- T-39c-01 mitigation explicit and grep-verified
- `npm run build` exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/39c-profile-layout-next-16-conformance/39c-02-SUMMARY.md` capturing: file created, the 4-line preamble verbatim, the T-39c-01 mitigation grep result, the chosen single-tag vs. dual-tag decision (the plan locks single-tag per D-39c-02; record this choice for the orchestrator). Note for downstream Plan 03: the gate calls `await ProfileShellResolver({ username })` to consume the cached aggregate.
</output>
