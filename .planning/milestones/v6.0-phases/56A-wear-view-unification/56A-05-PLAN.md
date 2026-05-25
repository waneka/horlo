---
phase: 56A-wear-view-unification
plan: 05
type: execute
wave: 3
depends_on: ["03"]
files_modified:
  - src/components/home/WywtRail.tsx
  - src/components/layout/BottomNav.tsx
  - src/components/layout/SlimTopNav.tsx
  - src/components/home/WywtOverlay.tsx
  - src/components/home/WywtSlide.tsx
  - tests/integration/phase56a-wears-lane.test.ts
autonomous: true
requirements: [SC-1, SC-2, SC-5]
must_haves:
  truths:
    - "Tapping a home-rail tile navigates to /wears/[username] (a real route) instead of opening the URL-frozen WywtOverlay modal (SC-1, SC-5)"
    - "BottomNav and SlimTopNav are hidden on /wears/ routes so the stories lane is full-screen with no nav chrome (SC-2)"
    - "The legacy WywtOverlay and WywtSlide are deleted; the rail no longer imports or renders them (SC-5)"
    - "The self-placeholder → WywtPostDialog flow is unchanged (out of scope per CONTEXT.md)"
  artifacts:
    - path: "src/components/home/WywtRail.tsx"
      provides: "Rail tile tap → router.push('/wears/[username]?from=...'); overlay state + import removed"
      contains: "router.push(`/wears/"
    - path: "src/components/layout/BottomNav.tsx"
      provides: "pathname.startsWith('/wears/') early-return (hide nav on lane)"
      contains: "/wears/"
    - path: "src/components/layout/SlimTopNav.tsx"
      provides: "pathname.startsWith('/wears/') early-return (hide nav on lane)"
      contains: "/wears/"
  key_links:
    - from: "src/components/home/WywtRail.tsx"
      to: "/wears/[username]"
      via: "openAt → router.push(`/wears/${tile.username}?from=${tile.wearEventId}`)"
      pattern: "router\\.push\\(`/wears/"
    - from: "src/components/layout/BottomNav.tsx"
      to: "render null on /wears/"
      via: "if (pathname.startsWith('/wears/')) return null"
      pattern: "pathname\\.startsWith\\('/wears/'\\)"
---

<objective>
Complete the cutover: rewire the home-rail tile tap to navigate to the real `/wears/[username]` route (replacing the URL-frozen `WywtOverlay` modal), hide the nav chrome on `/wears/` routes (full-screen lane), and delete the legacy `WywtOverlay`/`WywtSlide` now that the routed lane renders the shared card. The deletion is intentionally LAST (Wave 3, gated on Plan 03) per SC-5 — the replacement must work before the legacy is removed.

Purpose: SC-1 (tile tap → real route, not a client-only modal), SC-2 (no nav chrome on the lane), SC-5 (legacy WYWT overlay replaced by the routed experience).

Output: Three modified components, two deleted files, one RED scaffold turned green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/56A-wear-view-unification/56A-CONTEXT.md
@.planning/phases/56A-wear-view-unification/56A-PATTERNS.md

@src/components/home/WywtRail.tsx

<interfaces>
From src/components/home/WywtRail.tsx (self-analog being modified):
- Lines 3, 14-18: `lazy` import + `WywtOverlay` lazy-load — REMOVE the WywtOverlay lazy import (keep the WywtPostDialog lazy import).
- Lines 59-60: `overlayOpen` + `activeTileIndex` state — REMOVE.
- Lines 79-90: `openAt(tile)` currently markViewed + setActiveTileIndex + setOverlayOpen — REPLACE with markViewed + router.push.
- Lines 117-128: the `<Suspense>{overlayOpen && <WywtOverlay .../>}</Suspense>` block — REMOVE.
- KEEP: `onOpenPicker` → setPickerOpen(true) and the WywtPostDialog render (self-placeholder flow, out of scope — Pitfall 5).
- WywtTileData has `.username` and `.wearEventId`.

From src/components/layout/BottomNav.tsx (self-analog): line 103-105 — `const pathname = usePathname() ?? ''; if (isPublicPath(pathname)) return null; if (!username) return null`. Add a `/wears/` check.
From src/components/layout/SlimTopNav.tsx (self-analog): line 47-48 — `const pathname = usePathname() ?? ''; if (isPublicPath(pathname)) return null`. Add a `/wears/` check.

useRouter: `import { useRouter } from 'next/navigation'` (both BottomNav and SlimTopNav already use usePathname from next/navigation; WywtRail must add useRouter).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewire WywtRail to navigate + remove overlay state</name>
  <files>src/components/home/WywtRail.tsx</files>
  <read_first>
    - src/components/home/WywtRail.tsx (the file being modified — the lazy WywtOverlay import, overlayOpen/activeTileIndex state, openAt body, the Suspense overlay render block, and the preserved onOpenPicker/WywtPostDialog flow)
    - .planning/phases/56A-wear-view-unification/56A-PATTERNS.md (§ src/components/home/WywtRail.tsx (modify) — exact deletions + the replacement openAt with router.push(`/wears/${tile.username}?from=${tile.wearEventId}`))
    - .planning/phases/56A-wear-view-unification/56A-RESEARCH.md (Pitfall 5 — keep onOpenPicker → WywtPostDialog untouched)
  </read_first>
  <action>
    Modify `src/components/home/WywtRail.tsx`:

    1. Add `import { useRouter } from 'next/navigation'`. Inside the component, add `const router = useRouter()`.

    2. Remove the `WywtOverlay` lazy import (the `const WywtOverlay = lazy(() => import('@/components/home/WywtOverlay')...)` block). Keep the `WywtPostDialog` lazy import. If `lazy` and `Suspense` are still used by WywtPostDialog, keep their imports; otherwise drop the now-unused ones.

    3. Remove the `overlayOpen` and `activeTileIndex` state declarations.

    4. Replace the `openAt(tile)` body with: `markViewed(tile.wearEventId)` then `router.push(\`/wears/${tile.username}?from=${tile.wearEventId}\`)`. The `?from=` lets the lane open at the tapped slide (D-05). Keep the markViewed-first ordering so the rail ring updates even if navigation is slow.

    5. Remove the `<Suspense>{overlayOpen && <WywtOverlay ... />}</Suspense>` render block entirely.

    6. Leave the self-placeholder flow untouched (Pitfall 5): `onOpenPicker={() => setPickerOpen(true)}` and the `<Suspense>{pickerOpen && <WywtPostDialog .../>}</Suspense>` render stay exactly as they are.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -c "WywtRail" | grep -q "^0$" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "WywtOverlay" src/components/home/WywtRail.tsx` returns 0 (import + render removed)
    - File contains `router.push(\`/wears/${tile.username}?from=${tile.wearEventId}\`)` (or the equivalent template literal)
    - `grep -c "overlayOpen\|activeTileIndex" src/components/home/WywtRail.tsx` returns 0
    - File still contains `WywtPostDialog` and `onOpenPicker` (self-placeholder flow preserved, Pitfall 5)
    - File contains `markViewed(tile.wearEventId)` before the router.push in openAt
    - `npx tsc --noEmit` reports no errors referencing WywtRail.tsx
  </acceptance_criteria>
  <done>Tapping a rail tile navigates to /wears/[username]?from=...; the overlay import, state, and render are gone; the WywtPostDialog self-placeholder flow is untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Hide nav chrome on /wears/ routes</name>
  <files>src/components/layout/BottomNav.tsx, src/components/layout/SlimTopNav.tsx</files>
  <read_first>
    - src/components/layout/BottomNav.tsx (the isPublicPath early-return pattern at lines 103-105 — add the /wears/ check right after it)
    - src/components/layout/SlimTopNav.tsx (the isPublicPath early-return at lines 47-48 — add the /wears/ check right after it)
    - .planning/phases/56A-wear-view-unification/56A-PATTERNS.md (§ BottomNav + § SlimTopNav — the exact one-line additions and the client-side-only rationale)
    - .planning/phases/56A-wear-view-unification/56A-UI-SPEC.md (§ Route-Specific Layout Contracts → Stories Lane — Option B nav hiding, BottomNav md:hidden already; SlimTopNav md:hidden)
  </read_first>
  <action>
    In `src/components/layout/BottomNav.tsx`, immediately after the existing `if (isPublicPath(pathname)) return null` (and before/around the `if (!username) return null`), add: `if (pathname.startsWith('/wears/')) return null`. Add a comment: stories lane is full-screen / no nav chrome (SC-2, UI-SPEC §Route Layout — Option B); client-side only, no proxy impact (isPublicPath controls auth redirect, not this check).

    In `src/components/layout/SlimTopNav.tsx`, immediately after the existing `if (isPublicPath(pathname)) return null`, add: `if (pathname.startsWith('/wears/')) return null` with the same explanatory comment.

    Do NOT add `/wears` to isPublicPath / public-paths — that would wrongly disable the proxy auth gate (the lane is auth-only). The pathname checks here are purely the client-side render gate (Option B from RESEARCH.md, the lower-risk approach that avoids route-group restructuring).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep -cE "BottomNav|SlimTopNav" | grep -q "^0$" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "pathname.startsWith('/wears/')" src/components/layout/BottomNav.tsx` returns 1
    - `grep -c "pathname.startsWith('/wears/')" src/components/layout/SlimTopNav.tsx` returns 1
    - Neither file adds `/wears` to any public-paths import (auth gate unchanged) — `grep -c "isPublicPath" src/components/layout/BottomNav.tsx` is unchanged (still uses it, not modified)
    - `npx tsc --noEmit` reports no errors referencing BottomNav.tsx or SlimTopNav.tsx
  </acceptance_criteria>
  <done>BottomNav and SlimTopNav return null on /wears/ routes (client-side only); the proxy auth gate is untouched.</done>
</task>

<task type="auto">
  <name>Task 3: Delete legacy WywtOverlay + WywtSlide; turn SC-5 scaffold green</name>
  <files>src/components/home/WywtOverlay.tsx, src/components/home/WywtSlide.tsx, tests/integration/phase56a-wears-lane.test.ts</files>
  <read_first>
    - src/components/home/WywtRail.tsx (CONFIRM Task 1 removed all references — grep must show no WywtOverlay import before deleting)
    - .planning/phases/56A-wear-view-unification/56A-PATTERNS.md (§ DELETE: WywtOverlay.tsx + WywtSlide.tsx — gated AFTER the lane ships, SC-5)
    - tests/integration/phase56a-wears-lane.test.ts (the SC-5 RED scaffold from Plan 01 that asserts the legacy modules are removed — turn it green)
  </read_first>
  <action>
    Pre-flight: confirm no remaining importer of `WywtOverlay` or `WywtSlide` exists anywhere. Run a repo grep for `WywtOverlay` and `WywtSlide` across `src/` — the only matches should be the files themselves (and the deleted-state assertion in the test). If any other source file still imports them, STOP and fix that importer first (this is the SC-5 deletion gate — deletion must come AFTER the lane renders and after all importers are rewired in Task 1).

    Delete `src/components/home/WywtOverlay.tsx` and `src/components/home/WywtSlide.tsx`.

    Update `tests/integration/phase56a-wears-lane.test.ts`: turn the SC-5 assertion green — assert the legacy modules no longer exist. Use a filesystem existence check (`fs.existsSync` against the two paths returns false) OR a dynamic import that rejects, whichever the scaffold used. Remove the `EXPECTED RED until Plan 05` marker on the SC-5 block now that it is satisfied. Also turn green the SC-1 navigation-target assertion now that WywtRail.openAt pushes to `/wears/${username}` (assert the rail's navigation contract — e.g., the rendered tile triggers a router.push to a `/wears/` URL, or assert the openAt template via a unit-level check consistent with the scaffold's approach).
  </action>
  <verify>
    <automated>npm run test -- phase56a-wears-lane && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/home/WywtOverlay.tsx` is false (file deleted) and `test -f src/components/home/WywtSlide.tsx` is false (file deleted)
    - `grep -rc "WywtOverlay\|WywtSlide" src/ | grep -v ':0' | grep -v -E "WywtOverlay.tsx|WywtSlide.tsx"` returns no remaining source importers (only the now-deleted files would have matched, and they are gone)
    - `tests/integration/phase56a-wears-lane.test.ts` SC-5 block asserts the two files do NOT exist and carries no `EXPECTED RED` marker
    - `npm run test -- phase56a-wears-lane` exits 0 (SC-1 + SC-5 + D-07 all green)
    - `npm run build` succeeds with no unresolved imports of the deleted modules
  </acceptance_criteria>
  <done>WywtOverlay and WywtSlide are deleted with no remaining importers; the SC-5 (and SC-1) integration scaffold is green; the build succeeds.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client rail → /wears/[username] navigation | username comes from the rail tile (server-sourced via getWearRailForViewer); the lane re-resolves and re-gates server-side |
| client nav-render gate | pathname check hides nav chrome only; it is NOT the auth gate (proxy/isPublicPath remains the auth gate) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-56A-14 | Elevation of Privilege | Adding /wears to the client nav-hide check accidentally disabling the proxy auth gate | mitigate | The pathname.startsWith('/wears/') check lives ONLY in the client BottomNav/SlimTopNav render path, NOT in isPublicPath / public-paths. The proxy auth gate is untouched — /wears/ remains a non-public, auth-only path. Asserted by acceptance criteria (isPublicPath usage unchanged). |
| T-56A-15 | Information Disclosure | Rail navigation exposing a username for a wear the viewer cannot see | accept | The rail tiles already come from getWearRailForViewer's three-tier gate; navigating to /wears/[username] re-resolves and re-gates server-side via getActiveWearsForUser (Plan 03). No client-trusted data crosses the boundary as authority. |
| T-56A-16 | Denial of Service / regression | Deleting WywtOverlay/WywtSlide while an importer remains, breaking the home page | mitigate | The SC-5 deletion gate: a repo-wide grep for remaining importers runs BEFORE deletion; deletion is gated on Plan 03 (lane renders) and on Task 1 (rail rewired). `npm run build` in verify proves no unresolved imports. |
</threat_model>

<verification>
- `npm run test -- phase56a-wears-lane` exits 0 (SC-1, SC-5, D-07 green)
- `npm run build` succeeds (no unresolved imports of deleted modules)
- `npm run test && npm run test:e2e` — full suite green before phase gate (per VALIDATION.md); the e2e wears-lane scaffold (SC-1/SC-2/SC-3) now runs against the live route
- `grep -rc "WywtOverlay\|WywtSlide" src/` shows no remaining references after deletion
</verification>

<success_criteria>
- Rail tile tap navigates to the real /wears/[username] route (SC-1, SC-5)
- Nav chrome hidden on /wears/ (SC-2); WywtOverlay + WywtSlide deleted with no importers (SC-5)
- Self-placeholder WywtPostDialog flow unchanged; proxy auth gate untouched
</success_criteria>

<output>
After completion, create `.planning/phases/56A-wear-view-unification/56A-05-SUMMARY.md`
</output>
