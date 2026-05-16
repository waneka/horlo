---
phase: 39c-profile-layout-next-16-conformance
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/u/[username]/profile-shell-skeleton.tsx
  - src/app/u/[username]/loading.tsx
autonomous: true
requirements: [NEXT16-CONFORMANCE]
threat_refs: []
must_haves:
  truths:
    - "Profile route segment has a loading.tsx that renders a chrome-only skeleton during prefetch + nav"
    - "Skeleton's outer dimensions match the layout's <main> wrapper so swap is zero outer-CLS"
    - "Skeleton is text-free and uses only the shadcn <Skeleton/> primitive (no raw colors, no font-medium)"
  artifacts:
    - path: "src/app/u/[username]/profile-shell-skeleton.tsx"
      provides: "Chrome-only skeleton: 96px avatar circle, name placeholder (h-6 w-48), 5 tab pills (h-9 w-20 each), content card (h-64 rounded-xl border)"
      contains: "export function ProfileShellSkeleton"
    - path: "src/app/u/[username]/loading.tsx"
      provides: "Next 16 segment loading boundary rendering ProfileShellSkeleton inside a <main> wrapper matching layout.tsx"
      contains: "export default function Loading"
  key_links:
    - from: "src/app/u/[username]/loading.tsx"
      to: "src/app/u/[username]/profile-shell-skeleton.tsx"
      via: "named import"
      pattern: "import \\{ ProfileShellSkeleton \\} from './profile-shell-skeleton'"
---

<objective>
Author the chrome-only `<ProfileShellSkeleton/>` and the `loading.tsx` segment boundary that renders it. This plan delivers the visual contract from 39C-UI-SPEC.md without any data dependencies — it can ship in parallel with the resolver plan (Plan 02). Implements D-39c-06.

Purpose: Provide the static Suspense fallback that the refactored layout (Plan 03) and the Next 16 segment loading convention will both rely on. The skeleton's dimensions are non-negotiable per UI-SPEC and are chosen to optimize the public-branch swap (the dominant path) at the deliberate cost of small CLS on the locked-branch fork (per D-39c-06).

Output: 2 new files. No data flow, no client state, no `'use client'` directive.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-CONTEXT.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-UI-SPEC.md
@.planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md

<interfaces>
<!-- Existing shadcn primitive — the only design-system surface this plan touches -->

From src/components/ui/skeleton.tsx:
```
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element
// applies: className={cn('animate-pulse rounded-md bg-muted', className)}
```

From src/app/u/[username]/layout.tsx (current main wrapper className, must match in loading.tsx for zero outer-CLS):
```
<main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Author ProfileShellSkeleton chrome-only skeleton</name>
  <files>src/app/u/[username]/profile-shell-skeleton.tsx</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-UI-SPEC.md §Component Inventory → `<ProfileShellSkeleton/>` (element-by-element contract table)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/app/u/[username]/profile-shell-skeleton.tsx` section (the pattern S6 + analog mapping)
    - src/components/ui/skeleton.tsx (the primitive — confirm the `<Skeleton className=... />` shape)
    - src/components/insights/VerdictSkeleton.tsx (analog — pure-component shape, no `'use client'`, named export)
    - src/components/search/SearchResultsSkeleton.tsx (analog — `data-testid` outer hook pattern)
    - src/components/wear/PhotoSkeleton.tsx (analog — `role="status" aria-label` precedent if a11y label is added)
  </read_first>
  <action>
    Create `src/app/u/[username]/profile-shell-skeleton.tsx` as a Server-Component-safe pure presentational module. Single import: `import { Skeleton } from '@/components/ui/skeleton'`. No `'use client'` directive. No `'server-only'` import (the skeleton is safe in any environment).

    Export named function `ProfileShellSkeleton`. Outer wrapper is a `<div className="space-y-6" data-testid="profile-shell-skeleton">` (NOT a `<main>` — the layout owns the `<main>` wrapper; the `loading.tsx` boundary owns the OTHER `<main>` wrapper). Render four Skeleton blocks per UI-SPEC §Component Inventory:
    1. Header row: `<div className="flex items-center gap-4">` containing `<Skeleton className="size-24 rounded-full" />` (96px avatar circle) and `<Skeleton className="h-6 w-48" />` (name placeholder).
    2. Tab pill row container: `<div className="flex gap-2 overflow-hidden">` containing five `<Skeleton key={i} className="h-9 w-20 shrink-0 rounded-md" />` pills generated via `Array.from({ length: 5 }).map((_, i) => ...)`.
    3. Content card placeholder: `<Skeleton className="h-64 w-full rounded-xl border" />`.

    JSDoc above the function: 5-7 lines citing D-39c-06 (chrome-only — no taste-tag chips, no common-ground band, no `font-medium`) and the UI-SPEC element dimensions. Mirror the JSDoc shape of `src/components/insights/VerdictSkeleton.tsx:4-17`. Do NOT add any visible text content. Do NOT use `font-medium` anywhere — `tests/no-raw-palette.test.ts:20` forbids it (third occurrence of this lesson in Phase 39b history). Accessibility: do not add `role="status"` / `aria-label` unless the existing Phase 39b project lint requires it; the established VerdictSkeleton/SearchResultsSkeleton pattern is no a11y label, and that is acceptable per UI-SPEC §Accessibility.
  </action>
  <verify>
    <automated>test -f src/app/u/[username]/profile-shell-skeleton.tsx && grep -c "Skeleton" src/app/u/[username]/profile-shell-skeleton.tsx | grep -qE "^[5-9]$|^[1-9][0-9]+$" && ! grep -nE "font-medium|bg-gray-|#[0-9a-fA-F]{3,8}\\b|oklch\\(" src/app/u/[username]/profile-shell-skeleton.tsx && ! grep -n "'use client'" src/app/u/[username]/profile-shell-skeleton.tsx && grep -n "data-testid=\"profile-shell-skeleton\"" src/app/u/[username]/profile-shell-skeleton.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/app/u/[username]/profile-shell-skeleton.tsx` exits 0
    - `grep -n "export function ProfileShellSkeleton" src/app/u/[username]/profile-shell-skeleton.tsx` returns exactly 1 match
    - `grep -n "import { Skeleton } from '@/components/ui/skeleton'" src/app/u/[username]/profile-shell-skeleton.tsx` returns exactly 1 match
    - `grep -c "<Skeleton " src/app/u/[username]/profile-shell-skeleton.tsx` returns >= 3 (4-element design: avatar + name + 5-pill loop + content; the .map call counts as 1 lexical Skeleton occurrence)
    - `grep -n "size-24 rounded-full" src/app/u/[username]/profile-shell-skeleton.tsx` returns 1 match (96px avatar circle per UI-SPEC)
    - `grep -n "h-6 w-48" src/app/u/[username]/profile-shell-skeleton.tsx` returns 1 match (name placeholder per UI-SPEC)
    - `grep -n "h-9 w-20" src/app/u/[username]/profile-shell-skeleton.tsx` returns 1 match (tab pill dimensions per UI-SPEC)
    - `grep -n "h-64.*rounded-xl.*border\\|h-64.*border.*rounded-xl\\|rounded-xl.*border.*h-64\\|rounded-xl.*h-64.*border\\|border.*h-64.*rounded-xl\\|border.*rounded-xl.*h-64" src/app/u/[username]/profile-shell-skeleton.tsx` returns >= 1 match (content card per UI-SPEC) — order-tolerant
    - `grep -n "data-testid=\"profile-shell-skeleton\"" src/app/u/[username]/profile-shell-skeleton.tsx` returns 1 match (test hook per UI-SPEC)
    - `! grep -nE "font-medium" src/app/u/[username]/profile-shell-skeleton.tsx` (project lint — third occurrence of font-medium → font-semibold lesson in Phase 39b)
    - `! grep -nE "bg-gray-|#[0-9a-fA-F]{3,8}\\b|oklch\\(" src/app/u/[username]/profile-shell-skeleton.tsx` (no raw colors per `tests/no-raw-palette.test.ts`)
    - `! grep -n "'use client'" src/app/u/[username]/profile-shell-skeleton.tsx` (Server-Component-safe)
    - `npm run lint` exits 0 for this file (no new ESLint warnings introduced)
  </acceptance_criteria>
  <done>
    `src/app/u/[username]/profile-shell-skeleton.tsx` exists, exports a named `ProfileShellSkeleton` function, composes 4 Skeleton blocks at the UI-SPEC dimensions, has the outer `data-testid` hook, contains zero raw-color/font-medium/use-client violations, and survives `npm run lint`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Author loading.tsx segment boundary</name>
  <files>src/app/u/[username]/loading.tsx</files>
  <read_first>
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-UI-SPEC.md §Streaming & Interaction Contract → "loading.tsx boundary" + §Component Inventory → "loading.tsx"
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-RESEARCH.md §Code Examples → Example 4 (the canonical 2-line + `<main>` wrapper shape)
    - .planning/phases/39c-profile-layout-next-16-conformance/39C-PATTERNS.md §`src/app/u/[username]/loading.tsx` section (no in-repo analog; doc-mirror only)
    - node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md (lines 88-95 — same-segment layout NOT wrapped; loading.tsx wraps page.tsx + nested layouts)
    - src/app/u/[username]/layout.tsx (read lines 1-50 to confirm the current `<main>` className for parity)
  </read_first>
  <action>
    Create `src/app/u/[username]/loading.tsx`. Two statements only: (1) `import { ProfileShellSkeleton } from './profile-shell-skeleton'`; (2) `export default function Loading()` returning a `<main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12">` wrapping `<ProfileShellSkeleton />`.

    The `<main>` className MUST be byte-equivalent to the current `src/app/u/[username]/layout.tsx:50,113` wrapper className (`mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12`) so the user perceives zero outer-CLS when the loading.tsx fallback collapses into the layout's resolved tree. Per UI-SPEC §Streaming & Interaction Contract → "loading.tsx boundary": "they MUST visually match so the user never perceives a skeleton-to-skeleton hop."

    `default export` is required by the Next 16 segment file convention (different from the rest of the codebase which uses named exports). Synchronous function (NOT async) — Next 16 renders loading.js eagerly as the Suspense fallback per loading.md:88. No data fetching, no `await params`, no props. Add a 2-3 line comment above the function citing D-39c-06 + loading.md:88.
  </action>
  <verify>
    <automated>test -f src/app/u/[username]/loading.tsx && grep -n "export default function" src/app/u/[username]/loading.tsx && grep -n "ProfileShellSkeleton" src/app/u/[username]/loading.tsx && grep -n "mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12" src/app/u/[username]/loading.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/app/u/[username]/loading.tsx` exits 0
    - `grep -n "export default function Loading" src/app/u/[username]/loading.tsx` returns 1 match
    - `grep -n "import { ProfileShellSkeleton } from './profile-shell-skeleton'" src/app/u/[username]/loading.tsx` returns 1 match
    - `grep -n "mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-12" src/app/u/[username]/loading.tsx` returns 1 match (byte-equivalent to layout.tsx wrapper for zero outer-CLS — UI-SPEC §Streaming & Interaction Contract)
    - `grep -n "<ProfileShellSkeleton" src/app/u/[username]/loading.tsx` returns 1 match
    - `! grep -n "'use client'" src/app/u/[username]/loading.tsx` (Server-Component-safe)
    - `! grep -nE "async function|await " src/app/u/[username]/loading.tsx` (synchronous per loading.md:88)
    - `npm run lint` exits 0
  </acceptance_criteria>
  <done>
    `src/app/u/[username]/loading.tsx` exists as a 2-statement synchronous default-exported Loading function rendering `<ProfileShellSkeleton />` inside a `<main>` wrapper byte-equivalent to the current layout's `<main>`.
  </done>
</task>

</tasks>

<verification>
- File presence: both new files exist
- Static analysis: all greps in Task 1 + Task 2 acceptance criteria pass
- Build: `npm run lint && npm run build` exit 0 (the skeleton is independent of the rest of the refactor; build must not regress even though the layout still has its top-level fetches — the new files do not affect existing prefetch behavior on their own)
- Test hook: `data-testid="profile-shell-skeleton"` present on the skeleton's outer wrapper
</verification>

<success_criteria>
- New files: 2 (skeleton + loading.tsx)
- All acceptance criteria green
- `npm run build` exit 0
- No regression to Phase 39 / 39b affordances (this plan adds files but does not modify existing components yet)
</success_criteria>

<output>
After completion, create `.planning/phases/39c-profile-layout-next-16-conformance/39c-01-SUMMARY.md` capturing: files created, dimensions chosen vs. UI-SPEC table, any Rule 1 auto-fixes (anticipated: font-medium → font-semibold flip if executor accidentally introduces it during copy-paste).
</output>
