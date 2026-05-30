---
phase: 69
plan: 04
subsystem: add-watch-flow
tags: [client-component, presenter, structured-extract, mode-branched-copy, EXTR-05, EXTR-06, EXTR-07, Phase-66-D-06]
requires:
  - useStructuredExtractCache (Plan 02)
  - ExtractErrorCard (Phase 25)
  - CatalogPhotoUploader (Phase 19.1)
  - VerdictSkeleton (Phase 20)
provides:
  - StructuredEntryPanel pure-presenter (consumed by Plan 05 SearchEntry + Phase 70 AddWatchFlow)
  - ExtractErrorCard mode-branched body for structured-data-missing (consumed by StructuredEntryPanel and Plan 05 SearchEntry)
affects:
  - Phase 70 — mounts StructuredEntryPanel inside AddWatchFlow and wires onSubmitStructured + onSwitchToUrl
  - Plan 05 — composes StructuredEntryPanel inside SearchEntry's no-match expand (D-11)
tech-stack:
  added: []
  patterns:
    - Pure-presenter — props in, callbacks out (Phase 68 D-03 precedent)
    - Module-scope Map cache + in-render reset (D-06 + D-18 JSON-tuple key)
    - Mode-branched copy via component-body derivation (CONTRACT_BY_CATEGORY stays LOCKED)
key-files:
  created:
    - src/components/watch/StructuredEntryPanel.tsx
    - src/components/watch/StructuredEntryPanel.test.tsx
  modified:
    - src/components/watch/ExtractErrorCard.tsx
    - src/components/watch/ExtractErrorCard.test.tsx
decisions:
  - D-15 (4-field grid) — `grid grid-cols-1 gap-3 sm:grid-cols-2`; brand+model row 1, reference+year row 2
  - D-16 (DOM order) — fields → CatalogPhotoUploader inline → Find specs CTA → URL ghost link below
  - D-17 (in-place loading) — VerdictSkeleton below CTA during round-trip; fields stay visible
  - D-18 (cache key) — JSON.stringify({brand,model,reference,year}) with per-field trim().toLowerCase()
  - EXTR-05 — explicit Find specs button gates LLM call; cache check BEFORE network call
  - EXTR-06 — CatalogPhotoUploader inline (not behind reveal); inherits default copy
  - EXTR-07 — `onSwitchToUrl()` upward callback for the URL-backup ghost link
  - Phase 66 D-06 — `mode?: 'url' | 'structured'` on ExtractErrorCard; only `structured-data-missing` body branches; all other LOCKED categories preserved
metrics:
  duration: 12m
  completed: 2026-05-29
---

# Phase 69 Plan 04: StructuredEntryPanel + ExtractErrorCard mode-branched copy

Ship the structured-input form half of Phase 69: pure-presenter 4-field form with inline photo, explicit Find specs button gating the LLM call, in-place loading skeleton, mode-branched error card on failure, and a URL-backup ghost link — both new files ship DORMANT (Phase 70 wires them).

## What was built

**`src/components/watch/StructuredEntryPanel.tsx`** (287 LOC) — `'use client'` pure-presenter:

- **Props:** `viewerUserId`, optional `initialBrand`/`initialModel`/`initialReference`, `onSubmitStructured(result)`, `onSwitchToUrl()`
- **State:** `brand`, `model`, `reference`, `year` (string), `photoBlob`, `isExtracting`, `extractError`
- **D-15 grid:** `grid grid-cols-1 gap-3 sm:grid-cols-2` with `se-` ID prefix discipline; brand+model required + `aria-required="true"` + visible asterisk; reference+year optional
- **D-16 DOM order:** 4-field grid → `<CatalogPhotoUploader>` inline (always rendered) → "Find specs" CTA (`w-full min-h-[44px]`) → URL ghost link below
- **EXTR-05 gating:** Button `disabled={!brand.trim() || !model.trim() || isExtracting}`; click handler validates → cache.get(key) BEFORE network → fetch → success calls `cache.set(key, entry)` then `onSubmitStructured(envelope.data)`; failure sets `extractError`
- **D-17 in-place skeleton:** Loading-state button shows `<Loader2 className="size-4 mr-2 animate-spin" />Finding specs…`; `<VerdictSkeleton />` renders below CTA; fields stay visible
- **D-18 cache key:** `JSON.stringify({brand: brand.trim().toLowerCase(), model: model.trim().toLowerCase(), reference: reference.trim().toLowerCase(), year: yearNum})` (yearNum is `null` when empty)
- **Phase 66 D-06 consumer:** `<ExtractErrorCard category={extractError} mode="structured" retryAction={() => setExtractError(null)} manualAction={onSwitchToUrl} />`
- **EXTR-07 ghost link:** "Have a URL for this watch?" Button variant="ghost" → `onSwitchToUrl()`
- **Phase 66 body shape:** omits `reference`/`year` when empty/null so Zod discriminated schema sees a clean optional shape
- **Pure-presenter discipline:** No client navigation hooks; no action imports; fetches `/api/extract-watch` directly but does not navigate

**`src/components/watch/ExtractErrorCard.tsx`** (Phase 66 D-06 unlock):

- Added `mode?: 'url' | 'structured'` to `ExtractErrorCardProps` with JSDoc explaining single-row unlock
- Renamed CONTRACT destructure: `body: rawBody` and derived `const body = (category === 'structured-data-missing' && mode === 'structured') ? "Couldn't find specs for that watch. Try adding a reference number, or enter manually." : rawBody`
- Added inline comment near CONTRACT_BY_CATEGORY clarifying the single-row Phase 69 mode-aware variant
- CONTRACT_BY_CATEGORY entries themselves remain LOCKED — the URL-mode source of truth
- 4 LOCKED Phase 25 D-15 categories (`host-403`, `LLM-timeout`, `quota-exceeded`, `generic-network`) reuse their entries verbatim in BOTH modes

**`src/components/watch/StructuredEntryPanel.test.tsx`** (282 LOC, 10 tests):

| # | Test | Coverage |
|---|------|----------|
| 1 | required + aria-required on brand/model; not on reference/year | EXTR-03 |
| 2 | Find specs disabled on empty/whitespace; enabled on both | EXTR-05 |
| 3 | Click fires fetch to `/api/extract-watch` with `mode='structured'` | EXTR-05 |
| 4 | In-place skeleton + Loader2 + "Finding specs…" during round-trip; fields visible | D-17 |
| 5 | `<CatalogPhotoUploader>` rendered on mount | EXTR-06 |
| 6 | "Have a URL for this watch?" → onSwitchToUrl() | EXTR-07 |
| 7 | Failure → ExtractErrorCard with structured-mode body verbatim | Phase 66 D-06 |
| 8 | Cache hit calls onSubmitStructured(cached.extracted) without fetching; key shape matches D-18 | D-18 |
| 9 | Source file has no `useRouter` / `next/navigation` / `@/app/actions` / `router.push` | Presenter purity |
| 10 | Success envelope → onSubmitStructured(data) + cache.set fires | D-03 |

**`src/components/watch/ExtractErrorCard.test.tsx`** (3 new tests):

- `mode="structured" category="structured-data-missing"` → new body verbatim; URL body NOT in DOM
- `mode="url" category="structured-data-missing"` (explicit) → Phase 25 D-15 LOCKED body; new body NOT in DOM
- `mode="structured" category="host-403"` → Phase 25 D-15 LOCKED host-403 body unchanged

Existing 15 ExtractErrorCard tests stay green (UI-SPEC A9 regression guard).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `047ba441` | `feat(69-04): mode-branch ExtractErrorCard structured-data-missing body (Phase 66 D-06)` |
| 2 RED | `1e7302d1` | `test(69-04): add failing test for StructuredEntryPanel (RED, EXTR-05/06/07, D-15..D-18)` |
| 2 GREEN | `039b1d91` | `feat(69-04): ship StructuredEntryPanel pure-presenter (GREEN, EXTR-05/06/07, D-15..D-18)` |

## Verification

- `npm run test -- --run src/components/watch/ExtractErrorCard.test.tsx` → 18/18 pass (15 existing + 3 new)
- `npm run test -- --run src/components/watch/StructuredEntryPanel.test.tsx` → 10/10 pass
- `npm run build` → exits 0 (Vercel-compatible)
- Counter-assertions:
  - `git diff src/components/watch/CatalogPhotoUploader.tsx` empty (no modification)
  - `git diff src/components/insights/VerdictSkeleton.tsx` empty (no modification)
  - CONTRACT_BY_CATEGORY entries unchanged — only the component-body derivation branches
  - `grep -c "font-medium" src/components/watch/StructuredEntryPanel.tsx` → 0 (no-raw-palette guardrail honored)
  - `grep -v '^//' src/components/watch/StructuredEntryPanel.tsx | grep -c "useRouter\|next/navigation"` → 0 (presenter purity)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] CatalogPhotoUploader requires `onError` prop**

- **Found during:** Task 2 GREEN implementation
- **Issue:** Plan referenced `<CatalogPhotoUploader onPhotoReady={setPhotoBlob} onClear={() => setPhotoBlob(null)} disabled={isExtracting} />` but CatalogPhotoUploader's actual `CatalogPhotoUploaderProps` declares `onError: (message: string) => void` as **required** (not optional)
- **Fix:** Passed a no-op `onError={() => {}}` handler with an inline comment explaining the uploader surfaces its own error UI inline; the panel does not need to react because the photo is optional and failure does not block "Find specs"
- **Files modified:** `src/components/watch/StructuredEntryPanel.tsx`
- **Commit:** `039b1d91`

**2. [Rule 1 — Bug] Generic-network catch path**

- **Found during:** Task 2 GREEN implementation (per Phase 25 5-category taxonomy)
- **Issue:** Plan's Find specs handler described try/json/setExtractError flow but did not specify behavior when `fetch` itself rejects (network error, malformed JSON, etc.)
- **Fix:** Catch block sets `extractError='generic-network'` so the ExtractErrorCard branch renders (mode='structured' shows the LOCKED Phase 25 D-15 generic-network copy per Phase 66 D-06 single-row rule — only `structured-data-missing` has a mode variant)
- **Commit:** `039b1d91`

**3. [Rule 3 — Blocking issue] photoBlob unused-state warning**

- **Found during:** Task 2 build verification
- **Issue:** `const [photoBlob, setPhotoBlob] = useState(...)` produced a TypeScript / lint warning because `photoBlob` itself is never read inside the component (only set/cleared via callbacks; Phase 70 wires the upload pipeline)
- **Fix:** Destructured as `const [, setPhotoBlob] = useState<Blob | null>(null)` (state is held in React but only the setter is referenced); inline comment explains Phase 70 forwards it to the catalog source-photo upload pipeline at ConfirmStep commit
- **Files modified:** `src/components/watch/StructuredEntryPanel.tsx`
- **Commit:** `039b1d91`

**4. [Rule 3 — Blocking issue] JSDoc prose tripping presenter-purity grep**

- **Found during:** Task 2 GREEN test execution
- **Issue:** Initial JSDoc mentioned the literal token sequences "useRouter", "next/navigation", "Server Action", "router.push" to explain the presenter contract — but the test (9) grep `grep -v '^//' | grep -c "useRouter\|next/navigation"` falsely matched because JSDoc block comments use ` * ` prefix, not `//`
- **Fix:** Reworded JSDoc to "Pure presenter — no client-side navigation hooks, no action imports; all routing concerns live with Phase 70's orchestrator" — preserves intent without leaking the literal tokens
- **Commit:** `039b1d91`

**5. [Rule 3 — Blocking issue] JSDoc prose tripping URL-backup-copy acceptance grep**

- **Found during:** Task 2 acceptance-criteria check
- **Issue:** Initial JSDoc described `onSwitchToUrl()` callback wiring with the literal "Have a URL for this watch?" copy — but the AC requires `grep -c` to return exactly `1` (verbatim copy MUST appear once in JSX only)
- **Fix:** Reworded JSDoc to "URL backup ghost link (EXTR-07 copy verbatim in JSX)" — verbatim copy now only in the JSX literal at line 281
- **Commit:** `039b1d91`

**6. [Rule 3 — Blocking issue] JSDoc prose tripping no-raw-palette guardrail**

- **Found during:** Task 2 acceptance-criteria check
- **Issue:** Initial guardrail-rationale JSDoc said "NO raw font-medium override in this file" — but the no-raw-palette test pattern is `/\bfont-medium\b/` (a word-boundary regex that matches the literal in prose too)
- **Fix:** Reworded JSDoc to "no raw weight-500 className overrides in this file" — preserves intent; literal token now appears 0 times in the file
- **Commit:** `039b1d91`

### Architectural changes

None — Plan executed substantively as written.

## Authentication Gates

None — no auth surface in this plan. Phase 25 D-14 / AUTH-04 auth gate lives in the route handler (Phase 66); StructuredEntryPanel is a pure client presenter that fetches an already-authenticated route.

## Known Stubs

None. The component is fully wired but ships DORMANT — `StructuredEntryPanel` is not yet mounted in `AddWatchFlow` (Phase 70 wires; tracked in roadmap). The component is functional in isolation and consumed by the test harness end-to-end.

## Threat Flags

None — no new network endpoints, no new schema, no new trust boundaries. The component reuses the existing `/api/extract-watch` endpoint (Phase 66) and the existing module-scope cache primitives (Plan 02).

## Self-Check: PASSED

- Files exist:
  - FOUND: `src/components/watch/StructuredEntryPanel.tsx`
  - FOUND: `src/components/watch/StructuredEntryPanel.test.tsx`
  - FOUND: `src/components/watch/ExtractErrorCard.tsx` (modified)
  - FOUND: `src/components/watch/ExtractErrorCard.test.tsx` (modified)
- Commits exist:
  - FOUND: `047ba441` (Task 1 ExtractErrorCard mode-branch)
  - FOUND: `1e7302d1` (Task 2 RED test)
  - FOUND: `039b1d91` (Task 2 GREEN component)
- Tests + Build:
  - PASS: `npm run test -- --run src/components/watch/ExtractErrorCard.test.tsx` 18/18
  - PASS: `npm run test -- --run src/components/watch/StructuredEntryPanel.test.tsx` 10/10
  - PASS: `npm run build` exits 0
