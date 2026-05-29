# Phase 71: Dead Code Cleanup + Static Guards - Research

**Researched:** 2026-05-29
**Domain:** In-repo dead code subtraction + static CI guard authoring
**Confidence:** HIGH

## Summary

Phase 71 is a pure subtraction phase with zero net behavior change. It deletes 8 files (~926 LOC), prunes two exports from `flowTypes.ts`, removes a `useState` declaration and associated refs from `AddWatchFlow.tsx`, and writes two new `@vitest-environment node` static guards that will block reintroduction of the deleted components.

All factual claims below are `[VERIFIED: codebase grep]` unless tagged otherwise.

**Primary recommendation:** Execute exactly as CONTEXT.md D-01 through D-05 specify. No design decisions remain open. The only planner-facing discovery beyond CONTEXT claims is that `rail`/`setRail`/`railRef` references are more numerous than CONTEXT.md's summary suggested — 10 call sites across AddWatchFlow.tsx must all be swept in Plan 71-02, not just line 104.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: Delete `RecentlyEvaluatedRail.tsx` + `.test.tsx` outright. Remove `RailEntry` interface, `PendingTarget` type alias, and `verdict: unknown | null` field on RailEntry from `flowTypes.ts`. Remove `RailEntry` type import and `const [rail, setRail] = useState<RailEntry[]>([])` + all `rail`/`setRail`/`railRef` references from `AddWatchFlow.tsx`. Rationale: unrendered as of Phase 70; future recents rail (v8.x+) is a fresh design problem.

- **D-02**: Both static guards use imports-only regex `expect(src).not.toMatch(/from ['"](?:.*\/)?ComponentName['"]/)` with `existsSync` vacuous-pass, mirroring `tests/static/CollectionFitCard.no-engine.test.ts`. Both require `// @vitest-environment node` at file head (Memory: `project_vitest_static_node_env.md`).

- **D-03**: Reword `AddWatchFlow.tsx` top JSDoc (lines 35-36, 52) — replace dead-component name list with forward-looking statement that names the static guard file. Exact prose is implementer's discretion (D-Discretion).

- **D-04**: CLNP-03 guard checks a hardcoded 8-file array for `CollectionFitCard` imports:
  ```
  AddWatchFlow.tsx, SearchEntry.tsx, StructuredEntryPanel.tsx, ConfirmStep.tsx,
  DupeBanner.tsx, WatchForm.tsx, WatchPhotoStep.tsx, ExtractErrorCard.tsx
  ```

- **D-05**: Two-plan split. Plan 71-01 writes both guards (vacuous-pass today). Plan 71-02 deletes files + prunes source + verifies build.

### Claude's Discretion

- JSDoc reword exact wording (D-03 specifies structure, not prose)
- Whether to add a trailing comment to `flowTypes.ts` after cleanup marking it as "only DupeContext + FlowState live here"
- Whether to delete `.tsx` + `.test.tsx` pairs in same commit or separate commits within Plan 02
- `flowTypes.ts` JSDoc trailer after deleting the Phase 71 forward-coordination block

### Deferred Ideas (OUT OF SCOPE)

- Add-flow tree growth strategy (transitive walk vs. manual list update)
- Rdio-style recents rail (future v8.x+, fresh design)
- Other v8.0 dead code not covered by CLNP-01..04
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLNP-01 | `VerdictStep.tsx`, `WishlistRationalePanel.tsx`, and `PasteSection.tsx` deleted along with their test files; no callers remain | All 6 files verified to exist; zero non-test callers verified by grep |
| CLNP-02 | Static guard `tests/static/AddWatchFlow.no-verdict-step.test.ts` with `// @vitest-environment node` fails CI if any of the three deleted components reappear as imports in `AddWatchFlow.tsx` | Exact regex pattern extracted from CollectionFitCard.no-engine.test.ts precedent |
| CLNP-03 | Static guard `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` with `// @vitest-environment node` fails CI if `CollectionFitCard` is imported by any file in the add-flow tree | All 8 files confirmed to exist and currently clean (no CollectionFitCard imports) |
| CLNP-04 | `RecentlyEvaluatedRail` removed from `AddWatchFlow`; component file disposition resolved | D-01 locks delete; 2 files verified to exist; RailEntry/PendingTarget consumers identified |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static CI guard authoring | Test infrastructure | — | Pure test-file addition; no app tier involvement |
| Dead component deletion | Client — watch feature | — | Component files in `src/components/watch/`; no server-side impact |
| flowTypes.ts prune | Client — watch feature | — | Type-only exports; deleted alongside the sole consumer (RecentlyEvaluatedRail) |
| AddWatchFlow.tsx residue prune | Client — watch feature | — | Removes unused state that was never rendered post-Phase-70 |

---

## Standard Stack

No new libraries. Phase 71 uses only what is already installed.

| Tool | Purpose | Notes |
|------|---------|-------|
| `vitest` ^2.1.9 | Test runner for static guards | Already installed; `@vitest-environment node` directive is standard |
| `node:fs` | File reading in guards | Built-in; requires `// @vitest-environment node` to avoid Vercel prebuild failure |

---

## Architecture Patterns

### Static Guard Pattern (BINDING PRECEDENT)

Source: `tests/static/CollectionFitCard.no-engine.test.ts` [VERIFIED: codebase read]

```typescript
// @vitest-environment node
//
// This guard walks the filesystem ... MUST run in the node environment ...
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Phase 20 D-04 + Pitfall 1: <CollectionFitCard> is a pure renderer. It MUST NOT
 * import the similarity engine ...
 *
 * Plan 03 creates the file; this guard runs at all times. While the file does
 * not yet exist, the test passes vacuously (skip via existsSync).
 */
describe('Phase 20 D-04 — <CollectionFitCard> pure-renderer invariant', () => {
  const cardPath = 'src/components/insights/CollectionFitCard.tsx'

  it('does not import @/lib/similarity', () => {
    if (!existsSync(cardPath)) {
      // Vacuous pass until Plan 03 creates the file.
      return
    }
    const src = readFileSync(cardPath, 'utf8')
    expect(src).not.toMatch(/from ['"]@\/lib\/similarity['"]/)
    expect(src).not.toMatch(/analyzeSimilarity\s*\(/)
  })
  // ...
})
```

**Key structural elements the planner MUST copy:**
1. `// @vitest-environment node` on line 1 (mandatory — no blank line before it)
2. Multi-line comment block explaining WHY the node environment is needed (optional but matches precedent style)
3. `import { existsSync, readFileSync } from 'node:fs'` (use `node:` prefix)
4. `existsSync` vacuous-pass inside each `it()` block — not as a `describe`-level skip
5. Imports-only regex shape: `/from ['"](?:.*\/)?ComponentName['"]/`
6. Docstring header format: `"Phase NN D-NN + Pitfall N: <ComponentName> MUST NOT ..."`

### CLNP-02 Guard Shape

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Phase 71 CLNP-02 + Pitfall 1: AddWatchFlow.tsx MUST NOT import the deleted
 * verdict-flow components (VerdictStep, WishlistRationalePanel, PasteSection).
 * These files are deleted in Plan 71-02. This guard prevents reintroduction.
 *
 * While AddWatchFlow.tsx does not exist, the test passes vacuously.
 */
describe('Phase 71 CLNP-02 — AddWatchFlow no-verdict-step invariant', () => {
  const flowPath = 'src/components/watch/AddWatchFlow.tsx'

  it('does not import VerdictStep', () => {
    if (!existsSync(flowPath)) return
    const src = readFileSync(flowPath, 'utf8')
    expect(src).not.toMatch(/from ['"](?:.*\/)?VerdictStep['"]/)
  })

  it('does not import WishlistRationalePanel', () => {
    if (!existsSync(flowPath)) return
    const src = readFileSync(flowPath, 'utf8')
    expect(src).not.toMatch(/from ['"](?:.*\/)?WishlistRationalePanel['"]/)
  })

  it('does not import PasteSection', () => {
    if (!existsSync(flowPath)) return
    const src = readFileSync(flowPath, 'utf8')
    expect(src).not.toMatch(/from ['"](?:.*\/)?PasteSection['"]/)
  })
})
```

### CLNP-03 Guard Shape (per-file loop over 8-file list)

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Phase 71 CLNP-03 + Pitfall 1: No file in the add-flow component tree MUST
 * import CollectionFitCard. The add-flow is a data-entry surface; fit analysis
 * belongs on the watch-detail / insights surfaces only.
 *
 * Mirrors Phase 20 D-04 (CollectionFitCard.no-engine.test.ts) for the add-flow tree.
 * While a listed file does not exist, its check passes vacuously.
 */
const ADD_FLOW_FILES = [
  'src/components/watch/AddWatchFlow.tsx',
  'src/components/watch/SearchEntry.tsx',
  'src/components/watch/StructuredEntryPanel.tsx',
  'src/components/watch/ConfirmStep.tsx',
  'src/components/watch/DupeBanner.tsx',
  'src/components/watch/WatchForm.tsx',
  'src/components/watch/WatchPhotoStep.tsx',
  'src/components/watch/ExtractErrorCard.tsx',
]

describe('Phase 71 CLNP-03 — add-flow no-CollectionFitCard invariant', () => {
  for (const filePath of ADD_FLOW_FILES) {
    it(`${filePath} does not import CollectionFitCard`, () => {
      if (!existsSync(filePath)) return
      const src = readFileSync(filePath, 'utf8')
      expect(src).not.toMatch(/from ['"].*CollectionFitCard['"]/)
    })
  }
})
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Import-presence CI enforcement | Custom lint rule or AST walk | `readFileSync` + `expect().not.toMatch(regex)` — matches in-repo precedent |
| Transitive import walk for CLNP-03 | Recursive resolver | Hardcoded 8-file list (D-04) — stable post-Phase-70 |

---

## Verified Artifact Inventory

### 1. flowTypes.ts — Exact Lines to Delete

[VERIFIED: codebase read of `src/components/watch/flowTypes.ts`]

| Lines | Content | Action |
|-------|---------|--------|
| 66 | blank line before JSDoc | Delete |
| 67-78 | `/** Phase 71 forward-coordination ... */` JSDoc block | Delete |
| 79-86 | `export interface RailEntry { ... }` (7 lines incl. closing brace) | Delete |
| 87 | blank line between RailEntry and PendingTarget JSDoc | Delete |
| 88-92 | `/** Pending state target for the legacy VerdictStep ... */` JSDoc | Delete |
| 93 | `export type PendingTarget = 'wishlist' \| 'collection' \| 'skip' \| null` | Delete |

The file is 93 lines total. Lines 1-65 (`FlowState` union + `DupeContext` interface + their JSDoc) survive untouched. After deletion the file shrinks to approximately 65 lines.

**The "Phase 71 forward-coordination" JSDoc block spans lines 67-78** (not 67-94 as CONTEXT.md approximated — lines 79-93 are the actual `RailEntry` interface and `PendingTarget` alias). Delete lines 66-93 in full (from the blank line before the JSDoc through the last line of the file).

### 2. AddWatchFlow.tsx — All Residue Locations

[VERIFIED: grep of `src/components/watch/AddWatchFlow.tsx`, 885 lines total]

| Line | Content | Plan 71-02 Action |
|------|---------|-------------------|
| 24 | `import type { FlowState, RailEntry, DupeContext } from './flowTypes'` | Remove `RailEntry,` from the import list |
| 35-36 | JSDoc prose naming dead components | Reword per D-03 |
| 52 | `D-14 extracting-url is INLINE (no PasteSection)` in JSDoc | Reword per D-03 |
| 103 | Comment: `` // `rail` is preserved for Activity-hide cleanup safety; CLNP-04 deferred to Phase 71. `` | Delete |
| 104 | `const [rail, setRail] = useState<RailEntry[]>([])` | Delete |
| 130 | `const railRef = useRef(rail)` | Delete |
| 133 | `railRef.current = rail` | Delete |
| 141 | Comment referencing `railRef.current.length === 0` in skip-case-1 condition | Rewrite skip-case-1 condition |
| 142 | `if (s.kind === 'search-idle' && urlRef.current === '' && railRef.current.length === 0) return` | Remove `&& railRef.current.length === 0` (or delete the entire skip-case-1 if url==='' alone is sufficient) |
| 146 | `setRail([])` — in useLayoutEffect cleanup branch | Delete |
| 520 | `setRail([])` — in handleConfirmPrimary (wishlist/grail branch) | Delete |
| 579 | `setRail([])` — in handleMoveToCollection | Delete |
| 601 | `setRail([])` — in handleWatchCreated (non-owned branch) | Delete |
| 786 | `setRail([])` — in WatchPhotoStep onDone | Delete |
| 792 | `setRail([])` — in WatchPhotoStep onSkip | Delete |

**CONTEXT.md underspecified the scope**: it cited only line 104. The `rail` state has 10 call sites. Plan 71-02 must sweep all of them. This is the most important planner-facing discovery from research.

**Skip-case-1 note (line 142):** After removing `railRef.current.length === 0`, the condition becomes `if (s.kind === 'search-idle' && urlRef.current === '') return`. This remains semantically correct — "nothing user-accumulated to reset" reduces to "search-idle with no URL input." The `railRef` and `rail` variable disappear; `stateRef` and `urlRef` survive because `url` state is still used by the extracting-url inline form.

### 3. flowTypes.test.ts — No RailEntry/PendingTarget Assertions

[VERIFIED: codebase read of `src/components/watch/flowTypes.test.ts`]

`flowTypes.test.ts` imports only `FlowState` and `DupeContext` from `flowTypes`. It does NOT reference `RailEntry` or `PendingTarget` at any line. The file's 4 tests assert on: `FlowState['kind']` exhaustive union (7 kinds), `REMOVED_KINDS` non-overlap, `DupeContext` literal type-check, and `extraction-failed.mode`. All 4 tests survive Plan 71-02 without modification.

**No test deletions needed in `flowTypes.test.ts`.**

### 4. Dead Component Files — All 8 Exist

[VERIFIED: `ls` against each path]

| File | Exists | Lines |
|------|--------|-------|
| `src/components/watch/VerdictStep.tsx` | YES | 159 |
| `src/components/watch/VerdictStep.test.tsx` | YES | 196 |
| `src/components/watch/WishlistRationalePanel.tsx` | YES | 110 |
| `src/components/watch/WishlistRationalePanel.test.tsx` | YES | 129 |
| `src/components/watch/PasteSection.tsx` | YES | 83 |
| `src/components/watch/PasteSection.test.tsx` | YES | 92 |
| `src/components/watch/RecentlyEvaluatedRail.tsx` | YES | 64 |
| `src/components/watch/RecentlyEvaluatedRail.test.tsx` | YES | 93 |

Total deletion: **926 lines** across 8 files.

### 5. Non-Test Consumer Audit — Zero Live Consumers

[VERIFIED: grep across `src/` and `tests/` excluding `.test.` files]

```
grep -rn "from .*VerdictStep|WishlistRationalePanel|PasteSection|RecentlyEvaluatedRail" src/ tests/ | grep -v ".test."
```

Result: **no output**. Zero non-test consumers of any of the four dead components. Deletes are safe; no hidden callers require cleanup before or alongside Plan 71-02.

The only references to dead-component names in `AddWatchFlow.tsx` are in JSDoc prose (lines 35-36, 52) — not as import statements. The CLNP-02 guard's imports-only regex will not flag these prose references, so Plan 71-01's guards genuinely pass vacuously today.

### 6. CLNP-03 8-File Check — All Files Exist, All Currently Clean

[VERIFIED: existence check + CollectionFitCard grep across all 8 files]

All 8 files in D-04's `ADD_FLOW_FILES` array exist today. Zero CollectionFitCard imports found in any of the 8 files. Plan 71-01's CLNP-03 guard will pass vacuously on day one (as CONTEXT.md states).

### 7. RecentlyEvaluatedRail.test.tsx — Defines Its Own Local `RailEntry`

[VERIFIED: codebase read of `src/components/watch/RecentlyEvaluatedRail.test.tsx`]

The test file defines a local `interface RailEntry` (lines 20-26) that does NOT import from `flowTypes.ts`. It imports only `RecentlyEvaluatedRail` component and `ExtractedWatchData`. This means:

- Deleting `RecentlyEvaluatedRail.tsx` + `.test.tsx` fully eliminates all `RailEntry` consumers
- The `flowTypes.ts` `RailEntry` export's only live consumer is `src/components/watch/RecentlyEvaluatedRail.tsx` (line 5: `import type { RailEntry } from './flowTypes'`)
- After both files are deleted in Plan 71-02, no import of `RailEntry` from `flowTypes` remains anywhere

---

## Static Guard — Prebuild Wiring

[VERIFIED: `package.json` `scripts.prebuild`]

The current `prebuild` script runs only `legacy-watch-routes.test.ts`:

```json
"prebuild": "vitest run tests/static/legacy-watch-routes.test.ts"
```

The other existing static guards (`CollectionFitCard.no-engine.test.ts`, etc.) run only via `npm test` (which runs `vitest run` — the full suite). They are NOT individually wired into `prebuild`.

**Implication for Plan 71-01:** The new guards will run via `npm test` (full vitest suite) but will NOT automatically be added to `prebuild`. The planner must decide whether to extend `prebuild` to include the new guards or leave them as `npm test`-only. The CONTEXT.md does not specify this — it is Claude's Discretion territory.

**Recommendation:** Extend `prebuild` to run all `tests/static/` files together:
```json
"prebuild": "vitest run tests/static/"
```
This is simpler than maintaining an enumerated list and ensures every static guard blocks the Vercel build. The current single-file `prebuild` was presumably from Phase 59's initial guard; consolidating to the directory is a natural evolution. This change belongs in Plan 71-01 alongside writing the guards.

---

## Common Pitfalls

### Pitfall 1: Missing `// @vitest-environment node`

**What goes wrong:** Guard file reads without the directive — vitest runs under `jsdom` default (per `vitest.config.ts` line `environment: 'jsdom'`). Vite externalizes `node:fs` for browser compatibility → `readdirSync`/`readFileSync` become undefined → test passes locally but fails Vercel prebuild.

**Why it happens:** `// @vitest-environment node` is not standard vitest boilerplate; developers writing guards without consulting the precedent file miss it.

**How to avoid:** `// @vitest-environment node` MUST be the first line of the file. The precedent file `legacy-watch-routes.test.ts` has a multi-line comment explaining exactly why immediately after the directive — copy that comment block verbatim.

**Warning signs:** Guard passes locally but fails on Vercel deploy with `readdirSync is not a function` or similar.

### Pitfall 2: Incomplete `rail`/`setRail` Sweep

**What goes wrong:** Plan 71-02 removes only the `useState` declaration at line 104 but leaves one of the 8 `setRail([])` call sites, or leaves `railRef` declarations. TypeScript compile error on `setRail` / `railRef` undefined prevents `npm run build` from passing.

**Why it happens:** CONTEXT.md cited only line 104. The full sweep is 10+ call sites.

**How to avoid:** Use the verified line list in this document (lines 103-104, 130, 133, 141-142, 146, 520, 579, 601, 786, 792). Remove all of them. Run `npm run build` to confirm.

**Warning signs:** `npm run build` TypeScript error: `Cannot find name 'rail'` or `Cannot find name 'setRail'` or `Cannot find name 'railRef'`.

### Pitfall 3: Leaving `RailEntry` in the `import type` Line

**What goes wrong:** `flowTypes.ts` no longer exports `RailEntry` after Plan 71-02 prunes it. If line 24 of `AddWatchFlow.tsx` still reads `import type { FlowState, RailEntry, DupeContext }`, the build fails with a TypeScript error about missing export.

**How to avoid:** Edit line 24 to read `import type { FlowState, DupeContext } from './flowTypes'`.

### Pitfall 4: `prebuild` Script Not Updated

**What goes wrong:** New guards in `tests/static/` run via `npm test` but not `npm run build`. The enforcement mechanism works locally/in CI runs of `npm test` but not in Vercel's prebuild hook that triggers on `next build`.

**How to avoid:** Update `prebuild` to run `vitest run tests/static/` (the full static directory) in Plan 71-01.

---

## Validation Architecture

`workflow.nyquist_validation: true` in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.9 |
| Config file | `vitest.config.ts` (default env: jsdom) |
| Quick static run | `npx vitest run tests/static/` |
| Add-flow suite | `npx vitest run src/components/watch/AddWatchFlow.test.tsx src/components/watch/SearchEntry.test.tsx src/components/watch/StructuredEntryPanel.test.tsx src/components/watch/ConfirmStep.test.tsx src/components/watch/DupeBanner.test.tsx src/components/watch/flowTypes.test.ts` |
| Build gate | `npm run build` (exit 0) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLNP-01 | Dead component files absent + build passes | build-gate | `npm run build` | N/A (build gate) |
| CLNP-02 | no-verdict-step guard fails if import reintroduced | static guard | `npx vitest run tests/static/AddWatchFlow.no-verdict-step.test.ts` | No — Wave 0 (Plan 71-01) |
| CLNP-03 | no-CollectionFitCard guard fails if import added | static guard | `npx vitest run tests/static/AddWatchFlow.no-collection-fit-card.test.ts` | No — Wave 0 (Plan 71-01) |
| CLNP-04 | RecentlyEvaluatedRail absent + RailEntry/PendingTarget removed | build-gate + static | `npm run build` + `npx vitest run tests/static/` | N/A (build gate) |

### Sampling Rate

- **Per Plan 71-01 commit:** `npx vitest run tests/static/` (verifies new guards pass vacuously)
- **Per Plan 71-02 commit:** `npm run build` + `npx vitest run tests/static/` + add-flow suite
- **Phase gate:** Build green + static suite green before pushing to prod

### Wave 0 Gaps

- [ ] `tests/static/AddWatchFlow.no-verdict-step.test.ts` — CLNP-02; created in Plan 71-01
- [ ] `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` — CLNP-03; created in Plan 71-01

No framework config gaps — vitest and `@vitest-environment node` precedent are established.

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. Phase 71 touches only local source files, test files, and `package.json` scripts. No databases, services, or CLI tools beyond npm/vitest required.

---

## Assumptions Log

All claims in this research were verified by direct file read or grep. No assumed claims.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims verified — no user confirmation needed.**

---

## Open Questions

1. **`prebuild` scope extension**
   - What we know: `prebuild` currently runs only `legacy-watch-routes.test.ts`; new guards will run via `npm test` but not `npm run build` unless `prebuild` is extended
   - What's unclear: Whether the project owner wants `prebuild` extended to `tests/static/` or prefers per-guard enumeration
   - Recommendation: Extend to `vitest run tests/static/` in Plan 71-01 (simplest maintenance path). If the owner wants enumeration, the planner should enumerate all current static tests explicitly.

---

## Sources

### Primary (HIGH confidence)
- `src/components/watch/flowTypes.ts` — direct read; all line numbers verified
- `src/components/watch/AddWatchFlow.tsx` — direct read; all rail/setRail line numbers verified
- `src/components/watch/flowTypes.test.ts` — direct read; confirmed no RailEntry/PendingTarget assertions
- `src/components/watch/RecentlyEvaluatedRail.test.tsx` — direct read; confirmed local RailEntry definition
- `tests/static/CollectionFitCard.no-engine.test.ts` — direct read; regex pattern and guard structure extracted
- `tests/static/legacy-watch-routes.test.ts` — direct read; `// @vitest-environment node` directive precedent confirmed
- `package.json` scripts — direct read; prebuild and test commands confirmed
- `vitest.config.ts` — direct read; default jsdom environment confirmed
- Dead component existence + line counts — `ls` + `wc -l` for all 8 files
- Non-test consumer grep — confirmed zero live consumers

---

## Metadata

**Confidence breakdown:**
- Artifact line numbers: HIGH — verified by direct file read and grep
- Static guard pattern: HIGH — extracted verbatim from precedent file
- rail/setRail scope: HIGH — grep of AddWatchFlow.tsx, all 10 call sites listed
- flowTypes.test.ts scope: HIGH — direct read, no RailEntry/PendingTarget imports confirmed
- Prebuild wiring gap: HIGH — package.json scripts read directly

**Research date:** 2026-05-29
**Valid until:** Indefinite (no external dependencies; all facts are in-repo)

---

## RESEARCH COMPLETE
