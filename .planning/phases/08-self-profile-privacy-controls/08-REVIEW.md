---
phase: 08-self-profile-privacy-controls
reviewed: 2026-04-21T08:00:46Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - src/app/actions/notes.ts
  - src/app/actions/profile.ts
  - src/app/settings/page.tsx
  - src/app/u/[username]/[tab]/page.tsx
  - src/app/u/[username]/layout.tsx
  - src/app/u/[username]/page.tsx
  - src/components/layout/Header.tsx
  - src/components/layout/HeaderNav.tsx
  - src/components/profile/AddWatchCard.tsx
  - src/components/profile/AvatarDisplay.tsx
  - src/components/profile/CollectionObservations.tsx
  - src/components/profile/CollectionTabContent.tsx
  - src/components/profile/FilterChips.tsx
  - src/components/profile/HorizontalBarChart.tsx
  - src/components/profile/LockedProfileState.tsx
  - src/components/profile/LogTodaysWearButton.tsx
  - src/components/profile/NoteRow.tsx
  - src/components/profile/NoteVisibilityPill.tsx
  - src/components/profile/NotesTabContent.tsx
  - src/components/profile/ProfileEditForm.tsx
  - src/components/profile/ProfileHeader.tsx
  - src/components/profile/ProfileTabs.tsx
  - src/components/profile/ProfileWatchCard.tsx
  - src/components/profile/RemoveNoteDialog.tsx
  - src/components/profile/StatsCard.tsx
  - src/components/profile/StatsTabContent.tsx
  - src/components/profile/TasteTagPill.tsx
  - src/components/profile/ViewTogglePill.tsx
  - src/components/profile/WishlistTabContent.tsx
  - src/components/profile/WornCalendar.tsx
  - src/components/profile/WornTabContent.tsx
  - src/components/profile/WornTimeline.tsx
  - src/components/settings/PrivacyToggleRow.tsx
  - src/components/settings/SettingsClient.tsx
  - src/components/settings/SettingsSection.tsx
  - src/data/profiles.ts
  - src/data/watches.ts
  - src/data/wearEvents.ts
  - src/db/schema.ts
  - src/lib/stats.ts
  - src/lib/tasteTags.ts
  - src/lib/types.ts
findings:
  critical: 1
  warning: 7
  info: 8
  total: 16
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-04-21T08:00:46Z
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

The phase delivers a coherent self-profile + privacy-controls slice. The IDOR posture for the new Server Actions (`updateNoteVisibility`, `removeNote`, `updateProfile`, `updateProfileSettings`) is solid: every write scopes by `user.id` from the session, Zod schemas use `.strict()` to block mass assignment, and the visibility-field schema is a hard enum allow-list. Async `params` are awaited correctly, `redirect()` lives outside try/catch, and `useOptimistic` / `useTransition` flows snap back on failure via a reload of server state.

The most material gap is a downstream IDOR in `markAsWorn` (Phase 7 code, but newly exposed by the Phase 8 `LogTodaysWearButton`): the Server Action does not verify that the supplied `watchId` is actually owned by the caller before writing a `wear_events` row, and the unique constraint will not catch a foreign `watchId` because `(userId, watchId, wornDate)` combinations from different `userId` values are unique. There are also a handful of medium-severity privacy-gate inconsistencies and dead UI affordances worth fixing.

## Critical Issues

### CR-01: `markAsWorn` allows logging wear for another user's `watchId`

**File:** `src/app/actions/wearEvents.ts:10-37` (called from `src/components/profile/LogTodaysWearButton.tsx:38`)
**Issue:** `markAsWorn(watchId)` reads `userId` from the session (good) but accepts the `watchId` directly from the client and passes it to `wearEventDAL.logWearEvent(user.id, watchId, today)`. The DAL inserts `{ userId: user.id, watchId, wornDate: today }` with `onConflictDoNothing()`. The unique index in `src/db/schema.ts:196` is on `(user_id, watch_id, worn_date)`, so a malicious caller can submit any UUID — even one belonging to another user's watch — and a row will be inserted under their own `userId` pointing at someone else's watch. Subsequent reads (`getMostRecentWearDates`, `getAllWearEventsByUser`, the Worn calendar/timeline, and `wearCountByWatchMap` used by Stats) silently include those rows because they only filter by `userId`. The foreign-key constraint also references `watches.id` without a (user_id, id) composite, so it will not block this.

This phase did not introduce `markAsWorn`, but the new `LogTodaysWearButton` is the first UI that exposes a free-form `watchId` source-of-truth (a Select that, in the current owner-only flow, only lists the owner's watches — but the underlying Server Action itself accepts any UUID).

**Fix:**
```ts
// src/app/actions/wearEvents.ts
export async function markAsWorn(watchId: string): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  // Validate ownership BEFORE writing.
  const watch = await watchDAL.getWatchById(user.id, watchId)
  if (!watch) {
    // Return the same generic message used by notes IDOR mitigation so existence is not leaked.
    return { success: false, error: 'Watch not found' }
  }

  const today = new Date().toISOString().split('T')[0]
  try {
    await wearEventDAL.logWearEvent(user.id, watchId, today)
    // ...rest unchanged
  }
  // ...
}
```
Optionally also add `z.string().uuid()` validation on the `watchId` parameter to reject non-UUID input early.

## Warnings

### WR-01: `notes` tab ignores `collection_public` for non-owners

**File:** `src/app/u/[username]/[tab]/page.tsx:94-101`
**Issue:** The `notes` tab is filtered only by per-note `notesPublic` (D-13). When a user sets `collectionPublic=false`, their Collection tab is gated by `PrivateTabState` (line 56), but their Notes tab keeps rendering every public-noted watch — leaking brand/model/reference of watches the owner intended to hide. Notes are always attached to a specific watch and the row card surfaces the watch name + image + `<Link href="/watch/{id}">`, so this effectively re-exposes the collection through a side channel.

**Fix:** Either gate notes behind `collection_public` for non-owners (matching how Stats inherits collection visibility on line 136), or document and confirm that notes are intentionally independent. If the latter, also strip the watch-link/brand/model from `NoteRow` for non-owners so notes don't re-leak the collection.
```ts
if (tab === 'notes' && !isOwner && !settings.collectionPublic) {
  return <PrivateTabState tab="notes" />
}
```

### WR-02: `noteDefault` Setting is non-functional UI

**File:** `src/components/settings/SettingsClient.tsx:44-68, 107-119`
**Issue:** The "New Note Visibility" Select reads/writes `localStorage['horlo:noteVisibilityDefault']` but nothing on the watch-creation/edit path consumes it. `src/db/schema.ts:73` defaults `notes_public` to `true` server-side, and `src/app/actions/watches.ts` does not include `notesPublic` in `insertWatchSchema` so it is never set on creation. The dropdown therefore has zero behavioral effect — flipping it to "private" still produces public notes. This is a privacy footgun: a user reasonably believes they have changed a default and will not check each new watch.

**Fix:** Either (a) wire the default through the new-watch and edit-watch forms (read from `localStorage` in the form, send `notesPublic` to `addWatch`/`editWatch`, and add `notesPublic` to `insertWatchSchema`/`updateWatchSchema`), or (b) gate the dropdown behind `disabled` with a "Coming soon" badge until persistence lands. The PRIVACY-CRITICAL path is option (a); option (b) at minimum stops misleading users.

### WR-03: `notesUpdatedAt` bumped on visibility-only toggle

**File:** `src/app/actions/notes.ts:38-46`
**Issue:** `updateNoteVisibility` sets `notesUpdatedAt: new Date()` even though the user only flipped public/private. `NoteRow.tsx:29` then renders that timestamp as "Today / N days ago" next to the note body, which now means "you toggled visibility today" rather than "you wrote/edited this note today." The label is misleading and could push collectors to re-read or ignore notes that did not actually change.

**Fix:**
```ts
// src/app/actions/notes.ts:37-46
const result = await db
  .update(watches)
  .set({
    notesPublic: parsed.data.isPublic,
    updatedAt: new Date(),     // row-level timestamp is fine
    // notesUpdatedAt intentionally NOT touched — note content unchanged
  })
  .where(...)
```

### WR-04: `LogTodaysWearButton` button shown to non-owner viewers when wornPublic is on

**File:** `src/app/u/[username]/[tab]/page.tsx:103-131`, `src/components/profile/WornTabContent.tsx:93`
**Issue:** The page guards `WornTabContent` against non-owners only when `wornPublic=false`. When `wornPublic=true`, the page renders `WornTabContent` with `isOwner={isOwner}` (correct), but `isOwner` is computed from `viewerId === profile.id` so it will be `false` for non-owners. The `LogTodaysWearButton` does check `{isOwner && <LogTodaysWearButton ... />}` so it is hidden — that part is fine.

However, the `LogTodaysWearButton` itself has no extra ownership guard inside (it just renders a Dialog). The `markAsWorn` action it calls has no check either — combined with CR-01 above, an attacker who scripts the request bypasses the UI gate entirely. The defense-in-depth fix for CR-01 covers this.

**Fix:** Same as CR-01.

### WR-05: `getProfileByUsername` is case-sensitive — `/u/Tyler` is a different profile from `/u/tyler`

**File:** `src/data/profiles.ts:28-35`, `src/db/schema.ts:130-142`
**Issue:** `username` lookups use `eq(profiles.username, username)` and the unique index is plain `text` without a `lower(username)` expression. A user who registered as `tyler` will return `null` for any URL that capitalizes their handle, producing a 404. Worse, if the system later allows mixed-case signups, two distinct profiles can co-exist as `Tyler` and `tyler`, opening username-spoofing/phishing risk where a follower thinks they're following the right person.

**Fix:** Normalize username on signup AND on lookup. Either:
```ts
// src/data/profiles.ts
export async function getProfileByUsername(username: string) {
  const rows = await db
    .select()
    .from(profiles)
    .where(sql`lower(${profiles.username}) = lower(${username})`)
    .limit(1)
  return rows[0] ?? null
}
```
…and add a Postgres `CREATE UNIQUE INDEX ON profiles (lower(username))` migration to prevent same-letters-different-case duplicates. Alternatively, enforce lowercase at signup and reject uppercase here.

### WR-06: `getMostRecentWearDates` uses dynamic import inside hot path

**File:** `src/data/wearEvents.ts:43-61`
**Issue:** Line 48 does `const { inArray } = await import('drizzle-orm')` inside the function body. The Profile collection/wishlist/notes tabs hit this on every server render. Dynamic imports defeat tree-shaking, add a microtask per call, and read as code smell next to the static `import { eq, and, desc } from 'drizzle-orm'` two lines above. There's no apparent reason for the dynamic import (no circular dep — `inArray` is in the same package already imported).

**Fix:**
```ts
// src/data/wearEvents.ts:5
import { eq, and, desc, inArray } from 'drizzle-orm'

// ...delete the dynamic import on line 48
```

### WR-07: `revalidatePath('/u/[username]/notes', 'page')` may not match the dynamic route

**File:** `src/app/actions/notes.ts:51, 101`
**Issue:** Next.js 16 expects literal route templates for `revalidatePath` with a `'page'` selector. The `[username]` segment is correct as a literal, but the route actually rendered is `/u/[username]/[tab]/page.tsx` — the path segment is `[tab]`, not `notes`. Calling `revalidatePath('/u/[username]/notes', 'page')` will not match the compiled route entry and will silently no-op, leaving the Notes tab stale until a hard navigation. The same applies if you intended to revalidate the layout.

**Fix:** Revalidate the dynamic route segment that the App Router actually produced:
```ts
revalidatePath('/u/[username]/[tab]', 'page')
// or revalidate the layout to be safe:
revalidatePath('/u/[username]', 'layout')
```
Verify with a manual smoke test: toggle a note's visibility on a 2-watch collection, then refresh — without the fix, the pill snaps back correctly via `useOptimistic`, but a sibling tab (e.g. Stats) won't reflect the change until next navigation.

## Info

### IN-01: `notesPublic` not in `insertWatchSchema` / `updateWatchSchema`

**File:** `src/app/actions/watches.ts:13-41`
**Issue:** `mapDomainToRow` (DAL) accepts `notesPublic`, but the Server Action schemas don't include it. This is intentional (visibility is its own action), but means the regular watch-edit form cannot set it even on first creation — every new note starts public regardless of any default. Tied to WR-02.
**Fix:** Add `notesPublic: z.boolean().optional()` to both schemas if you decide to wire the Settings default through this path.

### IN-02: `HorizontalBarChart` uses `row.label` as React key

**File:** `src/components/profile/HorizontalBarChart.tsx:23`
**Issue:** `key={row.label}` collides if two distribution rows have the same label (e.g. case-mismatched style tags `Diver` vs `diver`). `styleDistribution` and `roleDistribution` in `src/lib/stats.ts` do not normalize case, so this is reachable.
**Fix:** Either normalize tag case in `calculateDistribution` (`v.toLowerCase()` when bucketing), or use `key={`${row.label}:${i}`}` with the index from `.map((row, i) => …)`.

### IN-03: `bucketWearsByWeekday` parses dates with implicit local timezone

**File:** `src/lib/stats.ts:142-148`, `src/components/profile/WornTimeline.tsx:25-31`, `src/components/profile/WornCalendar.tsx:32-34`
**Issue:** `new Date(yyyyMmDd + 'T00:00:00')` parses in the server/browser local timezone. Wear events stored as `'2026-04-19'` will bucket into a different weekday for users in different timezones, and the "Most Active Wearing Day" observation can flip based on whether the page renders on the server (UTC) vs client (local). Stats is server-rendered now, but if any of these helpers later run on the client (e.g. through revalidate-on-client), the result diverges.
**Fix:** Standardize on UTC for date math:
```ts
const d = new Date(e.wornDate + 'T00:00:00Z')
const dow = d.getUTCDay()
```

### IN-04: `getCalendarGrid` constructs Date objects with negative day-of-month for previous-month padding

**File:** `src/components/profile/WornCalendar.tsx:36-64`
**Issue:** Line 47 constructs `new Date(year, month - 1, prevMonthLastDay - i + 1)` which is technically valid for January (`month=0`, so `month - 1 = -1` rolls to December of prior year). Works because of JS Date normalization, but reads as a footgun. Same for trailing fill on December.
**Fix:** Document the rollover behavior or compute `previous = new Date(year, month, 0)` once and use its components.

### IN-05: `LockedProfileState` renders bio without explicit length cap

**File:** `src/components/profile/LockedProfileState.tsx:28-32`
**Issue:** Bio is server-validated to ≤500 chars (`updateProfileSchema` in profile.ts), but if data was inserted out-of-band (e.g. via raw SQL or future bulk import) the locked state would render an arbitrarily long bio. React auto-escapes so there's no XSS risk; this is purely a layout-blowup concern.
**Fix:** Add `line-clamp-3` (or similar) to the bio paragraph and rely on the server cap as the source of truth.

### IN-06: `ProfileHeader.tsx:54` shows `@username` only when `displayName` exists

**File:** `src/components/profile/ProfileHeader.tsx:51-56`
**Issue:** When `displayName` is null the H1 shows `@username` and the secondary line is omitted, but when `displayName` is set the H1 shows the display name. A non-owner viewer who lands on the profile via a share link of `@tyler` may not realize they're on `Tyler Waneka`'s profile if the displayName is something distinct like "Watch Guy 2026". Minor IA issue.
**Fix:** Always show `@username` somewhere in the header even when displayName fills the H1.

### IN-07: `Header.tsx` swallows DB errors when fetching the viewer's username

**File:** `src/components/layout/Header.tsx:24-30`
**Issue:** The `try { ... } catch { username = null }` block silently masks every error from `getProfileById`. A real DB outage falls through as "no Profile link in nav" without any log, making the bug invisible. The header still renders, which is the right UX, but no diagnostic exists.
**Fix:**
```ts
try {
  const profile = await getProfileById(user.id)
  username = profile?.username ?? null
} catch (err) {
  console.error('[Header] failed to resolve viewer username:', err)
  username = null
}
```

### IN-08: `RemoveNoteDialog` does not surface failure to the user

**File:** `src/components/profile/RemoveNoteDialog.tsx:32-41`
**Issue:** On failure, only `console.error` runs; the dialog stays open in its idle state and the user has no signal the action failed. Consistent with the rest of the codebase (NoteVisibilityPill, PrivacyToggleRow follow the same "snap-back via revalidate; log to console" pattern), but here the optimistic snap-back doesn't apply because removing a note is destructive.
**Fix:** Add a local `error` state and render it like `LogTodaysWearButton` does (`<p role="alert">`), or add an inline toast. Until the toast system lands, mirror the `LogTodaysWearButton` pattern explicitly.

---

_Reviewed: 2026-04-21T08:00:46Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
