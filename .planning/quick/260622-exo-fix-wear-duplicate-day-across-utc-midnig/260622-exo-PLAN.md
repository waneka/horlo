---
phase: quick-260622-exo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/wear.ts
  - src/app/actions/wearEvents.ts
  - src/components/home/WatchPickerDialog.tsx
  - src/components/wywt/WywtPostDialog.tsx
  - src/components/wywt/ComposeStep.tsx
  - src/components/profile/LogTodaysWearButton.tsx
  - src/components/watch/WatchDetail.tsx
  - src/components/watch/WatchDetailHero.tsx
  - tests/integration/phase15-wywt-photo-flow.test.ts
autonomous: true
requirements: [WR-02-FIX]
tags: [wear-events, timezone, server-actions]
must_haves:
  truths:
    - "ROOT CAUSE: src/lib/wear.ts:todayLocalISO() reads new Date().getFullYear/Month/Date() — those return the SERVER process's local calendar day, which is UTC on Vercel. Server Actions markAsWorn + logWearWithPhoto previously called this helper on the server, so a wear logged at 11:55 PM PT (UTC=next day) and one logged at 12:05 AM PT the FOLLOWING night (still UTC=next day) both serialized to the SAME wornDate and tripped the UNIQUE(user_id, watch_id, worn_date) constraint with 'Already logged this watch today'."
    - "FIX: thread the client's local calendar day (already correctly computed by todayLocalISO() in the browser) into both markAsWorn and logWearWithPhoto Server Actions as an explicit `today: string` argument; the server uses the client-supplied value instead of calling todayLocalISO() itself."
    - "TRUST MODEL — client-supplied `today`: T-X-01 (tampering): a malicious client can submit an arbitrary date matching /^\\d{4}-\\d{2}-\\d{2}$/. The DB UNIQUE(user_id, watch_id, worn_date) constraint still gates duplicate inserts at the row level, so a tampered `today` can only let the caller (a) log on a calendar day other than today (low-value: it logs against themselves, no PII leak, no cross-user effect) or (b) collide on some future legitimate insert. Mitigation: server-side regex validation `z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/)` already used by preflightSchema — extend the same regex to the new schemas. Accept residual risk: this is a single-user wear-logging surface; the value can already be 'wrong' if the user changes their device clock, so trusting the device clock is consistent with the existing client-side todayLocalISO() flow."
    - "TRUST MODEL — T-X-02 (replay/duplicate): the DB UNIQUE constraint is the canonical gate. Client-supplied `today` cannot bypass it; in the worst case a tampered `today` simply shifts WHICH (user_id, watch_id, worn_date) tuple collides — never elevates privilege or leaks data."
    - "todayLocalISO() in src/lib/wear.ts stays exported and unchanged in behavior — it is correct on the CLIENT. The doc comment is updated to flag that any new server-side caller MUST receive `today` from the client and validate it; calling todayLocalISO() inside a Server Action body is now a known bug."
    - "Callers covered (verified by grep markAsWorn|logWearWithPhoto src/): markAsWorn — WatchPickerDialog.tsx (handleSubmit fallback path when onWatchSelected is omitted), LogTodaysWearButton.tsx (profile quick-log), WatchDetail.tsx (handleMarkAsWorn), WatchDetailHero.tsx (handleMarkAsWorn); logWearWithPhoto — ComposeStep.tsx (handleSubmit, the WYWT post path)."
    - "NavWearButton.tsx does NOT call markAsWorn or logWearWithPhoto directly — it lazy-loads WywtPostDialog, which routes the eventual submit through ComposeStep. No change needed there."
  artifacts:
    - path: "src/app/actions/wearEvents.ts"
      provides: "markAsWorn accepts (watchId, today) with zod-validated `today`; logWearWithPhoto schema gains `today` field; both use the client-supplied value instead of calling todayLocalISO() server-side"
      contains: "today: z.string().regex"
    - path: "src/lib/wear.ts"
      provides: "todayLocalISO() unchanged in behavior; doc comment updated to flag server-side bug"
    - path: "src/components/wywt/ComposeStep.tsx"
      provides: "passes today: todayLocalISO() to logWearWithPhoto"
    - path: "src/components/home/WatchPickerDialog.tsx"
      provides: "passes today to markAsWorn on the fallback (non-WYWT) path"
    - path: "src/components/profile/LogTodaysWearButton.tsx"
      provides: "passes today to markAsWorn"
    - path: "src/components/watch/WatchDetail.tsx"
      provides: "passes today to markAsWorn"
    - path: "src/components/watch/WatchDetailHero.tsx"
      provides: "passes today to markAsWorn"
    - path: "tests/integration/phase15-wywt-photo-flow.test.ts"
      provides: "Test 20 (duplicate-day) updated to pass `today: date` explicitly; clock-stubbing block removed since server no longer reads its own clock"
  key_links:
    - from: "Client (5 sites)"
      to: "Server Action (markAsWorn / logWearWithPhoto)"
      via: "explicit `today: string` argument computed by todayLocalISO() in the browser"
      pattern: "today: todayLocalISO\\(\\)"
    - from: "Server Action input"
      to: "DB INSERT wornDate"
      via: "zod regex validation /^\\d{4}-\\d{2}-\\d{2}$/, then forwarded to wearEventDAL.logWearEvent / logWearEventWithPhoto"
      pattern: "today: z\\.string\\(\\)\\.regex"
---

<objective>
Fix the wear-event "Already logged this watch today" false positive that fires for any user whose local timezone is behind UTC and who logs wears within ~24h on either side of UTC midnight (e.g. 11:55 PM PT one night, 12:05 AM PT the NEXT night — both serialize to the same UTC date).

Root cause (from root_cause_context + verified read of src/lib/wear.ts + src/app/actions/wearEvents.ts):
- `todayLocalISO()` uses `new Date().getFullYear/Month/Date()`, which read the PROCESS's local calendar day.
- On the CLIENT this is the user's local zone (correct).
- On the SERVER (Vercel) this is UTC (wrong for any non-UTC user near the boundary).
- Both Server Actions (`markAsWorn` at line 41, `logWearWithPhoto` at line 172) call `todayLocalISO()` server-side, so they use UTC. The DB constraint `UNIQUE(user_id, watch_id, worn_date)` then trips with PG 23505, surfaced as `Already logged this watch today`.

Fix (minimal, surgical):
1. Add `today` to the input shape of `markAsWorn` and `logWearWithPhoto`, validated by the same regex already used by `preflightSchema` (`/^\d{4}-\d{2}-\d{2}$/`).
2. Update 5 caller sites to pass `todayLocalISO()` from the browser. (NavWearButton does NOT call these directly — its trigger goes through `WywtPostDialog` → `ComposeStep`, which is one of the 5 sites.)
3. Stop calling `todayLocalISO()` inside Server Action bodies. Update the doc comment in `src/lib/wear.ts` to flag this as a known bug for any future server-side caller.
4. Update the one integration test (Test 20) that previously pinned `vi.setSystemTime` to force a duplicate-day collision — pass `today: date` explicitly instead, which is closer to the production code path and survives without clock-stubbing.

Purpose: Eliminate the duplicate-day false positive across the UTC day boundary for all non-UTC users. No schema change. No new dependency. ~7 file diffs, all surgical.

Output: Two atomic commits (Task 1: server-side schema + helper doc; Task 2: 5 caller updates + 1 test update).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@AGENTS.md

# Buggy helper + comment to update
@src/lib/wear.ts

# Server Actions — the two that need `today` threaded in
@src/app/actions/wearEvents.ts

# Caller sites (5 total — all of these import markAsWorn or logWearWithPhoto)
@src/components/home/WatchPickerDialog.tsx
@src/components/wywt/WywtPostDialog.tsx
@src/components/wywt/ComposeStep.tsx
@src/components/profile/LogTodaysWearButton.tsx
@src/components/watch/WatchDetail.tsx
@src/components/watch/WatchDetailHero.tsx

# Not a direct caller, but it OWNS the trigger that opens WywtPostDialog → ComposeStep
@src/components/layout/NavWearButton.tsx

# Integration test with one assertion that needs adjustment
@tests/integration/phase15-wywt-photo-flow.test.ts

<interfaces>
<!-- Current shapes (pre-fix) — extracted from src/app/actions/wearEvents.ts -->

```typescript
// markAsWorn — current signature (lines 17, 41)
export async function markAsWorn(watchId: string): Promise<ActionResult<void>>
// Internally: const today = todayLocalISO()  // ← runs on server → UTC

// logWearWithPhoto — current input shape (line 84-90, 172)
const logWearWithPhotoSchema = z.object({
  wearEventId: z.string().uuid(),
  watchId: z.string().uuid(),
  note: z.string().max(200).nullable(),
  visibility: z.enum(['public', 'followers', 'private']),
  hasPhoto: z.boolean(),
})
// Internally: const today = todayLocalISO()  // ← same bug

// preflightSchema — already has the regex we will reuse (line 92-95)
const preflightSchema = z.object({
  userId: z.string().uuid(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// Client helper (browser-correct, server-buggy) — src/lib/wear.ts:32
export function todayLocalISO(now: Date = new Date()): string
```

<!-- Target shapes (post-fix) -->

```typescript
// markAsWorn — new signature (add second arg `today`)
export async function markAsWorn(
  watchId: string,
  today: string,           // YYYY-MM-DD, must match /^\d{4}-\d{2}-\d{2}$/
): Promise<ActionResult<void>>

// logWearWithPhoto — new input shape (add `today` field)
const logWearWithPhotoSchema = z.object({
  wearEventId: z.string().uuid(),
  watchId: z.string().uuid(),
  note: z.string().max(200).nullable(),
  visibility: z.enum(['public', 'followers', 'private']),
  hasPhoto: z.boolean(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Thread client `today` into markAsWorn + logWearWithPhoto Server Actions; update wear.ts doc comment</name>
  <files>src/app/actions/wearEvents.ts, src/lib/wear.ts</files>
  <action>
Two surgical edits, one commit.

(A) src/app/actions/wearEvents.ts:

  1. Change `markAsWorn`'s signature from `markAsWorn(watchId: string)` to `markAsWorn(watchId: string, today: string)`.
  2. Replace the existing `const watchIdSchema = z.string().uuid()` parse-step with a new combined schema (or add a second validation step) that validates `today` against the SAME regex used by `preflightSchema`: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`. Suggested shape:
       const markAsWornSchema = z.object({
         watchId: z.string().uuid(),
         today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
       })
     and call `markAsWornSchema.safeParse({ watchId, today })`. Keep the existing `Watch not found` failure copy for the bad-input branch (preserves IDOR-defense uniformity — see line 24 comment).
  3. DELETE the line `const today = todayLocalISO()` (currently line 41) and remove the `import { todayLocalISO } from '@/lib/wear'` if it is no longer referenced anywhere else in the file. Use the validated `parsed.data.today` when calling `wearEventDAL.logWearEvent(user.id, parsed.data.watchId, parsed.data.today)`.
  4. Add `today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` as a new field on `logWearWithPhotoSchema` (around line 84-90).
  5. Extend the `logWearWithPhoto` function's input type (the `input:` parameter annotation around line 118-124) to include `today: string`.
  6. DELETE the line `const today = todayLocalISO()` inside `logWearWithPhoto` (currently line 172) and use `parsed.data.today` when calling `wearEventDAL.logWearEventWithPhoto({ ... wornDate: parsed.data.today, ... })`.
  7. Update the WR-02 comments on both Server Actions (lines 37-40 for markAsWorn, lines 167-171 for logWearWithPhoto) to reflect the new architecture: the CLIENT computes `today`; the server validates the regex and trusts the value. Reference T-X-01 / T-X-02 in the comment (see `must_haves.truths`). Keep tone consistent with surrounding comments — short, factual, points at the helper.

(B) src/lib/wear.ts: Update the docstring on `todayLocalISO` (lines 9-31) to add a paragraph: "WARNING: do NOT call this helper inside a Server Action body. Server Actions run on the Vercel runtime where the process zone is UTC, so the returned value will be UTC — NOT the user's local calendar day. Server-side callers MUST receive `today` from the client (browser) and validate it server-side with the regex `/^\\d{4}-\\d{2}-\\d{2}$/` (see `src/app/actions/wearEvents.ts`). The 2026-06-22 incident behind this warning: a wear logged 11:55 PM PT and the NEXT night at 12:05 AM PT tripped `UNIQUE(user_id, watch_id, worn_date)` because both serialized to the same UTC date." Do NOT change the function body — it is correct in the browser.

Do NOT modify any caller in this task. Do NOT touch tests in this task. The build will be broken between Task 1 and Task 2 (callers still pass only one arg to `markAsWorn`); that is expected and is why these two tasks are sequential within a single plan rather than parallel — Task 2 fixes the call sites before any build/push.

NOTE: Both Task 1 and Task 2 must land before `npm run build` is run; the project memory `project_baseline_not_green_build_is_gate` flags that build (exit 0) is the gate. Do not push to main between tasks.

Commit message: `fix(quick-260622-exo): trust client-supplied "today" in wear Server Actions`
  </action>
  <verify>
    <automated>npx tsc --noEmit src/app/actions/wearEvents.ts src/lib/wear.ts 2>&1 | tee /tmp/exo-task1-tsc.txt; grep -E "src/app/actions/wearEvents\\.ts|src/lib/wear\\.ts" /tmp/exo-task1-tsc.txt; echo "(expect 0 errors specific to these two files; ignore unrelated pre-existing baseline noise per project memory project_baseline_not_green_build_is_gate)"</automated>
  </verify>
  <done>
- `src/app/actions/wearEvents.ts` contains EXACTLY ZERO calls to `todayLocalISO()` (grep -c "todayLocalISO" src/app/actions/wearEvents.ts returns 0).
- `markAsWornSchema` (or equivalent) validates both `watchId: uuid` and `today: /^\d{4}-\d{2}-\d{2}$/`.
- `logWearWithPhotoSchema` includes a `today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` field.
- `markAsWorn` signature is `(watchId: string, today: string) => Promise<ActionResult<void>>`.
- `logWearWithPhoto` input type includes `today: string`.
- The comment block above `todayLocalISO()` in `src/lib/wear.ts` warns server-side callers against using it directly.
- `npx tsc --noEmit` on these two files emits no errors specific to these files (unrelated baseline noise is OK).
  </done>
</task>

<task type="auto">
  <name>Task 2: Update 5 caller sites + 1 integration test to pass client-supplied `today`</name>
  <files>src/components/home/WatchPickerDialog.tsx, src/components/wywt/WywtPostDialog.tsx, src/components/wywt/ComposeStep.tsx, src/components/profile/LogTodaysWearButton.tsx, src/components/watch/WatchDetail.tsx, src/components/watch/WatchDetailHero.tsx, tests/integration/phase15-wywt-photo-flow.test.ts</files>
  <action>
Six caller-site updates + one integration-test update, one commit.

All 5 caller sites already operate in `'use client'` components, so `todayLocalISO()` runs in the browser (the correct context). For each, import `todayLocalISO` from `@/lib/wear` if not already imported, compute `const today = todayLocalISO()` inside the click/submit handler (NOT at module scope — must be evaluated at the moment of the user action), and pass it to the Server Action.

(1) src/components/home/WatchPickerDialog.tsx — fallback path only:
  - File ALREADY uses `markAsWorn` in `handleSubmit` (line 117): `const result = await markAsWorn(selectedId)`.
  - Add `import { todayLocalISO } from '@/lib/wear'` near the existing imports.
  - Inside the `startTransition` callback (just before the `markAsWorn` call), add `const today = todayLocalISO()`.
  - Change the call to `markAsWorn(selectedId, today)`.
  - Note: this codepath is the BACKWARDS-COMPAT branch when `onWatchSelected` is omitted (Phase 15 D-02). The WYWT path (Plan 03b) takes the `onWatchSelected` callback and never reaches this fallback — that path routes through ComposeStep instead.

(2) src/components/wywt/WywtPostDialog.tsx — orchestrator file, NO Server Action call to update:
  - This file already calls `getWornTodayIdsForUserAction({ userId, today })` (lines 85-86) with the correct local-today value. The `markAsWorn` / `logWearWithPhoto` calls live downstream in WatchPickerDialog (fallback, untouched in WYWT mode) and ComposeStep (handled below).
  - No code change needed here. Listed in `files_modified` only to make the audit trail explicit; if no diff is produced, skip the file. (Do NOT add a no-op import "to match the file list" — keep the diff minimal.)
  - Self-audit: after editing the OTHER files, re-grep this file for `markAsWorn\\|logWearWithPhoto`; expected count = 0. If non-zero, the assumption above is wrong — STOP and re-read the file before continuing.

(3) src/components/wywt/ComposeStep.tsx — the WYWT post submit:
  - File ALREADY uses `logWearWithPhoto` (line 268).
  - Add `import { todayLocalISO } from '@/lib/wear'` if not already present.
  - Inside the submit handler (the `startTransition` block around lines 260-285), just before the `await logWearWithPhoto(...)` call, compute `const today = todayLocalISO()`. Pass it as a new field on the object literal:
        const result = await logWearWithPhoto({
          wearEventId,
          watchId: watch.id,
          note: note.trim().length > 0 ? note.trim() : null,
          visibility,
          hasPhoto: !!photoBlob,
          today,
        })

(4) src/components/profile/LogTodaysWearButton.tsx (line 38 — `await markAsWorn(selected)`):
  - Add `import { todayLocalISO } from '@/lib/wear'`.
  - In `handleConfirm`'s `startTransition` callback, compute `const today = todayLocalISO()` and call `markAsWorn(selected, today)`.

(5) src/components/watch/WatchDetail.tsx (line 151 — `await markAsWorn(watch.id)`):
  - Add `import { todayLocalISO } from '@/lib/wear'`.
  - In `handleMarkAsWorn`, compute `const today = todayLocalISO()` inside the `startTransition` callback and call `markAsWorn(watch.id, today)`.

(6) src/components/watch/WatchDetailHero.tsx (line 155 — `await markAsWorn(watch.id)`):
  - Add `import { todayLocalISO } from '@/lib/wear'`.
  - In `handleMarkAsWorn`, compute `const today = todayLocalISO()` inside the `startTransition` callback and call `markAsWorn(watch.id, today)`.

(7) tests/integration/phase15-wywt-photo-flow.test.ts — Test 20 (duplicate-day collision):
  - Read lines 530-570. The test currently seeds a wearEvent at `wornDate: date`, then pins `vi.setSystemTime(new Date(\`${date}T12:00:00\`))` so the Server Action's internal `todayLocalISO()` resolves to `date`, then calls `logWearWithPhoto({ wearEventId, watchId, note, visibility, hasPhoto })` and expects a 23505 collision.
  - After this fix, the Server Action no longer reads its own clock — so the `vi.useFakeTimers` / `setSystemTime` / `useRealTimers` block is dead code. Delete those lines.
  - Pass `today: date` directly on the `logWearWithPhoto` call. The collision is now triggered by the explicit argument, not by clock manipulation.
  - Also: every OTHER `logWearWithPhoto({ ... })` call in this file (Tests 16, 17, 18, 19, 22, 23, and the inline call near line 700) must add `today: isoToday()` (or equivalent — the `isoToday` helper at line 50 of this test file already produces the correct local-day string in the test runner's zone). Without this, the new zod schema rejects all of those calls as `Invalid input` and the integration suite goes red.
  - Audit: `grep -n "logWearWithPhoto(" tests/integration/phase15-wywt-photo-flow.test.ts` then add a `today:` field to every object-literal argument. The shape is `today: isoToday()` for happy-day tests and `today: date` (or `today: isoToday(-N)`) for the duplicate-day / specific-day test cases.

NavWearButton.tsx (per constraints): grep-verified it does NOT call `markAsWorn` or `logWearWithPhoto` directly — it lazy-loads WywtPostDialog and the chain is `NavWearButton → WywtPostDialog → ComposeStep → logWearWithPhoto`. Task 2 fixes ComposeStep; no NavWearButton diff needed.

Other test files (tests/components/home/WatchPickerDialog.test.tsx, tests/components/WywtPostDialog.test.tsx, tests/components/watch/WatchDetail.isChronometer.test.tsx): grep-verified that all three use the pattern `markAsWorn: vi.fn(...)` or `markAsWorn: (...args: unknown[]) => mockMarkAsWorn(...args)`, i.e. variadic — adding a second arg to the production call does NOT break these mocks. The `mock.calls[0][0].watchId` style assertions in WywtPostDialog.test.tsx for `logWearWithPhoto` also keep passing (adding a `today` field to the object spread is non-breaking). Do NOT change these test files.

After all 7 edits land, run `npm run build` (the project memory `project_baseline_not_green_build_is_gate` requires build (exit 0) as the gate — full `tsc --noEmit` carries pre-existing test-file errors, so it is NOT the gate). Build MUST exit 0 before commit.

Commit message: `fix(quick-260622-exo): pass local "today" from 5 caller sites + update integration test`
  </action>
  <verify>
    <automated>
# 1. The single most important grep — confirm Task 1 + Task 2 together leave zero server-side todayLocalISO() calls:
grep -n "todayLocalISO" src/app/actions/wearEvents.ts; echo "(expected: 0 matches — server actions must NOT call todayLocalISO directly)"

# 2. Confirm all 5 client call sites now pass today:
grep -nE "markAsWorn\\(|logWearWithPhoto\\(" src/components/home/WatchPickerDialog.tsx src/components/wywt/ComposeStep.tsx src/components/profile/LogTodaysWearButton.tsx src/components/watch/WatchDetail.tsx src/components/watch/WatchDetailHero.tsx

# 3. Build gate (THE gate per project memory project_baseline_not_green_build_is_gate):
npm run build 2>&1 | tail -30
echo "Build exit: $?"

# 4. Spot-check the integration test no longer relies on clock stubbing for Test 20:
grep -nE "vi\\.setSystemTime|today:" tests/integration/phase15-wywt-photo-flow.test.ts | head -30
    </automated>
  </verify>
  <done>
- `grep -c "todayLocalISO" src/app/actions/wearEvents.ts` returns 0 (no server-side calls; the import is gone too).
- Every `markAsWorn(` call site in `src/components/**` passes a second `today` argument.
- Every `logWearWithPhoto({` call site in `src/components/**` includes a `today:` field.
- `npm run build` exits 0.
- `tests/integration/phase15-wywt-photo-flow.test.ts` Test 20 no longer calls `vi.setSystemTime` (or, if it still does, it's no longer load-bearing — the collision is asserted via the explicit `today: date` argument).
- Every `logWearWithPhoto(` call in the integration test passes a `today:` field; the zod regex does not reject any happy-path test.
- Two commits land on `main`: `fix(quick-260622-exo): trust client-supplied "today" in wear Server Actions` and `fix(quick-260622-exo): pass local "today" from 5 caller sites + update integration test`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Server Action | Browser submits `today: string` over the RSC wire; server must validate before reading it. |
| Server Action → DAL | Validated `today` is forwarded to `wearEventDAL.logWearEvent` / `logWearEventWithPhoto` as `wornDate`. The DAL/DB still enforces `UNIQUE(user_id, watch_id, worn_date)` regardless of source. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-X-01 | Tampering | `markAsWorn` / `logWearWithPhoto` `today` arg | mitigate | `today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` enforced server-side in both schemas (same regex `preflightSchema` already uses for `getWornTodayIdsForUserAction`); regex rejects any non-date string. |
| T-X-02 | Spoofing / replay | Duplicate-day collision via tampered `today` | accept | The DB `UNIQUE(user_id, watch_id, worn_date)` constraint is the canonical gate. A tampered `today` can only shift which (user_id, watch_id, day) tuple the caller collides on — it never bypasses the UNIQUE constraint, never affects another user (the row carries `caller.user_id`), and never leaks data. Low-value: single-user wear log; the user can already alter their device clock to achieve the same effect, so trusting the client clock is consistent with the existing CLIENT-side `todayLocalISO()` flow. |
| T-X-03 | Information disclosure | Server returns a different error when `today` is malformed vs. when watch is not owned | accept | The current code returns `Watch not found` for both bad-watch-id and bad-input shapes (IDOR-defense pattern, see existing line 24 comment). Adding `today` to the combined zod parse keeps this property — a malformed `today` returns the same `Watch not found` error. No new information leak. |
| T-X-04 | Denial of service | A caller submits a date 100 years in the future repeatedly | accept | Single-user log surface; rate limits inherited from Vercel/Supabase. A future-dated `today` only writes a row at that future date for the caller's own (user, watch) pair — no amplification, no cross-user effect. |
</threat_model>

<verification>
## Phase verification (build + UAT)

1. Local build gate (the gate per `project_baseline_not_green_build_is_gate`):
   ```
   npm run build
   ```
   MUST exit 0. Full `tsc --noEmit` will still show ~77 pre-existing test-file errors and `npm run test` will still show ≥1 pre-existing failure (CommentGateLocked font-medium) — those are NOT this phase's regressions per project memory.

2. Optional local unit-test sanity (NOT the gate; carries baseline noise):
   ```
   npm run test -- tests/components/home/WatchPickerDialog.test.tsx tests/components/WywtPostDialog.test.tsx
   ```
   The mocks are variadic / object-spread, so they should pass unchanged.

3. Prod UAT (per project memory `feedback_mobile_ui_verify_on_prod` — UI/mobile/wear-flow behaviors verify on prod via `git push origin main` → Vercel; local e2e skips because the test DB is empty):

   On the deployed Vercel app, signed in as the operator (in PT timezone):
   - **UAT-1 (regression — happy path):** Open `+ Wear` from the top nav. Pick any owned watch. Submit. Expect success + redirect to `/wear/{id}`.
   - **UAT-2 (regression — picker-disable):** Re-open `+ Wear`. The watch just logged renders disabled with the `Worn today` label.
   - **UAT-3 (the actual fix — UTC midnight boundary):** At ~11:55 PM PT (so UTC is the NEXT day), log a wear on Watch A. Then at ~12:05 AM PT the SAME night (UTC still the next day), log a wear on Watch B (different watch). Both succeed. Then ~12:10 AM PT log a SECOND wear on Watch B → expect `Already logged this watch today` (legitimate collision on the user's local calendar day for Watch B). To exercise this WITHOUT waiting overnight, the operator can:
     (a) temporarily change the device clock to ~11:55 PM local, log Watch A → success;
     (b) change the device clock to ~12:05 AM local the NEXT day, log Watch B → success (pre-fix this would have been "Already logged");
     (c) change the device clock to ~12:10 AM local the same next day, log Watch B again → expect "Already logged this watch today".
   - **UAT-4 (Profile quick-log):** Open `/u/{me}/wears` → "Log Today's Wear" → pick a watch → submit. Verify the wear row appears with today's local calendar date.

If UAT-3 passes after the fix lands and was broken before, the bug is closed.
</verification>

<success_criteria>
1. `grep -c "todayLocalISO" src/app/actions/wearEvents.ts` is 0 — server-side helper call eliminated.
2. `markAsWorn` and `logWearWithPhoto` both reject inputs whose `today` does not match `/^\d{4}-\d{2}-\d{2}$/` via the existing zod-regex pattern.
3. All 5 client call sites (`WatchPickerDialog`, `ComposeStep`, `LogTodaysWearButton`, `WatchDetail`, `WatchDetailHero`) pass `today: todayLocalISO()` computed in the browser.
4. `src/lib/wear.ts:todayLocalISO()` doc comment warns against server-side use.
5. `npm run build` exits 0 (the gate per project memory `project_baseline_not_green_build_is_gate`).
6. Two atomic commits on `main` with the conventional `fix(quick-260622-exo): …` shape.
7. UAT-3 above passes on the deployed Vercel app (the actual user-visible fix).
</success_criteria>

<output>
After completion, append a one-paragraph SUMMARY to `.planning/quick/260622-exo-fix-wear-duplicate-day-across-utc-midnig/` (filename `260622-exo-SUMMARY.md`) noting: (a) the two commit shas, (b) which files were touched and the high-level diff size (server-action signature + 5 client call sites + 1 test update + 1 doc comment), (c) UAT-3 verification result on prod, and (d) any surprises (e.g. additional test files needing updates, baseline-noise diffs, build-time regressions). Standard SUMMARY shape — single paragraph or compact bullet list, no ceremony.
</output>
