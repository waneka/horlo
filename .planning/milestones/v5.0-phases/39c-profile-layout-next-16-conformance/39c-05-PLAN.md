---
phase: 39c-profile-layout-next-16-conformance
plan: 05
type: execute
wave: 2
depends_on: [02]
files_modified:
  - src/app/actions/profile.ts
  - src/app/actions/watches.ts
  - src/app/actions/follows.ts
  - src/app/actions/wearEvents.ts
autonomous: true
requirements: [NEXT16-CONFORMANCE]
threat_refs: [T-39c-02, T-39c-03]
must_haves:
  truths:
    - "profile.ts.updateProfile fires updateTag('profile:${username}') — RYO (caller IS owner)"
    - "profile.ts.updateProfileSettings fires updateTag('profile:${username}') — RYO"
    - "watches.ts.addWatch / editWatch / removeWatch fire revalidateTag('profile:${ownerUsername}', 'max') — cross-user SWR"
    - "follows.ts.followUser / unfollowUser fire BOTH revalidateTag('profile:${targetUsername}', 'max') AND updateTag('viewer:${viewerId}:profile:${targetUserId}')"
    - "wearEvents.ts.markAsWorn / logWearWithPhoto fire revalidateTag('profile:${ownerUsername}', 'max')"
    - "All revalidateTag calls use two-arg form (Pitfall 2 — single-arg deprecated per revalidateTag.md:55)"
  artifacts:
    - path: "src/app/actions/profile.ts"
      provides: "RYO invalidation for profile:${username} on profile field + settings updates"
      contains: "updateTag(`profile:"
    - path: "src/app/actions/watches.ts"
      provides: "Cross-user fan-out invalidation for profile:${ownerUsername} alongside existing revalidateTag('explore', 'max')"
      contains: "revalidateTag(`profile:"
    - path: "src/app/actions/follows.ts"
      provides: "Mixed RYO + cross-user invalidation: target profile shell SWR + viewer-overlay RYO"
      contains: "viewer:${user.id}:profile:"
    - path: "src/app/actions/wearEvents.ts"
      provides: "Cross-user fan-out for profile:${ownerUsername} on wear-event writes"
      contains: "revalidateTag(`profile:"
  key_links:
    - from: "src/app/actions/profile.ts"
      to: "<ProfileShellResolver/> cacheTag('profile:${username}')"
      via: "updateTag — bundles fresh RSC payload in Server Action response (notifications.ts:26-46 source-level rationale)"
      pattern: "updateTag\\(`profile:"
    - from: "src/app/actions/watches.ts"
      to: "<ProfileShellResolver/> cacheTag('profile:${username}')"
      via: "revalidateTag(tag, 'max') — SWR cross-user fan-out"
      pattern: "revalidateTag\\(`profile:"
    - from: "src/app/actions/follows.ts"
      to: "viewer-overlay tag `viewer:${viewerId}:profile:${ownerId}` (D-39c-02 second tag family)"
      via: "updateTag — RYO from the viewer toggling follow state"
      pattern: "updateTag\\(`viewer:.*profile:"
---

<objective>
Wire cache-tag invalidation across the 4 Server Action files per D-39c-04. Implements the read-your-own-writes (`updateTag`) and cross-user SWR (`revalidateTag(tag, 'max')`) primitives at the correct call sites, with username derived via `getProfileById(userId)` lookup (Pattern S4).

Purpose: Without invalidation wiring, the cached `<ProfileShellResolver/>` from Plan 02 would serve stale data for up to 300s after every profile / watch / follow / wear-event write. This plan ensures every mutating Server Action invalidates the correct tag(s) per the decision rule from RESEARCH §Pitfall 3: caller IS viewer → `updateTag`; caller is NOT viewer → `revalidateTag(tag, 'max')`.

Output: 4 modified files. Independent of Plans 01/03/04 — this plan can ship in parallel with the layout refactor as long as Plan 02 (the resolver with `cacheTag('profile:${username}')`) has shipped first. Mirror the existing `revalidateTag('explore', 'max')` / `updateTag('viewer:${user.id}')` call sites verbatim and slot the new calls alongside.
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
<!-- Verified Next 16 API shapes from RESEARCH.md §Sources -->

From next/cache (verified at revalidateTag.md, updateTag.md):
- `revalidateTag(tag: string, profile: 'max' | { expire?: number }): void` — two-arg form REQUIRED; single-arg deprecated (revalidateTag.md:55); `'max'` is the SWR profile
- `updateTag(tag: string): void` — single-arg only; Server-Actions-only; sets `pathWasRevalidated = StaticAndDynamic` so the Server Action response bundles a fresh RSC payload (notifications.ts:26-46 in-repo source-level comment)

<!-- Tag taxonomy from D-39c-02 -->

- `profile:${username}` — owner-scoped (resolver receives username from route params)
- `viewer:${viewerId}:profile:${ownerId}` — viewer-overlay (distinct from existing `viewer:${id}` notifications tag)

<!-- DAL bridge -->

From src/data/profiles.ts:
```
export async function getProfileById(userId: string): Promise<{ id: string; username: string; ... } | null>
```
- Already imported by `src/app/actions/follows.ts:9` (used at line 44 for `actorProfile`)
- Already imported by `src/app/actions/watches.ts:14` (used at line 235 for `actorProfile`)
- Probably NOT imported by `src/app/actions/profile.ts` (uses namespace `* as profilesDAL`)
- NOT imported by `src/app/actions/wearEvents.ts` — Task 4 adds the import
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire updateTag in profile.ts for updateProfile + updateProfileSettings (RYO)</name>
  <files>src/app/actions/profile.ts</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-04 first bullet (profile.ts RYO wiring)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-RESEARCH.md §Code Examples → Example 7 (the verbatim call shape; lines 683-689)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/app/actions/profile.ts` section + §Pattern S3 (primitive selection rule) + §Pattern S4 (getProfileById lookup)
    - src/app/actions/notifications.ts lines 14-50, 66-82 (the canonical RYO `updateTag` pattern with the file-header comment explaining the Next 16 source-level mechanism — verbatim apply this rationale)
    - src/app/actions/profile.ts (the FULL file — verify the current `revalidatePath` shape at lines 33-35 and 81-83; locate the DAL writes in `updateProfile` and `updateProfileSettings`; confirm whether the `profilesDAL` namespace import already exposes `getProfileById`)
    - src/data/profiles.ts (verify `getProfileById` export signature)
  </read_first>
  <action>
    In `src/app/actions/profile.ts`:

    1. **Import extension (line 3):** change `import { revalidatePath } from 'next/cache'` to `import { revalidatePath, updateTag } from 'next/cache'`.

    2. **In `updateProfile`** (after the DAL write at ~line 33, BEFORE the existing `revalidatePath('/u/[username]', 'layout')`):
       - Add `const profile = await profilesDAL.getProfileById(user.id)` (the namespace `* as profilesDAL` is already at top; if `getProfileById` is not exposed via namespace, switch to a named import — verify in <read_first>)
       - Add RYO invalidation: `if (profile?.username) { updateTag(\`profile:${profile.username}\`) }`
       - Keep BOTH existing `revalidatePath` calls (path-based, additive to tag-based)
       - Add inline comment (2-4 lines) citing D-39c-04 and notifications.ts:26-46 rationale: "Phase 39c D-39c-04 — RYO invalidation of the cached owner-scoped profile shell. updateTag bundles a fresh RSC payload in the Server Action response."

    3. **In `updateProfileSettings`** (after the DAL write at ~line 77-81, BEFORE the existing `revalidatePath` calls):
       - Same pattern — lookup, RYO invalidation, inline comment
       - If `user.id` already in scope, the call is structurally identical to `updateProfile`

    Use `updateTag` (single-arg), NOT `revalidateTag` — caller IS owner whose UI is being invalidated (Pattern S3 + RESEARCH §Pitfall 3 verdict for profile.ts).

    PROHIBITED:
    - `revalidateTag(\`profile:${username}\`)` (wrong primitive for RYO — Pitfall 3 stale-UI failure mode)
    - `revalidateTag(\`profile:${username}\`, 'max')` (same wrong-primitive logic)
    - Single-arg `revalidateTag(tag)` (Pitfall 2 — deprecated)
  </action>
  <verify>
    <automated>grep -nE "updateTag\(\`profile:" src/app/actions/profile.ts && grep -c "updateTag" src/app/actions/profile.ts && ! grep -nE "revalidateTag\(\`profile:" src/app/actions/profile.ts && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "updateTag\(\`profile:" src/app/actions/profile.ts` returns >= 2 matches (one per RYO call site)
    - `grep -n "import.*updateTag.*from 'next/cache'" src/app/actions/profile.ts` returns 1 match (combined-import form acceptable: `import { revalidatePath, updateTag } from 'next/cache'`)
    - `grep -nE "profilesDAL\.getProfileById|getProfileById\(user\.id\)" src/app/actions/profile.ts` returns >= 2 matches (one per RYO call site)
    - **Pitfall 3 enforcement:** `! grep -nE "revalidateTag\(\`profile:" src/app/actions/profile.ts` (NEVER revalidateTag for RYO in profile.ts)
    - Existing `revalidatePath('/u/[username]', 'layout')` and `revalidatePath('/settings')` calls REMAIN (path-based invalidation is additive)
    - `npm run lint` exits 0
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>
    Both `updateProfile` and `updateProfileSettings` look up the caller's profile via `getProfileById(user.id)` and fire `updateTag(\`profile:${profile.username}\`)` after the DAL write. Existing `revalidatePath` calls preserved.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire revalidateTag in watches.ts for addWatch + editWatch + removeWatch (cross-user fan-out)</name>
  <files>src/app/actions/watches.ts</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-04 second bullet (watches.ts cross-user wiring)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/app/actions/watches.ts` section (self-analog at lines 274-286 — the existing `revalidatePath` + `revalidateTag('explore', 'max')` triplet; the new `revalidateTag('profile:${ownerUsername}', 'max')` slots ALONGSIDE)
    - src/app/actions/watches.ts (the FULL file — find the THREE call sites: addWatch's `revalidateTag('explore', 'max')` at line 285; editWatch's at line 431; removeWatch's at line 461; verify `getProfileById` is already imported at line 14 — Pattern S4 lookup precedent at line 235)
  </read_first>
  <action>
    In `src/app/actions/watches.ts`, at EACH of the three call sites (`addWatch`, `editWatch`, `removeWatch`):

    1. BEFORE the existing `revalidateTag('explore', 'max')` line, add:
       - `const ownerProfile = await getProfileById(user.id)`
       - `if (ownerProfile?.username) { revalidateTag(\`profile:${ownerProfile.username}\`, 'max') }`

    2. Add 2-3 line inline comment above the new call citing D-39c-04: "invalidate the owner's cached profile shell so the next /u/{owner} render reflects the new watch count, taste tags, and wear-event aggregates derived inside <ProfileShellResolver/>. Cross-user fan-out via revalidateTag(tag, 'max')."

    Use `revalidateTag` two-arg `'max'` form per Pattern S3 — caller IS owner BUT other viewers also have stale cached entries (RESEARCH §Pitfall 3 verdict for watches.ts: "trade-off — owner sees new watch with up to 5min delay on layout-cached counts BUT the page body re-fetches watches every nav, so actual watch list updates immediately").

    DAL note: `getProfileById` already imported at watches.ts:14 (verified). Pattern precedent at line 235 already calls it for `actorProfile`. No new import.

    PROHIBITED:
    - `updateTag(\`profile:${username}\`)` — wrong primitive (cross-user fan-out needs SWR)
    - Single-arg `revalidateTag(tag)` — Pitfall 2

    Keep ALL existing calls unchanged: `revalidatePath('/')`, `revalidatePath('/u/[username]', 'layout')`, `revalidateTag('explore', 'max')`, `revalidateTag(\`viewer:${recipient.userId}\`, 'max')` at line 265 — they serve different invariants.
  </action>
  <verify>
    <automated>grep -cE "revalidateTag\(\`profile:\\\$\{ownerProfile\.username\}\`,\s*'max'\)" src/app/actions/watches.ts && grep -c "revalidateTag\('explore', 'max'\)" src/app/actions/watches.ts && ! grep -nE "updateTag\(\`profile:" src/app/actions/watches.ts && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -cE "revalidateTag\(\`profile:\\\$\{ownerProfile\.username\}\`,\s*'max'\)" src/app/actions/watches.ts` returns 3 (addWatch + editWatch + removeWatch)
    - `grep -c "getProfileById\(user\.id\)" src/app/actions/watches.ts` returns >= 3 (+ pre-existing line 235; total >= 4. If executor batched with existing call in addWatch, accept 3.)
    - `grep -c "revalidateTag('explore', 'max')" src/app/actions/watches.ts` returns 3 (existing preserved at lines 285, 431, 461)
    - **Pitfall 3 enforcement:** `! grep -nE "updateTag\(\`profile:" src/app/actions/watches.ts` (cross-user fan-out uses revalidateTag)
    - **Pitfall 2 enforcement:** `! grep -nE "revalidateTag\(\`profile:[^,]+\`\)" src/app/actions/watches.ts` (every profile-tag revalidateTag has second arg)
    - `npm run lint` exits 0
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>
    All three write paths (`addWatch`, `editWatch`, `removeWatch`) fire `revalidateTag(\`profile:${ownerProfile.username}\`, 'max')` after the DAL write, alongside existing `revalidateTag('explore', 'max')` calls. Existing path-based and notification-cache invalidations preserved.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire mixed RYO + cross-user in follows.ts for followUser + unfollowUser</name>
  <files>src/app/actions/follows.ts</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-04 third bullet (follows.ts mixed wiring)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-RESEARCH.md §Code Examples → Example 7 (the follows.ts call shape at lines 691-696)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/app/actions/follows.ts` section (existing mixed pattern at lines 72-86 — new calls mirror this structure)
    - src/app/actions/follows.ts (the FULL file — verify `getProfileById` import at line 9 + the `actorProfile` lookup at line 44; locate `followUser` at line 19 + `unfollowUser` at line 95; locate existing invalidation block in followUser at lines 72-86)
  </read_first>
  <action>
    In `src/app/actions/follows.ts`, for BOTH `followUser` (around lines 49-86) and `unfollowUser` (around lines 115-123):

    1. **Cross-user invalidation (target's profile shell)** — caller is NOT target; SWR via `revalidateTag(tag, 'max')`:
       - `const targetProfile = await getProfileById(parsed.data.userId)`
       - `if (targetProfile?.username) { revalidateTag(\`profile:${targetProfile.username}\`, 'max') }`
       - Slot AFTER the existing `revalidateTag(\`viewer:${parsed.data.userId}\`, 'max')` at line 77 (followUser) / equivalent in unfollowUser
       - Comment: "Phase 39c D-39c-04 — invalidate the TARGET's cached profile shell so followerCount on /u/{target} reflects the change on next render."

    2. **RYO viewer-overlay invalidation** — caller IS viewer; `isFollowing` needs immediate refresh; `updateTag` single-arg:
       - `updateTag(\`viewer:${user.id}:profile:${parsed.data.userId}\`)`
       - Slot AFTER the existing `updateTag(\`explore:popular-collectors:viewer:${user.id}\`)` at line 86 (followUser) / line 123 (unfollowUser)
       - Comment: "Phase 39c D-39c-04 — invalidate the VIEWER-OVERLAY tag so viewer's isFollowing state inside <ProfileGate/> reflects the toggle immediately (RYO). Tag matches D-39c-02 second tag family."

    Imports: `getProfileById` already at line 9. `updateTag` + `revalidateTag` already at line 3 (`import { revalidatePath, revalidateTag, updateTag } from 'next/cache'`). NO new imports.

    `unfollowUser` symmetry: viewer-overlay tag shape IDENTICAL (`viewer:${user.id}:profile:${parsed.data.userId}`) — both follow and unfollow invalidate the same tag because the viewer's isFollowing state changed in either direction.

    Optimization (planner discretion): batch the `targetProfile` lookup with existing `actorProfile` lookup at line 44 if desired — both are `getProfileById` with different inputs.

    PROHIBITED:
    - Mixing primitives — target invalidation MUST be `revalidateTag(tag, 'max')` (cross-user); viewer-overlay MUST be `updateTag(tag)` (RYO). Swapping is a Pitfall 3 violation.
    - Single-arg `revalidateTag(tag)` — Pitfall 2.
  </action>
  <verify>
    <automated>grep -cE "revalidateTag\(\`profile:\\\$\{targetProfile\.username\}\`,\s*'max'\)" src/app/actions/follows.ts && grep -cE "updateTag\(\`viewer:\\\$\{user\.id\}:profile:" src/app/actions/follows.ts && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -cE "revalidateTag\(\`profile:\\\$\{targetProfile\.username\}\`,\s*'max'\)" src/app/actions/follows.ts` returns 2 (one in followUser, one in unfollowUser)
    - `grep -cE "updateTag\(\`viewer:\\\$\{user\.id\}:profile:" src/app/actions/follows.ts` returns 2 (one per mutation — viewer-overlay RYO)
    - `grep -cE "getProfileById\(parsed\.data\.userId\)" src/app/actions/follows.ts` returns >= 2 (if executor reused lookup across mutations, accept 2)
    - Existing invalidation preserved: `grep -nE "revalidateTag\(\`viewer:\\\$\{parsed\.data\.userId\}\`,\s*'max'\)" src/app/actions/follows.ts` returns 2 matches (untouched at line 77 + equivalent in unfollowUser)
    - **Pitfall 3 enforcement (mixed primitive):** target uses `revalidateTag` AND viewer-overlay uses `updateTag` — both must coexist (verified by the two grep counts above each being EXACTLY 2)
    - **Pitfall 2 enforcement:** `! grep -nE "revalidateTag\(\`(profile|viewer):[^,]+\`\)" src/app/actions/follows.ts` (every revalidateTag uses two-arg form)
    - `npm run lint` exits 0
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>
    Both `followUser` and `unfollowUser` fire the mixed pair: (a) `revalidateTag(\`profile:${targetProfile.username}\`, 'max')` for cross-user fan-out of the target's profile shell, and (b) `updateTag(\`viewer:${user.id}:profile:${parsed.data.userId}\`)` for RYO of the viewer-overlay tag. Existing `viewer:${parsed.data.userId}` notification-recipient invalidation and `explore:popular-collectors:viewer:${user.id}` RYO calls preserved.
  </done>
</task>

<task type="auto">
  <name>Task 4: Wire revalidateTag in wearEvents.ts for markAsWorn + logWearWithPhoto (cross-user fan-out)</name>
  <files>src/app/actions/wearEvents.ts</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-04 fourth bullet (wearEvents.ts wiring — CONTEXT.md flagged TBD; RESEARCH confirmed location + exactly two write paths)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/app/actions/wearEvents.ts` section (role-match analog from watches.ts; file currently has ZERO `revalidateTag` calls)
    - src/app/actions/wearEvents.ts (the FULL file — verify `markAsWorn` at line 16, `logWearWithPhoto` at line 109; verify imports — `profilesDAL` is NOT currently imported, but `watchDAL` is at line 7 using `* as` namespace style — new import mirrors that style)
    - src/data/profiles.ts (verify `getProfileById` is in the namespace export)
  </read_first>
  <action>
    In `src/app/actions/wearEvents.ts`:

    1. **Import extensions (line 3 and lines 6-8):**
       - Change `import { revalidatePath } from 'next/cache'` to `import { revalidatePath, revalidateTag } from 'next/cache'`
       - Add new namespace import below existing namespace imports: `import * as profilesDAL from '@/data/profiles'` (mirror namespace style of `import * as watchDAL from '@/data/watches'` at line 7)

    2. **In `markAsWorn`** (after the existing `revalidatePath('/')` at line 55):
       - `const ownerProfile = await profilesDAL.getProfileById(user.id)`
       - `if (ownerProfile?.username) { revalidateTag(\`profile:${ownerProfile.username}\`, 'max') }`
       - 2-3 line inline comment: "Phase 39c D-39c-04 — invalidate the owner's cached profile shell so wear-event aggregates (most-worn / WornCalendar / WornTabContent) inside <ProfileShellResolver/> recompute. Cross-user fan-out: although caller IS owner, other viewers may have stale cached entries — SWR via revalidateTag(tag, 'max') is correct."

    3. **In `logWearWithPhoto`** (after the existing `revalidatePath('/')` at line 228):
       - Same pattern — lookup, invalidate, comment

    Use `revalidateTag` two-arg `'max'` per Pattern S3 — caller IS owner BUT other viewers also have stale cached entries; SWR semantics correct (same reasoning as watches.ts).

    NO delete or edit action exists in wearEvents.ts — only the two write paths per RESEARCH §Drift note. Both must invalidate.

    PROHIBITED:
    - `updateTag(\`profile:${username}\`)` — wrong primitive (cross-user fan-out is correct)
    - Single-arg `revalidateTag(tag)` — Pitfall 2
  </action>
  <verify>
    <automated>grep -cE "revalidateTag\(\`profile:\\\$\{ownerProfile\.username\}\`,\s*'max'\)" src/app/actions/wearEvents.ts && grep -n "import \* as profilesDAL from '@/data/profiles'" src/app/actions/wearEvents.ts && grep -n "import { revalidatePath, revalidateTag" src/app/actions/wearEvents.ts && ! grep -nE "updateTag\(\`profile:" src/app/actions/wearEvents.ts && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -cE "revalidateTag\(\`profile:\\\$\{ownerProfile\.username\}\`,\s*'max'\)" src/app/actions/wearEvents.ts` returns 2 (one per write path — markAsWorn and logWearWithPhoto)
    - `grep -n "import \* as profilesDAL from '@/data/profiles'" src/app/actions/wearEvents.ts` returns 1 match (namespace import added)
    - `grep -n "import { revalidatePath, revalidateTag" src/app/actions/wearEvents.ts` returns 1 match (revalidateTag added alongside existing revalidatePath import)
    - `grep -c "profilesDAL.getProfileById(user.id)" src/app/actions/wearEvents.ts` returns >= 2 (one per write path)
    - **Pitfall 3 enforcement:** `! grep -nE "updateTag\(\`profile:" src/app/actions/wearEvents.ts` (cross-user fan-out uses revalidateTag, NEVER updateTag)
    - **Pitfall 2 enforcement:** `! grep -nE "revalidateTag\(\`profile:[^,]+\`\)" src/app/actions/wearEvents.ts` (every profile-tag revalidateTag has two-arg form)
    - `npm run lint` exits 0
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>
    Both `markAsWorn` and `logWearWithPhoto` fire `revalidateTag(\`profile:${ownerProfile.username}\`, 'max')` after the DAL write commits. New imports added: `revalidateTag` from `next/cache` and `* as profilesDAL` from `@/data/profiles`. Existing `revalidatePath('/')` calls preserved.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Server Action → cache tag system | Server Actions running on writes signal the Next 16 cache layer which tags to refresh. Correct primitive (RYO vs. SWR) determines whether the caller's immediate next render bundles a fresh RSC payload or serves stale-and-revalidates. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-39c-02 | Tampering (stale state served as fresh) | profile.ts / watches.ts / wearEvents.ts post-write invalidation | mitigate | All write paths fire either `updateTag` (RYO) or `revalidateTag(tag, 'max')` (cross-user SWR) after the DAL commit. Decision rule per RESEARCH §Pitfall 3 codified in PATTERNS.md §Pattern S3 table. Static-analysis grep enforces the correct primitive at every call site. Acceptance criteria across all 4 tasks confirm the right primitive is used (e.g., Task 1: `! grep "revalidateTag('profile:" src/app/actions/profile.ts` — never revalidateTag for RYO in profile.ts; Task 2: `! grep "updateTag('profile:" src/app/actions/watches.ts` — never updateTag for cross-user fan-out in watches.ts). |
| T-39c-03 | Information Disclosure (viewer-overlay cache leak across viewers) | follows.ts viewer-overlay tag | mitigate | Viewer-overlay tag uses the `viewer:${user.id}:profile:${parsed.data.userId}` shape (D-39c-02 second tag family), which embeds BOTH the viewer's user.id AND the target profile id in the tag key. Each viewer's overlay is keyed independently — one user's follow state cannot be cached and served to another. Distinct from the existing `viewer:${id}` notifications tag (Pitfall 4 fan-out hazard avoided). Acceptance criterion: `grep -cE "updateTag\(\`viewer:\\\$\{user\.id\}:profile:" src/app/actions/follows.ts` returns EXACTLY 2 (one per mutation; both follow + unfollow). |
</threat_model>

<verification>
- Static analysis: all 4 tasks' acceptance grep commands green
- `npm run lint && npm run build` exits 0
- T-39c-02 + T-39c-03 mitigations verified by exact-count greps across all 4 files
- VALIDATION.md per-task rows for profile.ts / watches.ts / follows.ts / wearEvents.ts all green
- Pitfall 2 enforcement (no single-arg `revalidateTag` introduced anywhere in this plan): `! grep -nE "revalidateTag\([^,]+\)\s*$" src/app/actions/*.ts` returns empty (every line ending in `revalidateTag(tag)` is forbidden; the existing two-arg calls survive)
</verification>

<success_criteria>
- Files modified: 4 (profile.ts + watches.ts + follows.ts + wearEvents.ts)
- All acceptance criteria green across 4 tasks
- T-39c-02 and T-39c-03 mitigations verified by static grep
- `npm run build` exits 0
- ROADMAP SC#2 partial: invalidation strategy documented in this plan + inline comments at each call site
</success_criteria>

<output>
After completion, create `.planning/phases/39c-profile-layout-next-16-conformance/39c-05-SUMMARY.md` capturing: files modified, the 9 new tag-invalidation call sites (2 profile.ts RYO + 3 watches.ts SWR + 2 follows.ts mixed-pair + 2 wearEvents.ts SWR), the exact tag strings used, any RYO/SWR decisions that diverged from Pattern S3 (none expected), and verification that the Pitfall 2 / Pitfall 3 invariants hold across all 4 files.
</output>
