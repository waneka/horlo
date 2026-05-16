---
phase: 39c-profile-layout-next-16-conformance
plan: 03
type: execute
wave: 2
depends_on: [01, 02]
files_modified:
  - src/app/u/[username]/profile-gate.tsx
  - src/app/u/[username]/layout.tsx
autonomous: true
requirements: [NEXT16-CONFORMANCE]
threat_refs: [T-39c-01, T-39c-04]
must_haves:
  truths:
    - "Layout body has ZERO uncached top-level data fetches (no getCurrentUser, no getProfileByUsername, no getProfileSettings, no isFollowing, no getFollowerCounts, no getWatchesByUser, no getAllWearEventsByUser, no resolveCommonGround)"
    - "Layout body is `<main>` + `<Suspense fallback={<ProfileShellSkeleton/>}>` + `<ProfileGate username>{children}</ProfileGate>`"
    - "ProfileGate resolves viewerId OUTSIDE the cached scope, calls the cached ProfileShellResolver, branches locked-vs-public AFTER reading cached settings, and bubbles notFound() before any post-suspending await"
    - "Private-profile gating still works: !isOwner && !settings.profilePublic still renders <LockedProfileState/> (SC#6 preserved)"
  artifacts:
    - path: "src/app/u/[username]/profile-gate.tsx"
      provides: "ProfileGate Server Component — viewer-dependent branching with `import 'server-only'`; renders LockedProfileState or the public composition (ProfileHeader + optional CommonGroundHeroBand + ProfileTabs + children)"
      contains: "export async function ProfileGate"
    - path: "src/app/u/[username]/layout.tsx"
      provides: "Thin shell — `<main>` + `<Suspense>` + `<ProfileGate>`; LayoutProps + await params preserved"
      contains: "<Suspense fallback={<ProfileShellSkeleton"
  key_links:
    - from: "src/app/u/[username]/layout.tsx"
      to: "src/app/u/[username]/profile-gate.tsx"
      via: "named import + Suspense child"
      pattern: "import \\{ ProfileGate \\} from './profile-gate'"
    - from: "src/app/u/[username]/profile-gate.tsx"
      to: "src/app/u/[username]/profile-shell-resolver.tsx"
      via: "await ProfileShellResolver({ username })"
      pattern: "await ProfileShellResolver"
    - from: "src/app/u/[username]/profile-gate.tsx"
      to: "@/lib/auth (getCurrentUser, UnauthorizedError)"
      via: "viewerId resolution try/catch OUTSIDE any cached scope"
      pattern: "getCurrentUser"
---

<objective>
Author `<ProfileGate/>` and refactor `src/app/u/[username]/layout.tsx` into a thin Suspense shell. Implements D-39c-05. After this plan lands:
- The layout body becomes 5 lines of JSX (`<main>` + `<Suspense fallback>` + `<ProfileGate>` + children pass-through).
- The gate owns viewer resolution (via the established `getCurrentUser` swallow-`UnauthorizedError` pattern OUTSIDE any cached scope), calls the cached resolver from Plan 02, branches locked-vs-public, and renders the existing `<LockedProfileState/>` or the public composition unchanged.

Purpose: This is the load-bearing structural change that makes prefetching safe under Next 16 `cacheComponents: true`. Once the layout body has zero uncached top-level fetches, the static shell prerenders identically for authed, unauthed, and stale-cookie sessions — the precondition for the Router-Cache poisoning bug evaporates.

Output: 1 new file + 1 modified file. Depends on Plan 01 (skeleton import) and Plan 02 (resolver import).
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
@.planning/phases/39c-profile-layout-next-16-conformance/39C-UI-SPEC.md
@.planning/phases/39c-profile-layout-next-16-conformance/39c-01-PLAN.md
@.planning/phases/39c-profile-layout-next-16-conformance/39c-02-PLAN.md

<interfaces>
<!-- Gate consumes the resolver from Plan 02 -->

From src/app/u/[username]/profile-shell-resolver.tsx (created in Plan 02):
```
export async function ProfileShellResolver({ username }: { username: string }): Promise<
  | { readonly profile: null }
  | { readonly profile: Profile; readonly settings: ProfileSettings; readonly counts: { followers: number; following: number }; readonly watches: WatchWithWear[]; readonly wearEvents: WearEvent[]; readonly tasteTags: TasteTag[] }
>
```

<!-- Gate consumes the skeleton from Plan 01 — but actually only the layout does (gate has no skeleton dependency) -->

<!-- Existing viewer-resolution pattern — the gate's first body block -->

From src/app/u/[username]/layout.tsx:24-30 (current — to be moved INTO the gate):
```
let viewerId: string | null = null
try {
  viewerId = (await getCurrentUser()).id
} catch (err) {
  if (!(err instanceof UnauthorizedError)) throw err
}
```

<!-- Components rendered from gate's branches — UNCHANGED -->

From src/components/profile/ProfileHeader.tsx (props the gate threads through):
```
export function ProfileHeader(props: {
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  isOwner: boolean
  followerCount: number
  followingCount: number
  watchCount: number
  wishlistCount: number
  tasteTags: TasteTag[]
  viewerId: string | null
  targetUserId: string
  initialIsFollowing: boolean
  targetDisplayName: string
}): JSX.Element
```

From src/components/profile/LockedProfileState.tsx (props the gate threads through):
```
export function LockedProfileState(props: {
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  followerCount: number
  followingCount: number
  viewerId: string | null
  targetUserId: string
  initialIsFollowing: boolean
}): JSX.Element
```

From src/components/profile/CommonGroundHeroBand.tsx:
```
export function CommonGroundHeroBand(props: { overlap: TasteOverlapResult; ownerUsername: string }): JSX.Element
```

From src/app/u/[username]/common-ground-gate.ts:
```
export async function resolveCommonGround(input: { viewerId: string | null; ownerId: string; isOwner: boolean; collectionPublic: boolean }): Promise<TasteOverlapResult | null>
```

From src/data/follows.ts:
```
export async function isFollowing(viewerId: string, ownerId: string): Promise<boolean>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author ProfileGate Server Component (viewer-dependent branching)</name>
  <files>src/app/u/[username]/profile-gate.tsx</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-05 (gate spec — the 5 numbered steps the gate performs)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-RESEARCH.md §Code Examples → Example 2 (the full gate body — verbatim mirror target)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/app/u/[username]/profile-gate.tsx` section + §Pattern S2 (getCurrentUser swallow) + §Pattern S5 (server-only annotation)
    - src/app/u/[username]/common-ground-gate.ts (analog — pure module + single async export + `import 'server-only'` shape)
    - src/app/u/[username]/layout.tsx (current — read the FULL 147 lines; the gate's body is essentially the current layout's lines 22-145 minus the outer `<main>` wrapper)
    - src/components/profile/ProfileHeader.tsx (verify props the gate threads through — already in <interfaces> above)
    - src/components/profile/LockedProfileState.tsx (verify props the gate threads through)
    - src/components/profile/CommonGroundHeroBand.tsx (verify props)
    - src/components/profile/ProfileTabs.tsx (verify props — `username`, `showCommonGround`, `isOwner`)
    - src/data/follows.ts (verify `isFollowing` signature)
    - src/app/u/[username]/profile-shell-resolver.tsx (created in Plan 02 — verify the actual return shape matches the <interfaces> declaration above; if the executor's Plan 02 chose Open Question #1's dual-tag option, propagate that here transparently — the gate just consumes the return shape)
  </read_first>
  <action>
    Create `src/app/u/[username]/profile-gate.tsx`. First line: `import 'server-only'` (per Pattern S5 — causes the build to fail if a Client Component ever transitively imports this gate; T-39c-04 mitigation supports this — keeps the locked-vs-public branching from ever shipping to a client).

    Imports (verbatim mirror of PATTERNS.md):
    - `import { notFound } from 'next/navigation'`
    - `import { getCurrentUser, UnauthorizedError } from '@/lib/auth'`
    - `import { isFollowing } from '@/data/follows'`
    - `import { ProfileHeader } from '@/components/profile/ProfileHeader'`
    - `import { CommonGroundHeroBand } from '@/components/profile/CommonGroundHeroBand'`
    - `import { LockedProfileState } from '@/components/profile/LockedProfileState'`
    - `import { ProfileTabs } from '@/components/profile/ProfileTabs'`
    - `import { resolveCommonGround } from './common-ground-gate'`
    - `import { ProfileShellResolver } from './profile-shell-resolver'`

    JSDoc block above the function (10-15 lines, mirror common-ground-gate.ts:15-34 structure): one-line purpose ("Server-side profile shell gate — viewer-dependent branching outside the cached scope (D-39c-05, T-39c-01 / T-39c-04 mitigations)"); load-bearing invariants block listing: (a) `notFound()` MUST be called BEFORE any post-suspending `await` (Pitfall 5 — loading.md:118-124), (b) `getCurrentUser()` lives OUTSIDE the `<ProfileShellResolver/>` cached scope (Pitfall 1), (c) `<ProfileShellResolver/>` is called HERE so the locked branch's `LockedProfileState` can render instead of falling through to the public composition.

    Export `async function ProfileGate({ username, children }: { username: string; children: React.ReactNode })`. Body (verbatim follow Example 2 from RESEARCH.md):
    1. Viewer resolution OUTSIDE any cached scope — copy the 5-line try/catch from current `layout.tsx:24-30` verbatim:
       ```
       let viewerId: string | null = null
       try {
         viewerId = (await getCurrentUser()).id
       } catch (err) {
         if (!(err instanceof UnauthorizedError)) throw err
       }
       ```
    2. Call the cached resolver: `const resolved = await ProfileShellResolver({ username })`
    3. **404 BEFORE any post-suspending await (Pitfall 5):** `if (!resolved.profile) notFound()`
    4. After the early return, destructure narrowed shape: `const { profile, settings, counts, watches, wearEvents, tasteTags } = resolved` (TypeScript narrows `resolved.profile` to non-null because `notFound()` is `never`-returning)
    5. Compute `const isOwner = viewerId === profile.id`
    6. Compute `const initialIsFollowing = viewerId && !isOwner ? await isFollowing(viewerId, profile.id) : false` — this is a viewer-overlay read; it lives in the gate (NOT the resolver) and is intentionally uncached for this phase per RESEARCH §Open Question #2 (deferred to follow-up perf phase)
    7. **Locked branch (T-39c-04 mitigation):** `if (!isOwner && !settings.profilePublic)` — render `<LockedProfileState/>` with the 9 props sourced from the cached resolver output (do NOT call `getFollowerCounts` a second time; reuse `counts.followers` and `counts.following` from the cached aggregate). Pass `viewerId`, `targetUserId: profile.id`, `initialIsFollowing` from the gate's locally-computed values. The locked branch returns ONLY `<LockedProfileState/>` (no outer `<main>` wrapper — the layout owns that). This is the T-39c-04 mitigation: the locked-vs-public branch happens HERE (uncached), AFTER reading the cached `settings.profilePublic` value, so private-profile follower lists never enter the cached scope.
       **Behavioral note (deliberate, documented):** locked-branch follower counts now reflect the 300s cache window per D-39c-03 instead of being live-fetched per-render (current `layout.tsx:47-64` re-queries `getFollowerCounts(profile.id)` after the locked decision). This is a deliberate behavioral shift consistent with D-39c-03 ("one cached resolver per shell, 300s revalidate"). SC#6 mandates only that the `notFound()` short-circuit and locked branch preserve — not live counts. Up-to-300s staleness on locked-branch counts is acceptable; cache invalidation on follow/unfollow (Plan 05 Task 3) keeps the cache fresh on relevant writes.
    8. **Public/owner branch:** Compute `const overlap = await resolveCommonGround({ viewerId, ownerId: profile.id, isOwner, collectionPublic: settings.collectionPublic })`. Compute `const ownedCount = watches.filter((w) => w.status === 'owned').length` and `const wishlistCount = watches.filter((w) => w.status === 'wishlist' || w.status === 'grail').length`. Return a fragment:
       - `<ProfileHeader/>` with 14 props (full list in <interfaces> above) sourced from resolver output + locally-computed values
       - `{overlap && <CommonGroundHeroBand overlap={overlap} ownerUsername={username} />}`
       - `<div className="mt-6"><ProfileTabs username={username} showCommonGround={overlap?.hasAny ?? false} isOwner={isOwner} /></div>`
       - `<div className="mt-6">{children}</div>`

    The gate returns a fragment (no outer wrapper) — the layout's `<main>` wrapper is the only outer container.

    PROHIBITED inside this file:
    - `'use cache'` directive — the gate is the uncached layer
    - `cacheTag` / `cacheLife` imports
    - Reading cookies or auth via any means OTHER than the `getCurrentUser()` try/catch at step 1
  </action>
  <verify>
    <automated>test -f src/app/u/[username]/profile-gate.tsx && grep -n "import 'server-only'" src/app/u/[username]/profile-gate.tsx && grep -n "export async function ProfileGate" src/app/u/[username]/profile-gate.tsx && grep -n "await ProfileShellResolver" src/app/u/[username]/profile-gate.tsx && grep -n "if (!resolved.profile) notFound()" src/app/u/[username]/profile-gate.tsx && grep -n "settings.profilePublic" src/app/u/[username]/profile-gate.tsx && ! grep -n "'use cache'" src/app/u/[username]/profile-gate.tsx && ! grep -n "cacheTag\\|cacheLife" src/app/u/[username]/profile-gate.tsx && npm run lint</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/app/u/[username]/profile-gate.tsx` exits 0
    - `grep -n "import 'server-only'" src/app/u/[username]/profile-gate.tsx` returns 1 match on line 1
    - `grep -n "export async function ProfileGate" src/app/u/[username]/profile-gate.tsx` returns 1 match
    - `grep -nE "username: string;\\s*children: React\\.ReactNode" src/app/u/[username]/profile-gate.tsx` returns >= 1 match (the prop type)
    - `grep -n "let viewerId: string | null = null" src/app/u/[username]/profile-gate.tsx` returns 1 match (Pattern S2 — copied verbatim from current layout.tsx:24)
    - `grep -n "UnauthorizedError" src/app/u/[username]/profile-gate.tsx` returns >= 2 matches (import + instanceof check)
    - `grep -n "await ProfileShellResolver" src/app/u/[username]/profile-gate.tsx` returns 1 match (gate calls the cached resolver — RESEARCH Example 2)
    - `grep -nE "if\\s*\\(\\s*!resolved\\.profile\\s*\\)\\s*notFound\\(\\)" src/app/u/[username]/profile-gate.tsx` returns 1 match (Pitfall 5 — notFound BEFORE the next await on isFollowing/resolveCommonGround)
    - `grep -n "settings.profilePublic" src/app/u/[username]/profile-gate.tsx` returns >= 1 match (T-39c-04 mitigation — locked-vs-public branch reads cached settings)
    - `grep -n "<LockedProfileState" src/app/u/[username]/profile-gate.tsx` returns 1 match (locked branch render)
    - `grep -n "<ProfileHeader" src/app/u/[username]/profile-gate.tsx` returns 1 match (public branch)
    - `grep -n "<CommonGroundHeroBand" src/app/u/[username]/profile-gate.tsx` returns 1 match (public branch, conditionally rendered)
    - `grep -n "<ProfileTabs" src/app/u/[username]/profile-gate.tsx` returns 1 match (public branch)
    - `grep -n "resolveCommonGround" src/app/u/[username]/profile-gate.tsx` returns >= 2 matches (import + call)
    - `grep -n "isFollowing" src/app/u/[username]/profile-gate.tsx` returns >= 2 matches (import + call)
    - **T-39c-01 / T-39c-04 enforcement:** `! grep -n "'use cache'" src/app/u/[username]/profile-gate.tsx` AND `! grep -nE "cacheTag|cacheLife" src/app/u/[username]/profile-gate.tsx` (the gate is uncached by design)
    - `npm run lint` exits 0
  </acceptance_criteria>
  <done>
    `src/app/u/[username]/profile-gate.tsx` exists, exports `ProfileGate` as an async Server Component (with `import 'server-only'`), resolves viewerId via the established try/catch swallow pattern OUTSIDE any cached scope, awaits the cached `<ProfileShellResolver/>`, calls `notFound()` BEFORE the next post-suspending `await`, branches locked-vs-public AFTER reading cached `settings.profilePublic`, and renders the existing components (LockedProfileState or ProfileHeader + optional CommonGroundHeroBand + ProfileTabs + children) unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Refactor layout.tsx into thin Suspense shell</name>
  <files>src/app/u/[username]/layout.tsx</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-RESEARCH.md §Code Examples → Example 3 (the verbatim refactored layout shape — 13 lines)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/app/u/[username]/layout.tsx` section (the "Final shape" + "Key invariants" + "What disappears" lists)
    - src/app/u/[username]/layout.tsx (current — read the FULL 147 lines; identify every line that needs to be removed or moved into the gate)
    - src/app/u/[username]/profile-gate.tsx (just created in Task 1 above — verify the export shape `ProfileGate({ username, children })`)
    - src/app/u/[username]/profile-shell-skeleton.tsx (created in Plan 01 — verify the export shape `ProfileShellSkeleton()`)
  </read_first>
  <action>
    Rewrite `src/app/u/[username]/layout.tsx` to the final shape from RESEARCH Example 3. The final file is ~13 lines, contains zero uncached DAL fetches at the top level, and threads `children` through `<ProfileGate>` (NOT directly through the layout).

    REMOVE from the current layout (every line that is now the gate's responsibility):
    - All 11 imports from `next/navigation` / `@/lib/auth` / `@/data/profiles` / `@/data/follows` / `@/data/watches` / `@/data/wearEvents` / `@/lib/tasteTags` / `@/components/profile/*` / `./common-ground-gate` (current lines 1-16 — keep ONLY what the new shape needs)
    - All 8 top-level `await`s (current lines ~27, 32, 38, 44-45, 67-71, 105-110)
    - The locked-vs-public branch return (current lines ~47-64)
    - The public-branch JSX (current lines ~112-145)

    KEEP / ADD to the new layout:
    - `import { Suspense } from 'react'`
    - `import { ProfileGate } from './profile-gate'`
    - `import { ProfileShellSkeleton } from './profile-shell-skeleton'`
    - The `LayoutProps<'/u/[username]'>` type generic — preserved verbatim from current line 21 (Next 16 typed-layouts feature; this is the project's first use of route-typed-layouts and must survive the refactor)
    - The `await params` — preserved verbatim from current line 22 (Next 16 async params convention)
    - `export default async function ProfileLayout({ children, params }: LayoutProps<'/u/[username]'>)`
    - Body: `const { username } = await params; return (<main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12"><Suspense fallback={<ProfileShellSkeleton />}><ProfileGate username={username}>{children}</ProfileGate></Suspense></main>)`

    The `<main>` className is preserved byte-equivalent so the loading.tsx fallback (Plan 01 Task 2) and the resolved tree are dimensionally identical (zero outer-CLS).

    The pre-existing `LayoutProps` TS error flagged in REQUIREMENTS.md §Future Requirements ("Pre-existing `LayoutProps` TS error in `src/app/u/[username]/layout.tsx:21` — carried from v3.0") MAY persist — do NOT attempt to fix it in this plan (it is explicitly deferred). If `npm run build` fails on this specific TS error, that is a Phase 39c-irrelevant pre-existing failure; document the diff vs. baseline in the SUMMARY.
  </action>
  <verify>
    <automated>! grep -nE "getCurrentUser|getProfileByUsername|getProfileSettings|isFollowing|getFollowerCounts|getWatchesByUser|getAllWearEventsByUser|resolveCommonGround|computeTasteTags" src/app/u/[username]/layout.tsx && grep -n "<Suspense fallback={<ProfileShellSkeleton" src/app/u/[username]/layout.tsx && grep -n "<ProfileGate username" src/app/u/[username]/layout.tsx && grep -n "LayoutProps<'/u/\\[username\\]'>" src/app/u/[username]/layout.tsx && grep -n "mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12" src/app/u/[username]/layout.tsx && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - **Load-bearing acceptance (VALIDATION.md row "Layout body has NO uncached top-level data fetches"):** `! grep -nE "getCurrentUser|getProfileByUsername|getProfileSettings|isFollowing|getFollowerCounts|getWatchesByUser|getAllWearEventsByUser|resolveCommonGround|computeTasteTags" src/app/u/[username]/layout.tsx` — none of the 8 prior uncached top-level reads appear in the refactored layout
    - `grep -n "import { Suspense } from 'react'" src/app/u/[username]/layout.tsx` returns 1 match
    - `grep -n "import { ProfileGate } from './profile-gate'" src/app/u/[username]/layout.tsx` returns 1 match
    - `grep -n "import { ProfileShellSkeleton } from './profile-shell-skeleton'" src/app/u/[username]/layout.tsx` returns 1 match
    - `grep -n "export default async function ProfileLayout" src/app/u/[username]/layout.tsx` returns 1 match
    - `grep -n "LayoutProps<'/u/\\[username\\]'>" src/app/u/[username]/layout.tsx` returns 1 match (Next 16 typed-layouts preserved)
    - `grep -n "await params" src/app/u/[username]/layout.tsx` returns 1 match (Next 16 async params preserved)
    - `grep -nE "<Suspense fallback=\\{<ProfileShellSkeleton" src/app/u/[username]/layout.tsx` returns 1 match
    - `grep -n "<ProfileGate username=" src/app/u/[username]/layout.tsx` returns 1 match
    - `grep -n "{children}" src/app/u/[username]/layout.tsx` returns 1 match (children threaded through the gate)
    - `grep -n "mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12" src/app/u/[username]/layout.tsx` returns 1 match (preserved className; zero outer-CLS contract per UI-SPEC §Streaming Contract)
    - File size: `wc -l src/app/u/[username]/layout.tsx` returns <= 25 lines (down from 147; tolerance for comments)
    - `npm run lint` exits 0
    - `npm run build` exits 0 (BUILD MUST PASS — this is the load-bearing structural change; if it fails on the pre-existing `LayoutProps` TS error, document the baseline match and proceed)
  </acceptance_criteria>
  <done>
    `src/app/u/[username]/layout.tsx` is refactored to the 13-line static-shell form: imports React.Suspense + ProfileGate + ProfileShellSkeleton, exports a default async `ProfileLayout({ children, params })` with `LayoutProps<'/u/[username]'>` typing and `await params` preserved, renders `<main>` + `<Suspense fallback={<ProfileShellSkeleton/>}>` + `<ProfileGate username>{children}</ProfileGate>`. Zero uncached top-level fetches remain. `npm run build` passes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Request → uncached gate | Viewer identity (from cookies) crosses into the gate's branching logic. Locked-vs-public decision happens AFTER reading the cached `settings.profilePublic` value, BEFORE rendering the public composition. |
| Suspense fallback → resolved tree | Browser swaps from `<ProfileShellSkeleton/>` to `<LockedProfileState/>` or the public composition. Zero outer-CLS per UI-SPEC. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-39c-01 | Information Disclosure | `<ProfileGate/>` viewer resolution | mitigate | Gate's `getCurrentUser()` try/catch is the SOLE entry point for viewer identity. Static grep enforces that the gate does NOT call `'use cache'` / `cacheTag` / `cacheLife` — the gate is the uncached layer. Acceptance criterion: `! grep -n "'use cache'" src/app/u/[username]/profile-gate.tsx`. |
| T-39c-04 | Information Disclosure | Locked-vs-public branching | mitigate | Locked branch reads cached `settings.profilePublic` AFTER the cached resolver returns, then decides whether to render `<LockedProfileState/>` (no follower lists, no watches, no wear events). The cached scope (`<ProfileShellResolver/>`) holds only chrome-shaped data — not viewer-overlay reads like follower lists scoped to the requesting viewer. Acceptance criterion: `grep -n "settings.profilePublic" src/app/u/[username]/profile-gate.tsx` returns >= 1 match. SC#6 preservation verified by code review (the existing `!isOwner && !settings.profilePublic` branch from current `layout.tsx:47` is reproduced verbatim inside the gate). |
</threat_model>

<verification>
- **VALIDATION.md row (load-bearing):** `! grep -nE "getCurrentUser|getProfileByUsername|getProfileSettings|isFollowing|getFollowerCounts|getWatchesByUser|getAllWearEventsByUser|resolveCommonGround" src/app/u/[username]/layout.tsx` — empty grep output
- File presence: `src/app/u/[username]/profile-gate.tsx` exists
- T-39c-01 + T-39c-04 mitigations grep-verified
- `npm run lint && npm run build` exits 0
- SC#6 preservation: locked-branch `<LockedProfileState/>` renders for `!isOwner && !settings.profilePublic` (preserved from `layout.tsx:47`; verified by reading the gate's locked-branch return)
- NO regression to Phase 39b affordances: ReferenceIdentityCard, OtherOwnersRoster, SameFamilyRail, LineageRail, LockedTabCard all live in `[tab]/page.tsx` or its child renders — none touch the layout. Build green proves the regression-free criterion.
</verification>

<success_criteria>
- Files changed: 1 new (profile-gate.tsx) + 1 modified (layout.tsx)
- All acceptance criteria green
- T-39c-01 and T-39c-04 mitigations verified by static grep
- `npm run build` exits 0
- ROADMAP SC#1 (zero uncached top-level fetches in layout body) verified by static grep
- ROADMAP SC#6 (private-profile gating preserved) verified by code review against the gate's locked branch
</success_criteria>

<output>
After completion, create `.planning/phases/39c-profile-layout-next-16-conformance/39c-03-SUMMARY.md` capturing: files changed (gate created + layout refactored), the load-bearing static-grep evidence (the empty grep output proving SC#1), the locked-branch preservation evidence (the `settings.profilePublic` match in the gate), `npm run build` exit code, and any deviations from RESEARCH Example 2 / 3 (e.g., if the executor chose to inline `<div className="mt-6">` wrappers differently from the current layout — call them out).
</output>
