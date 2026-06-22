# Phase 76: Video Schema, Storage Paths + Server Action — Research

**Researched:** 2026-06-22
**Domain:** Supabase Storage / Drizzle schema extension / Next.js 16 Server Action
**Confidence:** HIGH

---

## Summary

Phase 76 is a pure backend phase: no new UI ships. Its job is to make the server
ready to accept a wear-event video upload — a Drizzle schema migration, a bucket
MIME-type update, and an extended `logWearWithVideo` Server Action that mirrors
Phase 15's proven `logWearWithPhoto` pattern.

The codebase already has everything needed as a template. Phase 15
(`src/app/actions/wearEvents.ts` — `logWearWithPhoto`) implements the exact
security pipeline that Phase 76 must replicate for video:
server-constructed storage paths (T-15-17), probe-before-insert (T-15-04), and
compensating delete on INSERT failure (T-15-18). Phase 76 does NOT rewrite that
function; it adds a parallel `logWearWithVideo` that follows the same structure
but probes two objects (`.mp4` + `-poster.jpg`) instead of one (`.jpg`).

The migration is strictly additive. `wear_events.photo_url` stays in place;
three new columns are added (`media_type`, `media_path`, `poster_path`). This
preserves VID-15 (existing photo rows readable) and avoids any data migration
risk on the wipeable wear_events table.

**Primary recommendation:** Copy-and-adapt `logWearWithPhoto` to
`logWearWithVideo` with two Storage list probes, two best-effort removes, and a
new Zod schema. Add the Drizzle schema additions and the Supabase migration in
the same wave. Update the `wear-photos` bucket MIME allowlist to include
`video/mp4`. Ship the 4 MB client-side warn as a helper constant — not a Server
Action concern — to keep the server the authoritative gate.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VID-07 | Video + poster upload to `wear-photos` bucket at IDOR-safe server-constructed paths `{userId}/{wearEventId}.mp4` + `{userId}/{wearEventId}-poster.jpg`; client never provides the path | Phase 15 T-15-17 pattern (line 157 in actions/wearEvents.ts) — replicate exactly |
| VID-08 | Server probes both Storage objects exist (`storage.list()`) before inserting the `wear_events` row | Phase 15 T-15-04 pattern (lines 163-173 in actions/wearEvents.ts) — run twice, one per path |
| VID-09 | Server rejects video uploads >5 MB; client warns at ~4 MB before upload | Server gate: check `arrayBuffer.byteLength` in Server Action. 4 MB warn is a client constant (Phase 77) |
| VID-10 | On `wear_events` INSERT failure, BOTH Storage objects (video + poster) best-effort removed | Phase 15 T-15-18 pattern (lines 196-208 in actions/wearEvents.ts) — remove both paths |
| VID-11 | Migration adds `media_type`, `media_path`, `poster_path`; pre-existing `photo_url` rows survive | Additive ALTER only; `photo_url` kept as-is; DEFAULT 'photo' on `media_type` for existing rows |
| VID-12 | DB CHECK constraint: `media_type='video'` rows must have both `media_path` and `poster_path` non-NULL | Raw SQL migration (Drizzle cannot express CHECK constraints in pg-core DSL) |
| VID-16 | Cross-user write blocked; storage path constructed from `getCurrentUser().id` + server-accepted `wearEventId` UUID | Same pattern as `logWearWithPhoto`: server computes `${user.id}/${wearEventId}.mp4` |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 5 MB server-side size gate | API / Backend (Server Action) | — | Server is the authoritative enforcement point; client pre-warn is UX only |
| 4 MB client pre-warn | Browser / Client | — | UX affordance before upload attempt; never trusted by server |
| Storage path construction | API / Backend (Server Action) | — | T-15-17: path MUST be server-computed from auth.uid(); client must not supply it |
| Storage probe (object existence) | API / Backend (Server Action) | Supabase Storage | T-15-04: server calls `storage.list()` before DB INSERT |
| Compensating delete on failure | API / Backend (Server Action) | Supabase Storage | T-15-18: best-effort `storage.remove()` on INSERT failure |
| Schema migration | Database / Storage | — | Drizzle schema edit + Supabase migration file |
| Bucket MIME allowlist update | Database / Storage | — | Raw SQL `UPDATE storage.buckets SET allowed_mime_types` |
| `wearEventId` UUID generation | Browser / Client | — | Existing pattern from Phase 15; client generates, server validates shape and CONSTRUCTS the path from it |

---

## Phase 15 Parity Table

This is the highest-leverage section. Phase 76's Server Action is a direct structural parallel.

| VID-NN | Phase 15 Threat / Plan ID | File + Lines | Exact Pattern |
|--------|--------------------------|--------------|---------------|
| VID-16 | T-15-17 (cross-user path) | `src/app/actions/wearEvents.ts` L157 | `const photoPath = \`${user.id}/${parsed.data.wearEventId}.jpg\`` — client never supplies path |
| VID-08 | T-15-04 (probe before insert) | `src/app/actions/wearEvents.ts` L162-173 | `supabase.storage.from('wear-photos').list(user.id, { search: \`${wearEventId}.jpg\` })` then check `.some(f => f.name === ...)` |
| VID-10 | T-15-18 (compensating delete) | `src/app/actions/wearEvents.ts` L196-208 | `supabase.storage.from('wear-photos').remove([photoPath])` in catch block, log-only on cleanup error |
| VID-09 (server gate) | No direct Phase 15 analog (photos were smaller) | new | `if (videoBytes > 5 * 1024 * 1024) return { success: false, error: '...' }` before Storage upload |
| VID-11 | Phase 11 Migration 1 pattern | `supabase/migrations/20260423000001_phase11_wear_visibility.sql` | `ALTER TABLE wear_events ADD COLUMN IF NOT EXISTS ... DEFAULT ...` inside `BEGIN;...COMMIT;` |
| VID-12 | Phase 53 D-12 (comments CHECK) | `supabase/migrations/20260522000000_phase53_likes_comments_rls.sql` | Raw SQL `DO $$ BEGIN ... ADD CONSTRAINT IF NOT EXISTS ... CHECK (...) ... END $$` guard pattern |

### Key divergences from Phase 15

| Aspect | Phase 15 Photo | Phase 76 Video |
|--------|---------------|----------------|
| Number of Storage objects | 1 (`{userId}/{wearEventId}.jpg`) | 2 (`{userId}/{wearEventId}.mp4` + `{userId}/{wearEventId}-poster.jpg`) |
| Probe | Single `.list()` call | Two separate `.list()` calls (one per object) |
| Compensating delete | `remove([photoPath])` | `remove([videoPath, posterPath])` |
| DAL function | `logWearEventWithPhoto` | new `logWearEventWithVideo` |
| Bucket MIME | `image/jpeg, image/png, image/webp` | add `video/mp4` (poster is still `image/jpeg`) |
| Size cap | None explicit at app layer (bucket is already 5 MB) | Explicit byteLength check in Server Action |
| Schema column written | `photoUrl` | `mediaPath`, `posterPath`, `mediaType = 'video'` |
| `hasPhoto` flag | boolean in schema | replaced by `hasVideo: true` (or `mediaType: 'video'` discriminator) |

---

## Standard Stack

### Core (all pre-installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | `^0.45+` (already in use) | Drizzle schema additions + migrations | Established project ORM [VERIFIED: codebase] |
| `@supabase/supabase-js` | already in use | Storage `list()` + `remove()` API | Established in Phase 15 [VERIFIED: codebase] |
| `zod` | already in use | Input validation in Server Action | Established pattern in all Server Actions [VERIFIED: codebase] |
| `next/cache` | Next.js 16 | `revalidatePath` + `revalidateTag` | Cache invalidation after wear insert [VERIFIED: codebase] |

**No new packages needed for Phase 76.** The entire implementation reuses existing dependencies.

### Key API details (Next.js 16 specifics from `node_modules/next/dist/docs/`)

- `updateTag(tag)` — read-your-own-writes cache invalidation (NOT single-arg `revalidateTag`). Phase 75 precedent: [VERIFIED: project_next16_revalidatetag_deprecated memory] The `logWearWithPhoto` Server Action uses `revalidateTag(\`profile:${username}\`, 'max')` for cross-user SWR fan-out — `logWearWithVideo` must follow the same pattern, NOT introduce `updateTag` unless the goal is read-your-own-writes.
- `revalidatePath('/')` — invalidates the home page (same as `logWearWithPhoto`) [VERIFIED: codebase]

---

## Migration Plan (additive)

### What exists today in `wearEvents` (Drizzle schema, L294-315)

```typescript
// src/db/schema.ts lines 294-315 [VERIFIED: codebase]
export const wearEvents = pgTable(
  'wear_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchId: uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    wornDate: text('worn_date').notNull(),
    note: text('note'),
    photoUrl: text('photo_url'),           // <-- KEEP; existing photo rows use this
    visibility: wearVisibilityEnum('visibility').notNull().default('public'),
    hiddenFromDetail: boolean('hidden_from_detail').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  ...
)
```

### Drizzle schema diff (additive)

Add a `pgEnum` for `media_type` and three columns to `wearEvents`. Add enum above `wearEvents` in `schema.ts`:

```typescript
// ADD after line 26 (after wearVisibilityEnum)
export const mediaTypeEnum = pgEnum('media_type', ['photo', 'video'] as const)
```

Add three columns inside `wearEvents` after `hiddenFromDetail`:

```typescript
// ADD inside wearEvents pgTable columns
mediaType: mediaTypeEnum('media_type').notNull().default('photo'),
mediaPath: text('media_path'),     // NULL for pre-Phase-76 photo-only rows
posterPath: text('poster_path'),   // NULL for all photos; set only for videos
```

`photo_url` stays intact. Existing rows default to `media_type = 'photo'` with `media_path = NULL` and `poster_path = NULL`. The Server Action for photos (`logWearWithPhoto`) does NOT need to be changed — it continues writing `photoUrl` only. New video rows write `mediaType = 'video'`, `mediaPath`, and `posterPath` (and leave `photoUrl = NULL`).

### Supabase migration filename

Following the project filename ordering rule (`project_drizzle_supabase_db_mismatch` memory):

```
supabase/migrations/20260622000000_phase76_video_schema.sql
```

Date prefix: `20260622` (today). Must sort AFTER the latest existing migration
(`20260620204341_delete_orphan_users...`). The single-digit second in the time
component is fine — the sort is lexicographic on the timestamp prefix.

### Migration content

```sql
-- Phase 76 Migration: media_type enum + wear_events video columns + CHECK + bucket MIME
-- Dual-migration discipline: drizzle-kit push LOCAL ONLY; prod uses supabase db push --linked
-- Source: 76-RESEARCH.md §Migration Plan (additive)

BEGIN;

-- 1. media_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
    CREATE TYPE media_type AS ENUM ('photo', 'video');
  END IF;
END $$;

-- 2. Additive columns — IF NOT EXISTS for idempotence after drizzle-kit push
ALTER TABLE wear_events
  ADD COLUMN IF NOT EXISTS media_type media_type NOT NULL DEFAULT 'photo',
  ADD COLUMN IF NOT EXISTS media_path text NULL,
  ADD COLUMN IF NOT EXISTS poster_path text NULL;

-- 3. CHECK constraint: video rows must have both media_path and poster_path non-NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'wear_events_video_paths_required'
       AND conrelid = 'public.wear_events'::regclass
  ) THEN
    ALTER TABLE wear_events
      ADD CONSTRAINT wear_events_video_paths_required
      CHECK (
        media_type = 'photo'
        OR (media_path IS NOT NULL AND poster_path IS NOT NULL)
      );
  END IF;
END $$;

-- 4. Extend wear-photos bucket to accept video/mp4
-- ON CONFLICT DO NOTHING was used at bucket creation; UPDATE is safe now.
-- Keep existing JPEG/PNG/WEBP; add video/mp4 for wear video blobs.
UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  allowed_mime_types,
  ARRAY['video/mp4']::text[]
)
WHERE id = 'wear-photos'
  AND NOT ('video/mp4' = ANY(allowed_mime_types));

-- 5. Inline assertion: no existing rows accidentally got media_type='video'
DO $$
DECLARE
  bad_count bigint;
BEGIN
  SELECT COUNT(*) INTO bad_count
    FROM wear_events
   WHERE media_type = 'video';
  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'Phase 76 assertion failed: % existing rows have media_type=video after migration; expected 0',
      bad_count;
  END IF;
END $$;

COMMIT;
```

**Why no data backfill for `photo_url` → `media_path`:**
REQUIREMENTS.md VID-11 says "pre-existing rows default to 'photo' with their
existing `photo_url`". The planning decision noted in REQUIREMENTS.md is "or
`photo_url` retained as alias — phase planning decision". Research recommends
retaining `photo_url` as-is for existing rows (zero-migration risk, no UPDATE
touching potentially millions of rows, VID-15 compatibility is trivially
preserved). New video rows write `media_path`; new photo rows (post-Phase 77)
MAY continue writing `photo_url` OR write `media_path` — the planner should
make this explicit as a plan decision. This research flags it as an Open
Question.

---

## Architecture Patterns

### System Architecture Diagram

```
Client (ComposeStep Phase 77)
  │
  ├─► [1] client-side 4 MB size check → warn if > 4 MB (VID-09 client side)
  │
  ├─► [2] direct upload to Supabase Storage
  │     wear-photos/{userId}/{wearEventId}.mp4          (video/mp4)
  │     wear-photos/{userId}/{wearEventId}-poster.jpg   (image/jpeg)
  │
  └─► [3] call logWearWithVideo Server Action
             │
             ├─ [auth] getCurrentUser() → user.id
             ├─ [validate] Zod: wearEventId UUID, watchId UUID, size ≤ 5 MB, etc.
             ├─ [IDOR] watchDAL.getWatchById(user.id, watchId) ownership check
             ├─ [construct] videoPath = `${user.id}/${wearEventId}.mp4`  ← server only
             │               posterPath = `${user.id}/${wearEventId}-poster.jpg`
             ├─ [probe] storage.list(userId, {search: wearEventId+'.mp4'}) → must exist
             ├─ [probe] storage.list(userId, {search: wearEventId+'-poster.jpg'}) → must exist
             ├─ [INSERT] wearEventDAL.logWearEventWithVideo(...)
             │     on failure → storage.remove([videoPath, posterPath]) best-effort
             ├─ [activity] logActivity (fire-and-forget)
             └─ [cache] revalidatePath('/') + revalidateTag(profile, 'max')
```

### Recommended Project Structure

No new directories. All additions fit into existing files:

```
src/
├── app/actions/wearEvents.ts       # ADD logWearWithVideo() (new export)
├── data/wearEvents.ts              # ADD logWearEventWithVideo() DAL helper
├── lib/storage/wearPhotos.ts       # ADD buildWearVideoPath() + buildWearPosterPath()
│                                   # (client-side path builders for Phase 77 use)
│                                   # Note: client-side file only validates shape — server
│                                   # re-derives paths from auth.uid(), never from these
└── db/schema.ts                    # ADD mediaTypeEnum + 3 columns to wearEvents
supabase/migrations/
└── 20260622000000_phase76_video_schema.sql   # NEW
drizzle/
└── 0014_phase76_video_schema.sql             # NEW (drizzle-kit generate output)
```

### Pattern 1: `logWearWithVideo` Server Action skeleton

This is the authoritative pattern for Phase 76's primary deliverable.
[VERIFIED: codebase — derived from logWearWithPhoto in src/app/actions/wearEvents.ts]

```typescript
// src/app/actions/wearEvents.ts — ADD this export

const logWearWithVideoSchema = z.object({
  wearEventId:   z.string().uuid(),
  watchId:       z.string().uuid(),
  note:          z.string().max(200).nullable(),
  visibility:    z.enum(['public', 'followers', 'private']),
  videoBytes:    z.number().int().positive(),  // byteLength from client — server gate below
  today:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function logWearWithVideo(input: {
  wearEventId: string
  watchId: string
  note: string | null
  visibility: WearVisibility
  videoBytes: number
  today: string
}): Promise<ActionResult<{ wearEventId: string }>> {
  // Auth first (matches logWearWithPhoto ordering)
  let user
  try { user = await getCurrentUser() } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = logWearWithVideoSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  // VID-09 server gate (5 MB = 5_242_880 bytes)
  if (parsed.data.videoBytes > 5 * 1024 * 1024) {
    return { success: false, error: 'Video too large — maximum 5 MB' }
  }

  // IDOR defense — same as logWearWithPhoto
  const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
  if (!watch) return { success: false, error: 'Watch not found' }

  // T-15-17 / VID-16: server constructs both paths — client never supplies them
  const videoPath  = `${user.id}/${parsed.data.wearEventId}.mp4`
  const posterPath = `${user.id}/${parsed.data.wearEventId}-poster.jpg`
  const supabase = await createSupabaseServerClient()

  // T-15-04 / VID-08: probe BOTH objects before INSERT
  const [videoList, posterList] = await Promise.all([
    supabase.storage.from('wear-photos').list(user.id, { search: `${parsed.data.wearEventId}.mp4` }),
    supabase.storage.from('wear-photos').list(user.id, { search: `${parsed.data.wearEventId}-poster.jpg` }),
  ])
  const videoFound  = !videoList.error  && (videoList.data  ?? []).some(f => f.name === `${parsed.data.wearEventId}.mp4`)
  const posterFound = !posterList.error && (posterList.data ?? []).some(f => f.name === `${parsed.data.wearEventId}-poster.jpg`)
  if (!videoFound || !posterFound) {
    return { success: false, error: 'Video upload failed — please try again' }
  }

  const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null

  try {
    await wearEventDAL.logWearEventWithVideo({
      id:         parsed.data.wearEventId,
      userId:     user.id,
      watchId:    parsed.data.watchId,
      wornDate:   parsed.data.today,
      note,
      mediaPath:  videoPath,
      posterPath: posterPath,
      visibility: parsed.data.visibility,
    })
  } catch (err) {
    // T-15-18 / VID-10: best-effort cleanup of BOTH objects on any INSERT failure
    try {
      const cleanup = await supabase.storage
        .from('wear-photos')
        .remove([videoPath, posterPath])
      console.error('[logWearWithVideo] insert failed; orphan cleanup:', cleanup.error ?? 'ok')
    } catch (cleanupErr) {
      console.error('[logWearWithVideo] orphan cleanup threw:', cleanupErr)
    }
    const code = (err as { code?: string } | null)?.code
    if (code === '23505') {
      return { success: false, error: 'Already logged this watch today' }
    }
    console.error('[logWearWithVideo] insert failed:', err)
    return { success: false, error: 'Could not log that wear. Please try again.' }
  }

  // Activity + cache invalidation — same pattern as logWearWithPhoto
  // ... (fire-and-forget logActivity, revalidatePath('/'), revalidateTag)
  return { success: true, data: { wearEventId: parsed.data.wearEventId } }
}
```

### Pattern 2: `logWearEventWithVideo` DAL helper

```typescript
// src/data/wearEvents.ts — ADD this export
// [VERIFIED: codebase — derived from logWearEventWithPhoto pattern]

export async function logWearEventWithVideo(input: {
  id:         string
  userId:     string
  watchId:    string
  wornDate:   string
  note:       string | null
  mediaPath:  string
  posterPath: string
  visibility: WearVisibility
}): Promise<void> {
  await db.insert(wearEvents).values({
    id:         input.id,
    userId:     input.userId,
    watchId:    input.watchId,
    wornDate:   input.wornDate,
    note:       input.note,
    mediaType:  'video',
    mediaPath:  input.mediaPath,
    posterPath: input.posterPath,
    visibility: input.visibility,
    // photoUrl: intentionally left NULL (not passed)
  })
  // No onConflictDoNothing — same reasoning as logWearEventWithPhoto:
  // caller (logWearWithVideo) catches 23505 explicitly to (a) return error
  // to client and (b) clean up orphan Storage objects.
}
```

### Pattern 3: client-side path builders for Phase 77

```typescript
// src/lib/storage/wearPhotos.ts — ADD these two exports (same file as existing buildWearPhotoPath)
// [VERIFIED: codebase — mirrors buildWearPhotoPath at line 28]

export function buildWearVideoPath(userId: string, wearEventId: string): string {
  if (!userId) throw new TypeError('userId required')
  if (!UUID_RE.test(wearEventId)) throw new TypeError('wearEventId must be a UUID')
  return `${userId}/${wearEventId}.mp4`
}

export function buildWearPosterPath(userId: string, wearEventId: string): string {
  if (!userId) throw new TypeError('userId required')
  if (!UUID_RE.test(wearEventId)) throw new TypeError('wearEventId must be a UUID')
  return `${userId}/${wearEventId}-poster.jpg`
}
```

Note: These client-side builders are provided for Phase 77's upload helper.
They do NOT constitute a trust path — the Server Action re-derives the same
paths from `user.id`. Client-side builders are for upload ergonomics only.

### Anti-Patterns to Avoid

- **Accepting a client-supplied storage path:** The Server Action must ONLY accept `wearEventId` (a UUID), then compute `${user.id}/${wearEventId}.mp4` internally. Never accept a `videoPath` param from the client — this is the T-15-17 / VID-16 invariant.
- **Single probe for both objects:** Run two separate `.list()` calls (or `Promise.all` of two), not a single search string. The filenames differ (`.mp4` vs `-poster.jpg`) and Supabase Storage `list()` takes a `search` prefix.
- **`onConflictDoNothing` in the video DAL helper:** Use it in `logWearEvent` (no-photo path) but NOT in `logWearEventWithVideo`. If there is a 23505 conflict, the caller must know so it can clean up orphan Storage objects (T-15-18 / VID-10).
- **Modifying `logWearWithPhoto`:** Phase 76 adds a parallel `logWearWithVideo`. The photo action is not changed. This avoids any regression risk to the existing photo path (VID-15).
- **Allowing `video/mp4` uploads before bucket MIME update:** The bucket currently has `ARRAY['image/jpeg', 'image/png', 'image/webp']` only. The migration must UPDATE `allowed_mime_types` before Phase 77 ships. Phase 76 owns this migration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Storage object existence check | Custom HTTP HEAD probe | `supabase.storage.from('wear-photos').list(userId, { search: filename })` | Phase 15 proven pattern; SDK handles auth + error cases |
| Storage delete on failure | Custom Fetch DELETE | `supabase.storage.from('wear-photos').remove([paths])` | SDK batch delete; handles partial failures gracefully |
| UUID shape validation | Custom regex | `z.string().uuid()` | Already in Zod schema; consistent with other Server Actions |
| Path prefix IDOR guard | App-layer path parser | Construct path server-side from `user.id` — never parse or validate a client-supplied path | T-15-17: construction is the mitigation, not parsing |

---

## Common Pitfalls

### Pitfall 1: Probe returns false positive because search matches prefix

**What goes wrong:** `storage.list(userId, { search: 'abc123' })` returns a
file named `abc123-poster.jpg` when you searched for `abc123.mp4`. The `.some()`
check passes when it should fail.

**Why it happens:** Supabase Storage `list()` with `search:` does prefix
matching. If a file named `<wearEventId>-poster.jpg` exists when you probe for
`<wearEventId>.mp4`, the listed results may include it.

**How to avoid:** After `.list()`, check `f.name === \`${wearEventId}.mp4\``
(exact match on filename — same pattern as Phase 15 line 167:
`f.name === \`${parsed.data.wearEventId}.jpg\``).

**Warning signs:** Unit test passes, but a wear event gets inserted with only a
poster and no video.

### Pitfall 2: `logWearWithPhoto` photo_url vs new media_path mismatch

**What goes wrong:** After Phase 76, the schema has both `photo_url` and
`media_path`. Callers reading `media_path` find NULL for pre-76 photo rows.

**Why it happens:** Existing photo rows were written to `photo_url`. Phase 76
adds `media_path` but does NOT backfill it from `photo_url`.

**How to avoid:** Phase 77 display code (and any read in Phase 76 tests) must
check `photo_url` for media_type='photo' rows and `media_path` for
media_type='video' rows. The DAL read functions in `wearEvents.ts` that return
`photoUrl` will return NULL for video rows — this is expected. Phase 77 must
add a `posterPath` column to the read queries for video tiles.

**Warning signs:** Video tiles render as blank in Phase 77 UI.

### Pitfall 3: Bucket MIME allowlist blocks video upload before migration runs

**What goes wrong:** Phase 77 client tries to upload `video/mp4` to
`wear-photos`, gets a 400 from Supabase Storage.

**Why it happens:** The bucket was created in Phase 11 with
`ARRAY['image/jpeg', 'image/png', 'image/webp']` — `video/mp4` is not
in the list. [VERIFIED: `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql` line 29]

**How to avoid:** Phase 76's migration must UPDATE the `allowed_mime_types`
array. The plan must verify the migration ran on prod before Phase 77 goes live.

**Warning signs:** Client upload returns `{ error: { statusCode: '422', ... } }`
with a message about MIME type.

### Pitfall 4: `image/jpeg` poster blocked after MIME update removes old types

**What goes wrong:** The UPDATE migration accidentally overwrites `allowed_mime_types`
instead of appending to it, blocking existing photo uploads.

**Why it happens:** `SET allowed_mime_types = ARRAY['video/mp4']` replaces the
existing array.

**How to avoid:** Use `array_cat(allowed_mime_types, ARRAY['video/mp4'])` with
a NOT EXISTS guard (as shown in the migration above) to append, not replace.

**Warning signs:** Photo uploads fail in Phase 77 (or before, if migration is
applied while Phase 77 is still running).

### Pitfall 5: `video/mp4` vs `video/mp4; codecs=avc1.42000a` MIME mismatch

**What goes wrong:** iOS MediaRecorder produces a blob with type
`video/mp4; codecs=avc1.42000a` (with codec string). Supabase Storage
may reject this if `allowed_mime_types` only has `video/mp4`.

**Why it happens:** Supabase Storage MIME matching may be exact or prefix-based.

**How to avoid:** The upload call should override content type as
`contentType: 'video/mp4'` (strip the codec string) — same as how
`uploadWearPhoto` passes `contentType: 'image/jpeg'` explicitly. The `@supabase/storage-js`
SDK's `upload()` accepts `contentType` in options and uses it as-is.

**Warning signs:** Upload returns a MIME mismatch error only on iOS Safari, not
Chrome.

### Pitfall 6: Drizzle pgEnum naming collision with Supabase migration

**What goes wrong:** `pgEnum('media_type', ...)` in schema.ts collides with
another enum or fails if Drizzle emits `CREATE TYPE media_type` while the
Supabase migration also creates it.

**Why it happens:** Drizzle push runs locally; Supabase migration runs on prod.
Both create the same type.

**How to avoid:** The Supabase migration wraps enum creation in
`DO $$ BEGIN IF NOT EXISTS (...) THEN CREATE TYPE ... END IF; END $$`
(same pattern as `wear_visibility` in Phase 11 Migration 1). [VERIFIED: codebase pattern]

---

## Runtime State Inventory

> Phase 76 is additive schema — no rename or refactor. This section is included briefly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `wear_events` table — existing rows with `photo_url` set | None — `photo_url` retained; migration adds columns with DEFAULT |
| Live service config | `wear-photos` bucket — `allowed_mime_types` currently JPEG/PNG/WEBP only | UPDATE via migration (additive) |
| OS-registered state | None | None |
| Secrets/env vars | `ANTHROPIC_API_KEY`, `DATABASE_URL` — unchanged by this phase | None |
| Build artifacts | None | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Storage (`wear-photos` bucket) | VID-07, VID-08, VID-10, VID-16 | ✓ | Supabase managed | — |
| PostgreSQL (via `DATABASE_URL`) | Migration, DAL tests | ✓ | Managed Supabase | Local Docker for integration tests |
| `drizzle-kit` | Local schema push | ✓ | project devDep | — |
| `supabase` CLI | Prod migration via `supabase db push --linked` | ✓ (assumed) | project devDep | — |

**No missing dependencies.** Phase 76 is all server-side code using pre-existing infrastructure.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom default; integration tests use `// @vitest-environment node`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/unit/` |
| Full suite command | `npx vitest run` |
| Build gate | `npm run build` (exit 0) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VID-07 | Server constructs path from user.id; client path input rejected | unit | `npx vitest run tests/actions/` | ❌ Wave 0 |
| VID-08 | Server rejects when .mp4 or -poster.jpg probe finds nothing | unit | `npx vitest run tests/actions/` | ❌ Wave 0 |
| VID-09 | Server returns error when videoBytes > 5 MB | unit | `npx vitest run tests/actions/` | ❌ Wave 0 |
| VID-10 | Both storage paths removed on INSERT failure | unit | `npx vitest run tests/actions/` | ❌ Wave 0 |
| VID-11 | Migration additive — existing photo rows unaffected | integration | `npx vitest run tests/integration/` (DB required) | ❌ Wave 0 |
| VID-12 | DB CHECK rejects video row with NULL media_path | integration | `npx vitest run tests/integration/` (DB required) | ❌ Wave 0 |
| VID-16 | Cross-user watchId returns 'Watch not found'; path never from client | unit | `npx vitest run tests/actions/` | ❌ Wave 0 |

Integration tests require `DATABASE_URL` to be set; they use the `maybe = process.env.DATABASE_URL ? describe : describe.skip` pattern established by `tests/integration/phase15-wear-detail-gating.test.ts`.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/ tests/actions/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** `npm run build` exits 0 before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/actions/phase76-logWearWithVideo.test.ts` — unit tests for VID-07, VID-08, VID-09, VID-10, VID-16 with mocked Supabase storage client
- [ ] `tests/integration/phase76-video-schema.test.ts` — VID-11 (additive migration non-regression), VID-12 (CHECK constraint enforcement); requires `DATABASE_URL`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` in every Server Action — throws on unauth |
| V3 Session Management | no | Server Action uses cookie-based Supabase session; no new session logic |
| V4 Access Control | yes | `watchDAL.getWatchById(user.id, watchId)` ownership check; path constructed from `user.id` |
| V5 Input Validation | yes | Zod schema on all inputs; `z.string().uuid()` for IDs; `z.number().int().positive()` for `videoBytes` |
| V6 Cryptography | no | No new crypto; Supabase handles signed URLs |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user storage path write (T-15-17 / VID-16) | Tampering | Server constructs `${user.id}/${wearEventId}.mp4`; client never supplies path |
| Probe bypass (T-15-04 / VID-08) | Tampering | `.list()` probe before DB INSERT; any probe failure returns generic error |
| Orphan Storage on INSERT failure (T-15-18 / VID-10) | — | best-effort `remove([videoPath, posterPath])` in catch; swallow storage errors, log only |
| Cross-user watchId (IDOR) | Tampering | `watchDAL.getWatchById(user.id, watchId)` scoped to caller; uniform 'Watch not found' message |
| Oversized upload (VID-09) | Denial of Service | `videoBytes > 5 * 1024 * 1024` check in Server Action + bucket `file_size_limit = 5242880` enforced at Supabase Storage layer |

---

## Open Questions for Planner

1. **`photo_url` vs `media_path` for NEW photo posts (post-Phase 77)**
   - When Phase 77 lands, should new photo posts write `media_path` instead of `photo_url`, or continue writing `photo_url`?
   - Research stance: keep writing `photo_url` for photo posts to avoid any regression to `logWearWithPhoto`. New reads in Phase 77 can check both columns (`coalesce(media_path, photo_url)` for display). A future cleanup phase can backfill and drop `photo_url`.
   - The planner must make this explicit so Phase 77 display code is written correctly from the start.

2. **Bucket RLS SELECT policy update for `.mp4` paths**
   - The existing `wear_photos_select_three_tier` policy on `storage.objects` uses `split_part(storage.filename(name), '.', 1)` to extract the `wear_event_id` UUID from the filename. This works for `.jpg` and `.mp4` alike (the UUID is the stem). No RLS change needed for the video case.
   - However: the RLS policy currently only selects the `wear_visibility` field. There is no media_type gate — the three-tier visibility applies to all files in the bucket. This is correct and desired; no action needed.
   - The planner should verify this assumption is correct in the Phase 76 plan.

3. **`videoBytes` in Server Action — where does the size come from?**
   - The proposed Server Action receives `videoBytes` as a number (the client's `blob.size` value). This is the simplest approach and mirrors how Photo upload currently handles size.
   - Alternative: the Server Action receives the raw video blob and measures it directly via `arrayBuffer().byteLength`. This is safer but requires the Server Action to accept file data — a different calling convention than Phase 15.
   - Research recommendation: accept `videoBytes: number` from the client (same model as `hasPhoto: boolean` in Phase 15), because the actual video is uploaded client-direct to Supabase Storage. The Server Action does NOT receive the video bytes directly. The client sends blob.size; the server uses it as the size gate. This is the architecturally consistent approach.

4. **`wearEventId` — client-generated UUID accepted by server?**
   - REQUIREMENTS.md VID-16 says "server-issued wearEventId". Phase 15 shows the client generates the UUID (`crypto.randomUUID()`) and the server validates its shape (UUID format) and constructs the path from it. The "server-issued" language means "server-constructed path", not "server-generated UUID".
   - Research conclusion: Phase 76 should follow Phase 15 exactly — client generates a UUID, passes it to the Server Action, server validates UUID shape and constructs `${user.id}/${wearEventId}.mp4`. No architecture change is needed.

5. **Does the Phase 76 migration also need to update the Storage SELECT RLS for video tiles on the wear-event detail page?**
   - The existing policy works because it extracts the wear_event_id UUID from the filename stem (`.mp4` vs `.jpg` is stripped by `split_part`). No new RLS is needed.
   - However, the policy was written when `wear-photos` only contained `.jpg` files. A full verification that the policy works for `.mp4` paths should be part of Phase 76 integration testing.

6. **Spike cleanup — `src/app/spike-mr-capture/` deletion**
   - STATE.md notes "Spike cleanup: `src/app/spike-mr-capture/` must be deleted in Phase 77 (or earlier — throwaway code per Spike 001 README cleanup instructions)."
   - Could be included in Phase 76 as a no-risk cleanup task (it is dead code). The planner should decide which phase owns it.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `revalidateTag(tag)` single-arg | `revalidateTag(tag, 'max')` for SWR; `updateTag(tag)` for read-your-own-writes | Next.js 16 / Phase 75 | Phase 76 Server Action must use `revalidateTag(\`profile:${username}\`, 'max')` — NOT single-arg form |
| `createSupabaseServerClient()` for URL signing in PPR routes | `createSupabaseAdminClient()` for signing (no cookies dependency) | Phase 61 | Phase 76 does not sign URLs (returns raw paths from DAL); relevant only for Phase 77 detail page |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `supabase storage list()` with `search:` does prefix-based matching and requires an exact `.some(f => f.name === ...)` check | Common Pitfalls §1 | Probe logic may incorrectly pass or fail; would be caught by unit test |
| A2 | `UPDATE storage.buckets SET allowed_mime_types = array_cat(...)` works in the Supabase SQL migration context | Migration Plan | If Supabase restricts bucket mutation via SQL migration, manual dashboard update is needed instead |
| A3 | The existing three-tier SELECT RLS policy (`split_part(filename, '.', 1)`) correctly extracts wear_event_id UUID from `.mp4` filenames | Security Domain | Video signed URLs would fail to generate; caught by Phase 76 integration test |
| A4 | `videoBytes` will be passed as the client's `blob.size` value to the Server Action (no direct blob transfer) | Architecture Patterns | If design changes to accept raw blob, Server Action signature changes significantly |

**All critical patterns (T-15-17, T-15-04, T-15-18) are VERIFIED from the live codebase.**

---

## Sources

### Primary (HIGH confidence)
- `src/app/actions/wearEvents.ts` — Phase 15 `logWearWithPhoto` full implementation; T-15-04/17/18 threat mitigations verified
- `src/db/schema.ts` — current `wearEvents` table definition (lines 294-315); no `media_type` column exists today
- `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql` — `wear-photos` bucket creation: 5 MB limit, JPEG/PNG/WEBP MIME only
- `supabase/migrations/20260527000000_phase62_wear_hidden_from_detail.sql` — additive migration pattern reference
- `src/lib/storage/wearPhotos.ts` — `buildWearPhotoPath()` pattern; `uploadWearPhoto()` client helper
- `src/data/wearEvents.ts` — `logWearEventWithPhoto()` DAL helper pattern; all read functions that return `photoUrl`
- `.planning/REQUIREMENTS.md` — VID-07 through VID-16 definitions
- `.planning/ROADMAP.md` — Phase 76 success criteria including T-15-04/17/18 references
- `.planning/STATE.md` — locked decisions D-01..D-09 from SEED-020 + Spike 001
- `.planning/spikes/001-mr-ios-capture/README.md` — empirical results: 3.6 MB for 3s 720p, codec `avc1.42000a`, autoplay-muted-loop+playsInline confirmed

### Secondary (MEDIUM confidence)
- `src/app/wear/[wearEventId]/page.tsx` — how `photoUrl` is currently consumed (signed via `createSupabaseServerClient`); Phase 77 must add video path support here
- `src/components/wywt/WywtPostDialog.tsx` — `wearEventId = crypto.randomUUID()` client generation; Phase 77 context

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified from live codebase
- Architecture: HIGH — direct structural parallel to Phase 15 T-15-04/17/18; code excerpts cited
- Migration plan: HIGH — pattern matches Phase 11 Migration 1 (wear_visibility) and Phase 62 (hidden_from_detail); idempotence guards verified
- Pitfalls: MEDIUM-HIGH — A1 (probe prefix matching) is ASSUMED; all others derived from live code

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (30 days — stable infrastructure, no fast-moving dependencies)
