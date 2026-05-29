---
phase: 70
plan: 04
subsystem: add-watch-flow
status: complete
completed: 2026-05-29
duration_minutes: 3
tasks_completed: 1
tasks_total: 1
files_created:
  - src/components/watch/flowTypes.test.ts
files_modified:
  - src/components/watch/flowTypes.ts
commits:
  - c8f0c38c
tags:
  - addwatchflow
  - phase-70
  - flow-types
  - clnp-05
  - state-machine
  - dupe-context
requirements_completed:
  - CLNP-05
dependency_graph:
  requires:
    - 70-01 (Wave 0 compiler-gate prereqs only — no actual import dependency)
  provides:
    - FlowState discriminated union (Plan 05 orchestrator consumes)
    - DupeContext interface (Plan 02 DupeBanner + Plan 05 orchestrator consume)
    - 19-line D-02 transition-map JSDoc above FlowState declaration
  affects:
    - src/components/watch/AddWatchFlow.tsx (will fail to compile until Plan 05 rewrites it — EXPECTED)
    - src/components/watch/RecentlyEvaluatedRail.tsx (continues to compile — RailEntry retained per CLNP-04 deferral)
tech_stack:
  added: []
  patterns:
    - "Discriminated-union state machine (kind-tag)"
    - "JSDoc transition-map block above type declaration (D-02)"
    - "Co-located *.test.ts file (Claude's Discretion test layering)"
key_files:
  created:
    - src/components/watch/flowTypes.test.ts
  modified:
    - src/components/watch/flowTypes.ts
decisions:
  - "D-01 honored — final union collapses ROADMAP's four-new-states enumeration into one orchestrator-level 'search-idle' (SearchEntry owns query/results/showPanel internals)"
  - "D-02 honored — 19-line transition map shipped verbatim as JSDoc block above FlowState"
  - "CLNP-05 honored — 6 old variants removed (idle, extracting, verdict-ready, wishlist-rationale-open, submitting-wishlist, submitting-collection); 2 new variants added (search-idle, extracting-url); 4 survivors preserved (form-prefill, manual-entry, extraction-failed, photos-pending) with extraction-failed gaining mode field"
  - "Phase 69 D-06 parity — extraction-failed gains 'mode: url | structured' field for ExtractErrorCard mode-branch"
  - "DupeContext interface — three fields (existingWatchId, existingStatus, existingReference); existingReference: null is a valid case (catalog rows without public ref) per D-06"
  - "RailEntry.verdict re-typed to 'unknown | null' (was 'VerdictBundle | null') — drops the stale legacy verdict-types import while preserving RailEntry shape for RecentlyEvaluatedRail through Phase 71 cleanup"
  - "JSDoc-prose collision mitigation — comment originally read 'avoid a stale VerdictBundle import'; reworded to 'avoid a stale legacy verdict-types import' to prevent future grep-based false-positives (recurrence-3 of the Phase 69 Plan 04 JSDoc-as-test-input pattern)"
metrics:
  duration_seconds: 173
  task_count: 1
  file_count: 2
---

# Phase 70 Plan 04: FlowState union rewrite + DupeContext + transition map Summary

**Shipped:** the D-01 final 7-variant FlowState discriminated union + the DupeContext interface + the D-02 19-line transition-map JSDoc block, plus a co-located 4-case test file that locks the kind enumeration and removed-variant absence.

## What Shipped

### `src/components/watch/flowTypes.ts` (rewritten — 91 LOC)

**Final 7-variant FlowState union (D-01):**

| Variant | Fields | Phase 70 disposition |
|---------|--------|----------------------|
| `search-idle` | (none) | NEW — orchestrator-level idle on the search-first flow; SearchEntry owns query/results/showPanel internals |
| `extracting-url` | `url: string` | NEW — URL-backup mode (Phase 66 D-08 `{mode:'url',url}` body) |
| `extraction-failed` | `partial: ExtractedWatchData \| null; reason: string; category: ExtractErrorCategory; mode: 'url' \| 'structured'` | SURVIVOR + `mode` field added (Phase 69 D-06 ExtractErrorCard parity) |
| `confirming` | `catalogId: string \| null; extracted: ExtractedWatchData; pickedResult: SearchCatalogWatchResult \| null; dupeContext: DupeContext \| null; pending: boolean` | NEW — replaces verdict-ready / wishlist-rationale-open / submitting-wishlist / submitting-collection |
| `form-prefill` | `catalogId: string; extracted: ExtractedWatchData` | SURVIVOR — verbatim |
| `manual-entry` | `partial?: ExtractedWatchData \| null` | SURVIVOR — verbatim |
| `photos-pending` | `watchId: string; destination: string` | SURVIVOR — verbatim (D-17 gate applied by Plan 05 orchestrator, not the type) |

**6 removed variants (CLNP-05):** `idle`, `extracting`, `verdict-ready`, `wishlist-rationale-open`, `submitting-wishlist`, `submitting-collection`. Phase 71 CLNP-02 static guard will assert against THIS final union shape, not the ROADMAP draft enumeration (per CONTEXT.md §Phase 71 forward-coordination).

**DupeContext interface (new export):**

```typescript
export interface DupeContext {
  existingWatchId: string
  existingStatus: 'owned' | 'wishlist'
  existingReference: string | null
}
```

Surfaces the result of `findViewerWatchByCatalogId` (Phase 67 — Plan 01 of this phase extends the return shape to include `reference`) into the `confirming.dupeContext` field. DupeBanner (Plan 02) consumes the three fields; null-reference branch (D-06) tells DupeBanner to hide its "View existing" link.

**D-02 transition-map JSDoc:** Shipped verbatim as a 19-line `/** ... */` block ABOVE the `export type FlowState` declaration. Future readers see the state machine at a glance without leaving the type file.

**Imports:**
- KEPT: `ExtractedWatchData` from `@/lib/extractors`
- KEPT: `ExtractErrorCategory` from `./ExtractErrorCard`
- ADDED: `SearchCatalogWatchResult` from `@/lib/searchTypes` (for `confirming.pickedResult`)
- REMOVED: `VerdictBundle` from `@/lib/verdict/types` (verdict is out of scope for v8.0)

**Retained per CLNP-04 deferral (Phase 71 deletes alongside RecentlyEvaluatedRail):**
- `RailEntry` interface — shape preserved; `verdict` re-typed from `VerdictBundle | null` to `unknown | null` (the stale legacy-verdict import was the actual import to drop; field stays for `RecentlyEvaluatedRail.tsx` consumer compatibility)
- `PendingTarget` type — verbatim

### `src/components/watch/flowTypes.test.ts` (new — 91 LOC, 4 cases)

| Case | Assertion | Strategy |
|------|-----------|----------|
| (a) | `ALL_KINDS` (7 string literals) is assignable to `FlowState['kind'][]` | Compile-time check — if any kind is missing from the union, the spread assignment errors at tsc; `toHaveLength(7)` is the runtime witness |
| (b) | `REMOVED_KINDS` (6 string literals) and `ALL_KINDS` are disjoint | Runtime intersection loop (`expect(ALL_KINDS.includes(removed)).toBe(false)`) — documentation test; TypeScript compile gate via Plan 05's AddWatchFlow rewrite is the authoritative enforcement that the old kinds are unreachable |
| (c) | `DupeContext` literal type-checks with all 3 required fields + null-reference branch | Two constructed literals (owned + REF-001; wishlist + null) — exercises both `existingStatus` discriminant values and both `existingReference` shapes |
| (d) | `extraction-failed.mode` accepts both `'url'` and `'structured'` literals | Two constructed FlowState literals with different `mode` values; runtime narrows via the discriminant and asserts `.mode` matches |

**All 4 cases green** — `npx vitest run src/components/watch/flowTypes.test.ts` exits 0 in 2ms.

## Interim TypeScript-error state in AddWatchFlow.tsx

**Expected — Wave 2 plans run in parallel.** AddWatchFlow.tsx still imports the pre-Phase-70 FlowState union shape (`idle`, `verdict-ready`, etc.) and will fail to compile against the new union until Plan 05 rewrites the orchestrator. This is by design — the phase-level `npm run build` gate runs AFTER Plan 05 lands.

`flowTypes.test.ts` is pure type-level + runtime constants and imports no orchestrator code — it goes green independently of AddWatchFlow.tsx's mid-rewrite state.

## Self-Check: PASSED

**1. Created files exist:**
- FOUND: `src/components/watch/flowTypes.test.ts`

**2. Modified files updated:**
- FOUND: `src/components/watch/flowTypes.ts` (no longer imports `VerdictBundle`; 7-variant union; DupeContext + transition map shipped)

**3. Commit exists:**
- FOUND: `c8f0c38c` — `feat(70-04): rewrite flowTypes.ts to D-01 final union + DupeContext + CLNP-05 enumeration test`

**4. Done criteria from plan body:**
- `grep -nE "kind: '(idle|extracting|verdict-ready|wishlist-rationale-open|submitting-wishlist|submitting-collection)'" src/components/watch/flowTypes.ts | grep -v '^[^:]*://' | wc -l` → 0 (none of the removed kinds remain as type literals) ✓
- `grep -n "kind: 'search-idle'" src/components/watch/flowTypes.ts` → line 31 matches ✓
- `grep -n "export interface DupeContext" src/components/watch/flowTypes.ts` → line 49 matches ✓
- `grep -n "State transition map" src/components/watch/flowTypes.ts` → line 6 matches ✓
- `extraction-failed` variant declares `mode: 'url' | 'structured'` → confirmed on line 33 ✓
- `grep -c "VerdictBundle" src/components/watch/flowTypes.ts` → 0 (import + JSDoc prose both removed; comment reworded to avoid grep false-positive recurrence) ✓
- `grep -nE "export (interface RailEntry|type PendingTarget)" src/components/watch/flowTypes.ts` → both retained (lines 68, 82) ✓

## Deviations from Plan

**None — plan executed exactly as written**, with one minor JSDoc-prose adjustment captured proactively (not a Rule 1/2/3 fix, just a comment wording):

- **JSDoc-prose precaution (recurrence-3 of the Phase 69 Plan 04 pattern):** Initial draft of the RailEntry JSDoc included the phrase "stale `VerdictBundle` import"; reworded to "stale legacy verdict-types import" so a future grep-based test on the token `VerdictBundle` returns 0 in this file. No semantic change; same intent. Same pattern called out in the project memory `feedback_decision_coverage_gate_citations` family and reaffirmed by Phase 69 Plan 04 lessons. Tracked as a forward-looking comment hygiene fix, not a deviation from plan body.

## Auth Gates Encountered

None. Plan 04 is a pure type-rewrite + test-add task — no Server Actions, no DB calls, no auth surface.

## Known Stubs

None. Plan 04 ships fully typed exports (FlowState, DupeContext, RailEntry, PendingTarget). No empty arrays / placeholder strings / TODO markers introduced.

## Threat Flags

None. flowTypes.ts is a type-only file — no runtime code, no input handling, no I/O. No new security surface introduced (per plan body `<threat_model>` STRIDE register: "Type-only files have no STRIDE surface").

## Wave 2 Coordination Note

This plan ran in Wave 2 in parallel with:
- **Plan 02** — DupeBanner.tsx (shipped at commit referenced in STATE.md Key Decisions; non-overlapping file ownership)
- **Plan 03** — moveWishlistToCollection (shipped at commit referenced in STATE.md Key Decisions; non-overlapping file ownership)

Plan 04 owned `src/components/watch/flowTypes.ts` exclusively. No file-ownership collisions encountered.

**Downstream:**
- Plan 05 (AddWatchFlow orchestrator rewrite) imports `FlowState`, `DupeContext`, `RailEntry` from this file. Plan 05 cannot type-check the orchestrator's state setters or the DupeBanner's `dupeContext` prop without this plan's deliverables. Plan 05 will resolve the AddWatchFlow.tsx interim TypeScript-error state.
- Phase 71 CLNP-02 static guard will assert against THIS final union shape (NOT the ROADMAP draft enumeration) per CONTEXT.md §Phase 71 forward-coordination.
