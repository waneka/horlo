---
phase: 71-dead-code-cleanup-static-guards
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - tests/static/AddWatchFlow.no-verdict-step.test.ts
  - tests/static/AddWatchFlow.no-collection-fit-card.test.ts
  - package.json
  - src/components/watch/flowTypes.ts
  - src/components/watch/AddWatchFlow.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 71: Code Review Report

**Reviewed:** 2026-05-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 71 is a subtraction-only cleanup: rail residue removed from AddWatchFlow, flowTypes.ts pruned to two exports, two new static guards added with correct `// @vitest-environment node` directives at line 1, and prebuild expanded from a single file to the full `tests/static/` directory.

Rail residue sweep is clean — zero `rail`, `setRail`, `railRef`, or `RailEntry` tokens remain in AddWatchFlow.tsx. flowTypes.ts exports exactly `FlowState` and `DupeContext`; all three imports are used. Both new guards carry the mandatory `// @vitest-environment node` directive at line 1 (no preceding blank or content). package.json prebuild value is exactly `vitest run tests/static/`. No raw-palette colors, no `any` casts, no new TODO/FIXME introduced.

Three findings require attention before ship: one is about the risk profile of the new prebuild scope expansion, one is a pre-existing double-submission window surfaced by reading this file, and one is a loose-equality inconsistency in a TypeScript strict-mode project.

## Warnings

### WR-01: prebuild scope expansion exposes pre-existing `jsdom`-env tests to Vercel build

**File:** `package.json:7`
**Issue:** The prebuild was widened from `vitest run tests/static/legacy-watch-routes.test.ts` (single file with `// @vitest-environment node`) to `vitest run tests/static/` (all files). Eight pre-existing test files in that directory use `node:fs` functions (`existsSync`, `readFileSync`) without the `// @vitest-environment node` directive: `CollectionFitCard.no-engine.test.ts`, `ReferenceIdentityCard.no-engine.test.ts`, `hierarchy.lineage-3-node.test.ts`, `search-dal.movement-type.test.ts`, `WatchForm.accordion.guards.test.ts`, `WatchCard.sold-badge.test.tsx`, `composer-engine-alignment.test.ts`, `email-templates.test.ts`. Per the project memory (`project_vitest_static_node_env.md`), the root cause of Phase 59's Vercel prebuild failure was `node:fs` being externalized in the `jsdom` environment — the specific symptom was `readdirSync is not a function`. None of the eight files use `readdirSync` or `statSync`, only `existsSync`/`readFileSync`; the memory's parenthetical calls out `readdirSync` specifically. However the memory also describes the failure mode as "node:fs externalized" (the module, not just one function), leaving it ambiguous whether `readFileSync` is also undefined on Vercel's build. These tests passed locally (verified in phase execution), but local `jsdom` runs under a full Node.js runtime where `node:fs` is never actually externalized. The risk of a Vercel prebuild failure is real and not caught by `npm run build` locally.

**Fix:** Add `// @vitest-environment node` as line 1 to each of the eight pre-existing static tests that use `node:fs` without it. If confirmed that only `readdirSync`/`statSync` (not `readFileSync`/`existsSync`) is externalized on Vercel, the fix still costs nothing and removes the ambiguity permanently. Concrete example:
```typescript
// @vitest-environment node
//
// Reads source files via node:fs. Must run in the node environment —
// jsdom externalizes node:fs on Vercel's prebuild, making fs functions undefined.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
// ... rest of file unchanged
```

### WR-02: URL-extraction button not disabled during in-flight fetch — double-submission window

**File:** `src/components/watch/AddWatchFlow.tsx:671`
**Issue:** Inside the `extracting-url` branch, the "Find specs" button's `disabled` prop is bound to `!url.trim()` using the local `url` state variable (line 671). When the user clicks "Find specs", `handleUrlBackup` sets `state = { kind: 'extracting-url', url: trimmedUrl }` (line 312) but does NOT clear the local `url` state. The spinner shows via `state.url !== ''` (line 674), giving visual feedback — but the button remains enabled because `url.trim()` is still non-empty. A second click before the async fetch resolves calls `handleUrlBackup` again: the early-return guard at line 311 only checks for an empty URL, not for an in-progress fetch. This issues a duplicate `POST /api/extract-watch` request. If the two responses resolve in different orders, the second `setState` can overwrite the first's result silently. The URL cache (line 324–347) only mitigates this if the URL was already cached; it does not prevent the duplicate network call on first extraction.

**Fix:** Add an `isExtracting` state boolean or disable the button when `state.kind === 'extracting-url' && state.url !== ''`:
```tsx
<Button
  type="button"
  onClick={handleUrlBackup}
  disabled={!url.trim() || (state.kind === 'extracting-url' && state.url !== '')}
  className="w-full"
>
```
Alternatively, gate `handleUrlBackup` itself:
```typescript
const handleUrlBackup = useCallback(async () => {
  const trimmedUrl = url.trim()
  if (!trimmedUrl) return
  // Prevent double-submission: already extracting this URL
  if (state.kind === 'extracting-url' && state.url === trimmedUrl) return
  // ...
}, [url, urlCache, initialStatus, state])
```

### WR-03: Loose equality `!= null` on a `DupeContext | null` value in strict-mode TypeScript

**File:** `src/components/watch/AddWatchFlow.tsx:722`
**Issue:** The WR-01 pending-gate fix uses `state.dupeContext != null` (loose equality, line 722) to check whether a dupe context is present. The rest of the file uses strict equality consistently (`=== null` at line 135, `=== 'owned'` etc. throughout). The `DupeContext | null` type from `flowTypes.ts:60–64` cannot be `undefined`, so `!= null` and `!== null` are functionally equivalent here. However, the project is in TypeScript strict mode and uses `===`/`!==` uniformly; `!=` is a style inconsistency that reviewers and linters flag as unexpected in a strict-mode codebase.

**Fix:**
```tsx
pending={state.pending || state.dupeContext !== null}
```

## Info

### IN-01: `no-verdict-step.test.ts` reads the source file three times instead of once

**File:** `tests/static/AddWatchFlow.no-verdict-step.test.ts:22–37`
**Issue:** Each of the three `it` blocks calls `readFileSync(flowPath, 'utf8')` independently. The file is read from disk on every test case. A shared read at `describe` scope (or in a `beforeAll`) would be both clearer and marginally faster. This is a quality nit, not a correctness issue, but the adjacent `no-collection-fit-card.test.ts` (CLNP-03) demonstrates the preferred pattern: the file list is hoisted and each `it` reads only the file it needs.

**Fix:**
```typescript
describe('Phase 71 CLNP-02 — AddWatchFlow no-verdict-step invariant', () => {
  const flowPath = 'src/components/watch/AddWatchFlow.tsx'
  // Read once; skip all assertions if file absent.
  const src = existsSync(flowPath) ? readFileSync(flowPath, 'utf8') : null

  it('does not import VerdictStep', () => {
    if (!src) return
    expect(src).not.toMatch(/from ['"](?:.*\/)?VerdictStep['"]/)
  })
  // ... other it blocks use `src`
})
```

### IN-02: AddWatchFlow JSDoc mentions only one of the two new static guards

**File:** `src/components/watch/AddWatchFlow.tsx:36`
**Issue:** The top JSDoc cites `tests/static/AddWatchFlow.no-verdict-step.test.ts` as the guard that prevents reintroduction of deleted components. The new CLNP-03 guard (`AddWatchFlow.no-collection-fit-card.test.ts`) is not mentioned. Developers reading the file header won't know about the second guard and may not realise CollectionFitCard imports are also statically blocked.

**Fix:** Extend line 36 (or add an adjacent line):
```typescript
 * The legacy verdict-flow surface is deleted;
 * tests/static/AddWatchFlow.no-verdict-step.test.ts prevents reintroduction.
 * tests/static/AddWatchFlow.no-collection-fit-card.test.ts prevents CollectionFitCard imports.
```

---

_Reviewed: 2026-05-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
