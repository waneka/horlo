---
phase: 74
plan: 02
subsystem: mobile-polish
tags: [mobile, ios-safari, auto-zoom, css, static-guard, regression-fix]
requires:
  - src/app/layout.tsx viewport export shape (read-only)
  - src/components/ui/input.tsx + textarea.tsx text-base md:text-sm pattern (reference)
provides:
  - Global @layer base font-size 1rem floor on input/textarea/select
  - text-base md:text-sm responsive override on the 3 user-facing offenders
  - 2 fs-walking static guards locking the invariants
affects:
  - src/app/globals.css (new @layer base block at end)
  - src/components/comment/CommentCompose.tsx (one className token swap, line 60)
  - src/components/comment/CommentItem.tsx (one className token swap, line 170)
  - src/components/watch/SearchEntry.tsx (one className token swap, line 242)
  - tests/static/no-iOS-zoom-viewport.test.ts (NEW — D-11 guard, 7 tests)
  - tests/static/no-text-sm-on-native-form-controls.test.ts (NEW — D-12 guard, 2 tests)
tech-stack:
  added: []
  patterns:
    - "@layer base font-size floor (specificity 0,0,1 — utilities still win)"
    - "text-base md:text-sm responsive typography on form controls (mirrors shadcn primitives)"
    - "fs-walking static guard with // @vitest-environment node pragma"
key-files:
  created:
    - tests/static/no-iOS-zoom-viewport.test.ts
    - tests/static/no-text-sm-on-native-form-controls.test.ts
  modified:
    - src/app/globals.css
    - src/components/comment/CommentCompose.tsx
    - src/components/comment/CommentItem.tsx
    - src/components/watch/SearchEntry.tsx
decisions:
  - "D-06: globals.css @layer base { input, textarea, select { font-size: 1rem } } — DOM-default floor, no !important"
  - "D-07: text-sm → text-base md:text-sm on 3 user-facing offenders; shadcn primitives + admin files untouched"
  - "D-08: src/app/layout.tsx viewport export NOT modified (no maximumScale / userScalable / minimumScale)"
  - "D-11: viewport meta static guard with @vitest-environment node pragma; rejects forbidden keys + raw HTML meta forms"
  - "D-12: text-sm-on-native-form-controls regression guard limited to v8.1 fixed surfaces (comment/* + SearchEntry.tsx)"
  - "JSDoc-prose grep-collision recurrence-4 preempted: SCOPE LIMIT comment in D-12 guard reworded to avoid `src/components/admin` literal that the AC grep targets"
metrics:
  duration: "4min"
  tasks: 3
  files: 6
  completed: "2026-05-30T20:39:29Z"
requirements_addressed: [MOB-01]
---

# Phase 74 Plan 02: MOB-01 — iOS Safari Input Auto-Zoom Polish Summary

Global CSS `@layer base` font-size 1rem floor on `input/textarea/select` + responsive `text-base md:text-sm` rewrite on the 3 user-facing offenders + 2 fs-walking static guards. Closes MOB-01: tapping any input field on iOS Safari no longer triggers the auto-zoom heuristic, while `{ viewportFit: 'cover' }` is preserved (pinch-zoom intact per SC#3).

## What Shipped

### Layer 1 — global font-size floor (D-06)
`src/app/globals.css` gains a new `@layer base` block at the end:

```css
@layer base {
  input,
  textarea,
  select {
    font-size: 1rem; /* 16px — prevents iOS Safari auto-zoom on focus */
  }
}
```

Specificity is 0,0,1 — beaten by any utility class — so components that legitimately want a different size CAN still set one. This is the floor for DOM-default native elements, not a ceiling. No `!important`.

### Layer 2 — responsive override audit + rewrite (D-07)
Three call-sites flip from bare `text-sm` (14px → triggers iOS zoom) to `text-base md:text-sm` (16px mobile, 14px desktop — mirrors shadcn `Input` + `Textarea` primitives at `src/components/ui/input.tsx:12` + `src/components/ui/textarea.tsx:10`):

| File | Line | Element |
|------|------|---------|
| `src/components/comment/CommentCompose.tsx` | 60 | raw `<textarea>` |
| `src/components/comment/CommentItem.tsx` | 170 | raw edit-comment `<textarea>` |
| `src/components/watch/SearchEntry.tsx` | 242 | `<Combobox.Input>` (base-ui primitive renders `<input>`) |

Scope guards held: shadcn primitives untouched (already correct); admin-only files (`src/components/admin/ListEditorClient.tsx`, `CmsCoverUploader.tsx`, `MarkdownEditor.tsx`) untouched per D-07; `src/app/layout.tsx` untouched per D-08.

### Layer 3 — static guards (D-11 + D-12)
Two new tests/static/ guards, both with `// @vitest-environment node` on line 1 per `project_vitest_static_node_env`:

- **`tests/static/no-iOS-zoom-viewport.test.ts`** (D-11) — 7 tests. Asserts the parsed `src/app/layout.tsx` `viewport` export does NOT contain `maximumScale`, `userScalable`, or `minimumScale` keys; also rejects raw `maximum-scale=` / `user-scalable=` HTML smuggled via `dangerouslySetInnerHTML`. Fires CI tripwire if a future contributor tries the wrong fix (defeating pinch-zoom per ROADMAP SC#3).
- **`tests/static/no-text-sm-on-native-form-controls.test.ts`** (D-12) — 2 tests. Walks `src/components/comment/` (recursive) + `src/components/watch/SearchEntry.tsx`; for every native form-control opening tag (`<textarea`, `<input`, `<select`, `<Combobox.Input`) with `className` containing the bare token `text-sm`, asserts the same className ALSO contains `md:text-sm` (the allowed responsive companion). Scope deliberately limited — admin/* + the rest of src/ are NOT walked.

## Verification

| Gate | Result |
|------|--------|
| `npm run build` (after Task 1) | exit 0 — Compiled successfully in 5.7s |
| `npm run build` (after Task 3) | exit 0 — Compiled successfully in 5.9s |
| `npx vitest run tests/static/no-iOS-zoom-viewport.test.ts` | 7/7 pass (368ms) |
| `npx vitest run tests/static/no-text-sm-on-native-form-controls.test.ts` | 2/2 pass (392ms) |
| `grep -c "@layer base" src/app/globals.css` | 2 (existing + new) |
| `grep -c "font-size: 1rem" src/app/globals.css` | 1 |
| `grep -c "text-base md:text-sm" src/components/comment/CommentCompose.tsx src/components/comment/CommentItem.tsx src/components/watch/SearchEntry.tsx` | 3 (one per file) |
| `head -1` on both new test files | `// @vitest-environment node` |
| `git diff --stat src/app/layout.tsx src/components/ui/input.tsx src/components/ui/textarea.tsx src/components/admin/` | empty (untouched) |

Diff stat over the plan: `git diff --stat HEAD~3..HEAD` = 6 files changed, +225 / −3 LOC.

## Commits

| Task | Type | Hash | Subject |
|------|------|------|---------|
| 1 | feat | `c5583529` | feat(74): add iOS auto-zoom font-size floor + responsive text-sm overrides (MOB-01) |
| 2 | test | `3b36644a` | test(74): add viewport meta static guard against pinch-zoom regression (MOB-01 D-11) |
| 3 | test | `803d6e3b` | test(74): add text-sm-on-native-form-controls regression guard (MOB-01 D-12) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug-preemption] JSDoc-prose grep-collision recurrence-4 preempted in D-12 guard**

- **Found during:** Task 3 acceptance-criteria verification
- **Issue:** The plan acceptance criterion for the D-12 guard specifies `grep -c "src/components/admin" tests/static/no-text-sm-on-native-form-controls.test.ts` returns 0 — to prove admin files are NOT walked. The initial implementation cited `src/components/admin/*` verbatim in the SCOPE LIMIT comment to explain the deliberate exclusion. That literal token in JSDoc-prose produced 1 grep hit, failing the criterion.
- **Fix:** Reworded the SCOPE LIMIT comment to "Admin-only components (the admin/ subtree) are NOT walked …" — preserves the documentation intent; grep on `src/components/admin` now returns 0.
- **Why:** Recurrence-4 of the JSDoc-as-grep-target pattern (cataloged in STATE.md: Phase 64 WatchDetailTrailing → Phase 69 quartet → Phase 70 RailEntry → Phase 74-01 ConfirmStep JSDoc). Same lesson, different surface. Documented for the next planner.
- **Files modified:** `tests/static/no-text-sm-on-native-form-controls.test.ts` (1 comment block reworded; no code change)
- **Commit:** rolled into Task 3 commit `803d6e3b`

No other deviations. All scope guards (admin untouched, shadcn untouched, layout.tsx untouched, no font-medium introductions) held.

## Threat Model Status

All 5 STRIDE entries (T-74-05 through T-74-09) closed per CONTEXT plan disposition:

- T-74-05 (Tampering — globals.css @layer base): mitigated. Specificity 0,0,1, no !important; admin tooling with bespoke font-size keeps working.
- T-74-06 (DoS — visual reflow): accepted. Comment textarea is `rows={3}` (fixed); SearchEntry input is `h-10` (fixed). 16px mobile font consumes ~2px more line-height but no layout reflow.
- T-74-07 (Repudiation — static guards): mitigated. Both new guards declare `// @vitest-environment node` on line 1.
- T-74-08 (Information disclosure — viewport export): mitigated. D-11 guard locks the invariant against future easy-fix regression.
- T-74-09 (EoP — admin out of scope): accepted. Admin/* keeps text-sm overrides intentionally; iPad-admin auto-zoom is a future MOB-02 candidate.

No new threat surface flags introduced.

## Deferred Items (per CONTEXT)

- **Admin-tool input audit for MOB-01** — `ListEditorClient.tsx:588`, `CmsCoverUploader.tsx`, `MarkdownEditor.tsx`. Out of v8.1 user-facing scope. Pick up in a future admin-tooling phase or MOB-02 if reported on iPad.
- **CommentCompose + CommentItem refactor onto shadcn `Textarea` primitive** — would eliminate the className-drift class entirely; out of v8.1 (refactor, not defect-fix).
- **`text-base md:text-sm` enforcement via ESLint rule** — out of scope; project ESLint config is minimal. Revisit if MOB-01 recurs on a different surface.
- **Computed font-size unit test for MOB-01** — D-13 rejects (no Tailwind compilation in vitest harness).
- **Pinch-zoom automated test** — Safari runtime behavior; no jsdom path. D-09 manual prod UAT is the right verification.

## Prod UAT (bundled per D-15)

Pinch-zoom + iOS Safari auto-zoom verification is **prod UAT only** per `feedback_mobile_ui_verify_on_prod` — local jsdom + the static guards cover the structural contract (className tokens + viewport meta); Safari runtime behavior is verified on prod only.

Bundled in the single v8.1 deploy walk alongside Phase 72 SRCH-03 follow-up + Phase 73 ROUTE-01 + Phase 74 Plan 01 DUPE-04 — 6 items total in one UAT pass:

1. SRCH-01 multi-token search match
2. SRCH-02 combobox keyboard nav
3. SRCH-03 composite footer click closes popup + mounts StructuredEntryPanel
4. ROUTE-01 owned redirect from search-pick uses catalogId UUID (no 404)
5. DUPE-04 ConfirmStep primary CTA hidden under DupeBanner (no "Saving..." copy)
6. **MOB-01 (this plan):** (a) tap a comment textarea on a watch detail page → page does NOT auto-zoom; (b) tap the add-watch search input → page does NOT auto-zoom; (c) tap a comment edit textarea (own comment) → page does NOT auto-zoom; (d) two-finger pinch-zoom anywhere on the app → still zooms (preserved per ROADMAP SC#3 + D-08).

Per `feedback_ppr_cache_fill_no_longer_call_out` — do NOT bake PPR / #419 / cache-fill regression checks into this UAT script.

## Success Criteria Status

- [x] ROADMAP Phase 74 SC#2 closed (iOS auto-zoom defeated structurally; prod UAT confirms runtime)
- [x] ROADMAP Phase 74 SC#3 closed (pinch-zoom preserved — viewport export unchanged + D-11 guard locks it)
- [x] ROADMAP Phase 74 SC#4 closed (no visual regressions: shadcn untouched, admin untouched, the 3 rewrites swap only the text-* token, @layer base specificity 0,0,1 lets utilities win)
- [x] REQUIREMENTS.md MOB-01 closed
- [x] font-medium guardrail (recurrence-5) holds: 0 introductions across the 3 modified files
- [x] vitest-static-node-env discipline holds: both new guards declare `// @vitest-environment node` on line 1
- [x] Build exits 0; both new static guards exit 0

## Self-Check: PASSED

- `src/app/globals.css`: FOUND (modified)
- `src/components/comment/CommentCompose.tsx`: FOUND (modified)
- `src/components/comment/CommentItem.tsx`: FOUND (modified)
- `src/components/watch/SearchEntry.tsx`: FOUND (modified)
- `tests/static/no-iOS-zoom-viewport.test.ts`: FOUND (created)
- `tests/static/no-text-sm-on-native-form-controls.test.ts`: FOUND (created)
- Commit `c5583529`: FOUND in `git log`
- Commit `3b36644a`: FOUND in `git log`
- Commit `803d6e3b`: FOUND in `git log`
