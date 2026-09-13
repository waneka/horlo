---
phase: 84-wear-history-depth
reviewed: 2026-09-13T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/app/actions/wearEvents.ts
  - src/app/u/[username]/[tab]/page.tsx
  - src/components/profile/LogTodaysWearButton.tsx
  - src/components/profile/WearLeaderboard.tsx
  - src/components/profile/WornCalendar.tsx
  - src/components/profile/WornTabContent.tsx
  - src/components/profile/WornTimeline.tsx
  - src/lib/stats.ts
  - src/lib/wear.ts
  - src/lib/wornTabScope.ts
  - tests/actions/wearEventsBackfill.test.ts
  - tests/components/profile/LogTodaysWearButton.test.tsx
  - tests/components/profile/WearLeaderboard.test.tsx
  - tests/components/profile/WornCalendar.test.tsx
  - tests/unit/WornTimeline.test.tsx
  - tests/unit/leaderboard.test.ts
  - tests/unit/wornTabScope.test.ts
findings:
  critical: 2
  warning: 6
  info: 7
  total: 15
status: issues_found
---

# Phase 84: Code Review Report

**Reviewed:** 2026-09-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the Phase 84 diff (`1e6ab0be..6fa86db9`): the `logBackfillWear` action, the unified Log a wear form, `WearLeaderboard`, the window and ranking helpers, the Worn-tab privacy scoping, and the `/wear/[id]` row links. The pure helpers (`filterEventsByWindow`, `buildLeaderboard`, `scopeWornTabWatches`) are correct and well tested. The row-link changes are clean.

Two problems must be fixed before this ships:

1. **Duplicate-day message never shows (D-05).** The action checks for the duplicate-row error with `err.code === '23505'`. Drizzle 0.45.2 wraps every driver error in a `DrizzleQueryError` and puts the Postgres code on `err.cause`, so the check never matches. I confirmed this against the local DB: `e.code` was `undefined` and `e.cause.code` held the SQLSTATE. The unit test passes only because its mock throws an error with a bare `code` field, which the real driver never does.
2. **The T-84-LEAK fix is incomplete.** `scopeWornTabWatches` cuts down which watch rows a viewer gets, but not which fields. Full `Watch` objects still go to the client component. For a private collection, that includes `pricePaid`, `acquisitionDate` and notes marked private.

Other concerns: the client supplies "today", so a crafted request can get past the server's future-date check and the D-06 activity rule. The form's duplicate check can show stale results for a moment after the date changes. The form has no error handling if the action call throws. Leaderboard links are dead for non-owners of private collections. Empty-state text tells non-owners to "log a wear".

## Critical Issues

### CR-01: The duplicate-day check never matches, so users never see the "already logged" message (D-05)

**File:** `src/app/actions/wearEvents.ts:563-570` (same pattern at `:261-264` and `:446-449` in older actions)
**Issue:** `logBackfillWear` looks for the error code with `(err as { code?: string }).code === '23505'`. The DB client is `drizzle-orm/postgres-js` at 0.45.2. In that version, `PgPreparedQuery.queryWithCache` (`node_modules/drizzle-orm/pg-core/session.js:36-100`) catches every driver error and rethrows it as `new DrizzleQueryError(query, params, e)`. The top-level error has no `code`; the SQLSTATE is on `err.cause.code`. I checked this against local Postgres with a read-only failing query:

```
name DrizzleQueryError code undefined cause.code 42P01
```

Result: every real duplicate-day insert falls through to `console.error('[logBackfillWear] insert failed:', …)`, and the user sees "Couldn't log that wear." instead of "Already logged this watch on that date." The D-05 backstop exists to catch races the pre-check misses (see WR-02), and that is exactly the case that breaks. Test 7 in `tests/actions/wearEventsBackfill.test.ts:252-254` rejects with `Object.assign(new Error('dup'), { code: '23505' })`, a shape the real driver never produces, so the test passes while production doesn't work. The same bug is in `logWearWithPhoto` and `logWearWithVideo` (out of Phase 84 scope, but it's one shared fix).

**Fix:**
```ts
function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } } | null
  return e?.code ?? e?.cause?.code
}
// ...
} catch (err) {
  if (pgErrorCode(err) === '23505') {
    return { success: false, error: 'Already logged this watch on that date.' }
  }
  ...
}
```
Update Test 7 so the mock rejects with the real shape: `Object.assign(new Error('Failed query'), { cause: { code: '23505' } })`.

### CR-02: The Worn tab still sends full `Watch` rows (price paid, private notes) to non-owners

**File:** `src/app/u/[username]/[tab]/page.tsx:441-447, 507`; `src/lib/wornTabScope.ts:18-37`; `src/components/profile/WornTabContent.tsx:48`
**Issue:** `WornTabContent` is a `'use client'` component, so every prop is serialized into the RSC payload. `ownedWatches={scopedOwnedWatches}` passes whole `Watch` objects straight from `getWatchesByUser` (`profile-shell-resolver.tsx:40`). Those objects include `pricePaid`, `targetPrice`, `marketPrice`, `acquisitionDate`, `notes` and `notesPublic`.

The two viewer cases:
- **Private collection** (`collectionPublic=false`): the helper still returns every owned watch that a visible wear references. Any viewer who can see one public wear gets the owner's price paid and private notes for that watch, even though the Collection, Stats and Notes tabs are all locked for them.
- **Public collection:** notes with `notesPublic=false`, which the Notes tab filters out at `page.tsx:411-415`, still reach the client here.

The consumers need very little. `WearLeaderboard` reads `id`, `brand`, `model` and `imageUrl`. `watchOptions` reads `id`, `brand` and `model`. The phase's T-84-LEAK mitigation limits rows but not fields. The wide prop predates Phase 84, but this phase touched that exact line to close the leak.

**Fix:** Project on the server before the data crosses into the client component, and narrow the prop type:
```ts
// page.tsx
ownedWatches={scopedOwnedWatches.map((w) => ({
  id: w.id, brand: w.brand, model: w.model, imageUrl: w.imageUrl ?? null,
}))}
```
```ts
// WornTabContent.tsx
ownedWatches: Array<{ id: string; brand: string; model: string; imageUrl: string | null }>
```
Add a test that `ownedWatches` entries have no `pricePaid` or `notes` keys.

## Warnings

### WR-01: The client can get past the future-date check and the "today-only activity" rule by sending its own `today`

**File:** `src/app/actions/wearEvents.ts:544-546, 575-586`
**Issue:** Both `wornDate` and `today` come from the client. Sending `{ wornDate: '2099-01-01', today: '2099-01-01' }` passes the D-02 check (`wornDate > today` is false). It also passes the D-06 check (`wornDate === today`), so a `watch_worn` activity is written. Sending `{ wornDate: '2026-01-01', today: '2026-01-01' }` posts a months-old backfill to the feed as a new activity, which D-06 is meant to prevent.

A future-dated wear also stays pinned to the top of every follower's WYWT rail. `getWearRailForViewer` (`src/data/wearEvents.ts:433, 449`) has only a lower bound (`wornDate >= cutoffDate`) and sorts `wornDate DESC`. The doc comment's claim that "the server independently rejects `wornDate > today`" gives a false sense of safety. The 260622-exo rule forbids the server *deriving* the user's day, but a timezone-tolerant *bound* doesn't break that rule.

**Fix:** Add a sanity bound based on the server's UTC date without treating it as the user's day. No real timezone is more than +14h from UTC:
```ts
const utcNow = Date.now()
const maxPlausible = new Date(utcNow + 14 * 3600_000).toISOString().slice(0, 10)
const minPlausible = new Date(utcNow - 12 * 3600_000).toISOString().slice(0, 10)
if (parsed.data.today > maxPlausible || parsed.data.today < minPlausible) {
  return { success: false, error: 'Invalid input' }
}
```

### WR-02: The "already logged" check shows stale results after the date changes or the dialog reopens

**File:** `src/components/profile/LogTodaysWearButton.tsx:62-64, 75-85, 90-113`
**Issue:** When `wornDate` changes, `wornOnDateIds` keeps the *previous* date's results until the new request returns. `handleOpen` doesn't reset it either, so it carries over from the last session. In that window:
- watches already logged on the new date look selectable, and `canSubmit` is true;
- watches logged only on the old date look disabled.

A user who picks a date and quickly submits goes straight to the server's 23505 backstop, which currently shows the wrong message (CR-01). The effect also silently clears the selection (`setWatchId((cur) => set.has(cur) ? '' : cur)`) with no explanation.

**Fix:** Track a loading state and block submit while it's in flight:
```ts
const [preflightDate, setPreflightDate] = useState<string | null>(null)
// in effect .then: setWornOnDateIds(set); setPreflightDate(wornDate)
// in handleOpen: setWornOnDateIds(new Set()); setPreflightDate(null)
const canSubmit = ... && preflightDate === wornDate
```

### WR-03: No error handling around the server action call inside `startTransition`

**File:** `src/components/profile/LogTodaysWearButton.tsx:115-131`
**Issue:** `await logBackfillWear(...)` isn't wrapped in try/catch. If the action rejects, the error surfaces through the transition to the nearest error boundary and the Worn tab is replaced by an error screen. This happens on a network drop, a deploy-skew "failed to find server action", or if `profilesDAL.getProfileById` throws *after* a successful insert (`wearEvents.ts:593`). In that last case the wear was saved but the user sees a crash. The sibling `ComposeStep.tsx:342-437` wraps the same kind of call in try/catch.

**Fix:**
```ts
startTransition(async () => {
  try {
    const result = await logBackfillWear({ ... })
    if (!result.success) { setError(result.error); return }
    setOpen(false)
  } catch {
    setError("Couldn't log that wear. Please try again.")
  }
})
```

### WR-04: Leaderboard rows link to pages non-owners of private collections can't open

**File:** `src/components/profile/WearLeaderboard.tsx:160-162`; `src/lib/wornTabScope.ts:35-36`
**Issue:** When `collectionPublic=false`, `scopeWornTabWatches` still gives non-owners leaderboard rows for watches that visible wears reference. Each row links to `/w/${watch.id}`. `/w/[ref]` resolves per-user watches through `getWatchByIdForViewer` (`src/data/watches.ts:285-295`), which requires `collectionPublic = true` for owned watches. The page then treats the id as a catalog id and fails. Every leaderboard link a viewer of a private collection can see leads to a not-found page.

**Fix:** Pass a `linkable` flag (or `isOwner || collectionPublic`) into `WearLeaderboard` and render an unlinked row when it's false. Alternatively, link to the watch's `catalogId` if the catalog page is the intended destination.

### WR-05: Non-owners are told to "log a wear", and zero-wear profiles show two empty states

**File:** `src/components/profile/WearLeaderboard.tsx:146-153`; `src/components/profile/WornTabContent.tsx:97, 116`
**Issue:** `WearLeaderboard` has no idea who is viewing. Non-owners see "Try a longer window, or log a wear to get started." on someone else's profile, which is a call to action they can't use. When `events.length === 0`, `WornTabContent` also mounts the leaderboard above its own empty card. The owner (and a non-owner of a public collection) gets a list of every watch at "0 wears", a "No wears in this window." banner, *and* "No wears logged yet." / "Nothing here yet." underneath.

**Fix:** Pass `isOwner` to `WearLeaderboard` and show owner-only text (e.g. non-owner: "No wears in this window."). Also skip mounting the leaderboard when `events.length === 0`, since the empty card already covers that state.

### WR-06: The duplicate-day test mocks an error shape the real driver never produces

**File:** `tests/actions/wearEventsBackfill.test.ts:249-267`
**Issue:** Test 7 is supposed to cover D-05, but it rejects with `{ code: '23505' }` at the top level. The real Drizzle 0.45 error has the code on `cause` (CR-01). The test gives false confidence and would keep passing even if CR-01 were never fixed. `tests/integration/phase15-wywt-photo-flow.test.ts:266` makes the same top-level `.code` assumption; it only passes when env-gated skips hide it.

**Fix:** Mock `Object.assign(new Error('Failed query: insert …'), { cause: Object.assign(new Error('duplicate key'), { code: '23505' }) })`. Also add one integration assertion that runs against local Supabase.

## Info

### IN-01: No lower bound on `wornDate`

**File:** `src/app/actions/wearEvents.ts:129-135`; `src/components/profile/LogTodaysWearButton.tsx:227-237`
**Issue:** `isoCalendarDate` accepts `0001-01-01` and even `0000-01-01`, and the date input has no `min`. That allows typos like a year of 0202, which then sit at the bottom of the timeline and inflate "All time" counts.
**Fix:** Add a floor, e.g. `.refine((s) => s >= '1900-01-01')`, and set `min="1900-01-01"` on the input. Optionally also reject dates before the watch's `acquisitionDate`.

### IN-02: `logBackfillWear` accepts watches that aren't owned (wishlist or grail)

**File:** `src/app/actions/wearEvents.ts:536-539`
**Issue:** The ownership check confirms the watch *row* belongs to the caller but not its `status`. The form only lists owned watches, but a direct call can log wears on a wishlist watch. The leaderboard then ignores those wears (only `owned` is ranked) while the timeline shows them.
**Fix:** Reject `watch.status === 'wishlist' || watch.status === 'grail'` with the same `'Watch not found'` message. `sold` can stay allowed, since backfilling wears from before a sale is legitimate.

### IN-03: The component name no longer matches what it does, and a nearby comment is stale

**File:** `src/components/profile/LogTodaysWearButton.tsx:49`
**Issue:** `LogTodaysWearButton` now logs any past-or-today date and no longer calls `markAsWorn`. `src/components/layout/NavWearButton.tsx:16` still says it "remains on the quick-log markAsWorn" path.
**Fix:** Rename the component to `LogWearButton` (or similar) and update the NavWearButton comment.

### IN-04: Window tabs have no matching tab panel

**File:** `src/components/profile/WearLeaderboard.tsx:106-135, 154`
**Issue:** The `role="tab"` buttons have no `aria-controls`, and the `<ol>` has no `role="tabpanel"` or `aria-labelledby`, so the tabs pattern is only half implemented for assistive tech.
**Fix:** Add `id`s and `aria-controls` to the tabs, and `role="tabpanel"` with `aria-labelledby` to the list container. Alternatively, use a radiogroup pattern (see Phase 68 CR-01).

### IN-05: A submit still in flight can close or pollute a reopened dialog

**File:** `src/components/profile/LogTodaysWearButton.tsx:75-85, 129, 141`
**Issue:** `onOpenChange={setOpen}` lets Escape or a backdrop click close the dialog while `pending`, and `handleOpen` doesn't check `pending`. If the user reopens before the first submit resolves, the old transition then calls `setOpen(false)` or `setError(...)` on the new session.
**Fix:** Ignore `onOpenChange(false)` and `handleOpen` while `pending`.

### IN-06: Calendar test fixtures don't match the `WearEventLite` type

**File:** `tests/components/profile/WornCalendar.test.tsx:172-185`
**Issue:** The new fixtures leave out the required `photoUrl` field. Vitest doesn't type-check, so this only shows up under `tsc`, adding to the known baseline errors.
**Fix:** Add `photoUrl: null` to both fixtures.

### IN-07: Wears on sold watches are dropped from the leaderboard with no explanation

**File:** `src/lib/stats.ts:193-205`; `src/lib/wornTabScope.ts:27`
**Issue:** Only `status === 'owned'` watches become rows. If every wear in a window is on a watch that was since sold, the leaderboard says "No wears in this window." while the timeline right below lists those wears.
**Fix:** Either include `sold` watches that have wears in the window, or change the text to "No wears on current watches in this window."

---

_Reviewed: 2026-09-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
