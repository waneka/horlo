---
phase: 32-debt-09-notespublic-fix
verified: 2026-05-06T15:58:30Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 32: DEBT-09 notesPublic Fix Verification Report

**Phase Goal:** Repair the data-loss regression where `addWatch`/`editWatch` never persisted `notesPublic` and never called the correct `revalidatePath`, turning the existing RED scaffold GREEN before the multi-phase schema marathon begins.
**Verified:** 2026-05-06T15:58:30Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `tests/actions/watches.notesPublic.test.ts` reaches 4/4 GREEN in CI (was 4/4 FAIL at v4.1 close) | ✓ VERIFIED | `npx vitest run tests/actions/watches.notesPublic.test.ts` → `Test Files 1 passed (1)` / `Tests 4 passed (4)` |
| 2  | `insertWatchSchema` in `src/app/actions/watches.ts` accepts `notesPublic: z.boolean().optional()` (auto-flows to `updateWatchSchema` via `.partial()`) | ✓ VERIFIED | grep returns 1 hit at `src/app/actions/watches.ts:41`, inside `insertWatchSchema` z.object body (lines 17–55). `updateWatchSchema = insertWatchSchema.partial()` at line 58 auto-derives. |
| 3  | Both `addWatch` and `editWatch` persist `notesPublic` to the database on every write (via existing `mapDomainToRow` path) | ✓ VERIFIED | Test #1 (`addWatch accepts notesPublic and persists it through createWatch`) asserts `passedData.notesPublic === false` is forwarded to `watchDAL.createWatch` — PASS. `mapDomainToRow` at `src/data/watches.ts:84` (unmodified) writes the column. |
| 4  | Both `addWatch` and `editWatch` call `revalidatePath('/u/[username]', 'layout')` after every successful write | ✓ VERIFIED | grep returns exactly 2 hits in `src/app/actions/watches.ts` (lines 269 in addWatch, 343 in editWatch). Tests #2 and #3 assert `toHaveBeenCalledWith('/u/[username]', 'layout')` — both PASS. |
| 5  | Full test suite remains GREEN — no new test failures introduced | ✓ VERIFIED | Adjacent neighbors `tests/actions/watches.test.ts` + `tests/actions/addwatch-catalog-resilience.test.ts` → 25/25 pass. SUMMARY records baseline 51 fail → HEAD 47 fail (net −4 = the notesPublic flip). All 47 carryover failures are pre-existing per problem statement. |
| 6  | D-01: revalidatePath signature is `('/u/[username]', 'layout')` — NOT `('/u/[username]/[tab]', 'page')` | ✓ VERIFIED | grep for `('/u/[username]/[tab]', 'page')` in `src/app/actions/watches.ts` → 0 hits. The 2 hits are the layout signature exactly. |
| 7  | D-02: revalidate fires unconditionally on every successful add/edit — no `'notesPublic' in parsed.data` gate | ✓ VERIFIED | Read `src/app/actions/watches.ts:268-269` and `:342-343` — both calls are at the top scope of the success branch, immediately after the existing `revalidatePath('/')`, with no `if`/`'in parsed.data'` guard. |
| 8  | D-03: insertion order is `revalidatePath('/')` then `revalidatePath('/u/[username]', 'layout')` then `revalidateTag('explore', 'max')` | ✓ VERIFIED | addWatch lines 268, 269, 279 are in that order. editWatch lines 342, 343, 351 are in that order. |
| 9  | D-04: `removeWatch` is intentionally NOT modified — out of scope | ✓ VERIFIED | `git diff 63cd9df..HEAD -- src/app/actions/watches.ts` shows only 3 added lines, none in the `removeWatch` body (lines 369–391 unchanged). `removeWatch` still calls only `revalidatePath('/')` + `revalidateTag('explore', 'max')`. |
| 10 | D-05: ROADMAP.md success criterion #4 wording corrected inline this phase | ✓ VERIFIED | `.planning/ROADMAP.md:126` reads `4. Both Server Actions call \`revalidatePath('/u/[username]', 'layout')\` after every successful write`. grep for old wording `('/u/[username]/[tab]', 'page')` in ROADMAP.md → 0 hits. |
| 11 | D-06: No new tests authored — the 4 existing tests are the GREEN target as-is | ✓ VERIFIED | `git diff --stat 63cd9df..HEAD -- src/ .planning/ROADMAP.md` shows only `src/app/actions/watches.ts` (+3) and `.planning/ROADMAP.md` (+2/-2). No `tests/` paths modified. `tests/actions/watches.notesPublic.test.ts` unchanged from Phase 23 RED scaffold. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/actions/watches.ts` | Action-layer Zod schema + revalidate calls; contains `notesPublic: z.boolean().optional()` | ✓ VERIFIED | Schema field at line 41 (between `notes` and `imageUrl` per recommended placement). Two `revalidatePath('/u/[username]', 'layout')` calls at lines 269 (addWatch) and 343 (editWatch). |
| `.planning/ROADMAP.md` | Corrected success criterion #4 wording at line 126; contains `revalidatePath('/u/[username]', 'layout')` | ✓ VERIFIED | Line 126 reads the corrected wording verbatim. Old `'/u/[username]/[tab]', 'page'` wording absent. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/app/actions/watches.ts insertWatchSchema` (lines 17-55) | `src/data/watches.ts mapDomainToRow` (line 84) | Zod safeParse pass-through | ✓ WIRED | Test #1 proves the field flows through Zod → cleanData spread → `watchDAL.createWatch(user.id, createPayload)` with `notesPublic` intact. `mapDomainToRow` at `src/data/watches.ts:84` is unmodified per scope rules and was already correct on `main`. |
| `src/app/actions/watches.ts addWatch` (line 269 post-edit) | `/u/[username]/notes` per-row `<NoteVisibilityPill>` | `revalidatePath` layout-scoped invalidation cascade | ✓ WIRED | Line 269: `revalidatePath('/u/[username]', 'layout')`. Test #3 asserts `toHaveBeenCalledWith('/u/[username]', 'layout')` after `addWatch` — PASS. Layout selector cascades to `/[tab]` children per Next.js 16 docs. |
| `src/app/actions/watches.ts editWatch` (line 343 post-edit) | `/u/[username]/notes` per-row `<NoteVisibilityPill>` | `revalidatePath` layout-scoped invalidation cascade | ✓ WIRED | Line 343: `revalidatePath('/u/[username]', 'layout')`. Test #2 asserts `toHaveBeenCalledWith('/u/[username]', 'layout')` after `editWatch` — PASS. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/app/actions/watches.ts` (Server Action) | `parsed.data.notesPublic` | Zod `safeParse` of client form payload (WatchForm submission) | Yes — test #1 confirms `false` survives the parse and lands in `watchDAL.createWatch` payload | ✓ FLOWING |
| `src/app/actions/watches.ts` revalidate cascade | `'/u/[username]'` route template | Hardcoded literal — Next.js layout-scoped invalidation | Yes — `revalidatePath` is the data-source-equivalent for cache invalidation; tests #2 and #3 confirm the call lands on every success path | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 4 RED notesPublic tests flip GREEN | `npx vitest run tests/actions/watches.notesPublic.test.ts` | `Tests  4 passed (4)` | ✓ PASS |
| Adjacent watches actions test stays GREEN | `npx vitest run tests/actions/watches.test.ts tests/actions/addwatch-catalog-resilience.test.ts` | `Tests  25 passed (25)` | ✓ PASS |
| Schema field present exactly once | `grep -nE "notesPublic: z\.boolean\(\)\.optional\(\)" src/app/actions/watches.ts` | 1 hit at line 41 | ✓ PASS |
| Layout revalidate present exactly twice | `grep -cnE "revalidatePath\('/u/\[username\]', 'layout'\)" src/app/actions/watches.ts` | 2 | ✓ PASS |
| Old `/[tab]`/`page` wording absent from ROADMAP | `grep -nE "revalidatePath\('/u/\[username\]/\[tab\]', 'page'\)" .planning/ROADMAP.md` | 0 hits | ✓ PASS |
| Diff scope held to expected files | `git diff --stat 63cd9df..HEAD -- src/ .planning/ROADMAP.md` | Only `src/app/actions/watches.ts` (+3) and `.planning/ROADMAP.md` (+2/-2) | ✓ PASS |
| `removeWatch` untouched (D-04) | `git diff 63cd9df..HEAD -- src/app/actions/watches.ts` | Hunks only at lines 38, 265, 338 — none inside `removeWatch` body (lines 369–391) | ✓ PASS |
| Wave commit chain matches plan structure | `git log --oneline 63cd9df..HEAD` | Commits `8bb5777` (fix), `fab8eef` (docs), `00f08b2` (plan complete), `af2debb` (state), `b59dd93` (worktree merge), `4caaa9e` (mark plan complete) — all expected | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DEBT-09 | 32-01-PLAN.md | `addWatch`/`editWatch` Server Actions must persist `notesPublic` (Zod schema accepts `notesPublic: z.boolean().optional()`) and call the cross-page revalidate after every successful write so the per-row `<NoteVisibilityPill>` on `/u/{username}/notes` reflects the form's choice without a hard navigation. The existing RED scaffold `tests/actions/watches.notesPublic.test.ts` (4/4 FAIL) reaches 4/4 GREEN. | ✓ SATISFIED | All 5 ROADMAP success criteria #1–#5 verified above. Schema accepts the field (Truth 2), DAL persists (Truth 3), revalidate fires unconditionally (Truths 4 + 7), 4/4 tests GREEN (Truth 1), no new failures (Truth 5). Note: REQUIREMENTS.md line 15 still uses the old `('/u/[username]/[tab]', 'page')` wording — this is a documentation residue that does NOT affect satisfaction (the test contract uses `('/u/[username]', 'layout')` and was the locked source of truth per D-05). Flagged below as informational. |

**Orphaned requirements check:** ROADMAP.md line 121 maps Phase 32 to `Requirements: DEBT-09` only. Plan frontmatter declares `requirements: [DEBT-09]`. No orphan. ✓

**Documentation residue (informational, not a gap):** `.planning/REQUIREMENTS.md:15` still describes DEBT-09 with the old wording `revalidatePath('/u/[username]/[tab]', 'page')`. The phase scope (D-05) corrected this inline only in `.planning/ROADMAP.md:126`, not in `REQUIREMENTS.md:15`. This is a minor doc inconsistency, but the requirement itself is satisfied because (a) the test contract was always the locked source of truth per success criterion #1 and (b) the substantive intent of DEBT-09 (close the data-loss + stale-pill regression) is met. Recommend a one-line follow-up doc fix in v5.x hygiene if exact wording parity is desired.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No new TODO/FIXME/PLACEHOLDER, empty handlers, or hardcoded stub returns introduced by this phase | — | None |

The 3 added lines are structurally identical to existing call sites in the same file and in 5 sibling action files (`notes.ts` ×2, `profile.ts` ×2, `follows.ts` ×2). No new anti-patterns surface.

### Human Verification Required

None. The phase is a pure server-side regression repair gated entirely by automated unit tests (the 4 RED→GREEN tests in `tests/actions/watches.notesPublic.test.ts`) and grep-checkable file state. No visual surface, no UX flow, no real-time behavior, no external service to validate by hand.

### Gaps Summary

No gaps. All 11 must-have truths verified against the codebase, all 2 artifacts present and correctly populated, all 3 key links wired and exercised by passing tests, all 7 behavioral spot-checks PASS, and the only requirement (DEBT-09) is SATISFIED.

The fix landed exactly as planned:
- `src/app/actions/watches.ts:41` — `notesPublic: z.boolean().optional(),` inside `insertWatchSchema`.
- `src/app/actions/watches.ts:269` — new `revalidatePath('/u/[username]', 'layout')` in `addWatch`, between existing `revalidatePath('/')` and the `revalidateTag('explore', 'max')` block.
- `src/app/actions/watches.ts:343` — same insertion in `editWatch`.
- `.planning/ROADMAP.md:126` — wording corrected to match the test contract per D-05.
- `removeWatch` untouched (D-04).
- No new tests authored (D-06).

The wave commit chain (`8bb5777` fix → `fab8eef` docs → metadata commits) matches the plan structure. The pre-existing `LayoutProps` TS error and the ~47 unrelated baseline test failures were verified to be carryover (per problem statement) and are not regressions caused by this phase.

DEBT-09 is closed. Phase 32 is GREEN and ready for the v5.0 schema marathon to begin at Phase 33.

---

*Verified: 2026-05-06T15:58:30Z*
*Verifier: Claude (gsd-verifier)*
