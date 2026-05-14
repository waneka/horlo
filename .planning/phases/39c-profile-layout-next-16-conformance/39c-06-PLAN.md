---
phase: 39c-profile-layout-next-16-conformance
plan: 06
type: execute
wave: 4
depends_on: [04, 05]
files_modified:
  - src/components/layout/UserMenu.tsx
  - src/components/profile/ProfileTabs.tsx
  - src/components/layout/BottomNav.tsx
autonomous: true
requirements: [NEXT16-CONFORMANCE]
threat_refs: []
must_haves:
  truths:
    - "Default Next 16 prefetch behavior is restored on all three profile-bound Link sites (UserMenu avatar, ProfileTabs tab triggers, BottomNav Profile NavLink)"
    - "BottomNav's NavLink interface no longer carries the diagnostic `prefetch?: boolean` field"
    - "Build remains green after the revert — no regression from the structural changes in Plans 01-05"
  artifacts:
    - path: "src/components/layout/UserMenu.tsx"
      provides: "Avatar Link with Next 16 default prefetch behavior"
      contains: '`href={`/u/${username}/collection`}`'
    - path: "src/components/profile/ProfileTabs.tsx"
      provides: "Tab Link render prop with Next 16 default prefetch behavior"
      contains: "render={<Link href"
    - path: "src/components/layout/BottomNav.tsx"
      provides: "Mobile bottom-nav Profile entry with Next 16 default prefetch + NavLink interface without prefetch field"
      contains: "NavLink"
  key_links:
    - from: "Top-nav avatar / tab triggers / mobile bottom-nav Profile"
      to: "src/app/u/[username]/layout.tsx (refactored in Plan 03)"
      via: "Next 16 partial prefetch — viewport entry hits the static shell (skeleton chrome RSC), click hits the resolved content RSC"
      pattern: "<Link href=\\{?`/u/"
---

<objective>
Revert the diagnostic commit `2f42d00` ("test(diagnostic): disable prefetch on profile-bound Links (PENDING REVERT)") per D-39c-08. Removes the `prefetch={false}` mitigation on the three Link sites and drops the `prefetch?: boolean` field that was added to `BottomNav`'s `NavLink` interface.

Purpose: D-39c-08 mandates this revert lands LAST in the phase — AFTER Plans 01-05 have produced the static shell, skeleton, loading.tsx, `unstable_instant` build-time gate, and Server Action invalidation wiring. Reverting before the structural fix lands would re-introduce the Router-Cache poisoning bug verified in prod 2026-05-13 (per `.planning/debug/profile-page-404-top-nav.md`).

Output: 3 modified files. Pure deletions (4 prefetch={false} lines + 3 NavLink prefetch-prop lines). No new logic. The revert is the moment partial prefetching is re-enabled on the three Link sites — verification of "no 404 regression" is the prod-only Plan 07 checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md
@.planning/debug/profile-page-404-top-nav.md
@.planning/phases/39c-profile-layout-next-16-conformance/39c-03-PLAN.md
@.planning/phases/39c-profile-layout-next-16-conformance/39c-04-PLAN.md
@.planning/phases/39c-profile-layout-next-16-conformance/39c-05-PLAN.md

<interfaces>
<!-- Mitigation commit 2f42d00 — the revert target -->

The commit added `prefetch={false}` to three Link sites and added a `prefetch?: boolean` field to BottomNav's NavLink interface. All four edits must be undone for partial prefetching to be re-enabled.

Site 1: src/components/layout/UserMenu.tsx (line 110-114 region):
```
<Link
  href={`/u/${username}/collection`}
  prefetch={false}     ← LINE TO REMOVE
  aria-label={`Go to ${username}'s profile`}
  className="..."
>
```

Site 2: src/components/profile/ProfileTabs.tsx (line 73):
```
render={<Link href={`/u/${username}/${tab.id}`} prefetch={false} />}
                                              ^^^^^^^^^^^^^^^^^^ ← TO REMOVE
```

Site 3: src/components/layout/BottomNav.tsx (multi-line revert across two scopes):
- Line 73: `prefetch?: boolean` field on NavLinkProps interface — REMOVE
- Line 76: `prefetch` destructure in NavLink function signature — REMOVE
- Line 80: `prefetch={prefetch}` on the Link inside NavLink — REMOVE
- Line 157: `prefetch={false}` on the Profile NavLink invocation — REMOVE
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Revert prefetch={false} on UserMenu avatar Link</name>
  <files>src/components/layout/UserMenu.tsx</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-08 first bullet (UserMenu revert)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/components/layout/UserMenu.tsx` section (the "Current line 110-114" target + "After revert" diff)
    - src/components/layout/UserMenu.tsx (read lines 100-130 to see the Link's surrounding JSX — single-line removal at line 112; no imports change; no logic change)
  </read_first>
  <action>
    Open `src/components/layout/UserMenu.tsx`. Locate line 112 (the `prefetch={false}` attribute inside the `<Link href={\`/u/${username}/collection\`}>` JSX). Remove that single line.

    Before:
    ```
    <Link
      href={`/u/${username}/collection`}
      prefetch={false}
      aria-label={`Go to ${username}'s profile`}
      className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
    ```

    After:
    ```
    <Link
      href={`/u/${username}/collection`}
      aria-label={`Go to ${username}'s profile`}
      className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
    ```

    Single-line removal. No imports change. No logic change. Default Next 16 prefetch behavior takes over (link.md — `prefetch="auto"` is the default).
  </action>
  <verify>
    <automated>! grep -n "prefetch={false}" src/components/layout/UserMenu.tsx && grep -n "href={`/u/" src/components/layout/UserMenu.tsx && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `! grep -n "prefetch={false}" src/components/layout/UserMenu.tsx` (the diagnostic attribute is absent)
    - `grep -n "href={`/u/" src/components/layout/UserMenu.tsx` returns >= 1 match (the avatar Link is still present and unchanged)
    - `grep -n "aria-label" src/components/layout/UserMenu.tsx` returns >= 1 match (the avatar's aria-label is preserved)
    - `git diff src/components/layout/UserMenu.tsx` shows ONLY a single-line removal (or two lines if surrounding whitespace shifts) — no other changes
    - `npm run lint` exits 0
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>
    `src/components/layout/UserMenu.tsx` line 112 (`prefetch={false}` on the avatar Link) is removed. Next 16 default prefetch behavior is restored on the top-nav avatar.
  </done>
</task>

<task type="auto">
  <name>Task 2: Revert prefetch={false} on ProfileTabs tab triggers</name>
  <files>src/components/profile/ProfileTabs.tsx</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-08 second bullet (ProfileTabs revert)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/components/profile/ProfileTabs.tsx` section (single-line revert inside JSX render prop)
    - src/components/profile/ProfileTabs.tsx (read lines 65-85 to see the TabsTrigger render prop context)
  </read_first>
  <action>
    Open `src/components/profile/ProfileTabs.tsx`. Locate line 73 (inside a TabsTrigger render prop). Remove the `prefetch={false}` attribute from the embedded Link.

    Before:
    ```
    render={<Link href={`/u/${username}/${tab.id}`} prefetch={false} />}
    ```

    After:
    ```
    render={<Link href={`/u/${username}/${tab.id}`} />}
    ```

    Single-token removal (within the same line). No imports change. No logic change.
  </action>
  <verify>
    <automated>! grep -n "prefetch={false}" src/components/profile/ProfileTabs.tsx && grep -n "render={<Link href=" src/components/profile/ProfileTabs.tsx && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `! grep -n "prefetch={false}" src/components/profile/ProfileTabs.tsx` (the diagnostic attribute is absent)
    - `grep -n "render={<Link href=" src/components/profile/ProfileTabs.tsx` returns 1 match (the render-prop Link is still present)
    - `git diff src/components/profile/ProfileTabs.tsx` shows ONLY the prefetch={false} token removal — no other changes
    - `npm run lint` exits 0
    - `npm run build` exits 0
  </acceptance_criteria>
  <done>
    `src/components/profile/ProfileTabs.tsx` line 73 has `prefetch={false}` removed from the TabsTrigger render prop's Link. Tab prefetching is restored.
  </done>
</task>

<task type="auto">
  <name>Task 3: Revert BottomNav multi-line prefetch additions (NavLink prop + invocation)</name>
  <files>src/components/layout/BottomNav.tsx</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-08 third + fourth bullets (BottomNav multi-line revert)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/components/layout/BottomNav.tsx` section (the 4-line revert with the interface + destructure + Link pass-through + invocation)
    - src/components/layout/BottomNav.tsx (read lines 65-90 for the NavLinkProps interface + NavLink function signature + Link inside NavLink; read lines 150-165 for the Profile NavLink invocation)
  </read_first>
  <action>
    In `src/components/layout/BottomNav.tsx`, perform a 4-line revert across two scopes:

    **Scope 1: NavLinkProps interface (line ~73) — remove the `prefetch?: boolean` field.**

    Before:
    ```
    interface NavLinkProps {
      href: string
      icon: LucideIcon
      label: string
      active: boolean
      prefetch?: boolean
    }
    ```

    After:
    ```
    interface NavLinkProps {
      href: string
      icon: LucideIcon
      label: string
      active: boolean
    }
    ```

    **Scope 2: NavLink function destructure (line ~76) — remove `prefetch` from the destructure pattern.**

    Before:
    ```
    function NavLink({ href, icon: Icon, label, active, prefetch }: NavLinkProps) {
    ```

    After:
    ```
    function NavLink({ href, icon: Icon, label, active }: NavLinkProps) {
    ```

    **Scope 3: Link pass-through inside NavLink (line ~80) — remove `prefetch={prefetch}` attribute.**

    Before:
    ```
    <Link
      href={href}
      prefetch={prefetch}
      aria-current={active ? 'page' : undefined}
    ```

    After:
    ```
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
    ```

    **Scope 4: Profile NavLink invocation (line ~157) — remove `prefetch={false}` attribute.**

    Before:
    ```
    <NavLink
      href={profileHref}
      icon={User}
      label="Profile"
      active={isProfile}
      prefetch={false}
    />
    ```

    After:
    ```
    <NavLink
      href={profileHref}
      icon={User}
      label="Profile"
      active={isProfile}
    />
    ```

    Order of removals does NOT matter — they're independent edits. TypeScript will catch any partial revert (e.g., destructuring `prefetch` when the prop is no longer on the interface would compile-fail). After the revert, all four NavLink invocations in BottomNav use the same prefetch shape — Next 16 default `prefetch="auto"`.
  </action>
  <verify>
    <automated>! grep -nE "prefetch=\{false\}" src/components/layout/BottomNav.tsx && ! grep -nE "prefetch\?:\s*boolean" src/components/layout/BottomNav.tsx && ! grep -nE "prefetch=\{prefetch\}" src/components/layout/BottomNav.tsx && grep -n "interface NavLinkProps" src/components/layout/BottomNav.tsx && grep -n "function NavLink" src/components/layout/BottomNav.tsx && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `! grep -nE "prefetch=\{false\}" src/components/layout/BottomNav.tsx` (Scope 4 removed)
    - `! grep -nE "prefetch\?:\s*boolean" src/components/layout/BottomNav.tsx` (Scope 1 removed — NavLinkProps interface)
    - `! grep -nE "prefetch=\{prefetch\}" src/components/layout/BottomNav.tsx` (Scope 3 removed — Link pass-through)
    - `! grep -nE "^\s*prefetch[\s,]" src/components/layout/BottomNav.tsx` (Scope 2 removed — destructure no longer contains `prefetch` token alone on a line)
    - `grep -n "interface NavLinkProps" src/components/layout/BottomNav.tsx` returns 1 match (interface still exists, just without the prefetch field)
    - `grep -n "function NavLink" src/components/layout/BottomNav.tsx` returns 1 match (function still exists, just without the prefetch destructure)
    - `git diff src/components/layout/BottomNav.tsx` shows 4 net-deletion regions (interface field, destructure, pass-through, invocation) — no other changes
    - `npm run lint` exits 0
    - `npm run build` exits 0 (TypeScript catches partial reverts — if any of the 4 scopes is incomplete, compile fails)
  </acceptance_criteria>
  <done>
    `src/components/layout/BottomNav.tsx` has all four diagnostic additions reverted (NavLinkProps field, destructure, Link pass-through, Profile invocation). The NavLink interface returns to its pre-2f42d00 shape; the Profile NavLink uses default prefetch behavior.
  </done>
</task>

<task type="auto">
  <name>Task 4: Repo-wide grep gate (no prefetch={false} lingering on the three target files)</name>
  <files>(verification only — no file edits)</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-VALIDATION.md §Per-Task Verification Map row "Diagnostic commit 2f42d00 reverted"
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-08 (the "Order matters" note — revert lands LAST in the phase; this task is the final gate before Plan 07's prod checkpoint)
  </read_first>
  <action>
    Run the load-bearing repo-wide grep checks across the three target files. This task is a verification-only sanity check before handing off to Plan 07 (prod checkpoint).

    Verify the following grep commands return EMPTY output:
    - `grep -nE "prefetch=\{false\}" src/components/layout/UserMenu.tsx src/components/profile/ProfileTabs.tsx src/components/layout/BottomNav.tsx` — no `prefetch={false}` remains on any of the three target files
    - `grep -nE "prefetch\?:\s*boolean" src/components/layout/BottomNav.tsx` — BottomNav's NavLink no longer accepts a prefetch prop

    Verify the following commands return success:
    - `npm run build` exits 0
    - `npm run lint` exits 0

    If any check fails, surface the failure to the orchestrator (do NOT proceed to Plan 07 — partial revert may re-introduce the bug or leave dead code paths in BottomNav).

    No file edits in this task. Pure verification.
  </action>
  <verify>
    <automated>! grep -nE "prefetch=\{false\}" src/components/layout/UserMenu.tsx src/components/profile/ProfileTabs.tsx src/components/layout/BottomNav.tsx && ! grep -nE "prefetch\?:\s*boolean" src/components/layout/BottomNav.tsx && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `! grep -nE "prefetch=\{false\}" src/components/layout/UserMenu.tsx src/components/profile/ProfileTabs.tsx src/components/layout/BottomNav.tsx` (no `prefetch={false}` on any target file — VALIDATION.md row green)
    - `! grep -nE "prefetch\?:\s*boolean" src/components/layout/BottomNav.tsx` (NavLink no longer accepts prefetch prop — VALIDATION.md row green)
    - `npm run build` exits 0
    - `npm run lint` exits 0
  </acceptance_criteria>
  <done>
    All three target files pass the VALIDATION.md grep gates. Partial-prefetch is re-enabled on UserMenu / ProfileTabs / BottomNav. Phase is now ready for Plan 07 (prod manual checkpoint).
  </done>
</task>

</tasks>

<verification>
- Static analysis: all 4 grep gates green (3 prefetch={false} removals + 1 NavLink prefetch?:boolean field removal)
- `npm run lint && npm run build` exits 0 (TypeScript catches any partial revert)
- ROADMAP SC#4 verified: "diagnostic commit 2f42d00 is reverted; partial prefetching restored on all three Link sites"
- No regression: build remains green after reverting the mitigation — this means Plans 01-05's structural fix is in place and the mitigation is no longer needed
</verification>

<success_criteria>
- Files modified: 3 (UserMenu + ProfileTabs + BottomNav)
- All acceptance criteria green across 4 tasks (3 reverts + 1 verification gate)
- `npm run build` exits 0
- ROADMAP SC#4 satisfied
</success_criteria>

<output>
After completion, create `.planning/phases/39c-profile-layout-next-16-conformance/39c-06-SUMMARY.md` capturing: files modified, the 7 net-deletion edits (1 in UserMenu + 1 in ProfileTabs + 4 across two scopes in BottomNav + 1 verification-only task), `git diff --stat` output showing the deletion counts, `npm run build` exit code, and a one-line callout that Plan 07 is the prod-checkpoint follow-up.
</output>
