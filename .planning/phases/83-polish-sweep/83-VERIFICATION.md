---
phase: 83-polish-sweep
verified: 2026-09-12T00:00:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "Dialog body for wishlist/grail remove reads 'Remove {brand} {model} from your wishlist? You can add it back any time.' (original D-09 copy)"
    reason: "Code review CR-01 found the reassurance sentence factually wrong — removeWatch cascade-deletes wear history, likes, comments, and photos, so 'add it back any time' overstates recoverability. Operator accepted dropping the trailing sentence; 83-CONTEXT D-09 amended in place on 2026-09-12. Amended copy (no trailing sentence) is now the contract this verification checks against."
    accepted_by: "operator (via 83-REVIEW.md Resolution Log + 83-CONTEXT.md D-09 amendment)"
    accepted_at: "2026-09-12T00:00:00Z"
re_verification:
  previous_status: human_needed
  previous_score: 9/9
  gaps_closed:
    - "POLISH-03 delete-dialog copy now lives in the RENDERED component (WatchDetailHero.tsx, imported by src/app/w/[ref]/page.tsx), not only in the dead-island legacy WatchDetail.tsx that the initial verification incorrectly inspected."
  gaps_remaining:
    - "POLISH-03 mobile Safari re-walk on prod — the WatchDetailHero fix (commits 28a3a2b3, 23bcca75) is committed locally but not yet pushed to origin/main (branch is 9 commits ahead). 83-HUMAN-UAT.md test 2 failed against the currently-deployed prod build; it has not been re-walked since the fix landed."
  regressions: []
gaps: []
human_verification:
  - test: "On a mobile device (iPhone Safari) against PROD (after this branch is pushed and deployed), sign in as the owner of a wishlist or grail watch, navigate to /w/{id}, and tap the delete-dialog trigger."
    expected: "Trigger reads 'Remove from wishlist' (outline variant, not red). Dialog title reads 'Remove from wishlist'. Dialog body reads 'Remove {brand} {model} from your wishlist?' (no 'You can add it back any time' sentence — CR-01 amendment). Confirm button reads 'Remove from wishlist' (destructive variant). Cancel reads 'Cancel'. Opening an OWNED watch still shows destructive 'Delete' / 'Delete Watch' / 'This action cannot be undone.' unchanged."
    why_human: "83-HUMAN-UAT test 2 (POLISH-03) failed on the currently-deployed prod build because the original 83-03 fix only touched the dead-island legacy WatchDetail.tsx. The corrected fix (WatchDetailHero.tsx, commits 28a3a2b3 + 23bcca75) is verified at the code/test/build level in this repo but has not been pushed to origin/main yet, so it cannot be observed on prod. Per project rule feedback_mobile_ui_verify_on_prod, mobile-Safari behavior is verified on prod, not locally. This item must be re-walked after the branch is pushed and Vercel deploys it."
---

# Phase 83: Polish Sweep Verification Report

**Phase Goal:** Ship three small, low-risk UX cleanups that unblock the v9.0 pile before any schema work begins.
**Verified:** 2026-09-12
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plan 83-04 (WatchDetailHero fix + CR-01 copy amendment).

---

## Why This Re-Verification Exists

The initial verification (score 9/9, 2026-07-14) marked POLISH-03 VERIFIED by inspecting `src/components/watch/WatchDetail.tsx`. That file is a **dead island** — `/w/[ref]/page.tsx` has rendered `WatchDetailHero.tsx` since Phase 64 (D-02/D-09), and the only remaining consumer of `WatchDetail.tsx` is a chronometer-row test. The initial verification never traced the import from the actual route, so it certified a fix that users could never see. `83-HUMAN-UAT.md` test 2 caught this on prod ("on my wishlist, i still see 'delete' instead of 'remove from wishlist'"). Plan 83-04 closed the gap by porting the fix into the live component; a code review (`83-REVIEW.md`) then found the original softened copy's reassurance sentence was factually wrong given `removeWatch`'s cascade-delete behavior (CR-01), and the operator resolved it by dropping the sentence, amending `83-CONTEXT.md` D-09 in place.

This re-verification traces the render path itself rather than trusting the plan's stated target file, per this task's explicit instruction.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On the desktop top nav (≥md viewport), the user does NOT see a `+` add-watch icon-button. | VERIFIED | `grep -c 'Plus\|aria-label="Add watch"\|/watch/new' src/components/layout/DesktopTopNav.tsx` = 0 (re-confirmed unchanged since initial verification). |
| 2 | `DesktopTopNav.test.tsx` reflects the removal (no add-watch link assertions; 12 tests, not 13). | VERIFIED | `npx vitest run tests/components/layout/DesktopTopNav.test.tsx` → 12/12 passed. |
| 3 | `WornTabContent`'s `watchOptions` (feeding both the events-filter Select and `LogTodaysWearButton`) derives from `ownedWatches`, not `Object.values(watchMap)`; `watchMap` stays complete for timeline rendering. | VERIFIED | `WornTabContent.tsx:70-78`: `useMemo(() => ownedWatches...`, dep array `[ownedWatches]`. `watchMap={watchMap}` still passed at lines 162/164 to `WornTimeline`/`WornCalendar`. `watchOptions` feeds `LogTodaysWearButton` (line 159) and the filter Select (line 151). |
| 4 | The rendered `/w/[ref]` route imports `WatchDetailHero`, not the legacy `WatchDetail`. | VERIFIED | `grep -n "WatchDetailHero\|WatchDetail'" "src/app/w/[ref]/page.tsx"` — `import { WatchDetailHero } from '@/components/watch/WatchDetailHero'` at line 21; rendered at lines 347 and 603; zero imports of legacy `WatchDetail`. |
| 5 | In `WatchDetailHero.tsx` (the live component), the delete-dialog trigger, title, and confirm button all branch on `isWishlistLike`: `Remove from wishlist` / `outline` for wishlist+grail, `Delete` / `destructive` for owned. | VERIFIED | Lines 380-409: trigger `variant={isWishlistLike ? 'outline' : 'destructive'}` / label ternary; title ternary line 388; confirm button ternary line 409, `variant="destructive"` unchanged (D-09/D-10). |
| 6 | Dialog body copy matches the amended D-09 contract: wishlist/grail = `Remove {brand} {model} from your wishlist?` (no reassurance sentence); owned = unchanged `Are you sure you want to delete {brand} {model}? This action cannot be undone.` | VERIFIED | Lines 391-393: `` `Remove ${watch.brand} ${watch.model} from your wishlist?` `` (no trailing sentence) vs. unchanged owned branch. `grep -c 'You can add it back any time' src/components/watch/WatchDetailHero.tsx` = 0. |
| 7 | `handleDelete`, `removeWatch(watch.id)`, `isDeleteDialogOpen`, and `isWishlistLike` derivation in `WatchDetailHero.tsx` are unchanged by the copy fix. | VERIFIED | Lines 140/142/144/146 unchanged from pre-83-04 shape; `grep -c 'const isWishlistLike'` = 1, `grep -c 'removeWatch(watch.id)'` = 1. |
| 8 | A component test renders the live `WatchDetailHero` (not the dead `WatchDetail`) and asserts wishlist, grail, owned, and non-owner branches, including the amended (no-reassurance-sentence) copy. | VERIFIED | `tests/components/watch/WatchDetailHero.removeCopy.test.tsx` imports `WatchDetailHero`; asserts `dialog.queryByText(/add it back/)).not.toBeInTheDocument()` (lines 89, 123) alongside the positive `Remove from wishlist` / `Remove {brand} {model} from your wishlist?` assertions. Ran: `npx vitest run tests/components/watch/WatchDetailHero.removeCopy.test.tsx` → 5/5 passed. |
| 9 | Legacy `src/components/watch/WatchDetail.tsx` was not modified by the gap-closure plan (out of scope, left as a documented dead-island follow-up). | VERIFIED | `git diff --stat c868740e -- src/components/watch/WatchDetail.tsx` reported empty in 83-04-SUMMARY; independently re-confirmed no `src/` importer references it (`WR-01` in `83-REVIEW.md`). |
| 10 | Full build compiles clean with the amended copy in place. | VERIFIED | `npm run build` → exit 0 (re-run in this verification session). |
| 11 | `npm run test` for the phase's touched suites is green (not just claimed in SUMMARY). | VERIFIED | `npx vitest run tests/components/watch/WatchDetailHero.removeCopy.test.tsx tests/components/layout/DesktopTopNav.test.tsx` → 17/17 passed (re-run in this verification session, independent of SUMMARY claims). |
| 12 | REQUIREMENTS.md correctly reflects POLISH-01/02/03 as Complete, and all three IDs are claimed by a plan in this phase (no orphans). | VERIFIED | `.planning/REQUIREMENTS.md:92-94` — all three rows "Complete". Plan frontmatter: 83-01→POLISH-01, 83-02→POLISH-02, 83-03 & 83-04→POLISH-03. No unclaimed Phase-83 IDs found. |

**Score:** 12/12 truths verified at the code/test/build level.

**Caveat:** Truth 5/6 (the corrected POLISH-03 behavior) is verified in this repository's working tree, but the fix has **not yet reached prod** — see Human Verification below.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/layout/DesktopTopNav.tsx` | No `+` add-watch button | VERIFIED | Unchanged since initial verification; regression-checked. |
| `src/components/profile/WornTabContent.tsx` | `watchOptions` from `ownedWatches`; `watchMap` intact | VERIFIED | Unchanged since initial verification; regression-checked. |
| `src/components/watch/WatchDetailHero.tsx` | **The live** delete-dialog component branches on `isWishlistLike` with amended (no-reassurance-sentence) copy | VERIFIED | This is the artifact the initial verification missed. Confirmed via direct read of lines 379-413 and via `src/app/w/[ref]/page.tsx` import trace. |
| `tests/components/watch/WatchDetailHero.removeCopy.test.tsx` | Regression test targeting the rendered component | VERIFIED | 5/5 passing; asserts both presence of new copy and absence of old copy and of the dropped reassurance sentence. |
| `src/components/watch/WatchDetail.tsx` (legacy) | Left untouched by 83-04; not the source of truth for the goal | VERIFIED (advisory) | Still contains the old (never-amended) copy including "You can add it back any time" at its own line ~314 — this is dead code with zero `src/` importers, so it does not affect goal achievement, but it is a live WARNING (see Anti-Patterns). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/w/[ref]/page.tsx` | `WatchDetailHero.tsx` | `import { WatchDetailHero } from '@/components/watch/WatchDetailHero'`, rendered at lines 347 & 603 | VERIFIED | Confirmed by direct grep and read — this is the render path the goal depends on. |
| `WatchDetailHero.tsx` `isWishlistLike` gate | DialogTrigger Button variant+label, DialogTitle, DialogDescription, confirm Button | Inline ternaries at lines 381-409 | VERIFIED | All four sites branch correctly, amended copy in place. |
| `tests/components/watch/WatchDetailHero.removeCopy.test.tsx` | `WatchDetailHero.tsx` | `import { WatchDetailHero } from '@/components/watch/WatchDetailHero'` | VERIFIED | Test imports the live component, not the dead one — closes the root-cause verification gap from the initial pass. |
| Local git branch (`main`, 9 commits ahead) | `origin/main` (prod deploy source) | `git push` | **NOT WIRED** | `git status` / `git log origin/main..HEAD` show the 83-04 fix commits (`28a3a2b3`, `23bcca75`) and preceding phase-83 work are local-only. Prod is still serving the pre-fix build that `83-HUMAN-UAT.md` test 2 failed against. |

---

### Data-Flow Trace (Level 4)

Not applicable — POLISH-03 is a pure copy/variant change keyed on the pre-existing `isWishlistLike` boolean computed from `watch.status`, already validated by build success and the component test's per-status fixtures (wishlist/grail/owned/non-owner all exercised).

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| POLISH-03 fix lives in the rendered component | `grep -c "import { WatchDetailHero }" "src/app/w/[ref]/page.tsx"` | 1 | PASS |
| POLISH-03 amended copy (no reassurance sentence) in live component | `grep -c 'You can add it back any time' src/components/watch/WatchDetailHero.tsx` | 0 | PASS |
| POLISH-03 amended copy matches test expectations | `npx vitest run tests/components/watch/WatchDetailHero.removeCopy.test.tsx` | 5/5 passed | PASS |
| POLISH-01 regression | `npx vitest run tests/components/layout/DesktopTopNav.test.tsx` | 12/12 passed | PASS |
| POLISH-02 regression (code inspection — no dedicated test file exists) | `grep -n "ownedWatches\|watchMap" src/components/profile/WornTabContent.tsx` | derivation intact, unchanged | PASS |
| Full build | `npm run build` | exit 0 | PASS |
| Local branch vs. prod | `git log origin/main..HEAD --oneline` | 9 commits ahead, including 83-04 fix | **FAIL for prod-parity** (expected — not yet pushed) |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/watch/WatchDetail.tsx` | ~303-330 | Dead component (zero `src/` importers) still carries the pre-CR-01, never-amended wishlist copy, including the reassurance sentence the operator explicitly rejected on the live component | ⚠️ WARNING | Does not affect the live UI or goal achievement (route never renders this file). Documented in `83-REVIEW.md` WR-01 and in the 83-04 SUMMARY's Follow-ups section as a known, accepted cleanup candidate — not a blocker for Phase 83, but a durable trap for the next person who greps for "Remove from wishlist" and finds two answers. |
| `src/app/actions/watches.ts` (via `removeWatch`) | 779-820 | `removeWatch` cascade-deletes wear events, likes, comments (incl. other users'), and photos on wishlist/grail removal — the softened UX (outline button, no destructive-red framing) does not visually distinguish this case from a truly reversible action | ℹ️ INFO (already resolved per operator decision) | This was CR-01 in `83-REVIEW.md`. The operator's resolution (drop the reassurance sentence, keep destructive confirm-button variant, keep outline trigger) is the accepted contract per the amended D-09 — not re-litigated here. Flagging only for completeness; not a gap. |
| `tests/components/watch/WatchDetailHero.removeCopy.test.tsx` | — | No case exercises the `sold` status branch or clicks confirm to assert `removeWatch` is called (per `83-REVIEW.md` IN-05) | ℹ️ INFO | Advisory test-coverage gap noted by code review, not required by any must-have; does not block phase goal. |

No debt markers (TBD, FIXME, XXX) found in any file modified by Phase 83.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| POLISH-01 | 83-01-PLAN | User no longer sees a `+` add-watch button in the desktop top nav | SATISFIED | `DesktopTopNav.tsx` — verified live, no regression. |
| POLISH-02 | 83-02-PLAN | User selecting "log a wear" watch dropdown on Worn tab sees only currently-owned watches | SATISFIED | `WornTabContent.tsx` — verified live, no regression. |
| POLISH-03 | 83-03-PLAN, 83-04-PLAN (gap closure) | User removing a watch from wishlist sees "Remove from wishlist" copy, not "Delete" | SATISFIED (code-level); **prod re-walk pending** | Live fix confirmed in `WatchDetailHero.tsx`, the component `/w/[ref]/page.tsx` actually renders. Amended per CR-01. Local commits not yet pushed to `origin/main` — prod still serves the pre-fix build. |

All three POLISH requirement IDs accounted for in plan frontmatter and REQUIREMENTS.md. No orphaned Phase-83 requirements.

---

### Human Verification Required

#### 1. POLISH-03 Mobile Dialog Copy — Re-walk on PROD after push

**Test:** After this branch (`main`, currently 9 commits ahead of `origin/main`) is pushed and Vercel deploys it, sign in on iPhone Safari against prod as the owner of a wishlist or grail watch. Navigate to `/w/{id}`. Tap the delete-dialog trigger.
**Expected:** Trigger reads "Remove from wishlist" (outline, not red). Dialog title reads "Remove from wishlist". Dialog body reads "Remove {brand} {model} from your wishlist?" — with NO "You can add it back any time" sentence (CR-01 amendment). Confirm button reads "Remove from wishlist" (destructive-styled). Cancel reads "Cancel". An OWNED watch's dialog is unchanged: "Delete" / "Delete Watch" / "This action cannot be undone." / destructive.
**Why human:** Per project rule `feedback_mobile_ui_verify_on_prod`, mobile-Safari behavior is verified on prod, not in local dev. `83-HUMAN-UAT.md` test 2 already failed once against the pre-fix prod build; this re-walk closes that loop against the corrected build. This item is scoped to POLISH-03 only — POLISH-01 and POLISH-02 already passed their prod UAT walk (`83-HUMAN-UAT.md` test 1, pass) and are not being re-requested.

---

### Gaps Summary

No code-level gaps remain. The single outstanding item is operational, not a code defect: the corrected POLISH-03 fix (commits `28a3a2b3`, `23bcca75`) exists and is verified in this working tree — component test passing, build clean, render-path traced from `page.tsx` through to the live `WatchDetailHero.tsx` — but it has not been pushed to `origin/main`, so it cannot yet be observed on the prod surface that mobile-Safari UAT is required to test against. Status is `human_needed`, not `gaps_found`, because there is no evidence of a code-level failure — only a pending deploy + re-walk step.

---

_Verified: 2026-09-12_
_Verifier: Claude (gsd-verifier)_

## Human Verification Outcome

- 2026-09-12: 83-HUMAN-UAT test 2 (POLISH-03) re-walked on prod iPhone Safari after push of 23bcca75 — **pass**. Test 1 (POLISH-02) passed earlier the same day. All human items resolved; status → passed.
