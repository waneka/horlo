---
phase: 39c-profile-layout-next-16-conformance
plan: 04
type: execute
wave: 3
depends_on: [03]
files_modified:
  - src/app/u/[username]/[tab]/page.tsx
autonomous: true
requirements: [NEXT16-CONFORMANCE]
threat_refs: []
must_haves:
  truths:
    - "[tab]/page.tsx exports `unstable_instant = { prefetch: 'static' }` as a build-time gate"
    - "`npm run build` exits 0 — the gate confirms the static shell is instant; failure indicates the layout refactor (Plan 03) is incomplete"
  artifacts:
    - path: "src/app/u/[username]/[tab]/page.tsx"
      provides: "Existing tab page body UNCHANGED; new top-level `export const unstable_instant = { prefetch: 'static' }`"
      contains: "unstable_instant"
  key_links:
    - from: "src/app/u/[username]/[tab]/page.tsx"
      to: "src/app/u/[username]/layout.tsx (refactored in Plan 03)"
      via: "Next 16 simulates every shared-layout entry point at build time per instant.md:65-69"
      pattern: "unstable_instant.*prefetch.*static"
---

<objective>
Add the Next 16 native build-time validation gate `export const unstable_instant = { prefetch: 'static' }` to `src/app/u/[username]/[tab]/page.tsx`. Implements D-39c-07.

Purpose: This is the compile-time invariant that turns "the static shell is instant" from a manual checklist item into a build-time gate. Per `instant.md:65-69`, the validation simulates every shared-layout entry point — if Plan 03's layout refactor is incomplete (any uncached top-level read remains), the build fails. Per RESEARCH §Pitfall 6 / §Recommended order, this plan lands AFTER the layout refactor for exactly this reason: the gate would fail-fast on an incomplete refactor.

Output: 1 modified file. Single-line addition (plus 3-5 lines of doc comment).
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
@.planning/phases/39c-profile-layout-next-16-conformance/39c-03-PLAN.md

<interfaces>
<!-- Verified Next 16 API shape from RESEARCH.md §Sources -->

From node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md:22-30:
```typescript
export const unstable_instant: InstantConfig = { prefetch: 'static' }
// or with type-only annotation:
export const unstable_instant = { prefetch: 'static' }
```

Verified from instant.md:
- Must be on a Server Component (instant.md:20). `[tab]/page.tsx` is a Server Component (verified — starts with `import { notFound } from 'next/navigation'`).
- Simulates every shared-layout entry point at build + dev time (instant.md:65-69). The refactored layout from Plan 03 is in the simulation scope.
- Opt-out is `false` (instant.md). NOT needed here — we want the static shell, not the opt-out.
- `cacheComponents: true` is required (verified — `next.config.ts:13`).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add unstable_instant route-segment export to [tab]/page.tsx</name>
  <files>src/app/u/[username]/[tab]/page.tsx</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md §D-39c-07 (locked decision: adopt `unstable_instant` as the build-time gate)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-RESEARCH.md §Code Examples → Example 6 (the verbatim single-line addition) + §Pitfall 6 / §Recommended order (why this lands AFTER Plan 03)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/app/u/[username]/[tab]/page.tsx` section (the "no in-repo analog" note + position guidance — between imports and the page component)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md lines 15-30 (the canonical shape) and lines 65-69 (the validation scope)
    - src/app/u/[username]/[tab]/page.tsx (the FULL file — verify the existing import block ending and the position to insert the new export; PATTERNS.md suggests near line 36-37, after the imports ending at `import type { WatchWithWear } from '@/lib/types'` and before the `const VALID_TABS = [...]` declaration)
    - .planning/phases/39c-profile-layout-next-16-conformance/39c-03-PLAN.md (verify Plan 03 has already shipped — this plan's `depends_on: [03]` enforces that ordering at the orchestrator level, but executor should sanity-check the layout refactor is in place before adding the gate)
  </read_first>
  <action>
    Open `src/app/u/[username]/[tab]/page.tsx`. Locate the boundary between the imports block (last import is `import type { WatchWithWear } from '@/lib/types'` near line 36) and the `const VALID_TABS = [...]` declaration. Insert a 5-line block at that boundary (preserve blank line above and below per project formatting convention):

    ```
    // Phase 39c D-39c-07: build-time gate that confirms the route produces an
    // instant static shell. Next 16 simulates every shared-layout entry point
    // and fails the build if any component blocks prefetch. Source:
    // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
    // 02-route-segment-config/instant.md:22-30
    export const unstable_instant = { prefetch: 'static' }
    ```

    Single-line export. NO `import type { InstantConfig }` — the inline object literal type-infers correctly without an explicit annotation (instant.md shows both forms; the un-annotated form is the cleaner fit for this codebase's existing style).

    Do NOT modify the rest of the file — the page body, the `notFound()` calls, the tab routing logic, the DAL fan-in all stay UNCHANGED. The page's existing Server Component status is preserved (instant.md:20 requirement).

    Run `npm run build` as part of the task. The build is the gate: if it fails, that proves the layout refactor (Plan 03) is incomplete — the failure message identifies the offending component (per RESEARCH §Open Question #4). In that case, surface the failure to the orchestrator (do NOT silently disable the gate or revert the layout — gap-closure is the orchestrator's call).
  </action>
  <verify>
    <automated>grep -nE "export const unstable_instant\\s*=\\s*\\{\\s*prefetch:\\s*'static'\\s*\\}" src/app/u/[username]/[tab]/page.tsx && npm run lint && npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "export const unstable_instant\\s*=\\s*\\{\\s*prefetch:\\s*'static'\\s*\\}" src/app/u/[username]/[tab]/page.tsx` returns 1 match (the route-segment export per D-39c-07)
    - `grep -n "unstable_instant" src/app/u/[username]/[tab]/page.tsx` returns >= 1 match (forward-compatibility — covers the case where the executor formatted the export differently)
    - The export sits BEFORE the page component default export (verify by inspecting line numbers — the export should be on a line less than the `export default async function` line)
    - **Load-bearing acceptance:** `npm run build` exits 0 — this IS the build-time gate per D-39c-07; failure indicates Plan 03 layout refactor is incomplete and triggers gap-closure
    - `npm run lint` exits 0 (no new ESLint warnings)
    - The page body's DAL calls (`getProfileByUsername`, `getWatchesByUser`, etc.) are UNCHANGED — `git diff src/app/u/[username]/[tab]/page.tsx` should show ONLY the new 6-line block (5-line comment + 1-line export) as an addition; ZERO modifications to existing code
  </acceptance_criteria>
  <done>
    `src/app/u/[username]/[tab]/page.tsx` gains the `export const unstable_instant = { prefetch: 'static' }` route-segment export (with a 5-line doc comment) between the imports and the `VALID_TABS` declaration. `npm run build` exits 0, proving the layout refactor produces an instant static shell.
  </done>
</task>

</tasks>

<verification>
- Static analysis: the `unstable_instant` export grep returns exactly 1 match
- **Build-time gate:** `npm run build` exits 0 (the load-bearing acceptance — this is THE Next 16 native validation that the static shell is instant)
- File diff: only the 6-line addition appears in `git diff` — no incidental edits to the page body
</verification>

<success_criteria>
- File modified: 1 (single-line export + 5-line doc comment)
- All acceptance criteria green
- `npm run build` exits 0
- ROADMAP SC#5 partial: this plan does NOT yet verify prod-only nav behavior (that lands in Plan 07 prod checkpoint) — the build-time gate is the automated half of the verification
</success_criteria>

<output>
After completion, create `.planning/phases/39c-profile-layout-next-16-conformance/39c-04-SUMMARY.md` capturing: file modified, exact line range of the addition, `npm run build` output (the relevant prerender / static-shell line if Next 16 emits one), any warnings, and any gap-closure recommendation if the build fails (do NOT mark the plan done if build fails).
</output>
