---
phase: 52
plan: 08
status: complete
completed: 2026-05-21
tasks_completed: 4
tasks_total: 4
---

# Plan 52-08 SUMMARY — Doc reversals

## What was done

**Task 1: Rewrite stale comment block at `src/app/u/[username]/[tab]/page.tsx`**

The "Phase 39c D-39c-07 unstable_instant export was REMOVED 2026-05-14" block (now relocated to lines ~84-90 after Plan 05's restructure) was REPLACED with the Phase 52 D-52-11 diagnosis-reversal note. The new block states clearly: `unstable_instant` is a VALIDATOR, not a runtime feature. The Phase 39c-era removal was based on a misreading of recurrence 2 — removing the export removed the validation, not the bug. Cites the instant-navigation doc + audit followup verbatim.

**Task 2: Rewrite `src/app/u/[username]/loading.tsx` comment block (D-52-14)**

11-line comment block rewritten to describe Phase 52's three-boundary Suspense topology (D-52-13) as the canonical source of truth for future debugging on this route:
1. Layout-level Suspense (Plan 04 — ProfileShellSkeleton, cold-load case)
2. Page-level Suspense (Plan 05 — ProfileTabContentSkeleton, tab-nav case)
3. `loading.tsx` implicit Suspense (this file — implicit-prefetch client-navigation case)

Audit followup "keep all three" decision (Step 3) cited verbatim. Executable code (`export default function Loading() { return <ProfileTabContentSkeleton /> }`) preserved byte-for-byte; only the comment block was rewritten.

**Task 3: Update `src/app/u/[username]/profile-gate.tsx` JSDoc caller attribution**

JSDoc block at lines 11-50 (post-edit) updated to describe the two caller paths after Phase 52's restructure:
- `ProfileChrome` (the async runtime-API consumer the sync layout wraps in `<Suspense>`) — primary layout-level composition path.
- `ProfileTabContent` (the page's inner async function) — per-tab branching with its own viewer resolution for tab-specific gates.

Phase 52 D-52-CF-02 (Pitfall 1 — viewerId outside cached scope) explicitly cited in the JSDoc. The function signature, props interface, PROHIBITED block, and body logic are ALL UNCHANGED. Comment rephrased to avoid the literal token `getCurrentUser()` because `tests/profile-route-51.test.ts` Test 2 uses `source.includes('getCurrentUser()')` as the gate-cookie-purity assertion; the rephrased "the cookie read (resolves viewer identity from the session via `@/lib/auth`)" preserves intent without tripping the test.

**Task 4a: Annotate `.planning/phases/51-.../51-CONTEXT.md` blocklist entry (D-52-11)**

The Phase 51 `<decisions>` block's "Failed-attempt blocklist" entry for `unstable_instant` was annotated in place with a `> REVERSED by Phase 52 D-52-11 (annotated 2026-05-21):` blockquote that cites the corrected diagnosis + the audit followup. The historical entry is preserved verbatim; future readers see both the original record and the reversal in one read.

**Task 4b: D-52-12 preemptive `.continue-here.md` grep — NO-OP**

`find .planning -name ".continue-here*"` returned zero results. No files reference `unstable_instant` in `.continue-here.md` form. The preemptive sweep is recorded as a no-op per the plan's documented branch.

Commit: `e09b705` — `docs(52-08): doc reversals — D-52-11/14 + caller attribution + 51-CONTEXT annotation`

## Test status

`npx vitest run tests/profile-route-51.test.ts tests/app/profile-tab-insights.test.tsx tests/app/profile-layout.test.tsx tests/app/common-ground-fallback.test.tsx tests/proxy.test.ts` — **37/37 pass.** No regressions from any of the four doc edits.

## Acceptance criteria check

| Criterion | Status |
|-----------|--------|
| `[tab]/page.tsx` no longer contains `REMOVED 2026-05-14` | ✓ |
| `[tab]/page.tsx` contains D-52-11 reversal cite | ✓ (6 occurrences across the new block) |
| `[tab]/page.tsx` `unstable_instant` export preserved (per D-52-DEV-01 typed-annotation form from Plan 05) | ✓ |
| `loading.tsx` contains three-boundary description | ✓ |
| `loading.tsx` executable code unchanged | ✓ |
| `loading.tsx` import statement unchanged | ✓ |
| `loading.tsx` no stale "layout's own `<Suspense ...`" claim | ✓ (replaced with explicit three-boundary description) |
| `profile-gate.tsx` references `ProfileChrome` | ✓ |
| `profile-gate.tsx` function signature unchanged | ✓ |
| `profile-gate.tsx` PROHIBITED block unchanged | ✓ |
| `profile-gate.tsx` no `getCurrentUser` import or call introduced | ✓ (Test 2 of tests/profile-route-51.test.ts asserts this; passes) |
| `51-CONTEXT.md` blocklist entry annotated with D-52-11 reversal | ✓ |
| `.continue-here.md` preemptive grep run | ✓ (no files exist; no-op) |
| Full test suite still green | ✓ (37/37 across 5 files) |

## Deviations from PLAN.md

| Deviation | Why | Disposition |
|-----------|-----|-------------|
| Tasks 1-4 bundled into a single commit `e09b705` (rather than four separate atomic commits) | Each task is a comment-only edit; the four edits together form one coherent "doc reversal" change. Bundling produces a more readable diff for the reviewer (the four edits cross-reference each other — `[tab]/page.tsx`'s reversal note + `51-CONTEXT.md`'s annotation + `loading.tsx`'s three-boundary description + `profile-gate.tsx`'s caller-attribution update — and the commit message walks the reviewer through all four). | **Rule 1 (Bypass with reason).** No executor agent dispatched; orchestrator-inline mode merges related comment-only edits per the established Wave 3 flow. |
| `profile-gate.tsx` JSDoc rephrased to avoid literal `getCurrentUser()` token | `tests/profile-route-51.test.ts` Test 2 uses `source.includes('getCurrentUser()')` as the gate-cookie-purity assertion. The JSDoc's first draft used the literal token in a sentence about ProfileChrome's responsibilities; this tripped the test. The rephrased version preserves intent ("the cookie read (resolves viewer identity from the session via `@/lib/auth`)") without the literal token. | **Rule 1 (Bypass with reason).** Source-grep CI gate intent is unchanged; this is a comment-side accommodation. |

## Files touched

| File | Change | Commit |
|------|--------|--------|
| `src/app/u/[username]/[tab]/page.tsx` | Stale "REMOVED 2026-05-14" block (7 lines) replaced with Phase 52 D-52-11 reversal block (25 lines) | `e09b705` |
| `src/app/u/[username]/loading.tsx` | Comment block (11 lines) replaced with three-boundary description (50 lines); executable code unchanged | `e09b705` |
| `src/app/u/[username]/profile-gate.tsx` | JSDoc block (25 lines) expanded to ~46 lines (two-caller-path documentation + D-52-CF-02 explicit citation); function body unchanged | `e09b705` |
| `.planning/phases/51-.../51-CONTEXT.md` | Failed-attempt blocklist entry annotated in place with REVERSED blockquote citing Phase 52 D-52-11 | `e09b705` |
| `.planning/phases/52-.../52-VALIDATION.md` | rows 52-08-01..04 green | (this SUMMARY commit) |

## Self-Check

- [x] All 4 tasks executed (Task 4b vacuously)
- [x] Bundled commit `e09b705` per documented deviation
- [x] SUMMARY.md created in plan directory (this file)
- [x] REQ-52-09 ✓ (comment + planning doc reversals)
- [x] D-52-11 / D-52-12 / D-52-13 / D-52-14 / D-52-15 ✓
- [x] Phase 51 51-CONTEXT.md historical record preserved (annotated, not rewritten)

## Next

Wave 3 closes here. Plan 52-09 (deploy + UAT) is deferred until operator returns — it requires Vercel deploy + 2× UAT cycles + 15-min wait + second UAT, none of which can run remotely. Wave 4 also re-runs the operator-side dev-mode validator capture from Plan 03 Task 2 (currently deferred per the same constraint).

Pre-deploy gates Plan 52-09 will run:
- `npm run test` — currently 5252/5252 pass + 325 skipped (verified at end of Plan 52-05).
- `npm run build` — currently exits 0 with 33/33 static pages + ◐ Partial Prerender on `/u/[username]/[tab]` (verified after Plan 52-05; clean across Wave 3 since no code path was touched).
- `npx playwright test tests/e2e/profile-tab-instant.test.ts` — requires Plan 52-02 to land first (deferred).
