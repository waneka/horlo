# Phase 71: Dead Code Cleanup + Static Guards - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 6 (2 created, 2 modified, 8 deleted)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/static/AddWatchFlow.no-verdict-step.test.ts` | static guard (test) | file-I/O | `tests/static/CollectionFitCard.no-engine.test.ts` | exact |
| `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` | static guard (test, per-file loop) | file-I/O | `tests/static/legacy-watch-routes.test.ts` (loop shape) + `tests/static/CollectionFitCard.no-engine.test.ts` (regex + vacuous-pass) | exact |
| `package.json` `scripts.prebuild` | config | — | `package.json` line 7 (current single-file prebuild) | exact |
| `src/components/watch/flowTypes.ts` | type module | — | itself (lines 66-93 deleted) | exact |
| `src/components/watch/AddWatchFlow.tsx` | component / orchestrator | — | itself (10 rail/setRail/railRef call sites removed) | exact |

**Deleted files (no pattern needed — straight deletion):**

| File | Lines |
|---|---|
| `src/components/watch/VerdictStep.tsx` | 159 |
| `src/components/watch/VerdictStep.test.tsx` | 196 |
| `src/components/watch/WishlistRationalePanel.tsx` | 110 |
| `src/components/watch/WishlistRationalePanel.test.tsx` | 129 |
| `src/components/watch/PasteSection.tsx` | 83 |
| `src/components/watch/PasteSection.test.tsx` | 92 |
| `src/components/watch/RecentlyEvaluatedRail.tsx` | 64 |
| `src/components/watch/RecentlyEvaluatedRail.test.tsx` | 93 |

Total deletion: 926 lines. No callers remain outside own test files (verified by grep).

---

## Pattern Assignments

### `tests/static/AddWatchFlow.no-verdict-step.test.ts` (CLNP-02)

**Analog:** `tests/static/CollectionFitCard.no-engine.test.ts`

**Critical observation:** `CollectionFitCard.no-engine.test.ts` does NOT have `// @vitest-environment node` at its top — it predates Phase 59's forced requirement. The authoritative directive placement comes from `tests/static/legacy-watch-routes.test.ts` (line 1). Phase 71's new guards MUST include it; the CollectionFitCard file is the structural analog for regex + vacuous-pass, not for the directive.

**`// @vitest-environment node` directive placement** — from `tests/static/legacy-watch-routes.test.ts` lines 1-7:
```typescript
// @vitest-environment node
//
// This guard walks the filesystem (readdirSync/statSync) and reads source files.
// It MUST run in the node environment — under the config default (jsdom), vite
// externalizes node:fs "for browser compatibility" and readdirSync becomes
// undefined. That difference is environment-dependent: it passed locally but
// failed Vercel's build (prebuild hook) with "readdirSync is not a function".
```

Rule: `// @vitest-environment node` is line 1 with NO blank line before it. The explanatory comment block immediately follows (lines 2-7). Then the JSDoc block. Then imports.

**Imports pattern** — from `tests/static/CollectionFitCard.no-engine.test.ts` lines 1-2:
```typescript
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
```

Use `node:` prefix on the fs import. No other imports needed for CLNP-02.

**Docstring header style** — from `tests/static/CollectionFitCard.no-engine.test.ts` lines 4-11:
```typescript
/**
 * Phase 20 D-04 + Pitfall 1: <CollectionFitCard> is a pure renderer. It MUST NOT
 * import the similarity engine or the verdict composer (both pull non-trivial
 * code into client bundles when transitively reached from a 'use client' file).
 *
 * Plan 03 creates the file; this guard runs at all times. While the file does
 * not yet exist, the test passes vacuously (skip via existsSync).
 */
```

Pattern: `Phase NN CLNP-NN + Pitfall N: <Subject> MUST NOT ...` followed by a blank comment line + vacuous-pass note. CLNP-02 adaptation:
```typescript
/**
 * Phase 71 CLNP-02 + Pitfall 1: AddWatchFlow.tsx MUST NOT import the deleted
 * verdict-flow components (VerdictStep, WishlistRationalePanel, PasteSection).
 * These files are deleted in Plan 71-02. This guard prevents reintroduction.
 *
 * While AddWatchFlow.tsx does not exist, the test passes vacuously.
 */
```

**`existsSync` vacuous-pass guard** — from `tests/static/CollectionFitCard.no-engine.test.ts` lines 16-24:
```typescript
it('does not import @/lib/similarity', () => {
  if (!existsSync(cardPath)) {
    // Vacuous pass until Plan 03 creates the file.
    return
  }
  const src = readFileSync(cardPath, 'utf8')
  expect(src).not.toMatch(/from ['"]@\/lib\/similarity['"]/)
  expect(src).not.toMatch(/analyzeSimilarity\s*\(/)
})
```

Rule: vacuous-pass is INSIDE each `it()` block, not as a `describe`-level skip. Shorter form `if (!existsSync(path)) return` (no comment) is also used in lines 28, 36 of the same file and is acceptable.

**Imports-only regex shape** — from `tests/static/CollectionFitCard.no-engine.test.ts` lines 22, 29-30, 38-39:
```
/from ['"]@\/lib\/similarity['"]/
/from ['"]@\/lib\/verdict\/composer['"]/
/from ['"]server-only['"]/
```

For component names without path anchors the shape is `/from ['"](?:.*\/)?ComponentName['"]/` — the `(?:.*\/)?` allows any leading path segment so `'./VerdictStep'`, `'../watch/VerdictStep'`, etc. all match.

**Complete CLNP-02 structure** (from RESEARCH §Architecture Patterns):
```typescript
// @vitest-environment node
// [multi-line comment block explaining node env requirement — copy from legacy-watch-routes.test.ts lines 2-7]
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

---

### `tests/static/AddWatchFlow.no-collection-fit-card.test.ts` (CLNP-03)

**Analogs:**
- `tests/static/CollectionFitCard.no-engine.test.ts` — regex + vacuous-pass shape
- `tests/static/legacy-watch-routes.test.ts` lines 136-153 — per-file loop over a collected array (structural analog for the `for (const file of ADD_FLOW_FILES)` loop)

**Per-file loop pattern** — from `tests/static/legacy-watch-routes.test.ts` lines 136-153:
```typescript
for (const file of srcFiles) {
  it(`${file} has no legacy watch-detail links`, () => {
    const lines = readFileSync(file, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (ALLOWLIST.some((al) => al.test(line))) continue
      for (const { pattern, label } of FORBIDDEN) {
        expect(
          pattern.test(line),
          `${file}:${i + 1} — ${label}: ${line.trim()}`,
        ).toBe(false)
      }
    }
  })
}
```

CLNP-03 simplifies this: no ALLOWLIST, no line-by-line split — just `readFileSync` + single regex match + `existsSync` vacuous-pass per file.

**Hardcoded 8-file `ADD_FLOW_FILES` array shape** — from CONTEXT.md D-04 (binding decision):
```typescript
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
```

This array is module-level (before the `describe` block), same as `legacy-watch-routes.test.ts`'s module-level `const srcFiles = collectSourceFiles('src')`.

**Regex for CollectionFitCard** — from RESEARCH §Architecture Patterns CLNP-03 shape:
```
/from ['"].*CollectionFitCard['"]/
```

Note: no `(?:.*\/)?` prefix needed here; `.*` before `CollectionFitCard` already captures any path prefix.

**Complete CLNP-03 structure** (from RESEARCH §Architecture Patterns):
```typescript
// @vitest-environment node
// [multi-line comment block — copy from legacy-watch-routes.test.ts lines 2-7]
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

### `package.json` `scripts.prebuild` (config change)

**Analog:** `package.json` line 7 (current value)

**Exact line being changed** — from `package.json` line 7:
```json
"prebuild": "vitest run tests/static/legacy-watch-routes.test.ts",
```

**Target value:**
```json
"prebuild": "vitest run tests/static/",
```

Replacing the single-file enumeration with the full directory. This is a Claude's Discretion call per RESEARCH §Static Guard Prebuild Wiring: simpler maintenance path, ensures all guards in `tests/static/` block the Vercel build. No other script lines change.

---

### `src/components/watch/flowTypes.ts` (prune lines 66-93)

**Analog:** itself — verified line-by-line by RESEARCH §1

**Lines to delete** — from `src/components/watch/flowTypes.ts` lines 66-93 (the entire tail of the file after `DupeContext`):

```typescript
// Line 66: blank line — DELETE

/**
 * Phase 71 forward-coordination — `RailEntry` + `PendingTarget` exports     // line 67
 * STAY in Phase 70. Phase 71 deletes them alongside the `RecentlyEvaluatedRail`
 * disposition per CLNP-04. Shape preserved verbatim from the pre-Phase-70
 * `flowTypes.ts` so existing consumers (RecentlyEvaluatedRail + its test)
 * continue to compile through this milestone.
 *
 * Note: the legacy verdict bundle field is intentionally typed as `unknown | null`
 * here to avoid a stale legacy verdict-types import (verdict is out of scope for v8.0).
 * Phase 71 deletes both fields + their consumer in a single sweep — no consumer
 * outside `RecentlyEvaluatedRail` reads `.verdict`, and the RecentlyEvaluatedRail
 * component is unrendered as of Phase 70 (CLNP-04 deferral).
 */                                                                            // line 78
export interface RailEntry {                                                   // line 79
  catalogId: string
  brand: string
  model: string
  imageUrl: string | null
  extracted: ExtractedWatchData
  verdict: unknown | null
}                                                                              // line 86

                                                                               // line 87: blank — DELETE
/**                                                                            // line 88
 * Pending state target for the legacy VerdictStep / WishlistRationalePanel
 * pending-CTA disambiguation. STAYS in Phase 70 per CLNP-04 deferral; Phase 71
 * removes alongside the rail.
 */                                                                            // line 92
export type PendingTarget = 'wishlist' | 'collection' | 'skip' | null        // line 93
```

After deletion the file is ~65 lines ending at the `DupeContext` interface closing brace (line 64) + its trailing blank line (line 65). The surviving content (lines 1-65) is untouched.

---

### `src/components/watch/AddWatchFlow.tsx` (10-site prune + JSDoc reword)

**Analog:** itself — all line numbers verified by RESEARCH §2

**Site 1 — Line 24 (import type):**
```typescript
// Current:
import type { FlowState, RailEntry, DupeContext } from './flowTypes'
// Target:
import type { FlowState, DupeContext } from './flowTypes'
```

**Sites 2-3 — Lines 35-36 and 52 (JSDoc reword, D-03):**
```typescript
// Current lines 35-36 (inside the opening JSDoc of AddWatchFlow):
 * Hard-cutover: no PasteSection /
 * VerdictStep / WishlistRationalePanel / RecentlyEvaluatedRail /
// Current line 52:
 *   D-14 extracting-url is INLINE (no PasteSection); {mode:'url',url} body
```

Per D-03 the dead-component names are replaced with a forward-looking reference to the static guard. The exact prose is implementer's discretion; target is 2-4 lines, names `tests/static/AddWatchFlow.no-verdict-step.test.ts`.

**Sites 4-5 — Lines 103-104 (useState declaration):**
```typescript
// Current:
  // `rail` is preserved for Activity-hide cleanup safety; CLNP-04 deferred to Phase 71.
  const [rail, setRail] = useState<RailEntry[]>([])
// Target: delete both lines
```

**Sites 6-8 — Lines 130, 133 (railRef declarations and assignment):**
```typescript
// Current line 130:
  const railRef = useRef(rail)
// Current line 133:
  railRef.current = rail
// Target: delete both lines
```

**Site 9 — Line 142 (skip-case-1 condition):**
```typescript
// Current:
      if (s.kind === 'search-idle' && urlRef.current === '' && railRef.current.length === 0) return
// Target (remove railRef.current.length === 0 predicate):
      if (s.kind === 'search-idle' && urlRef.current === '') return
```

Line 141 (the comment referencing `railRef.current.length === 0`) is also deleted.

**Site 10 — Line 146 (useLayoutEffect cleanup branch):**
```typescript
// Current:
      setRail([])
// Target: delete this line
```

**Sites 11-15 — Lines 520, 579, 601, 786, 792 (scattered `setRail([])` calls):**
Each is a standalone `setRail([])` statement; delete each line entirely. No surrounding logic changes — these were side-effect-free no-ops post-Phase-70.

**Warning (RESEARCH Pitfall 2):** CONTEXT.md cited only line 104. There are 10 call sites total. Missing any one causes `npm run build` TypeScript errors (`Cannot find name 'rail'` / `'setRail'` / `'railRef'`). The verified site list: lines 103, 104, 130, 133, 141, 142, 146, 520, 579, 601, 786, 792.

---

## Shared Patterns

### `// @vitest-environment node` Directive
**Source:** `tests/static/legacy-watch-routes.test.ts` lines 1-7
**Apply to:** Both new static guard files (`AddWatchFlow.no-verdict-step.test.ts`, `AddWatchFlow.no-collection-fit-card.test.ts`)

```typescript
// @vitest-environment node
//
// This guard walks the filesystem (readdirSync/statSync) and reads source files.
// It MUST run in the node environment — under the config default (jsdom), vite
// externalizes node:fs "for browser compatibility" and readdirSync becomes
// undefined. That difference is environment-dependent: it passed locally but
// failed Vercel's build (prebuild hook) with "readdirSync is not a function".
```

This block must be line 1 with no preceding blank lines. Then JSDoc block. Then imports.

### `existsSync` Vacuous-Pass
**Source:** `tests/static/CollectionFitCard.no-engine.test.ts` lines 17-20
**Apply to:** Every `it()` block in both new guard files

```typescript
it('does not import VerdictStep', () => {
  if (!existsSync(filePath)) return
  const src = readFileSync(filePath, 'utf8')
  expect(src).not.toMatch(/from ['"](?:.*\/)?VerdictStep['"]/)
})
```

Guard is inside the `it()` body, not at `describe` level. Short form `if (!existsSync(path)) return` (no inline comment) is the correct style for Phase 71 guards — matches later usages in `CollectionFitCard.no-engine.test.ts` lines 28, 36.

### Imports-Only Regex Shape
**Source:** `tests/static/CollectionFitCard.no-engine.test.ts` lines 22-23, 29-32
**Apply to:** All `expect(...).not.toMatch(...)` assertions in both new guards

For relative-path component imports: `/from ['"](?:.*\/)?ComponentName['"]/`
For absolute/any-path imports: `/from ['"].*ComponentName['"]/`

The regex matches single or double quotes, any leading path, and the bare component name. It does NOT match JSDoc prose or comments mentioning the component name — this is the desired behavior per D-02.

### node:fs Import
**Source:** `tests/static/CollectionFitCard.no-engine.test.ts` line 2 / `legacy-watch-routes.test.ts` line 35
**Apply to:** Both new guard files

```typescript
import { existsSync, readFileSync } from 'node:fs'
```

Always use `node:` prefix (not bare `'fs'`).

---

## No Analog Found

None. All files have direct codebase analogs.

---

## Metadata

**Analog search scope:** `tests/static/`, `src/components/watch/`, `package.json`
**Files scanned:** 6 analog files read directly (CollectionFitCard.no-engine.test.ts, legacy-watch-routes.test.ts, ReferenceIdentityCard.no-engine.test.ts, WatchForm.accordion.guards.test.ts, flowTypes.ts, AddWatchFlow.tsx lines 1-155)
**Pattern extraction date:** 2026-05-29

---

## PATTERN MAPPING COMPLETE
