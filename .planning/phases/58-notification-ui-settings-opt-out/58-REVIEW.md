---
phase: 58-notification-ui-settings-opt-out
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/app/actions/profile.ts
  - src/components/notifications/NotificationRow.tsx
  - src/components/notifications/NotificationsInbox.tsx
  - src/components/settings/NotificationsSection.tsx
  - src/data/profiles.ts
  - tests/components/home/PersonalInsightsGrid.test.tsx
  - tests/components/notifications/NotificationRow.test.tsx
  - tests/components/notifications/NotificationsInbox.test.tsx
  - tests/components/settings/NotificationsSection.test.tsx
  - tests/components/settings/SettingsTabsShell.test.tsx
  - tests/data/profiles.test.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 58: Code Review Report

**Reviewed:** 2026-05-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 58 extends the profile_settings persistence chain with `notifyOnLike` and `notifyOnComment` opt-out fields, adds four new notification type renderers to `NotificationRow`, extends the like-collapse grouping in `NotificationsInbox`, and surfaces two new toggles in `NotificationsSection`. The core security concerns raised in the phase context were verified:

- **Server Action allowlist (T-08-04):** The `VISIBILITY_FIELDS` `as const` tuple + `z.enum()` correctly rejects any field not in the list. The `updateProfileSettingsField` DAL function accepts only the `VisibilityField` union type. Mass-assignment protection is preserved.
- **comment_preview rendering:** `{commentPreview}` is rendered as a React text node (line 118 of `NotificationRow.tsx`), never via `dangerouslySetInnerHTML`. React escapes HTML entities in text content. No XSS risk.
- **Deep-link href construction:** All href segments (`watch_id`, `wear_event_id`, `actor_username`) originate from server-written notification payloads whose values are DB-sourced (UUIDs, lowercase-constrained usernames). No open-redirect or path-injection vector.
- **Like-collapse key collision:** `watch_like` and `wear_like` use type-prefixed keys (`watch_like|…` and `wear_like|…`); these cannot collide with each other. However, the `watch_overlap` key uses a different, non-type-prefixed format — see WR-01 below.

Three warnings and one info item are raised.

## Warnings

### WR-01: `collapseWatchOverlaps` shares a `groups` Map across three notification types but `watch_overlap` key lacks a type prefix — latent cross-type collision

**File:** `src/components/notifications/NotificationsInbox.tsx:87-95`

**Issue:** `watch_like` and `wear_like` keys are type-prefixed (`watch_like|<id>|<day>` and `wear_like|<id>|<day>`), which prevents them from colliding with each other. The `watch_overlap` key is **not** type-prefixed: `${brand}|${model}|${day}`. All three types write into the same `groups` Map.

If a user stores a watch with `brand = "watch_like"` (after normalization via `LOWER(TRIM(…))`), the `watch_overlap` key for that brand would be `watch_like|<model>|<day>` — identical to a `watch_like` key for a watch with `watch_id = <model>`. The two types would incorrectly merge into a single grouped row, yielding a wrong `actorCount` and displaying the wrong notification copy.

No production watch brand normalizes to `"watch_like"`, so this is latent rather than active. However, the design is inconsistent: `watch_like` and `wear_like` are explicitly type-prefixed to avoid exactly this class of collision (per the comment at line 98), but `watch_overlap` was not updated to match.

**Fix:** Add a type prefix to the `watch_overlap` key to make the defense symmetric:
```typescript
// Before (line 92):
const key = `${brand}|${model}|${day}`

// After:
const key = `watch_overlap|${brand}|${model}|${day}`
```

---

### WR-02: `profiles.test.ts` — existing test `"returns the row values when a profile_settings row exists"` does not cover the Phase 58 fields; the test mock and expected object are both stale

**File:** `tests/data/profiles.test.ts:45-66`

**Issue:** The mock row at lines 46–56 does **not** include `notifyOnLike` or `notifyOnComment`. The `getProfileSettings` function (added in Phase 58) explicitly reads `rows[0].notifyOnLike` and `rows[0].notifyOnComment` and sets them in the returned object. When the keys are absent on the mock row, `rows[0].notifyOnLike` evaluates to `undefined`. The `expect(settings).toEqual(…)` at lines 57–66 also omits these keys.

Vitest's `toEqual` uses `hasDefinedKey` (which excludes properties whose value is `undefined` from the key-count comparison), so the test **passes silently** even though the actual return value carries `notifyOnLike: undefined` and `notifyOnComment: undefined` — not the correct boolean values. This means the Phase 58 read path for these fields is entirely untested.

If a future change accidentally swaps `notifyOnLike` and `notifyOnComment` in the return struct (e.g., a copy-paste error), this test would not catch it.

**Fix:** Update the mock row and expected object to include the Phase 58 fields:
```typescript
mockRows = [
  {
    userId: 'user-with-row',
    profilePublic: false,
    collectionPublic: true,
    wishlistPublic: false,
    notificationsLastSeenAt: new Date('2026-04-01T00:00:00Z'),
    notifyOnFollow: true,
    notifyOnWatchOverlap: false,
    notifyOnLike: false,      // ← add
    notifyOnComment: true,    // ← add (non-default to catch swaps)
  },
]
const settings = await getProfileSettings('user-with-row')
expect(settings).toEqual({
  userId: 'user-with-row',
  profilePublic: false,
  collectionPublic: true,
  wishlistPublic: false,
  notificationsLastSeenAt: new Date('2026-04-01T00:00:00Z'),
  notifyOnFollow: true,
  notifyOnWatchOverlap: false,
  notifyOnLike: false,      // ← add
  notifyOnComment: true,    // ← add
})
```

---

### WR-03: `collapseWatchOverlaps` function name is misleading — it now handles three notification types including `watch_like` and `wear_like`

**File:** `src/components/notifications/NotificationsInbox.tsx:82`

**Issue:** The function is named `collapseWatchOverlaps` but as of Phase 58 it collapses `watch_overlap`, `watch_like`, and `wear_like` rows. A developer working on the inbox in a future phase might add a new groupable type (e.g., `collection_like`) and search for the collapse logic under a more generic name — and miss this function entirely. Or they might see the name and assume it only touches `watch_overlap` rows, leading them to add a separate (duplicate) collapse pass.

**Fix:** Rename to `collapseGroupableNotifications` (or `collapseByGroup`) and update the JSDoc accordingly:
```typescript
// Before:
function collapseWatchOverlaps(rows: NotificationRowData[]): NotificationRowData[] {

// After:
/**
 * Collapse groupable notification rows by (type, target_id, UTC-day).
 * Handles: watch_overlap, watch_like, wear_like.
 * Non-grouped: follow, watch_comment, wear_comment (pass through unchanged).
 */
function collapseGroupableNotifications(rows: NotificationRowData[]): NotificationRowData[] {
```

Also update the call site at line 25:
```typescript
const collapsed = collapseGroupableNotifications(rows)
```

## Info

### IN-01: `aria-label` on grouped notification rows names only the lead actor — screen-reader copy is misleading for collapsed rows

**File:** `src/components/notifications/NotificationRow.tsx:100`

**Issue:** The `aria-label` is always `"{actorName} notification"` regardless of `actorCount`. When a grouped row has `actorCount=3`, the visible text reads "Alice + 2 others liked your Submariner", but the announced accessible name is "Alice notification". A screen-reader user hears only "Alice" — the grouped context is lost.

**Fix:** Compute the accessible label to reflect the group:
```typescript
const ariaLabel =
  actorCount > 1
    ? `${actorName} and ${actorCount - 1} others notification`
    : `${actorName} notification`

// Then in JSX:
aria-label={ariaLabel}
```

---

_Reviewed: 2026-05-24T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
