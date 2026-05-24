# Phase 58: Notification UI + Settings Opt-Out - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 6 modified files + 3 test files
**Analogs found:** 6 / 6 (all modifications extend existing patterns within the same file or a sibling)

> This phase modifies existing files only — no new files. For each change, the
> closest analog is an existing branch or construct within the same file.

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/components/notifications/NotificationRow.tsx` | component | request-response (client) | Existing `follow` + `watch_overlap` branches in same file | exact — mirror branch structure |
| `src/components/notifications/NotificationsInbox.tsx` | component | transform (client) | Existing `collapseWatchOverlaps` in same file (lines 76-110) | exact — extend same function |
| `src/components/settings/NotificationsSection.tsx` | component | request-response (client) | Existing `notifyOnFollow` / `notifyOnWatchOverlap` `PrivacyToggleRow` rows in same file | exact |
| `src/data/profiles.ts` | service / DAL | CRUD | Existing `notifyOnFollow` / `notifyOnWatchOverlap` entries throughout same file | exact — mirror every occurrence |
| `src/app/actions/profile.ts` | server action | request-response | Existing `VISIBILITY_FIELDS` + `updateSettingsSchema` in same file | exact — append to same arrays |
| `src/lib/notifications/types.ts` | types | n/a | Existing `WatchLikePayload` / `WearLikePayload` / `WatchCommentPayload` / `WearCommentPayload` already defined | read-only confirm — no change needed |

---

## Pattern Assignments

### 1. `src/components/notifications/NotificationRow.tsx` — extend 4 render branches

**Primary analogs within this file:**

#### B-8 guard (line 52) — extend to pass the four new types through

Current (analog to mirror, then extend):
```typescript
// src/components/notifications/NotificationRow.tsx:52-54
if (row.type !== 'follow' && row.type !== 'watch_overlap') {
  return null
}
```
Phase 58 extends this to a whitelist of 6 known types; the null fallback remains for any other value:
```typescript
const KNOWN_TYPES = ['follow', 'watch_overlap', 'watch_like', 'wear_like', 'watch_comment', 'wear_comment']
if (!KNOWN_TYPES.includes(row.type)) {
  return null
}
```

#### `actorName` / `actorCount` / `timeLabel` locals (lines 57-60) — reuse verbatim

```typescript
// src/components/notifications/NotificationRow.tsx:57-60
const isUnread = optimisticReadAt === null
const actorName =
  row.actorDisplayName ?? row.actorUsername ?? 'Someone'
const actorCount = row.actorCount ?? 1
const timeLabel = timeAgo(row.createdAt)
```
All four new branches use these same locals — no new variables needed.

#### `actorClass` unread-weight pattern (lines 142-144) — copy verbatim into new branches

```typescript
// src/components/notifications/NotificationRow.tsx:142-144
const actorClass = isUnread
  ? 'font-semibold text-foreground'
  : 'font-normal text-foreground'
```

#### `resolveHref` — watch_overlap branch (lines 124-129) as structural analog

```typescript
// src/components/notifications/NotificationRow.tsx:124-129
if (row.type === 'watch_overlap') {
  const p = row.payload as { actor_username?: string; watch_id?: string }
  const username = p.actor_username ?? row.actorUsername ?? ''
  const watchId = p.watch_id ?? ''
  return `/u/${username}?focusWatch=${watchId}`
}
```
New branches follow the same cast-then-read pattern:
```typescript
// Pattern for watch_like / watch_comment (D-07):
if (row.type === 'watch_like' || row.type === 'watch_comment') {
  const watchId = (row.payload as { watch_id?: string })?.watch_id ?? ''
  return `/watch/${watchId}`
}
// Pattern for wear_like / wear_comment (D-07):
if (row.type === 'wear_like' || row.type === 'wear_comment') {
  const wearEventId = (row.payload as { wear_event_id?: string })?.wear_event_id ?? ''
  return `/wear/${wearEventId}`
}
```

#### `resolveCopy` — watch_overlap branch (lines 155-174) as structural analog

Single-actor branch (lines 167-173):
```typescript
// src/components/notifications/NotificationRow.tsx:167-173
return (
  <>
    <span className={actorClass}>{actorName}</span>
    <span> also owns your </span>
    <span className="font-semibold text-foreground">{watchModel}</span>
  </>
)
```

Grouped "+"  branch (lines 158-165):
```typescript
// src/components/notifications/NotificationRow.tsx:158-165
if (actorCount > 1) {
  return (
    <>
      <span className={actorClass}>{actorName}</span>
      <span> + {actorCount - 1} others also own your </span>
      <span className="font-semibold text-foreground">{watchModel}</span>
    </>
  )
}
```
New like branches use the same shape — only the verb phrase changes. D-03 requires "+ N others" (not "and N others") — confirmed in the analog at line 162. watchModel is read identically: `(row.payload as { watch_model?: string })?.watch_model ?? 'a watch'`.

#### Render container — comment preview second line

The existing render container (lines 108-111) holds `{copy}` and the time label:
```tsx
// src/components/notifications/NotificationRow.tsx:108-111
<div className="flex-1 min-w-0 text-sm text-foreground">
  {copy}
  <span className="text-muted-foreground"> · {timeLabel}</span>
</div>
```
D-02 places the comment preview as a sibling `<p>` inside this same div:
```tsx
<div className="flex-1 min-w-0 text-sm text-foreground">
  {copy}
  <span className="text-muted-foreground"> · {timeLabel}</span>
  {commentPreview && (
    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{commentPreview}</p>
  )}
</div>
```
`commentPreview` is extracted in the component body (alongside `href` and `copy`) by casting `row.payload` to the comment types — it is NOT returned by `resolveCopy` (no API change to `resolveCopy`).

---

### 2. `src/components/notifications/NotificationsInbox.tsx` — extend collapse to like types

**Analog: `collapseWatchOverlaps` (lines 76-110) — exact mechanics to mirror**

```typescript
// src/components/notifications/NotificationsInbox.tsx:76-110
function collapseWatchOverlaps(rows: NotificationRowData[]): NotificationRowData[] {
  const groups = new Map<string, NotificationRowData[]>()
  const nonOverlap: NotificationRowData[] = []

  for (const row of rows) {
    if (row.type !== 'watch_overlap') {   // <-- this guard is the extension point
      nonOverlap.push(row)
      continue
    }
    const p = row.payload as { watch_brand_normalized?: string; watch_model_normalized?: string }
    const brand = p.watch_brand_normalized ?? ''
    const model = p.watch_model_normalized ?? ''
    const day = toUtcDayKey(row.createdAt)
    const key = `${brand}|${model}|${day}`
    const existing = groups.get(key)
    if (existing) existing.push(row)
    else groups.set(key, [row])
  }

  const collapsed: NotificationRowData[] = [...nonOverlap]
  for (const group of groups.values()) {
    // Most recent actor wins (rows arrive newest-first from DAL; first in array is newest).
    const mostRecent = group[0]
    collapsed.push({ ...mostRecent, actorCount: group.length })
  }

  // Re-sort by createdAt desc, id desc to preserve newest-first after merging.
  collapsed.sort((a, b) => {
    const aTs = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : a.createdAt.getTime()
    const bTs = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : b.createdAt.getTime()
    if (bTs !== aTs) return bTs - aTs
    return b.id.localeCompare(a.id)
  })
  return collapsed
}
```

**Extension pattern:** The guard at line 81 (`if (row.type !== 'watch_overlap')`) is a blanket pass-through. Phase 58 must intercept `watch_like` and `wear_like` before they fall through to `nonOverlap`. Pitfall 1 from RESEARCH.md makes this explicit. The like-group key format (type-prefixed to avoid collision with overlap groups sharing the same watch_id):
```typescript
// watch_like: key on payload.watch_id + UTC day
const targetId = (row.payload as { watch_id?: string })?.watch_id ?? ''
const key = `${row.type}|${targetId}|${toUtcDayKey(row.createdAt)}`
// wear_like: key on payload.wear_event_id + UTC day
const targetId = (row.payload as { wear_event_id?: string })?.wear_event_id ?? ''
const key = `${row.type}|${targetId}|${toUtcDayKey(row.createdAt)}`
```
`toUtcDayKey` (lines 112-115) is reused verbatim — no change to that helper.

The re-sort block (lines 103-108) is also reused verbatim after merge.

Comments (`watch_comment` / `wear_comment`) do NOT enter the group map — they fall through to `nonOverlap` like `follow` does (D-05).

---

### 3. `src/components/settings/NotificationsSection.tsx` — 2 new toggles + rename title

**Analog: existing `PrivacyToggleRow` rows in this same file (lines 20-31)**

```typescript
// src/components/settings/NotificationsSection.tsx:5-7 — Props (current, to widen)
interface NotificationsSectionProps {
  settings: Pick<ProfileSettings, 'notifyOnFollow' | 'notifyOnWatchOverlap'>
}
```
Phase 58 widens to:
```typescript
interface NotificationsSectionProps {
  settings: Pick<ProfileSettings, 'notifyOnFollow' | 'notifyOnWatchOverlap' | 'notifyOnLike' | 'notifyOnComment'>
}
```

```tsx
// src/components/settings/NotificationsSection.tsx:18 — title (to rename)
<SettingsSection title="Email notifications">
// → becomes:
<SettingsSection title="Notifications">
```

```tsx
// src/components/settings/NotificationsSection.tsx:20-31 — existing toggle rows (structural template)
<PrivacyToggleRow
  label="New Followers"
  description="Get notified when someone starts following you."
  field="notifyOnFollow"
  initialValue={settings.notifyOnFollow}
/>
<PrivacyToggleRow
  label="Watch Overlaps"
  description="Get notified when another collector owns a watch you own."
  field="notifyOnWatchOverlap"
  initialValue={settings.notifyOnWatchOverlap}
/>
```
Two new rows follow this exact structure (D-10 copy is verbatim):
```tsx
<PrivacyToggleRow
  label="Likes"
  description="Get notified when someone likes your watches or wear posts."
  field="notifyOnLike"
  initialValue={settings.notifyOnLike}
/>
<PrivacyToggleRow
  label="Comments"
  description="Get notified when someone comments on your watches or wear posts."
  field="notifyOnComment"
  initialValue={settings.notifyOnComment}
/>
```

---

### 4. `src/data/profiles.ts` — 3 drift fixes (BLOCKING)

Each fix mirrors the existing `notifyOnFollow` / `notifyOnWatchOverlap` entries in the same construct.

#### Drift fix 1: `ProfileSettings` interface (lines 7-16)

```typescript
// src/data/profiles.ts:7-16 — current
export interface ProfileSettings {
  userId: string
  profilePublic: boolean
  collectionPublic: boolean
  wishlistPublic: boolean
  notificationsLastSeenAt: Date
  notifyOnFollow: boolean
  notifyOnWatchOverlap: boolean
}
```
Add after `notifyOnWatchOverlap`:
```typescript
  notifyOnLike: boolean
  notifyOnComment: boolean
```

#### Drift fix 2: `VisibilityField` union (lines 18-23)

```typescript
// src/data/profiles.ts:18-23 — current
export type VisibilityField =
  | 'profilePublic'
  | 'collectionPublic'
  | 'wishlistPublic'
  | 'notifyOnFollow'
  | 'notifyOnWatchOverlap'
```
Add after `'notifyOnWatchOverlap'`:
```typescript
  | 'notifyOnLike'
  | 'notifyOnComment'
```

#### Drift fix 3: `DEFAULT_SETTINGS` (lines 25-32)

```typescript
// src/data/profiles.ts:25-32 — current
const DEFAULT_SETTINGS: Omit<ProfileSettings, 'userId'> = {
  profilePublic: true,
  collectionPublic: true,
  wishlistPublic: true,
  notificationsLastSeenAt: new Date(0),
  notifyOnFollow: true,
  notifyOnWatchOverlap: true,
}
```
Add after `notifyOnWatchOverlap: true`:
```typescript
  notifyOnLike: true,
  notifyOnComment: true,
```

#### Drift fix 4: `getProfileSettings` return mapping (lines 100-111)

```typescript
// src/data/profiles.ts:100-111 — current return block
if (rows[0]) {
  return {
    userId: rows[0].userId,
    profilePublic: rows[0].profilePublic,
    collectionPublic: rows[0].collectionPublic,
    wishlistPublic: rows[0].wishlistPublic,
    notificationsLastSeenAt: rows[0].notificationsLastSeenAt,
    notifyOnFollow: rows[0].notifyOnFollow,
    notifyOnWatchOverlap: rows[0].notifyOnWatchOverlap,
  }
}
```
Add after `notifyOnWatchOverlap: rows[0].notifyOnWatchOverlap`:
```typescript
    notifyOnLike: rows[0].notifyOnLike,
    notifyOnComment: rows[0].notifyOnComment,
```

#### Drift fix 5: `updateProfileSettingsField` upsert insert-path values (lines 155-171)

```typescript
// src/data/profiles.ts:155-171 — current upsert
await db
  .insert(profileSettings)
  .values({
    userId,
    profilePublic: field === 'profilePublic' ? value : true,
    collectionPublic: field === 'collectionPublic' ? value : true,
    wishlistPublic: field === 'wishlistPublic' ? value : true,
    notifyOnFollow: field === 'notifyOnFollow' ? value : true,
    notifyOnWatchOverlap: field === 'notifyOnWatchOverlap' ? value : true,
    // notificationsLastSeenAt omitted — DB DEFAULT now() applies on insert
    updatedAt: new Date(),
  })
  .onConflictDoUpdate({
    target: profileSettings.userId,
    set: { [field]: value, updatedAt: new Date() },
  })
```
Add after `notifyOnWatchOverlap: field === 'notifyOnWatchOverlap' ? value : true`:
```typescript
    notifyOnLike: field === 'notifyOnLike' ? value : true,
    notifyOnComment: field === 'notifyOnComment' ? value : true,
```
The `.onConflictDoUpdate` at line 167 already uses `set: { [field]: value, updatedAt: new Date() }` — this is already general and needs no change once `VisibilityField` is widened.

---

### 5. `src/app/actions/profile.ts` — VISIBILITY_FIELDS + Zod enum (BLOCKING)

**Analog: existing `VISIBILITY_FIELDS` constant (lines 56-62)**

```typescript
// src/app/actions/profile.ts:56-62 — current
const VISIBILITY_FIELDS = [
  'profilePublic',
  'collectionPublic',
  'wishlistPublic',
  'notifyOnFollow',
  'notifyOnWatchOverlap',
] as const
```
Append two values:
```typescript
const VISIBILITY_FIELDS = [
  'profilePublic',
  'collectionPublic',
  'wishlistPublic',
  'notifyOnFollow',
  'notifyOnWatchOverlap',
  'notifyOnLike',
  'notifyOnComment',
] as const
```
`updateSettingsSchema` at lines 64-69 uses `z.enum(VISIBILITY_FIELDS)` — it automatically includes the new values once the array is widened. No further change needed in that schema or in the `updateProfileSettings` function body.

**Pitfall 3 (RESEARCH.md):** `VisibilityField` in `profiles.ts` and `VISIBILITY_FIELDS` in `actions/profile.ts` are separate — both must be widened in the same edit. Verify with `npm run build`.

---

## Shared Patterns

### `PrivacyToggleRow` persistence contract
**Source:** `src/components/settings/PrivacyToggleRow.tsx:28-38`
**Apply to:** All four `NotificationsSection` toggle rows

```typescript
// src/components/settings/PrivacyToggleRow.tsx:28-38
function handleToggle() {
  const newValue = !optimisticValue
  startTransition(async () => {
    setOptimistic(newValue)
    const result = await updateProfileSettings({ field, value: newValue })
    if (!result.success) {
      console.error('[PrivacyToggleRow] save failed:', result.error)
    }
  })
}
```
SA call shape is `{ field: VisibilityField, value: boolean }`. The `field` prop flows directly into the SA call — no transformation. The new toggles (`notifyOnLike`, `notifyOnComment`) work identically; the only Phase 58 requirement is that `VisibilityField` and `VISIBILITY_FIELDS` include them.

### Optimistic snap-back pattern
**Source:** `src/components/settings/PrivacyToggleRow.tsx:25-26` + `src/components/notifications/NotificationRow.tsx:44-47`
**Apply to:** Both new toggle rows (already handled by reusing `PrivacyToggleRow` unchanged)

```typescript
// The useOptimistic pattern — reused verbatim; no new code needed for new toggles.
const [optimisticValue, setOptimistic] = useOptimistic(initialValue)
const [pending, startTransition] = useTransition()
```

### payload cast pattern
**Source:** `src/components/notifications/NotificationRow.tsx:125-127`, `156-157`
**Apply to:** All four new `resolveHref` and `resolveCopy` branches

```typescript
// Cast-then-read — all existing branches use this shape:
const p = row.payload as { watch_id?: string; watch_model?: string }
const watchModel = p.watch_model ?? 'a watch'
```

---

## Test Extension Patterns

### NotificationRow.test.tsx — extend existing suites

**Analog: `watch_overlap type — single actor` describe block (lines 110-143) and `watch_overlap type — grouped` (lines 145-160)**

Structure to copy for each new type:
```typescript
// src component tests pattern from NotificationRow.test.tsx:111-142
describe('watch_like type — single actor', () => {
  it('renders "liked your {model}" copy', () => {
    const { container } = render(
      <NotificationRow
        row={makeRow({
          type: 'watch_like',
          payload: { watch_id: 'w-1', watch_model: 'Submariner' },
        })}
      />,
    )
    const text = getNotifCopyText(container)
    expect(text).toContain('liked your')
    expect(text).toContain('Submariner')
  })

  it('click navigates to /watch/{id} via router.push', async () => {
    // Same act/fireEvent.click + mockPush assertion pattern as lines 125-142
  })
})
```
Comment rows additionally assert the preview `<p>` is rendered (D-02) and that like rows do NOT render a preview `<p>` (D-02 negative case).

Grouped like copy test mirrors the `watch_overlap actorCount > 1` test (lines 145-160):
```typescript
// Analog at NotificationRow.test.tsx:146-160
it('renders "+ N others liked your {model}" grouped copy', () => {
  const { container } = render(
    <NotificationRow
      row={makeRow({
        type: 'watch_like',
        payload: { watch_id: 'w-1', watch_model: 'Submariner' },
        actorCount: 3,
      })}
    />,
  )
  const text = getNotifCopyText(container)
  expect(text).toContain('+ 2 others liked your')
  expect(text).toContain('Submariner')
})
```

### NotificationsInbox.test.tsx — extend collapse suite

**Analog: `NOTIF-08 watch_overlap display-time collapse` describe block (lines 90-145)**

Like-collapse tests follow the exact same structure:
```typescript
// Structural template from NotificationsInbox.test.tsx:91-107
describe('NOTIF-13 watch_like display-time collapse', () => {
  it('collapses watch_like rows with same watch_id + day into one row', () => {
    const day = new Date('2026-04-22T10:00:00Z')
    const rows = [
      makeRow({ id: 'l1', type: 'watch_like', createdAt: day, actorDisplayName: 'Alice', payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
      makeRow({ id: 'l2', type: 'watch_like', createdAt: day, actorDisplayName: 'Bob', actorUsername: 'bob', payload: { watch_id: 'w-42', watch_model: 'Submariner' } }),
    ]
    render(<NotificationsInbox rows={rows} now={NOW} />)
    expect(screen.getAllByTestId(/notif-row-/)).toHaveLength(1)
  })
  // + actorCount assertion, + most-recent-actor-wins assertion
})
```
Also add negative case: `watch_comment` rows with same watch_id on same day must NOT collapse (2 rows rendered).

### NotificationsSection.test.tsx — update existing fixture + add assertions

**Pitfall 5 from RESEARCH.md:** The fixture at line 24 must be widened:
```typescript
// tests/components/settings/NotificationsSection.test.tsx:24-27 — current
const settings = {
  notifyOnFollow: true,
  notifyOnWatchOverlap: true,
}
// → after Phase 58:
const settings = {
  notifyOnFollow: true,
  notifyOnWatchOverlap: true,
  notifyOnLike: true,
  notifyOnComment: true,
}
```

New assertions mirror the existing `notifyOnFollow` regression test (lines 42-49):
```typescript
// Analog: NotificationsSection.test.tsx:42-49
it('regression: notifyOnFollow toggle behavior unchanged from SettingsClient', async () => {
  render(<NotificationsSection settings={settings} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('switch', { name: 'New Followers' }))
  expect(updateMock).toHaveBeenCalledWith({ field: 'notifyOnFollow', value: false })
})
// New test for likes toggle:
it('likes toggle calls updateProfileSettings with { field: notifyOnLike, value: false }', async () => {
  render(<NotificationsSection settings={settings} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('switch', { name: 'Likes' }))
  expect(updateMock).toHaveBeenCalledWith({ field: 'notifyOnLike', value: false })
})
```

Also update the switch count assertion from `toHaveLength(2)` → `toHaveLength(4)`, and add a title assertion: `expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument()` (or `screen.getByText('Notifications')` matching the existing `h2` found via `container.querySelector('h2')`).

---

## No Analog Found

None — every modification has a direct analog in the same file.

---

## Metadata

**Analog search scope:** `src/components/notifications/`, `src/components/settings/`, `src/data/profiles.ts`, `src/app/actions/profile.ts`, `tests/components/notifications/`, `tests/components/settings/`
**Files read:** 7 source files + 3 test files
**Pattern extraction date:** 2026-05-24
