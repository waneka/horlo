# Phase 76: Video Schema, Storage Paths + Server Action — Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 7 (new/modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/actions/wearEvents.ts` (add `logWearWithVideo`) | server-action | write (request-response) | `src/app/actions/wearEvents.ts` — `logWearWithPhoto` (L126-255) | exact |
| `src/data/wearEvents.ts` (add `logWearEventWithVideo`) | dal-helper | write (CRUD) | `src/data/wearEvents.ts` — `logWearEventWithPhoto` (L60-78) | exact |
| `src/lib/storage/wearPhotos.ts` (add `buildWearVideoPath` + `buildWearPosterPath`) | utility | transform | `src/lib/storage/wearPhotos.ts` — `buildWearPhotoPath` (L28-39) | exact |
| `src/db/schema.ts` (add `mediaTypeEnum` + 3 columns to `wearEvents`) | db-schema | — | `src/db/schema.ts` — `wearVisibilityEnum` (L23-27) + `wearEvents` table (L294-315) | exact |
| `supabase/migrations/20260622000000_phase76_video_schema.sql` | migration | write (DDL) | `supabase/migrations/20260423000001_phase11_wear_visibility.sql` (BEGIN/COMMIT + IF NOT EXISTS enum + ADD COLUMN IF NOT EXISTS + DO $$ CHECK guard) | exact |
| `tests/actions/phase76-logWearWithVideo.test.ts` | test | unit | `tests/actions/watchPhotos.test.ts` (vi.mock pattern, authAs/authFail helpers, describe/it/beforeEach shape) | role-match |
| `tests/integration/phase76-video-schema.test.ts` | test | integration | `tests/integration/phase15-wywt-photo-flow.test.ts` (maybe=describe.skip gate, beforeAll DB setup, withMockedAuth/vi.doMock, afterAll cleanup) | exact |

---

## Pattern Assignments

### `src/app/actions/wearEvents.ts` — add `logWearWithVideo`

**Analog:** `src/app/actions/wearEvents.ts` — `logWearWithPhoto` export

**Imports pattern** (lines 1-12):
```typescript
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import * as wearEventDAL from '@/data/wearEvents'
import * as watchDAL from '@/data/watches'
import * as profilesDAL from '@/data/profiles'
import { logActivity } from '@/data/activities'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/actionTypes'
import type { WearVisibility } from '@/lib/wearVisibility'
```
No new imports needed — all are already present in this file.

**Zod schema pattern** (lines 91-98):
```typescript
const logWearWithPhotoSchema = z.object({
  wearEventId: z.string().uuid(),
  watchId: z.string().uuid(),
  note: z.string().max(200).nullable(),
  visibility: z.enum(['public', 'followers', 'private']),
  hasPhoto: z.boolean(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
```
Change: replace `hasPhoto: z.boolean()` with `videoBytes: z.number().int().positive()`. This is the only schema field that differs.

**Auth-first pattern** (lines 136-141):
```typescript
let user
try {
  user = await getCurrentUser()
} catch {
  return { success: false, error: 'Not authenticated' }
}
```
Copy verbatim. Auth must come before Zod parse (matches established ordering in all Server Actions in this file).

**IDOR ownership check pattern** (lines 151-154):
```typescript
const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
if (!watch) {
  return { success: false, error: 'Watch not found' }
}
```
Copy verbatim. Server scopes watch lookup to caller's userId — uniform "Watch not found" on miss (no existence leak).

**T-15-17 / VID-16 — server path construction pattern** (lines 156-158):
```typescript
// Path is server-constructed — never trust a client-supplied path.
const photoPath = `${user.id}/${parsed.data.wearEventId}.jpg`
const supabase = await createSupabaseServerClient()
```
Change: derive TWO paths — `videoPath = \`${user.id}/${parsed.data.wearEventId}.mp4\`` and `posterPath = \`${user.id}/${parsed.data.wearEventId}-poster.jpg\``. Client never supplies either path.

**T-15-04 / VID-08 — Storage probe pattern** (lines 162-174):
```typescript
if (parsed.data.hasPhoto) {
  const { data: listed, error: listErr } = await supabase.storage
    .from('wear-photos')
    .list(user.id, { search: `${parsed.data.wearEventId}.jpg` })
  const found =
    !listErr && (listed ?? []).some((f) => f.name === `${parsed.data.wearEventId}.jpg`)
  if (!found) {
    return {
      success: false,
      error: 'Photo upload failed — please try again',
    }
  }
}
```
Change: remove the `if (parsed.data.hasPhoto)` guard — video upload is always required, no conditional. Run two parallel probes via `Promise.all` (one for `.mp4`, one for `-poster.jpg`). Use exact `.some(f => f.name === ...)` match on each result to avoid the prefix-matching pitfall (Pitfall 1 in RESEARCH.md). Return `'Video upload failed — please try again'` if either probe fails.

**T-15-18 / VID-10 — compensating delete pattern** (lines 193-208):
```typescript
if (parsed.data.hasPhoto) {
  try {
    const cleanup = await supabase.storage
      .from('wear-photos')
      .remove([photoPath])
    console.error(
      '[logWearWithPhoto] insert failed; orphan cleanup:',
      cleanup.error ?? 'ok',
    )
  } catch (cleanupErr) {
    console.error('[logWearWithPhoto] orphan cleanup threw:', cleanupErr)
  }
}
```
Change: remove the `if (parsed.data.hasPhoto)` guard — cleanup is always required for video. Pass `[videoPath, posterPath]` to `.remove(...)` (batch delete). Update log prefix to `[logWearWithVideo]`.

**23505 catch + generic error pattern** (lines 210-218):
```typescript
const code = (err as { code?: string } | null)?.code
if (code === '23505') {
  return { success: false, error: 'Already logged this watch today' }
}
console.error('[logWearWithPhoto] insert failed:', err)
return {
  success: false,
  error: 'Could not log that wear. Please try again.',
}
```
Copy verbatim. Change log prefix to `[logWearWithVideo]`.

**Cache invalidation pattern** (lines 245-253):
```typescript
revalidatePath('/')
const ownerProfile = await profilesDAL.getProfileById(user.id)
if (ownerProfile?.username) {
  revalidateTag(`profile:${ownerProfile.username}`, 'max')
}
return { success: true, data: { wearEventId: parsed.data.wearEventId } }
```
Copy verbatim. Uses `revalidateTag(tag, 'max')` (SWR fan-out form — NOT single-arg; per memory `project_next16_revalidatetag_deprecated`).

**New pattern — VID-09 server size gate** (no analog in Phase 15):
```typescript
// VID-09 server gate: authoritative 5 MB check (videoBytes is client blob.size)
if (parsed.data.videoBytes > 5 * 1024 * 1024) {
  return { success: false, error: 'Video too large — maximum 5 MB' }
}
```
Insert after Zod parse succeeds and before the IDOR check. The `videoBytes` field carries `blob.size` from the client — it is not the raw bytes. Server is the authoritative gate; bucket `file_size_limit = 5242880` is a defense-in-depth backstop at the Supabase layer.

---

### `src/data/wearEvents.ts` — add `logWearEventWithVideo`

**Analog:** `src/data/wearEvents.ts` — `logWearEventWithPhoto` (lines 60-78)

**File header pattern** (lines 1-7):
```typescript
import 'server-only'

import { db } from '@/db'
import { wearEvents, profileSettings, follows, profiles, watches } from '@/db/schema'
import { eq, and, desc, inArray, gte, or, sql, asc, isNotNull } from 'drizzle-orm'
import type { WywtTile, WywtRailData } from '@/lib/wywtTypes'
import type { WearVisibility } from '@/lib/wearVisibility'
```
No new imports needed. The new `mediaTypeEnum` column is referenced indirectly through the Drizzle schema — no enum import needed in the DAL.

**Core DAL insert pattern** (lines 60-78):
```typescript
export async function logWearEventWithPhoto(input: {
  id: string
  userId: string
  watchId: string
  wornDate: string
  note: string | null
  photoUrl: string | null
  visibility: WearVisibility
}): Promise<void> {
  await db.insert(wearEvents).values({
    id: input.id,
    userId: input.userId,
    watchId: input.watchId,
    wornDate: input.wornDate,
    note: input.note,
    photoUrl: input.photoUrl,
    visibility: input.visibility,
  })
}
```
Change: rename to `logWearEventWithVideo`. Replace `photoUrl: string | null` in the input type with `mediaPath: string` and `posterPath: string` (both non-nullable — the Server Action only calls this after probing that both objects exist). In `.values({...})` replace `photoUrl: input.photoUrl` with `mediaType: 'video'`, `mediaPath: input.mediaPath`, `posterPath: input.posterPath`. Do NOT pass `photoUrl` (leave it NULL for video rows). Do NOT add `.onConflictDoNothing()` — caller catches 23505 explicitly to trigger Storage cleanup (same reasoning as `logWearEventWithPhoto`, documented at lines 52-57).

---

### `src/lib/storage/wearPhotos.ts` — add `buildWearVideoPath` + `buildWearPosterPath`

**Analog:** `src/lib/storage/wearPhotos.ts` — `buildWearPhotoPath` (lines 28-39)

**Full analog** (lines 1-39):
```typescript
'use client'

// ...header comment...

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type UploadResult = { path: string } | { error: string }

const UUID_RE = /^[0-9a-f-]{36}$/i

export function buildWearPhotoPath(
  userId: string,
  wearEventId: string,
): string {
  if (!userId) {
    throw new TypeError('userId required')
  }
  if (!UUID_RE.test(wearEventId)) {
    throw new TypeError('wearEventId must be a UUID')
  }
  return `${userId}/${wearEventId}.jpg`
}
```
Change: add two new exported functions after `buildWearPhotoPath`. Both copy the guard structure (`if (!userId)` + UUID_RE test) and differ only in return value suffix (`.mp4` and `-poster.jpg`). The `UUID_RE` constant is already in scope — do not redeclare it. The `'use client'` directive at line 1 stays in place (these helpers are for Phase 77 client-direct uploads, same as `buildWearPhotoPath`).

---

### `src/db/schema.ts` — add `mediaTypeEnum` + 3 columns to `wearEvents`

**Analog 1: enum declaration** (lines 23-27):
```typescript
// ----- Phase 11: wear_visibility enum (WYWT-09) -----
export const wearVisibilityEnum = pgEnum('wear_visibility', [
  'public',
  'followers',
  'private',
])
```
Change: add `export const mediaTypeEnum = pgEnum('media_type', ['photo', 'video'] as const)` immediately after `wearVisibilityEnum` (line 27). Match the comment header style with `// ----- Phase 76: media_type enum (VID-11) -----`. Use `as const` to match `movementTypeEnum` pattern at line 44.

**Analog 2: wearEvents table columns** (lines 294-315):
```typescript
export const wearEvents = pgTable(
  'wear_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    watchId: uuid('watch_id').notNull().references(() => watches.id, { onDelete: 'cascade' }),
    wornDate: text('worn_date').notNull(),
    note: text('note'),
    // Phase 11 additions (WYWT-09):
    photoUrl: text('photo_url'),
    visibility: wearVisibilityEnum('visibility').notNull().default('public'),
    // Phase 62 D-11: ...
    hiddenFromDetail: boolean('hidden_from_detail').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  ...
)
```
Change: add three columns after `hiddenFromDetail` and before `createdAt`:
```typescript
// Phase 76 additions (VID-11):
mediaType: mediaTypeEnum('media_type').notNull().default('photo'),
mediaPath: text('media_path'),      // NULL for pre-Phase-76 photo-only rows
posterPath: text('poster_path'),    // NULL for all photos; set only for videos
```
`photoUrl` stays in place — do NOT remove or rename it. Existing rows default to `mediaType = 'photo'` with `mediaPath = NULL` and `posterPath = NULL`. The DB-level CHECK constraint (`wear_events_video_paths_required`) lives in the migration file only — Drizzle 0.45.2 cannot express CHECK constraints in the pg-core DSL.

---

### `supabase/migrations/20260622000000_phase76_video_schema.sql`

**Primary analog:** `supabase/migrations/20260423000001_phase11_wear_visibility.sql`

**BEGIN/COMMIT + IF NOT EXISTS enum guard pattern** (lines 18-27 of Phase 11 migration):
```sql
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wear_visibility') THEN
    CREATE TYPE wear_visibility AS ENUM ('public', 'followers', 'private');
  END IF;
END $$;
```
Copy this guard verbatim. Change: `typname = 'media_type'`, `CREATE TYPE media_type AS ENUM ('photo', 'video')`.

**ADD COLUMN IF NOT EXISTS pattern** (lines 32-35 of Phase 11 migration):
```sql
ALTER TABLE wear_events
  ADD COLUMN IF NOT EXISTS photo_url text NULL;
ALTER TABLE wear_events
  ADD COLUMN IF NOT EXISTS visibility wear_visibility NOT NULL DEFAULT 'public';
```
Change: three columns in one ALTER statement (idiomatic SQL; Phase 11 used two separate ALTER statements — either form is fine). Add `media_type media_type NOT NULL DEFAULT 'photo'`, `media_path text NULL`, `poster_path text NULL`.

**Secondary analog — DO $$ CHECK constraint guard pattern** (`supabase/migrations/20260522000000_phase53_likes_comments_rls.sql` lines 69-80):
```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'comments_exactly_one_target'
       AND conrelid = 'public.comments'::regclass
  ) THEN
    ALTER TABLE comments
      ADD CONSTRAINT comments_exactly_one_target
      CHECK ((watch_id IS NULL) <> (wear_event_id IS NULL));
  END IF;
END $$;
```
Change: constraint name `wear_events_video_paths_required`, table `wear_events`, CHECK predicate `(media_type = 'photo' OR (media_path IS NOT NULL AND poster_path IS NOT NULL))`.

**Tertiary analog — bucket MIME UPDATE** (`supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql` lines 36-44):
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wear-photos',
  'wear-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
```
The bucket already exists. Use UPDATE instead:
```sql
UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  allowed_mime_types,
  ARRAY['video/mp4']::text[]
)
WHERE id = 'wear-photos'
  AND NOT ('video/mp4' = ANY(allowed_mime_types));
```
The `array_cat` + NOT EXISTS guard appends without replacing existing MIME types (avoids Pitfall 4 from RESEARCH.md — overwriting the existing image types).

**Inline assertion pattern** (lines 72-86 of Phase 11 migration):
```sql
DO $$
DECLARE
  followers_count bigint;
BEGIN
  SELECT COUNT(*) INTO followers_count
    FROM wear_events
   WHERE visibility = 'followers';

  IF followers_count > 0 THEN
    RAISE EXCEPTION
      'Backfill bug (Pitfall G-6): % rows ended up with visibility=followers ...',
      followers_count;
  END IF;
END $$;
```
Change: assert `media_type = 'video'` count is 0 after migration (since no pre-76 rows should have video type). Note from memory `project_post_flight_assertion_predicate_divergence`: phrase assertion broadly — check `WHERE media_type::text = 'video'` or `WHERE media_type != 'photo'` so it doesn't trivially pass if the migration accidentally no-ops.

---

### `tests/actions/phase76-logWearWithVideo.test.ts` (unit test)

**Analog:** `tests/actions/watchPhotos.test.ts`

**vi.mock setup pattern** (lines 50-72):
```typescript
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/data/wearEvents', () => ({
  logWearEventWithVideo: vi.fn(),
}))

vi.mock('@/data/watches', () => ({
  getWatchById: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
```
Phase 76 does not use custom error classes (no `vi.hoisted` needed). The Supabase mock must return an object with `.storage.from('wear-photos').list()` and `.storage.from('wear-photos').remove()` methods — use a nested mock object, not a real client.

**authAs / authFail helpers** (lines 91-97):
```typescript
function authAs(user = mockUser) {
  ;(getCurrentUser as Mock).mockResolvedValueOnce(user)
}
function authFail() {
  ;(getCurrentUser as Mock).mockRejectedValueOnce(new Error('Not authenticated'))
}
```
Copy verbatim.

**Test structure** — each test asserts one VID-NN requirement:
- VID-07/VID-16: server constructs path from `user.id` + `wearEventId`; `wearEventDAL.logWearEventWithVideo` is called with the server-derived path, not any client string
- VID-08: mock `.list()` to return empty — action must return `{ success: false, error: 'Video upload failed ...' }` and NOT call `logWearEventWithVideo`
- VID-09: pass `videoBytes: 5 * 1024 * 1024 + 1` — action must return size error before Storage probe
- VID-10: mock `.list()` to succeed but mock `logWearEventWithVideo` to throw — assert `.remove([videoPath, posterPath])` was called
- VID-16: auth as `userA`, pass `watchId` owned by `userB` — mock `getWatchById` to return null — assert `{ success: false, error: 'Watch not found' }`
- Auth failure: `authFail()` — assert `{ success: false, error: 'Not authenticated' }` before any DAL call

---

### `tests/integration/phase76-video-schema.test.ts` (integration test)

**Analog:** `tests/integration/phase15-wywt-photo-flow.test.ts`

**Environment gate pattern** (lines 38-44):
```typescript
const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabase =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabase ? describe : describe.skip
```
Copy verbatim. Phase 76 tests are integration-only — they require a real DB to verify VID-11 (additive migration, existing rows unaffected) and VID-12 (CHECK constraint enforcement). Per memory `project_vitest_static_node_env`, add `// @vitest-environment node` at the top of the file.

**beforeAll / afterAll DB setup pattern** (lines 83-176):
```typescript
beforeAll(async () => {
  admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  // ... createUser, insert catalog + watches rows ...
}, 60_000)

afterAll(async () => {
  // cleanup storage, then wear_events, watches, users, auth.admin.deleteUser
}, 60_000)
```
Copy structure. Phase 76 integration tests need only one test user (not two) since VID-11/VID-12 tests are schema-level, not cross-user privacy checks.

**withMockedAuth helper** (lines 293-326):
```typescript
async function withMockedAuth(userId: string, fn: () => Promise<void>) {
  vi.resetModules()
  vi.doMock('@/lib/auth', async () => { ... })
  vi.doMock('@/lib/supabase/server', () => ({
    createSupabaseServerClient: vi.fn(async () => admin),
  }))
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
  try {
    await fn()
  } finally {
    vi.doUnmock('@/lib/auth')
    vi.doUnmock('@/lib/supabase/server')
    vi.doUnmock('next/cache')
    vi.resetModules()
  }
}
```
Copy verbatim — use `admin` (service-role client) as the Storage client so probes succeed without real cookie sessions.

**VID-11 test shape** (analog: Test 5 in Phase 15 integration, lines 202-233):
Query `wearEvents` by `id` after calling `logWearEventWithVideo`. Assert `row.mediaType === 'video'`, `row.mediaPath === videoPath`, `row.posterPath === posterPath`, `row.photoUrl === null`. Then query an existing pre-76 photo row: assert `row.mediaType === 'photo'`, `row.photoUrl !== null`, `row.mediaPath === null`.

**VID-12 test shape** — direct Drizzle insert with `mediaType: 'video'` but `mediaPath: null` must throw PG `23514` (CHECK violation). Mirror the Test 6 pattern (lines 235-269) that catches the error and asserts `.code === '23505'` — change target code to `'23514'`.

---

## Shared Patterns

### Auth-first ordering
**Source:** `src/app/actions/wearEvents.ts` lines 136-141 (all Server Actions in file)
**Apply to:** `logWearWithVideo` in `src/app/actions/wearEvents.ts`
```typescript
let user
try {
  user = await getCurrentUser()
} catch {
  return { success: false, error: 'Not authenticated' }
}
```
Auth must execute before Zod parse, before ownership check, before Storage calls.

### Zod parse + early return
**Source:** `src/app/actions/wearEvents.ts` lines 143-145
**Apply to:** `logWearWithVideo`
```typescript
const parsed = logWearWithVideoSchema.safeParse(input)
if (!parsed.success) {
  return { success: false, error: 'Invalid input' }
}
```

### IDOR ownership check
**Source:** `src/app/actions/wearEvents.ts` lines 151-154
**Apply to:** `logWearWithVideo`
```typescript
const watch = await watchDAL.getWatchById(user.id, parsed.data.watchId)
if (!watch) {
  return { success: false, error: 'Watch not found' }
}
```
Use uniform "Watch not found" regardless of whether the watchId doesn't exist or belongs to another user (no existence leak).

### revalidateTag SWR form (Next 16)
**Source:** `src/app/actions/wearEvents.ts` lines 250-253 (per memory `project_next16_revalidatetag_deprecated`)
**Apply to:** `logWearWithVideo` cache invalidation block
```typescript
revalidateTag(`profile:${ownerProfile.username}`, 'max')
```
Always `revalidateTag(tag, 'max')` for cross-user SWR fan-out. Single-arg `revalidateTag(tag)` is deprecated in Next 16.

### Storage path construction is server-only
**Source:** `src/app/actions/wearEvents.ts` line 157 (T-15-17 comment)
**Apply to:** `logWearWithVideo` (VID-16)
Path derivation: `\`${user.id}/${parsed.data.wearEventId}.mp4\`` must live inside the Server Action, after `getCurrentUser()`. The action input type must NOT include `videoPath` or `posterPath` parameters.

### BEGIN/COMMIT atomic migration
**Source:** `supabase/migrations/20260423000001_phase11_wear_visibility.sql` lines 18, 88
**Apply to:** `supabase/migrations/20260622000000_phase76_video_schema.sql`
Wrap the entire migration in `BEGIN;` ... `COMMIT;` so the inline assertion can abort the transaction on failure.

### Dual-migration discipline header comment
**Source:** `supabase/migrations/20260527000000_phase62_wear_hidden_from_detail.sql` lines 5-9
**Apply to:** `supabase/migrations/20260622000000_phase76_video_schema.sql`
```sql
-- Dual-migration discipline: drizzle-kit push LOCAL ONLY; prod uses supabase db push --linked
```
Include in migration file header.

---

## No Analog Found

All files in Phase 76 have direct analogs in the codebase. No novel patterns are required.

---

## Metadata

**Analog search scope:** `src/app/actions/`, `src/data/`, `src/lib/storage/`, `src/db/schema.ts`, `supabase/migrations/`, `tests/actions/`, `tests/integration/`
**Files scanned:** 11 analog files read
**Pattern extraction date:** 2026-06-22
