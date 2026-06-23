---
phase: 76-video-schema-storage-paths-server-action
plan: 03
subsystem: server-actions
tags: [server-action, dal, storage-probe, idor, compensating-delete, video, wear-events]

requires:
  - phase: 11-wywt-server-actions-photos-uploads
    provides: logWearWithPhoto Server Action + logWearEventWithPhoto DAL helper — the structural template this plan parallels byte-for-byte (auth-first ordering, Zod-then-IDOR, server-constructed Storage path, generic-error-on-Storage-failure, fire-and-forget logActivity, revalidatePath + revalidateTag('max') fan-out).
  - phase: 76-01
    provides: mediaType enum + mediaPath/posterPath columns + DB CHECK `wear_events_video_paths_required` — the DAL helper writes these columns; the CHECK is the last-line gate.
  - phase: 76-02
    provides: client-side buildWearVideoPath / buildWearPosterPath — the SAME path strings the Server Action independently recomputes from getCurrentUser().id (client builders are an ergonomic helper, never a trust path; T-15-17 / VID-16 defense in depth).
provides:
  - `logWearEventWithVideo({ id, userId, watchId, wornDate, note, mediaPath, posterPath, visibility })` DAL helper at src/data/wearEvents.ts:80-127 — Drizzle insert with mediaType='video' + both paths; photoUrl left NULL; no .onConflictDoNothing so caller catches 23505 for Storage cleanup
  - `logWearWithVideoSchema` Zod schema at src/app/actions/wearEvents.ts:100-112 — same shape as logWearWithPhotoSchema with `videoBytes: z.number().int().positive()` swapping `hasPhoto: z.boolean()`
  - `logWearWithVideo` Server Action at src/app/actions/wearEvents.ts:268-444 — 11-step pipeline: auth → Zod → 5 MB byte gate → IDOR check → server path construction → TWO parallel Storage `.list()` probes → DAL insert → compensating .remove([videoPath, posterPath]) on failure → fire-and-forget activity log → revalidatePath('/') + revalidateTag SWR fan-out → success
  - 9 unit tests at tests/actions/wearEventsVideo.test.ts proving VID-07/08/09/10/16 contracts with vi.mock'd auth, DAL, Storage, profiles, activities, next/cache
affects: [phase-76-04, phase-77-wywt-capture-ui]

tech-stack:
  added: []
  patterns:
    - "Auth-first try/catch then Zod safeParse (matches markAsWorn / logWearWithPhoto ordering — unauthenticated callers never reach validation)"
    - "5 MB server-side byte gate via Zod-validated `videoBytes: z.number().int().positive()` + runtime `> 5 * 1024 * 1024` check BEFORE IDOR / Storage / DAL (VID-09 defense in depth — Supabase bucket file_size_limit also enforces at Storage layer)"
    - "TWO parallel `.list()` probes via Promise.all + exact-match `.some(f => f.name === filename)` (NOT prefix match — Pitfall 1: `.list({search})` returns prefix matches)"
    - "Uniform error string `'Video upload failed — please try again'` regardless of which probe failed (no existence leak)"
    - "Server path construction inside the action AFTER getCurrentUser() succeeds — action input type has NO videoPath/posterPath fields (T-15-17 / VID-16)"
    - "Compensating .remove([videoPath, posterPath]) on ANY DAL insert failure (both 23505 and non-23505); best-effort: cleanup error console.error'd, never escalated; original DAL error propagates"
    - "revalidateTag(tag, 'max') for SWR cross-user fan-out — NOT a read-your-own-write case (no updateTag); matches logWearWithPhoto verbatim"

key-files:
  created:
    - tests/actions/wearEventsVideo.test.ts
    - .planning/phases/76-video-schema-storage-paths-server-action/76-03-SUMMARY.md
  modified:
    - src/data/wearEvents.ts
    - src/app/actions/wearEvents.ts

key-decisions:
  - "Mock Supabase Storage via nested factory `{ storage: { from: vi.fn(() => bucketStub) } }` with SHARED bucketStub so `.remove()` assertions land on the same Mock regardless of how many `.from('wear-photos')` invocations the action makes (one for probes + one for cleanup = 2 `from()` calls per Test 8/9 — without a shared stub, the `.mock.results[N]` lookup pattern from the plan's spec would have been brittle)."
  - "`.list()` mock destructures the SECOND positional arg `({ search })` — caught during initial test run when 5 of 9 tests failed with `TypeError: search.endsWith is not a function`. The action calls `.list(user.id, { search: ... })` — two positional args. The plan's mock spec was missing the first `_path` arg."
  - "Kept `revalidateTag(`profile:${ownerProfile.username}`, 'max')` verbatim with explicit `'max'` second arg per durable memory `project_next16_revalidatetag_deprecated`. This is NOT a read-your-own-write case (no updateTag) — the action writes the owner's wear event, and the cache invalidation fans out for other viewers who may have stale cached profile pages. Matches logWearWithPhoto L250-253 verbatim."
  - "DAL helper signature uses non-nullable `mediaPath: string` + `posterPath: string` (vs logWearEventWithPhoto's `photoUrl: string | null`) — the Server Action only invokes this helper AFTER both Storage objects are confirmed present, so a null path is structurally impossible at this layer. Removes a class of bugs where a future caller might pass null and hit the DB CHECK rejection."

patterns-established:
  - "Phase 15 → Phase 76 parallel pattern: when adding a new media-type variant to an existing media-bearing Server Action, the safest path is to APPEND a new exported function + schema beside the analog rather than parameterize the existing one. Preserves the original's regression surface (VID-15 guard) and keeps the threat-model citations specific to each variant. Documented 7 divergences inline in the action's JSDoc make code review a 1-page diff against the analog."

requirements-completed: [VID-07, VID-08, VID-09, VID-10, VID-16]

duration: ~20min
completed: 2026-06-23
---

# Phase 76 Plan 03: logWearWithVideo Server Action + DAL Helper Summary

**`logWearWithVideo` Server Action and `logWearEventWithVideo` DAL helper added as direct structural parallels to the Phase 15 photo path, with 7 documented divergences. Server constructs both Storage paths (`${userId}/${wearEventId}.mp4` + `-poster.jpg`) from `getCurrentUser().id` after Zod-validated UUID, probes both Storage objects in parallel via `Promise.all` before any DB write, runs a 5 MB byte-length gate before IDOR check, and runs compensating `.remove([videoPath, posterPath])` on any DAL insert failure (23505 or otherwise). Photo path untouched (VID-15 regression guard).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 (all `type="auto" tdd="true"`)
- **Files modified:** 2 (`src/data/wearEvents.ts`, `src/app/actions/wearEvents.ts`)
- **Files created:** 1 (`tests/actions/wearEventsVideo.test.ts`)

## Accomplishments

- Appended `logWearEventWithVideo` DAL helper to `src/data/wearEvents.ts` immediately after `logWearEventWithPhoto`. Drizzle insert writes `mediaType: 'video' as const` + both paths; `photoUrl` left NULL via column default. No `.onConflictDoNothing()` — caller catches 23505 explicitly so it can clean up BOTH orphan Storage objects.
- Appended `logWearWithVideoSchema` Zod schema after `logWearWithPhotoSchema` — same field ordering, swaps `hasPhoto: z.boolean()` for `videoBytes: z.number().int().positive()`.
- Appended `logWearWithVideo` Server Action after `logWearWithPhoto` (177 lines including 28-line JSDoc documenting all 7 divergences inline). Pipeline order: auth-first → Zod → 5 MB gate → IDOR check → server path construction → TWO parallel `.list()` probes via `Promise.all` → exact-match `.some(f => f.name === filename)` → DAL insert → catch with compensating `.remove([videoPath, posterPath])` + 23505 discrimination → fire-and-forget `logActivity` → `revalidatePath('/')` + `revalidateTag(\`profile:${username}\`, 'max')`.
- Created `tests/actions/wearEventsVideo.test.ts` — 9 unit cases covering all 5 requirements with vi.mock'd auth, DAL, Storage, profiles, activities, and next/cache. Each case asserts both the success/failure result shape AND the side-effect call (or non-call) on the appropriate mock.
- VID-15 regression guard verified: `grep -c "export async function logWearWithPhoto"` and `grep -c "export async function logWearEventWithPhoto"` both return 1 — no existing exports duplicated, renamed, or modified.

## Task Commits

Each task was committed atomically:

1. **Task 1: Append logWearEventWithVideo DAL helper** — `e695dc8e` (feat)
2. **Task 2: Append logWearWithVideoSchema + logWearWithVideo Server Action** — `0ea9d2cf` (feat)
3. **Task 3: Write tests/actions/wearEventsVideo.test.ts (9 cases)** — `0dc01752` (test)

**Plan metadata commit:** (this commit — `docs(76-03)`)

## Files Created/Modified

- `src/data/wearEvents.ts` — appended 46 lines between `logWearEventWithPhoto` (closes L78) and `getMostRecentWearDate` (now shifted from L80 → L126). New `logWearEventWithVideo` function with 22-line JSDoc citing VID-07 / VID-08 / VID-10 / SEED-020 D-07 / T-15-04 / T-15-18 / VID-15. Zero changes to imports, existing functions.
- `src/app/actions/wearEvents.ts` — TWO insertions: (a) 13-line `logWearWithVideoSchema` between `logWearWithPhotoSchema` (closes L98) and `preflightSchema` (now shifted L100 → L113), (b) 177-line `logWearWithVideo` function with 28-line JSDoc between `logWearWithPhoto` (closes L255 — now L268) and `getWornTodayIdsForUserAction` (now shifted L268 → L445). Zero changes to imports, `markAsWorn`, `logWearWithPhoto`, `logWearWithPhotoSchema`, `preflightSchema`, `getWornTodayIdsForUserAction`, `hideWearPicAction`, `unhideWearPicAction`, `hideWearPicSchema`.
- `tests/actions/wearEventsVideo.test.ts` — 289 lines; vi.mock for `@/lib/auth` + `@/data/wearEvents` (all 6 named exports stubbed to avoid namespace-import failures) + `@/data/watches` + `@/data/profiles` + `@/data/activities` + `next/cache` + `@/lib/supabase/server`; fixture UUIDs (`userId`, `watchId`, `wearEventId`, `VICTIM_USER_ID`) and derived path strings (`videoPath`, `posterPath`); `authAs` + `authFail` + `mkInput` + `mockStorage` helpers; 1 describe block with 9 it cases mapped 1:1 to VID-07/08/09/10/16 requirements per the validation contract.

## Signatures (per output spec)

### DAL helper

```ts
export async function logWearEventWithVideo(input: {
  id: string
  userId: string
  watchId: string
  wornDate: string
  note: string | null
  mediaPath: string
  posterPath: string
  visibility: WearVisibility
}): Promise<void>
```

### Server Action

```ts
export async function logWearWithVideo(input: {
  wearEventId: string
  watchId: string
  note: string | null
  visibility: WearVisibility
  videoBytes: number
  today: string
}): Promise<ActionResult<{ wearEventId: string }>>
```

## 7 Documented Divergences from logWearWithPhoto

1. **Schema field:** `videoBytes: z.number().int().positive()` replaces `hasPhoto: z.boolean()` so the 5 MB byte gate has the actual byte length to check (VID-09).
2. **NEW 5 MB server gate** runs AFTER Zod parse, BEFORE IDOR check / Storage / DAL: `if (parsed.data.videoBytes > 5 * 1024 * 1024) return 'Video too large — maximum 5 MB'` (VID-09; no Phase 15 analog because photos were small).
3. **Path construction:** TWO paths — `videoPath = \`${user.id}/${wearEventId}.mp4\`` + `posterPath = \`${user.id}/${wearEventId}-poster.jpg\`` (VID-07 / VID-16).
4. **Storage probe:** NO `hasPhoto` guard (video always required); TWO probes via `Promise.all` — one per Storage object; exact-match `.some(f => f.name === filename)` per probe (NOT prefix match — Pitfall 1); either miss returns uniform `'Video upload failed — please try again'` (VID-08).
5. **DAL call:** `wearEventDAL.logWearEventWithVideo({ ..., mediaPath: videoPath, posterPath, visibility })` — NO `photoUrl` field passed; mediaType written as `'video' as const`.
6. **Catch cleanup:** NO `hasPhoto` guard; `.remove([videoPath, posterPath])` 2-element array fires on BOTH 23505 + non-23505 DAL failures (VID-10 / T-15-18).
7. **Log prefix:** all `console.error` use `[logWearWithVideo]` (orphan cleanup + insert failed + activity log non-fatal — 3 sites).

## Test Count

**9/9 unit tests pass** in 5 ms (`npx vitest run tests/actions/wearEventsVideo.test.ts`):

| # | VID req | Behavior asserted |
|---|---------|-------------------|
| 1 | (auth) | unauthenticated → 'Not authenticated'; no DAL/Storage call |
| 2 | (Zod) | non-UUID wearEventId → 'Invalid input'; no DAL call |
| 3 | VID-09 | videoBytes > 5 MB → 'Video too large'; no IDOR/Storage |
| 4 | VID-16 | cross-user watchId → uniform 'Watch not found'; no Storage |
| 5 | VID-08 | missing .mp4 → 'Video upload failed'; no DAL |
| 6 | VID-08 | missing -poster.jpg → 'Video upload failed'; no DAL |
| 7 | VID-07 + VID-16 | happy path → DAL called with SERVER-DERIVED `${userId}/${wearEventId}.mp4` + `-poster.jpg` |
| 8 | VID-10 | 23505 → `.remove([videoPath, posterPath])` + 'Already logged this watch today' |
| 9 | VID-10 | non-23505 → `.remove([videoPath, posterPath])` + 'Could not log that wear. Please try again.' |

## logWearWithPhoto NOT Modified (VID-15 Regression Guard)

- `grep -c "export async function logWearWithPhoto" src/app/actions/wearEvents.ts` → **1**
- `grep -c "export async function logWearEventWithPhoto" src/data/wearEvents.ts` → **1**
- `grep -c "const logWearWithPhotoSchema = z.object" src/app/actions/wearEvents.ts` → **1**

All three pre-existing photo-path exports preserved byte-for-byte. No duplication, no rename, no inline change.

## Decisions Made

See `key-decisions` in frontmatter. Most notable runtime decisions:

1. **Shared `bucketStub` inside mockStorage helper.** The action invokes `supabase.storage.from('wear-photos')` TWICE per request (once for the parallel `.list()` probes, once again in the catch for `.remove()`). If `from()` returned a fresh bucket stub on each call, the test's `expect(stub._removeMock).toHaveBeenCalledWith(...)` would land on a different mock than the one the action used. The shared `bucketStub` collapses both invocations onto the same `.remove` mock, making the assertion robust without the plan's brittle `.mock.results[N].value` lookup pattern.
2. **Non-nullable `mediaPath` + `posterPath` in the DAL signature.** Diverges from `logWearEventWithPhoto`'s `photoUrl: string | null` — but is correct here because the Server Action ONLY reaches the DAL after both Storage objects are confirmed present. A null path at this layer would be a programming error, not a valid state. The non-nullable type makes that invariant explicit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] mockStorage helper destructured the wrong positional arg from `.list()`**

- **Found during:** Task 3 (first test run — 5 of 9 tests failed)
- **Issue:** The plan's mock spec declared `list: vi.fn(({ search }) => ...)`, but the Supabase Storage `.list(path, opts)` API takes TWO positional args (path string + options object). The action invokes `supabase.storage.from('wear-photos').list(user.id, { search: ... })`. The mock was destructuring `{ search }` from the FIRST arg (the path string), which is just a string, so `search.endsWith('.mp4')` threw `TypeError: search.endsWith is not a function`.
- **Fix:** Changed signature to `vi.fn((_path: string, opts2: { search: string }) => ...)` and read `search` from `opts2.search`. Added inline comment documenting the two-positional-arg API.
- **Files modified:** `tests/actions/wearEventsVideo.test.ts`
- **Verification:** Re-ran `npx vitest run tests/actions/wearEventsVideo.test.ts` → 9/9 pass in 5ms.
- **Committed in:** `0dc01752` (Task 3 atomic commit included the fix in the initial test file content)

**Rationale for not surfacing as Rule 4 (architectural):** the fix is a 3-line mock helper correction inside one test file. The action implementation and DAL helper were correct from the outset — only the test scaffolding miscounted the API arity. Documenting here so future test authors mocking Supabase Storage `.list()` know it's a two-positional-arg API.

---

**Total deviations:** 1 auto-fixed (1 × Rule 1)
**Impact on plan:** No scope creep. The fix is contained to one helper function in one test file. Future ground truth: Supabase Storage `.list(path, opts)` is two positional args — mocks must accept both.

## Issues Encountered

None beyond the test-mock fix above.

## Verification

- ✅ `npm run build` exits 0 — "Compiled successfully in 5.9s" (the gate per durable memory `project_baseline_not_green_build_is_gate`)
- ✅ `grep -c "export async function logWearWithVideo" src/app/actions/wearEvents.ts` → 1
- ✅ `grep -c "export async function logWearWithPhoto" src/app/actions/wearEvents.ts` → 1 (VID-15 regression guard)
- ✅ `grep -c "export async function logWearEventWithVideo" src/data/wearEvents.ts` → 1
- ✅ `grep -c "export async function logWearEventWithPhoto" src/data/wearEvents.ts` → 1 (VID-15 regression guard)
- ✅ `grep -c "videoBytes > 5 \* 1024 \* 1024" src/app/actions/wearEvents.ts` → 1 (VID-09 gate)
- ✅ Actual `.remove([videoPath, posterPath])` call site exactly once at src/app/actions/wearEvents.ts:398 (VID-10)
- ✅ `revalidateTag(\`profile:...\`, 'max')` call sites: 3 (markAsWorn L70 preserved + logWearWithPhoto L265 preserved + new logWearWithVideo L439 — Next 16 SWR fan-out form preserved verbatim)
- ✅ `npx vitest run tests/actions/wearEventsVideo.test.ts` exits 0 — `Test Files 1 passed (1) / Tests 9 passed (9)` in 703ms

## Self-Check: PASSED

- ✅ `.planning/phases/76-video-schema-storage-paths-server-action/76-03-SUMMARY.md` — this file (written, will commit)
- ✅ `src/data/wearEvents.ts` modified — `git show e695dc8e --stat` confirms `1 file changed, 46 insertions(+)`
- ✅ `src/app/actions/wearEvents.ts` modified — `git show 0ea9d2cf --stat` confirms `1 file changed, 187 insertions(+)`
- ✅ `tests/actions/wearEventsVideo.test.ts` created — `git show 0dc01752 --stat` confirms `1 file changed, 289 insertions(+)`
- ✅ Commit `e695dc8e` (Task 1) present in `git log`
- ✅ Commit `0ea9d2cf` (Task 2) present in `git log`
- ✅ Commit `0dc01752` (Task 3) present in `git log`
