---
phase: 76-video-schema-storage-paths-server-action
plan: 02
subsystem: storage
tags: [storage, utility, client-direct-upload, video, wear-events]

requires:
  - phase: 11-wywt-server-actions-photos-uploads
    provides: existing `src/lib/storage/wearPhotos.ts` with `buildWearPhotoPath` (analog template) + `UUID_RE` constant + `'use client'` directive — extended in place, not replaced.
  - phase: 76-01
    provides: `mediaTypeEnum` + `media_path` / `poster_path` columns + DB CHECK gate — the DB-layer contract these client builders compose strings for.
provides:
  - `buildWearVideoPath(userId, wearEventId): string` returning `${userId}/${wearEventId}.mp4`
  - `buildWearPosterPath(userId, wearEventId): string` returning `${userId}/${wearEventId}-poster.jpg`
  - Both throw `TypeError` on falsy `userId` or non-UUID `wearEventId` (mirrors `buildWearPhotoPath` contract for VID-15 parity)
  - 6 unit tests proving the contract end-to-end (happy + 2 throw cases per builder)
affects: [phase-76-03, phase-77-wywt-capture-ui]

tech-stack:
  added: []
  patterns:
    - "Reuse-not-redeclare for shared validation constants (UUID_RE on src/lib/storage/wearPhotos.ts:21 is the single source — both new builders consume it; matches the existing buildWearPhotoPath at line 28)"
    - "Mirror analog template verbatim, change suffix only (buildWearPhotoPath → buildWearVideoPath / buildWearPosterPath — same guard sequence, same TypeError messages, only the return-string suffix differs — minimizes review surface)"
    - "JSDoc /** @throws TypeError when ... */ on each exported builder matches the style at buildWearPhotoPath lines 23-27"
    - "Defense in depth — client-side ergonomic helpers ONLY; Plan 03 Server Action re-derives the same strings from `getCurrentUser().id` and never trusts a client-supplied path (T-15-17 / VID-16)"

key-files:
  created:
    - tests/unit/buildWearVideoPath.test.ts
    - .planning/phases/76-video-schema-storage-paths-server-action/76-02-SUMMARY.md
  modified:
    - src/lib/storage/wearPhotos.ts

key-decisions:
  - "Insert the two new builders between `buildWearPhotoPath` and `uploadWearPhoto` (not at end-of-file) — keeps all path-builders grouped above the upload helper, matching the implicit 'compose-then-act' file layout the analog established in Phase 15."
  - "Plain `export function` (not `const + arrow`) — matches `buildWearPhotoPath` style exactly; lets TypeScript hoist the symbol so Plan 03 + Phase 77 imports do not depend on file ordering."
  - "Single-line JSDoc summary + `@throws` tag per builder — same shape as `buildWearPhotoPath`. No need to repeat the broader file-level comment block (lines 3-15) which already covers the path convention and RLS reference."
  - "Pure-unit test file (no Next imports, no mocks, no env-gating) — these are deterministic primitive-string functions; jsdom (vitest default) is sufficient; no `@vitest-environment node` pragma needed."

patterns-established:
  - "Path-builder family in src/lib/storage/wearPhotos.ts now grows as `buildWear<Media>Path` — future media kinds (e.g., burst, alt-angle) should follow `buildWear<Kind>Path(userId, wearEventId): string` with the same UUID_RE guard and the same TypeError contract. Suffix is the only thing that varies."

requirements-completed: [VID-07, VID-16]

duration: ~10min
completed: 2026-06-22
---

# Phase 76 Plan 02: Storage Path Builders for Video + Poster Summary

**Two new client-side Storage path builders — `buildWearVideoPath` and `buildWearPosterPath` — appended to `src/lib/storage/wearPhotos.ts` so Phase 77's client-direct upload helper can compose `${userId}/${wearEventId}.mp4` and `${userId}/${wearEventId}-poster.jpg` without inline string composition. Plan 03's Server Action re-derives the same strings independently from `getCurrentUser().id`, so a tampered client cannot poison the DB row's path columns (VID-16 defense in depth).**

## Performance

- **Duration:** ~10 min (single-agent atomic run)
- **Started:** 2026-06-22T17:20Z (Task 1 edit)
- **Completed:** 2026-06-22T17:23Z (Task 2 commit)
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files modified:** 1 (`src/lib/storage/wearPhotos.ts`)
- **Files created:** 1 (`tests/unit/buildWearVideoPath.test.ts`)

## Accomplishments

- Appended `buildWearVideoPath(userId, wearEventId)` and `buildWearPosterPath(userId, wearEventId)` to `src/lib/storage/wearPhotos.ts` immediately after `buildWearPhotoPath`. Both reuse the existing `UUID_RE` constant on line 21 (no duplicate regex) and both throw `TypeError` on falsy `userId` (`'userId required'`) or non-UUID `wearEventId` (`'wearEventId must be a UUID'`), matching the analog's contract verbatim.
- Authored `tests/unit/buildWearVideoPath.test.ts` — 2 describe blocks × 3 `it` cases = 6 deterministic unit tests covering happy path + both throw cases per builder. No mocks, no env vars, no Next imports. Pure-string assertions on the exact return values.
- Preserved `buildWearPhotoPath` and `uploadWearPhoto` byte-for-byte — VID-15 regression guard intact (`grep -c "export function buildWearPhotoPath"` still returns 1, `grep -c "export async function uploadWearPhoto"` still returns 1).
- Preserved the `'use client'` directive on line 1 — these builders run in the Phase 77 ComposeStep (a client component) alongside the existing `uploadWearPhoto` helper.

## Task Commits

Each task was committed atomically:

1. **Task 1: Append buildWearVideoPath + buildWearPosterPath to src/lib/storage/wearPhotos.ts** — `011d6e52` (feat)
2. **Task 2: Write tests/unit/buildWearVideoPath.test.ts — 6 unit cases** — `7d110d0d` (test)

**Plan metadata commit:** (this commit — `docs(76-02)`)

## Files Created/Modified

- `src/lib/storage/wearPhotos.ts` — added 36 lines between `buildWearPhotoPath` (line 39) and the JSDoc block above `uploadWearPhoto` (now shifted from line 41 → line 77). Two new `export function`s with single-line JSDoc + `@throws` tag. Zero changes to the import block, `UploadResult` type, `UUID_RE` constant, `buildWearPhotoPath`, or `uploadWearPhoto`.
- `tests/unit/buildWearVideoPath.test.ts` — 48 lines; imports `vitest` (`describe, it, expect`) + the two new builders from `@/lib/storage/wearPhotos`; two `const`s for fixture inputs (`VALID_UUID`, `USER_ID`); 2 describe blocks named `'buildWearVideoPath (VID-07 / VID-16 client-side helper)'` and `'buildWearPosterPath (VID-07 / VID-16 client-side helper)'`; 3 `it` cases per block (returns-exact-string, throws-on-empty-userId, throws-on-non-uuid).

## Decisions Made

See `key-decisions` in frontmatter. Most notable runtime decisions:

1. **No new shared utility extracted for the guard sequence.** The 4-line guard (`if (!userId) throw ...; if (!UUID_RE.test(wearEventId)) throw ...`) is duplicated across all 3 builders. Considered extracting `assertValidPathInputs(userId, wearEventId)`, but rejected because (a) only 3 callsites, (b) inlined guards keep the `@throws` JSDoc co-located with the assertion that backs it, (c) extracting a helper would require modifying the existing `buildWearPhotoPath` — out of scope for this plan and a VID-15 regression risk.
2. **Plain string-equality tests (no path-shape regex matcher).** Considered `expect(...).toMatch(/^[\w-]+\/[\w-]+\.mp4$/)` for resilience to "any valid path", but `.toBe()` against the exact expected string is the stronger contract — it would also catch a typo like `.mp4` → `.MP4`. The cost (must update the test if the path shape ever changes) is acceptable since the path shape IS the contract.

## Deviations from Plan

None — plan executed exactly as written. Both verify blocks (Task 1 + Task 2) passed on first run with no auto-fixes needed.

(One cosmetic note: the Task 1 verify block contained a `grep -c "return \`\${userId}/\${wearEventId}.mp4\`"` invocation whose backtick-and-`$`-escaping confused the bash interpreter and returned `0`. The grep was rerun without nested-quote escaping — `grep -n 'wearEventId.*mp4'` — which confirmed the line was correctly placed at line 56 of the post-edit file. The build succeeded with "Compiled successfully in 6.0s", so the file was correctly written; only the verify-block grep command had a shell-quoting issue, not the plan's underlying claim. Recording for future plan authors: use single-quoted greps with `.*` for template-literal pattern checks rather than nested backticks + `\$`.)

## Issues Encountered

None.

## Verification

- ✅ `npm run build` exits 0 — "Compiled successfully in 6.0s" (the gate per durable memory `project_baseline_not_green_build_is_gate`)
- ✅ `grep -c "export function buildWearVideoPath" src/lib/storage/wearPhotos.ts` returns 1
- ✅ `grep -c "export function buildWearPosterPath" src/lib/storage/wearPhotos.ts` returns 1
- ✅ `grep -c "export function buildWearPhotoPath" src/lib/storage/wearPhotos.ts` returns 1 (VID-15 regression guard — unchanged)
- ✅ `grep -c "const UUID_RE = " src/lib/storage/wearPhotos.ts` returns 1 (constant reused, not redeclared)
- ✅ `grep -c "use client" src/lib/storage/wearPhotos.ts` returns 1 (directive preserved on line 1)
- ✅ `grep -c "export async function uploadWearPhoto" src/lib/storage/wearPhotos.ts` returns 1 (analog preserved)
- ✅ `npx vitest run tests/unit/buildWearVideoPath.test.ts` exits 0 — `Test Files 1 passed (1) / Tests 6 passed (6)` in 691ms (transform 22ms, tests 2ms)
- ✅ Both new builders verified by hand-calling logic equivalent to the test cases (e.g., `buildWearVideoPath('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', '11111111-1111-4111-8111-111111111111')` returns the exact expected string `'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/11111111-1111-4111-8111-111111111111.mp4'`)

## Self-Check: PASSED

- ✅ `.planning/phases/76-video-schema-storage-paths-server-action/76-02-SUMMARY.md` — this file (written, will commit)
- ✅ `src/lib/storage/wearPhotos.ts` modified — `git show 011d6e52 --stat` confirms `1 file changed, 36 insertions(+)`
- ✅ `tests/unit/buildWearVideoPath.test.ts` created — `git show 7d110d0d --stat` confirms `1 file changed, 48 insertions(+)`
- ✅ Commit `011d6e52` (Task 1) present in `git log --oneline | head -3`
- ✅ Commit `7d110d0d` (Task 2) present in `git log --oneline | head -3`
- ✅ Both commits use the conventional `<type>(76-02): ...` prefix
