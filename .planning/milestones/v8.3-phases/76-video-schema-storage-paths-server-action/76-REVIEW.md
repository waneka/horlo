---
phase: 76-video-schema-storage-paths-server-action
reviewed: 2026-06-22T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/db/schema.ts
  - supabase/migrations/20260622000000_phase76_video_schema.sql
  - tests/integration/phase76-video-schema.test.ts
  - src/lib/storage/wearPhotos.ts
  - tests/unit/buildWearVideoPath.test.ts
  - src/data/wearEvents.ts
  - src/app/actions/wearEvents.ts
  - tests/actions/wearEventsVideo.test.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 76: Code Review Report

**Reviewed:** 2026-06-22
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 76 adds video support to wear events: a `media_type` enum + 3 nullable columns + a defense-in-depth CHECK constraint on `wear_events`, client-side Storage path builders (`buildWearVideoPath` / `buildWearPosterPath`), a `logWearEventWithVideo` DAL helper, and a `logWearWithVideo` Server Action that runs auth → Zod → 5 MB byte gate → IDOR check → parallel `.list()` probes → DAL insert → compensating cleanup.

The structural parallelism with the Phase 15 photo flow is good — Phase 15's `logWearWithPhoto` was preserved unchanged (VID-15 regression check passes). The migration is correctly additive and idempotent. Tests cover the canonical happy and reject paths.

That said, **one BLOCKER** undermines the VID-08 probe's purpose: the photo helper's `.jpg` filename is a strict prefix of the video poster's `-poster.jpg` filename, so Supabase `list({search})` substring matching means a video flow's poster probe can succeed against an unrelated legacy photo. Several WARNING-tier issues concern Storage-list edge cases (pagination cap, `.list()` error swallowing) and a stale comment on `getWearEventByIdForViewer` that may cause future-phase video rows to silently leak `mediaPath` as `photoUrl`.

## Critical Issues

### CR-01: VID-08 video-probe is satisfied by a co-resident legacy `.jpg` (filename collision)

**File:** `src/app/actions/wearEvents.ts:351-371` (and `src/lib/storage/wearPhotos.ts:38, 56, 74`)

**Issue:**
The probe matrix is:

| Object kind | Storage path                                        | `.list({search})` value                |
|-------------|-----------------------------------------------------|----------------------------------------|
| Photo       | `{userId}/{wearEventId}.jpg`                        | `${wearEventId}.jpg`                   |
| Video       | `{userId}/{wearEventId}.mp4`                        | `${wearEventId}.mp4`                   |
| Poster      | `{userId}/{wearEventId}-poster.jpg`                 | `${wearEventId}-poster.jpg`            |

`storage.from(bucket).list(prefix, { search })` is documented and observed to be a **substring/contains** filter on filenames inside `prefix`, not an exact match. (The `.list({search: 'abc.mp4'})` comment at L347 acknowledges this for the prefix direction; the converse holds for suffixes too — `search: 'foo'` returns every name containing `foo`.)

Now consider that the **same `wearEventId` UUID could be re-used across the photo and video flows**: nothing in this phase or Phase 15 prevents a client from generating a wearEventId, uploading a `.jpg` via the photo flow's `uploadWearPhoto`, then later attempting `logWearWithVideo` with the same wearEventId. The video probe (`search: ${wearEventId}.mp4`) is exact-matched at L361-363, so a missing video correctly fails. But the **poster probe** (`search: ${wearEventId}-poster.jpg`) is what worries: the action calls `.some(f => f.name === \`${wearEventId}-poster.jpg\`)` (L364-368) which is exact-match in code, BUT the underlying Storage `.list({search})` returns matches *containing* the search string. The poster probe will include `{wearEventId}-poster.jpg` only — that name does not appear among the legacy `.jpg` siblings — so this specific path is safe.

**However, the wider failure mode that *does* hit:** within the same user folder, **two wear events** can have IDs `aaaa...` and `aaaa...-poster`-like collisions only by adversarial UUID, which is implausible (UUID v4 collision space). The real exploit is **simpler**:

1. Client computes wearEventId `X`.
2. Client uploads a `.jpg` to `${user.id}/X.jpg` via the photo upload helper (which uses `upsert: false`, succeeds).
3. Client calls `logWearWithVideo` with the same wearEventId `X` and a tampered `videoBytes` that is small but no actual `.mp4` upload happened.
4. Server probes `search: 'X.mp4'` → exact-match `.some(f.name === 'X.mp4')` returns `false` → fails closed. **Good.**

So the canonical photo→video confusion scenario actually fails closed thanks to the exact-match `.some()` at L361-363 and L364-368. Substring matching in `search` makes the API call return a superset of results, but the in-process `.some(f => f.name === ...)` exact comparison defangs it.

**Where the threat actually lands**: when the `wear-photos` folder grows past the Supabase `.list()` default cap (100 objects) or the per-test specified `limit`. `.list(prefix, {search})` is page-bounded — Supabase returns at most `limit` (default 100) entries matching the prefix, paginated by `offset`. A power user who has accumulated >100 wear photos may have the probe target paginated past the first page; the exact-match `.some(...)` then returns `false` and **a legitimate video post fails with the misleading "Video upload failed — please try again" string**, even though both objects were uploaded successfully.

**Impact:** A user with >100 wear-photos objects under their folder permanently cannot post video wears — the Server Action returns the uniform `"Video upload failed — please try again"` regardless. There is no UI affordance to recover (the wear-photos folder is per-user, not per-event-bucket).

**Fix:** Use a more discriminating probe. Two viable approaches:

```ts
// Option A — explicit limit + offset loop until search target found or pages exhausted:
async function objectExists(supabase, prefix: string, exactName: string): Promise<boolean> {
  let offset = 0
  const PAGE = 100
  for (;;) {
    const { data, error } = await supabase.storage
      .from('wear-photos')
      .list(prefix, { search: exactName, limit: PAGE, offset })
    if (error) return false
    const rows = data ?? []
    if (rows.some(f => f.name === exactName)) return true
    if (rows.length < PAGE) return false
    offset += PAGE
  }
}
```

```ts
// Option B (simpler, preferred) — HEAD via createSignedUrl on the exact path.
// .createSignedUrl returns 404 for missing objects without enumerating the folder:
const { error } = await supabase.storage
  .from('wear-photos')
  .createSignedUrl(`${user.id}/${wearEventId}.mp4`, 1)
const videoFound = !error
```

Option B is O(1) per probe (no list pagination) and is the canonical "does this object exist" Storage primitive. The same fix should be retrofitted to `logWearWithPhoto` (Phase 15) since it shares the failure mode; that is a Phase 15 latent bug surfaced by this review and likely belongs in a follow-up patch ticket — leaving it is acceptable for Phase 76 only if the Phase 76 video probe is fixed and the Phase 15 latent bug is logged.

---

## Warnings

### WR-01: `.list()` API error is silently coalesced to "not found" — masks transient Storage outages as user-facing failure

**File:** `src/app/actions/wearEvents.ts:359-368`

**Issue:**
```ts
const videoFound =
  !videoList.error &&
  (videoList.data ?? []).some(...)
```

If `.list()` returns `{ data: null, error: { ... } }` for a non-existence reason (Storage 5xx, rate-limit, network reset), `videoFound` becomes `false` and the user receives the same `"Video upload failed — please try again"` message. The Storage object DID upload successfully; the probe failed. The downstream cleanup branch is NOT triggered (we return before the try/catch around DAL), so the Storage object becomes orphaned (the user retries, generates a new wearEventId, never reuses the original) — but the DB row is never created.

**Impact:** On any transient Storage error, the user sees a misleading failure and accumulates a permanently orphaned Storage object. The phase's compensating-delete contract (VID-10) only fires on DAL failure, not on probe failure.

**Fix:** Distinguish probe error from object-missing:

```ts
if (videoList.error || posterList.error) {
  console.error('[logWearWithVideo] storage probe error:', videoList.error, posterList.error)
  // Compensating cleanup — same as DAL-failure path:
  try { await supabase.storage.from('wear-photos').remove([videoPath, posterPath]) } catch {}
  return { success: false, error: 'Video upload failed — please try again' }
}
const videoFound = (videoList.data ?? []).some(f => f.name === `${wearEventId}.mp4`)
const posterFound = (posterList.data ?? []).some(f => f.name === `${wearEventId}-poster.jpg`)
if (!videoFound || !posterFound) {
  return { success: false, error: 'Video upload failed — please try again' }
}
```

Or, adopt CR-01's Option B (createSignedUrl probe) which sidesteps this branch entirely.

---

### WR-02: `getWearEventByIdForViewer` and other DAL readers do NOT select `media_type` / `media_path` / `poster_path`

**File:** `src/data/wearEvents.ts:296-322, 244-256, 381-405, 502-606, 619-636`

**Issue:**
The DAL readers `getWearEventByIdForViewer`, `getWearEventsForViewer`, `getWearRailForViewer`, `getActiveWearsForUser`, and `getPublicWearPicsForWatch` all select `photoUrl` but none of them select the three new Phase 76 columns. Any caller (page.tsx / hero render / carousel) that needs to discriminate a photo row from a video row will see `null` `photoUrl` for video rows and have no signal at all that media exists — the wear event simply appears un-illustrated.

This is partially deliberate ("Phase 77 owns the read path") but the DAL surface is **public** and other phases will integrate against it. The risk: a downstream phase (e.g. the wear-detail page or the rail tile) is rendered with a video-bearing wear event and silently degrades to a placeholder.

Additionally, `getPublicWearPicsForWatch` at L616 hard-filters `isNotNull(wearEvents.photoUrl)` — this means **video-only wear events are invisible to the watch detail carousel** even after Phase 77 ships, until that filter is widened to `OR mediaPath IS NOT NULL`. Worth a TODO marker on this function explicitly.

**Fix:** Add the new columns to every reader's SELECT projection (return type updates required) OR add a comment at the top of each reader stating "Phase 76 added video columns; do not call before Phase 77 read-path updates select them." The former is the cleaner forward-compat path.

---

### WR-03: Phase 15 `logWearWithPhoto` is structurally vulnerable to the same CR-01 pagination failure — flag as latent

**File:** `src/app/actions/wearEvents.ts:175-187`

**Issue:**
The Phase 15 photo probe uses `.list(user.id, { search: \`${wearEventId}.jpg\` })` + `.some(f => f.name === ...)`. Identical pagination cap risk applies: a user with >100 photos under their folder will see `logWearWithPhoto` fail with `"Photo upload failed — please try again"` even when the upload succeeded. This is a Phase 15 latent bug exposed by Phase 76 review, not a Phase 76 regression — but the parallel structure means the fix should be coordinated.

**Fix:** Track in a follow-up ticket. Apply the same Option B (createSignedUrl) fix to Phase 15 in a patch alongside Phase 77. Note this in `76-POST-DEPLOY.md`.

---

### WR-04: Migration's section-4 bucket UPDATE silently fails when `allowed_mime_types` is NULL

**File:** `supabase/migrations/20260622000000_phase76_video_schema.sql:63-66`

**Issue:**
```sql
UPDATE storage.buckets
   SET allowed_mime_types = array_cat(allowed_mime_types, ARRAY['video/mp4']::text[])
 WHERE id = 'wear-photos'
   AND NOT ('video/mp4' = ANY(allowed_mime_types));
```

If `allowed_mime_types` is `NULL` for the `wear-photos` bucket (which happens if a prior migration was rolled back to a state predating the `INSERT` at `20260423000004`), then:
- `array_cat(NULL, ARRAY['video/mp4'])` yields `NULL` (silent NULL-propagation).
- `'video/mp4' = ANY(NULL)` evaluates to `NULL`, so `NOT (NULL)` is `NULL`, the WHERE clause filters the row out, and the UPDATE silently affects 0 rows.

The migration commits without raising, but `video/mp4` is **not in the allowlist**. Subsequent `.upload()` calls from the client will be rejected at the Storage layer with a MIME error — the Server Action's 5 MB byte gate (VID-09) and the bucket-level cap (defense in depth) both seem fine, but the bucket MIME allowlist quietly never gained `video/mp4`.

**Impact:** On a stale local env or a rolled-back prod (unlikely but not impossible), prod video uploads silently fail at the Storage layer with no migration-time signal.

**Fix:** Use `COALESCE` + a post-flight assertion:

```sql
UPDATE storage.buckets
   SET allowed_mime_types = array_append(COALESCE(allowed_mime_types, ARRAY[]::text[]), 'video/mp4')
 WHERE id = 'wear-photos'
   AND (allowed_mime_types IS NULL OR NOT ('video/mp4' = ANY(allowed_mime_types)));

-- Post-flight (matches the section-5 pattern):
DO $$
DECLARE
  has_video bool;
BEGIN
  SELECT 'video/mp4' = ANY(allowed_mime_types) INTO has_video
    FROM storage.buckets WHERE id = 'wear-photos';
  IF NOT has_video THEN
    RAISE EXCEPTION 'Phase 76: video/mp4 missing from wear-photos allowed_mime_types';
  END IF;
END $$;
```

---

### WR-05: `logWearEventWithVideo` DAL helper uses `'video' as const` cast — coerces but does not constrain

**File:** `src/data/wearEvents.ts:119`

**Issue:**
```ts
mediaType: 'video' as const,
```

The `as const` cast widens nothing useful here and obscures intent. The Drizzle column type is `mediaTypeEnum('media_type')` which infers the union `'photo' | 'video'` for inserts — passing the literal string `'video'` is already type-correct without the cast. The `as const` is a code-smell more than a bug, but it suggests the author was working around a typing issue that may be hiding a real type mismatch.

More importantly: by NOT passing `photoUrl` at all (relying on the column DEFAULT being `NULL`), the DAL is **implicitly assuming Drizzle does not insert `null` for omitted nullable columns** — which is correct for Drizzle 0.45.2, but if a future contributor switches to `db.insert(...).values({...omit photoUrl}).onConflictDoUpdate({...})` the behavior may diverge. Worth a one-line comment:

```ts
// photoUrl intentionally omitted — column DEFAULT (NULL) applies; do not pass
// `null` explicitly because future onConflict refactors may behave differently.
```

**Fix:** Drop `as const`. Add the omission rationale comment.

---

## Info

### IN-01: `buildWearVideoPath` / `buildWearPosterPath` `UUID_RE` accepts loose hex with dashes — does not validate v4 structure

**File:** `src/lib/storage/wearPhotos.ts:21`

**Issue:**
`const UUID_RE = /^[0-9a-f-]{36}$/i` accepts e.g. `'------------------------------------'` (36 dashes), or `'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'` (no dashes), and any 36-char hex-or-dash string — not actual UUIDs. The Server Action's Zod `z.string().uuid()` is stricter (proper UUID structure with positioned dashes) and is the authoritative gate, but the helpers' validation is misleadingly weak relative to their `wearEventId must be a UUID` error message.

**Impact:** Cosmetic — defense in depth is broken on the helper side but the Server Action covers it. Tests pass with `not-a-uuid` because that string contains characters outside the allowed alphabet.

**Fix:** Tighten to `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` or use a shared validator with the Zod schema.

---

### IN-02: Server Action probe uses `Promise.all` — first reject discards the second probe's error log

**File:** `src/app/actions/wearEvents.ts:351-358`

**Issue:**
`Promise.all` short-circuits on first rejection. If both probes throw (e.g. Storage outage), only the first error reaches a handler; the second is silently dropped. Supabase's `.list()` typically returns `{error}` rather than throwing, so this is mostly theoretical, but `Promise.allSettled` would be more defensive for logging both probe outcomes when both fail.

**Fix:** Switch to `Promise.allSettled` and log both outcomes for observability. Low priority.

---

### IN-03: Integration test fixture date `'2026-06-21'` will collide with previously-run leftover rows if cleanup partially fails

**File:** `tests/integration/phase76-video-schema.test.ts:81-85`

**Issue:**
The test uses hard-coded `DATE_LEGACY = '2026-06-21'` through `DATE_PHOTO_FRESH = '2026-06-25'`. The `wear_events_unique_day` UNIQUE constraint is on `(user_id, watch_id, worn_date)`. The user is fresh per-run (timestamped email), so collisions are extremely unlikely — BUT the `afterAll` cleanup is in `try {} catch {}` without any logging, so a partial cleanup failure leaves leftover rows and the next test run with the same timestamp (extremely unlikely but possible at second resolution) could collide. The comment at L79-80 acknowledges the uniqueness constraint correctly.

**Fix:** Make `afterAll` log its errors so a partial cleanup isn't silent. Low priority.

---

### IN-04: `logWearWithVideo` cleanup branch logs `cleanup.error ?? 'ok'` — `cleanup.error` is `null` on success in some Supabase JS versions

**File:** `src/app/actions/wearEvents.ts:399-402`

**Issue:**
```ts
console.error(
  '[logWearWithVideo] insert failed; orphan cleanup:',
  cleanup.error ?? 'ok',
)
```

Minor pattern-smell: `console.error` is used for the success-of-cleanup path (with the string `'ok'`), which floods logs at ERROR severity even when nothing went wrong. Future log aggregation that pages on `console.error` will get false positives.

**Fix:** Split the log:
```ts
if (cleanup.error) {
  console.error('[logWearWithVideo] orphan cleanup error:', cleanup.error)
} else {
  console.warn('[logWearWithVideo] insert failed; orphans removed')
}
```

---

_Reviewed: 2026-06-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
