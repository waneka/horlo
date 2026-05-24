# Phase 58: Notification UI + Settings Opt-Out - Research

**Researched:** 2026-05-24
**Domain:** React component extension (NotificationRow, NotificationsInbox) + Settings persistence wiring
**Confidence:** HIGH — all findings verified against actual source files

## Summary

Phase 58 is a small, well-constrained UI + wiring phase. The backend is fully complete. The only work is: (a) extend the B-8 guard in `NotificationRow` to render four new types with copy + deep-links, (b) generalize the like-grouping in `NotificationsInbox`, and (c) add two toggles to `NotificationsSection` with `ProfileSettings` + `VisibilityField` + `updateProfileSettingsField` wired through.

The codebase matches the CONTEXT.md descriptions closely with **three significant drift items** that the planner must address as explicit tasks:

1. **`ProfileSettings` type in `src/data/profiles.ts`** does not include `notifyOnLike` or `notifyOnComment` — they exist in the DB schema and logger but were never added to the TypeScript type or `getProfileSettings` return value. This is the widest blast radius item: it requires edits in `profiles.ts`, `DEFAULT_SETTINGS`, `getProfileSettings`, and the DAL upsert.

2. **`VisibilityField` union and `VISIBILITY_FIELDS` constant in `src/app/actions/profile.ts`** do not include `'notifyOnLike'` or `'notifyOnComment'`. The `updateProfileSettings` Server Action uses `z.enum(VISIBILITY_FIELDS)` — any toggle call with the new fields currently returns `{ success: false, error: 'Invalid settings payload' }`. This must be widened before the toggles can persist.

3. **`updateProfileSettingsField` upsert in `src/data/profiles.ts`** only lists the five existing fields in the `INSERT ... .values({...})` path — the new fields are missing from the insert values object (the `onConflictDoUpdate` would work for existing rows, but the fallback insert would ignore the new fields). Must add `notifyOnLike` and `notifyOnComment` with conditional values.

**Primary recommendation:** Plan four edit groups: (1) backend type/DAL widening (profiles.ts + actions/profile.ts), (2) NotificationRow render extension, (3) NotificationsInbox collapse generalization, (4) NotificationsSection toggle addition + test updates.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Voice = "name the watch, label the wear." Copy strings are verbatim in CONTEXT.md.
- D-02: Comment rows show `payload.comment_preview` on a muted second line (line-clamp-2). Like rows have no second line.
- D-03: Grouped-like phrasing uses existing "+ N others" convention (NOT "and N others").
- D-04: Likes collapse per (type, target_id, calendar-day) — reuse/extend `collapseWatchOverlaps` pattern.
- D-05: Comments are never grouped. Pass through unchanged.
- D-06: Grouped like rows — displayed row's `id` is what `markNotificationRead` targets. Bucketing unchanged.
- D-07: `watch_like` / `watch_comment` → `/watch/{payload.watch_id}`; `wear_like` / `wear_comment` → `/wear/{payload.wear_event_id}`. No scroll anchor.
- D-08: Extend the B-8 guard for the four new types; keep null fallback for unknown future types.
- D-09: Rename "Email notifications" → "Notifications"; add `notifyOnLike` + `notifyOnComment` toggles.
- D-10: Toggle labels and `field=` values are specified verbatim in CONTEXT.md.
- D-11: Suppression already enforced server-side in logger. Only UI + persistence + `ProfileSettings` Pick widen needed.

### Claude's Discretion
- Exact Tailwind classes / spacing for the muted comment-preview second line.
- Whether to refactor `collapseWatchOverlaps` into a generalized helper vs. adding parallel collapse branches.
- Test shape (unit vs integration) for grouping + opt-out wiring, following Phase 55/57 Nyquist patterns.

### Deferred Ideas (OUT OF SCOPE)
- Likes in the home activity feed (confirmed NOT added).
- Scroll-anchoring comment deep-links to a specific comment (deferred).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-15 | User can independently opt out of like and comment notifications in Settings | Toggles persist via `updateProfileSettings` SA → `updateProfileSettingsField` DAL. Three drift items block this: `ProfileSettings` type, `VisibilityField` union, and upsert insert values. All addressable in one wave. |
| NOTIF-16 | Like/comment notifications render with clear copy and deep-link to target in existing inbox + bell | `NotificationRow` B-8 guard, `resolveHref`, `resolveCopy` all need extension. `getNotificationsForViewer` already returns all 6 types. Routes `/watch/[id]` and `/wear/[wearEventId]` confirmed to exist. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Notification row rendering (copy + href) | Browser / Client | — | `NotificationRow` is `'use client'`; uses `useOptimistic` + `useRouter` |
| Like grouping (collapse) | Browser / Client | — | `collapseWatchOverlaps` runs in `NotificationsInbox` (Server Component but pure JS — no DB) |
| Settings toggle persistence | API / Backend (Server Action) | Browser (optimistic) | `PrivacyToggleRow` calls `updateProfileSettings` SA; `PrivacyToggleRow` is `'use client'` for optimistic |
| Settings data fetch | Frontend Server (SSR) | — | `/settings` page calls `getProfileSettings` server-side at render |
| Opt-out suppression | API / Backend | — | `logNotification` reads `profile_settings` columns at write-time; already complete |

---

## Codebase Verification Report

### NotificationRow.tsx — VERIFIED with drift

| Claim | Actual | Status |
|-------|--------|--------|
| B-8 guard at ~line 52 returns null for non-follow/watch_overlap | Line 52: `if (row.type !== 'follow' && row.type !== 'watch_overlap') { return null }` | EXACT MATCH |
| `NotificationRowData` interface at lines 19-32 with `actorCount?: number` | Lines 19-32; `actorCount?: number` on line 31 | EXACT MATCH |
| `resolveHref` at lines 116-134 | Lines 116-134, comment at line 131 explains Phase 53 D-09 stub | EXACT MATCH |
| `resolveCopy` at lines 136-180 | Lines 136-180; `actorClass` pattern at 142-144 | EXACT MATCH |
| `"+ {actorCount-1} others"` overlap precedent | Line 162: `+ {actorCount - 1} others also own your` | EXACT MATCH — confirms D-03 phrase shape |
| `AvatarDisplay` + `timeAgo` + `actorClass` unread-weight pattern | All present; `actorClass` at 142-144, `timeAgo` at 60, `AvatarDisplay` at 102 | CONFIRMED |

**Type union already includes all 6 types** (line 23): `'follow' | 'watch_overlap' | 'watch_like' | 'wear_like' | 'watch_comment' | 'wear_comment'` — Phase 53 pre-wired this. The TS type is not a blocker.

### NotificationsInbox.tsx — VERIFIED

| Claim | Actual | Status |
|-------|--------|--------|
| `collapseWatchOverlaps` at lines 76-110 | Lines 76-110 | EXACT MATCH |
| `bucketByDay` at lines 123-145 | Lines 123-145 | EXACT MATCH |
| Most-recent-actor-wins + actorCount + newest-first re-sort | Lines 97-108 | CONFIRMED |

**Key implementation note for like grouping:** `collapseWatchOverlaps` currently separates `watch_overlap` rows into a group map and puts ALL other types into `nonOverlap`. The like-grouping extension must intercept `watch_like` and `wear_like` before they fall through to `nonOverlap`. The simplest approach is extending the `if (row.type !== 'watch_overlap')` early-continue to also check for the two like types, using `payload.watch_id` or `payload.wear_event_id` as the key instead of brand/model normalized. The group map can share the same structure; key format: `${type}|${targetId}|${day}`.

### types.ts — VERIFIED with observation

All four payload types confirmed with exact field names:
- `WatchLikePayload`: `watch_id`, `watch_model` (no `watch_brand` needed for copy)
- `WearLikePayload`: `wear_event_id`, `watch_model`
- `WatchCommentPayload`: `watch_id`, `watch_model`, `comment_id`, `comment_preview`
- `WearCommentPayload`: `wear_event_id`, `watch_model`, `comment_id`, `comment_preview`

**Observation:** `WatchLikePayload` and `WearLikePayload` do NOT include a `watch_brand` field dedicated to display (they have `watch_brand` but D-01 copy only uses `watch_model`). `resolveCopy` for like/comment types should read `payload.watch_model`, same as `watch_overlap` already does. Field names confirmed load-bearing per type file comment.

### notifications.ts (DAL) — VERIFIED

`getNotificationsForViewer` returns all 6 types via LEFT JOIN on profiles. No change needed. `getNotificationsUnreadState` is type-agnostic (EXISTS query on `notifications` table with no type filter) — automatically lights the bell for all 6 types without any change.

### NotificationsSection.tsx — VERIFIED with drift

Current state: `Pick<ProfileSettings, 'notifyOnFollow' | 'notifyOnWatchOverlap'>` (confirmed line 6-7). Title "Email notifications" confirmed line 18. **The Pick must widen to include `'notifyOnLike' | 'notifyOnComment'`** per D-11.

### PrivacyToggleRow.tsx — VERIFIED

Uses `field: VisibilityField` prop type (line 10). Calls `updateProfileSettings({ field, value })` via `'@/app/actions/profile'`. Optimistic toggle + snap-back pattern confirmed.

**DRIFT — BLOCKING:** `VisibilityField` in `src/data/profiles.ts` (lines 18-23) only contains `'profilePublic' | 'collectionPublic' | 'wishlistPublic' | 'notifyOnFollow' | 'notifyOnWatchOverlap'`. `notifyOnLike` and `notifyOnComment` are absent. If the new `PrivacyToggleRow` instances pass `field="notifyOnLike"`, TypeScript will reject it at compile time AND the SA's Zod enum will reject it at runtime.

### profiles.ts (ProfileSettings type) — VERIFIED with drift

**DRIFT — BLOCKING (3 separate gaps):**

1. **`ProfileSettings` interface** (lines 7-16): only has `notifyOnFollow` and `notifyOnWatchOverlap`. `notifyOnLike` and `notifyOnComment` are absent. The TS type must add them.

2. **`DEFAULT_SETTINGS`** (lines 25-32): missing `notifyOnLike: true` and `notifyOnComment: true`. Must be added so missing-row fallback returns sane defaults.

3. **`getProfileSettings` return** (lines 100-111): only maps `notifyOnFollow` and `notifyOnWatchOverlap` from the DB row. Must add `notifyOnLike: rows[0].notifyOnLike` and `notifyOnComment: rows[0].notifyOnComment`.

4. **`VisibilityField` union** (lines 18-23): must add `'notifyOnLike' | 'notifyOnComment'`.

5. **`updateProfileSettingsField` upsert** (lines 155-171): the `db.insert(...).values({...})` path (for missing rows) does not include `notifyOnLike` or `notifyOnComment`. Must add conditional values matching the existing pattern: `notifyOnLike: field === 'notifyOnLike' ? value : true`. The `.onConflictDoUpdate` at line 169 uses `set: { [field]: value, updatedAt: new Date() }` — this is already general and will work once `VisibilityField` includes the new values.

### actions/profile.ts — VERIFIED with drift

**DRIFT — BLOCKING:** `VISIBILITY_FIELDS` constant (lines 56-62) and `updateSettingsSchema` Zod enum do not include `'notifyOnLike'` or `'notifyOnComment'`. SA returns `{ success: false, error: 'Invalid settings payload' }` for any toggle attempt with the new fields. Must add both to `VISIBILITY_FIELDS`.

### schema.ts — VERIFIED

`notifyOnLike` at line 273, `notifyOnComment` at line 274, both `boolean('...').notNull().default(true)`. Columns confirmed in `profileSettings` table.

### logger.ts — VERIFIED (no changes needed)

Opt-out reads at lines 87-105. Reads `notifyOnLike` (line 91) and `notifyOnComment` (line 92) from `profileSettings`. Checks at lines 104-105. D-11 confirmed: logger already suppresses likes/comments when opted out. No change needed here.

### Settings page (src/app/settings/page.tsx) — VERIFIED

Calls `getProfileSettings(userId)` and passes result as `settings={settings}` to `SettingsTabsShell`. `SettingsTabsShell` passes it directly as `settings={props.settings}` to `NotificationsSection` (line 160). The pass-through is a bare `settings` prop typed as `ProfileSettings` — once `ProfileSettings` is widened and `getProfileSettings` returns the new fields, the full chain from DB to toggle is complete. **No additional wiring needed in the page or shell.**

### Deep-link routes — VERIFIED

- `/watch/[id]`: `src/app/watch/[id]/page.tsx` — confirmed exists
- `/wear/[wearEventId]`: `src/app/wear/[wearEventId]/page.tsx` — confirmed exists

Both routes match the D-07 deep-link targets exactly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Like grouping logic | New collapse algorithm | Extend `collapseWatchOverlaps` with like-aware key function (D-04) |
| Toggle component | New switch UI | Reuse `PrivacyToggleRow` verbatim (proven optimistic + SA pattern) |
| Toggle persistence | Custom fetch/mutation | Existing `updateProfileSettings` SA path (once widened) |
| Comment preview truncation | JS slice | Tailwind `line-clamp-2` on the second-line `<p>` |

---

## Common Pitfalls

### Pitfall 1: collapseWatchOverlaps — pass-through logic for likes
**What goes wrong:** Current function puts ALL non-`watch_overlap` types into `nonOverlap` before any grouping. If like rows aren't intercepted before that push, they pass through uncollapsed.
**Why it happens:** The existing guard `if (row.type !== 'watch_overlap')` is a blanket pass-through.
**How to avoid:** Check for `watch_like` and `wear_like` before the `nonOverlap.push` — use a separate group map (or extend the existing map with a type-prefixed key). The key format for likes must include `type` to prevent `watch_like` rows from merging with `watch_overlap` rows sharing the same `watch_id` (the overlap key uses brand+model+day, not watch_id, but be explicit).

### Pitfall 2: updateProfileSettingsField upsert insert-path
**What goes wrong:** The `db.insert(...).values({...})` path (executed only when the row is missing) omits `notifyOnLike` and `notifyOnComment`. For existing prod users the `onConflictDoUpdate` path fires; for any new user whose `profile_settings` row hasn't been inserted yet, the insert would default to `true` from the DB DEFAULT — fine functionally, but the TypeScript code should be explicit to avoid confusion.
**How to avoid:** Add `notifyOnLike: field === 'notifyOnLike' ? value : true` and `notifyOnComment: field === 'notifyOnComment' ? value : true` to the values object.

### Pitfall 3: VisibilityField / VISIBILITY_FIELDS desync
**What goes wrong:** `VisibilityField` type in `profiles.ts` and `VISIBILITY_FIELDS` constant in `actions/profile.ts` are maintained separately. Widening one without the other causes TS to accept the prop type but the SA to reject at runtime (or vice versa).
**How to avoid:** Widen both in the same atomic commit. Verify by running `npm run build` (TS strict mode catches mismatches between the two).

### Pitfall 4: resolveCopy for wear types — watch_model field
**What goes wrong:** `WearLikePayload` and `WearCommentPayload` use `watch_model` (the model of the watch worn at the event) — the copy "liked your {model} wear" needs this field. It exists on both payload types.
**How to avoid:** Cast payload to the appropriate type and read `.watch_model` — same pattern as the existing `watch_overlap` branch which reads `payload.watch_model`.

### Pitfall 5: NotificationsSection test fixture only has 2 fields
**What goes wrong:** `tests/components/settings/NotificationsSection.test.tsx` has a `settings` fixture with only `{ notifyOnFollow: true, notifyOnWatchOverlap: true }`. After widening the Props type, TS will error in the test because the fixture is missing `notifyOnLike` and `notifyOnComment`.
**How to avoid:** Update the fixture in the existing test. Also assert that the new toggle labels render and that clicking them calls `updateProfileSettings` with the correct field names.

### Pitfall 6: Existing NotificationsSection test title assertion
**What goes wrong:** The test at line 52 asserts an `h2` exists inside a `SettingsSection` card frame — this will still pass. But D-09 renames the title "Email notifications" → "Notifications". There is no test asserting the title text currently, so the rename won't break tests. However, a new test (or update) should verify the new title.

### Pitfall 7: Comment preview second line — `line-clamp-2` requires CSS
**What goes wrong:** `line-clamp-2` is a Tailwind utility that requires `@tailwindcss/line-clamp` in older setups, but Tailwind CSS 4 (this project's version) includes it natively via CSS `display: -webkit-box`. No plugin needed — just use `line-clamp-2` directly.
**How to avoid:** No action needed. Using `line-clamp-2` with Tailwind 4 works out of the box. [VERIFIED: project uses `tailwindcss ^4`]

---

## Architecture Patterns

### Like grouping — extended key function

The planner has discretion to either refactor `collapseWatchOverlaps` into a generalized `collapseRows(types, keyFn)` or add a parallel like-collapse block. Either approach must produce:

- One row per (type, targetId, UTC-day) group
- Most-recent actor wins (DAL returns newest-first; first item in group array is newest)
- `actorCount` = group size
- Newest-first re-sort after merge (existing `collapsed.sort(...)` at lines 103-108 is reusable as-is)

The key function for likes:
```typescript
// watch_like: key on payload.watch_id + UTC day
const targetId = (row.payload as { watch_id?: string })?.watch_id ?? ''
const key = `${row.type}|${targetId}|${toUtcDayKey(row.createdAt)}`
// wear_like: key on payload.wear_event_id + UTC day
const targetId = (row.payload as { wear_event_id?: string })?.wear_event_id ?? ''
const key = `${row.type}|${targetId}|${toUtcDayKey(row.createdAt)}`
```
[VERIFIED: field names match `WatchLikePayload.watch_id` and `WearLikePayload.wear_event_id` in `src/lib/notifications/types.ts`]

### resolveCopy extension pattern

```typescript
// Inside resolveCopy — four new branches follow the existing watch_overlap pattern exactly
if (row.type === 'watch_like') {
  const watchModel = (row.payload as { watch_model?: string })?.watch_model ?? 'a watch'
  if (actorCount > 1) {
    return (
      <>
        <span className={actorClass}>{actorName}</span>
        <span> + {actorCount - 1} others liked your </span>
        <span className="font-semibold text-foreground">{watchModel}</span>
      </>
    )
  }
  return (
    <>
      <span className={actorClass}>{actorName}</span>
      <span> liked your </span>
      <span className="font-semibold text-foreground">{watchModel}</span>
    </>
  )
}
```
Wear-like adds " wear" after the model. Comment branches omit actorCount (D-05) and add a second `<p>` for the preview below the main copy div.
[ASSUMED: exact Tailwind classes for the second-line preview are at Claude's discretion per CONTEXT.md]

### Comment preview second line

The second line is a sibling element to the copy `<div>`, not inside the copy `React.ReactNode`. The render area of `NotificationRow` currently renders `copy` and `· {timeLabel}` inside a single `<div className="flex-1 min-w-0 text-sm text-foreground">`. For comment rows the preview must appear as a second visual line inside this same container:

```tsx
<div className="flex-1 min-w-0 text-sm text-foreground">
  {copy}
  <span className="text-muted-foreground"> · {timeLabel}</span>
  {commentPreview && (
    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{commentPreview}</p>
  )}
</div>
```

The `commentPreview` string would be extracted inside the component after the `resolveCopy` call, or `resolveCopy` can be extended to return `{ copyNode, preview }`. Either approach is at executor's discretion. [ASSUMED: exact spacing/font-size class is Claude's discretion]

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json`

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + Testing Library |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test -- --reporter=verbose tests/components/notifications/ tests/components/settings/NotificationsSection.test.tsx tests/unit/notifications/` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-16 | watch_like renders "liked your {model}" copy | Unit (component) | `npm run test -- tests/components/notifications/NotificationRow.test.tsx` | ✅ — extend existing |
| NOTIF-16 | wear_like renders "liked your {model} wear" copy | Unit (component) | same | ✅ — extend existing |
| NOTIF-16 | watch_comment renders "commented on your {model}" copy | Unit (component) | same | ✅ — extend existing |
| NOTIF-16 | wear_comment renders "commented on your {model} wear" copy | Unit (component) | same | ✅ — extend existing |
| NOTIF-16 | Comment rows render preview second line | Unit (component) | same | ✅ — extend existing |
| NOTIF-16 | Like rows have no second line (only headline) | Unit (component) | same | ✅ — extend existing |
| NOTIF-16 | watch_like deep-link → /watch/{id} via router.push | Unit (component) | same | ✅ — extend existing |
| NOTIF-16 | wear_like deep-link → /wear/{wearEventId} via router.push | Unit (component) | same | ✅ — extend existing |
| NOTIF-16 | watch_comment deep-link → /watch/{id} | Unit (component) | same | ✅ — extend existing |
| NOTIF-16 | wear_comment deep-link → /wear/{wearEventId} | Unit (component) | same | ✅ — extend existing |
| NOTIF-16 | B-8 guard: unknown future type still returns null | Unit (component) | same | ✅ — existing test preserved |
| NOTIF-13 (via NOTIF-16) | watch_like rows with same watch_id + day collapse into one row | Unit (component) | `npm run test -- tests/components/notifications/NotificationsInbox.test.tsx` | ✅ — extend existing |
| NOTIF-13 (via NOTIF-16) | collapsed like row carries actorCount = group size | Unit (component) | same | ✅ — extend existing |
| NOTIF-13 (via NOTIF-16) | most-recent actor wins for avatar/name after collapse | Unit (component) | same | ✅ — extend existing |
| NOTIF-13 (via NOTIF-16) | grouped like copy: "{actor} + N others liked your {model}" | Unit (component) | `npm run test -- tests/components/notifications/NotificationRow.test.tsx` | ✅ — extend existing |
| NOTIF-13 (via NOTIF-16) | wear_like rows with same wear_event_id + day collapse | Unit (component) | `npm run test -- tests/components/notifications/NotificationsInbox.test.tsx` | ✅ — extend existing |
| NOTIF-16 | watch_comment rows are NOT grouped (each is separate) | Unit (component) | same | ✅ — extend existing |
| NOTIF-16 | wear_comment rows are NOT grouped | Unit (component) | same | ✅ — extend existing |
| NOTIF-15 | NotificationsSection renders 4 toggles (not 2) | Unit (component) | `npm run test -- tests/components/settings/NotificationsSection.test.tsx` | ✅ — update existing |
| NOTIF-15 | Notifications section title is "Notifications" (not "Email notifications") | Unit (component) | same | ✅ — update existing |
| NOTIF-15 | Likes toggle calls updateProfileSettings with { field: 'notifyOnLike', value: false } | Unit (component) | same | ✅ — update existing |
| NOTIF-15 | Comments toggle calls updateProfileSettings with { field: 'notifyOnComment', value: false } | Unit (component) | same | ✅ — update existing |
| NOTIF-15 | Logger skips like insert when notifyOnLike=false (existing) | Unit (logger) | `npm run test -- tests/unit/notifications/logger.test.ts` | ✅ — already exists (Phase 55) |
| NOTIF-15 | Logger skips comment insert when notifyOnComment=false (existing) | Unit (logger) | same | ✅ — already exists (Phase 55) |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/components/notifications/ tests/components/settings/NotificationsSection.test.tsx`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green + `npm run build` green before `/gsd-verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. The test files for `NotificationRow`, `NotificationsInbox`, and `NotificationsSection` already exist and must be extended (not created). The `logger.test.ts` opt-out tests already cover NOTIF-15's suppression side.

The `NotificationsSection.test.tsx` fixture at `tests/components/settings/NotificationsSection.test.tsx:24-27` must be updated to include `notifyOnLike: true` and `notifyOnComment: true` (otherwise TS will error after the type widening).

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — no new auth paths |
| V4 Access Control | yes (minor) | `updateProfileSettings` SA already verifies caller via `getCurrentUser()`; the new `VisibilityField` values inherit this protection |
| V5 Input Validation | yes | `VISIBILITY_FIELDS` Zod enum whitelist gates acceptable field names — must widen whitelist to include new fields |

No new security surface is introduced. The toggle persistence path (SA → DAL → DB) already enforces auth and Zod validation.

---

## Open Questions

1. **Comment preview rendering location**
   - What we know: `NotificationRow` renders a single `<div className="flex-1 ...">` containing `{copy}` + time label. D-02 specifies a "muted second line below the headline line."
   - What's unclear: Whether `commentPreview` is extracted inside the render function body and conditionally appended, or whether `resolveCopy` returns a richer structure. Neither is locked.
   - Recommendation: Extract `commentPreview` in the component body (alongside `href` and `copy`) and conditionally render a `<p>` as a sibling to `{copy}` inside the same flex container. Keeps `resolveCopy` as a `React.ReactNode` factory (no API change).

2. **collapseWatchOverlaps refactor vs. parallel branches**
   - What we know: D-04 says executor's choice, as long as behavior holds.
   - What's unclear: Whether to rename the function or export it under a new name.
   - Recommendation: Rename to `collapseNotificationRows` (or keep old name with an internal extension) — the internal function is not exported, so the rename is fully internal. The component still calls `collapseWatchOverlaps(rows)` (or renamed) and NotificationsInbox tests mock `NotificationRow`, so the function's test coverage comes via the Inbox tests. Either approach passes the same test suite.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind `line-clamp-2` works without a plugin in Tailwind 4 | Common Pitfalls #7 | Minor — would need `overflow-hidden` + manual CSS; easily caught by visual review |
| A2 | Exact Tailwind classes for comment preview second line (`text-xs text-muted-foreground line-clamp-2 mt-0.5`) | Architecture Patterns | Cosmetic — executor adjusts per UI-SPEC |

---

## Sources

### Primary (HIGH confidence — verified against source files)
- `src/components/notifications/NotificationRow.tsx` — all line numbers verified
- `src/components/notifications/NotificationsInbox.tsx` — all line numbers verified
- `src/lib/notifications/types.ts` — payload field names verified
- `src/data/notifications.ts` — DAL return shape verified
- `src/components/settings/NotificationsSection.tsx` — current 2-toggle state confirmed
- `src/components/settings/PrivacyToggleRow.tsx` — persistence path confirmed
- `src/data/profiles.ts` — `ProfileSettings` type, `VisibilityField`, `DEFAULT_SETTINGS`, `getProfileSettings`, `updateProfileSettingsField` all verified
- `src/db/schema.ts` — `notifyOnLike` (line 273), `notifyOnComment` (line 274) confirmed
- `src/lib/notifications/logger.ts` — opt-out reads lines 87-105 confirmed
- `src/app/actions/profile.ts` — `VISIBILITY_FIELDS` and `updateSettingsSchema` confirmed
- `src/app/settings/page.tsx` — `settings` prop pass-through chain confirmed
- `src/app/components/settings/SettingsTabsShell.tsx` — `NotificationsSection settings={props.settings}` confirmed
- `src/app/watch/[id]/page.tsx` and `src/app/wear/[wearEventId]/page.tsx` — routes confirmed
- `tests/components/notifications/NotificationRow.test.tsx` — test patterns confirmed
- `tests/components/notifications/NotificationsInbox.test.tsx` — test patterns confirmed
- `tests/components/settings/NotificationsSection.test.tsx` — fixture gap confirmed
- `vitest.config.ts` — framework confirmed
- `.planning/config.json` — `nyquist_validation: true` confirmed

### Metadata

**Confidence breakdown:**
- Drift items: HIGH — verified by reading actual source; no assumptions
- Standard stack: HIGH — no new dependencies; all existing patterns
- Architecture: HIGH — extending proven patterns
- Test plan: HIGH — test files exist; only extensions needed
- Pitfalls: HIGH — all verified against actual code

**Research date:** 2026-05-24
**Valid until:** Phase duration (no external dependencies; no npm packages; pure code extension)
