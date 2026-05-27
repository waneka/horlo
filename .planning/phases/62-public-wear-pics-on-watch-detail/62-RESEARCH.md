# Phase 62: Public Wear Pics on Watch Detail - Research

**Researched:** 2026-05-27
**Domain:** DAL union extension, hide-from-detail schema, social layer reuse, cache-safe signing, Wears-tab photo repoint
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01 (Phase 60 D-02): Wear pics are NOT copied into watch_photos. Queried from wear_events (visibility='public') and merged into the carousel at the DAL read layer.
- D-02: Carousel order = owner uploads first, then public wear pics newest-worn first.
- D-03: Wear pics render in the always-on filmstrip as tap-to-jump thumbnails.
- D-04 (Phase 60 D-14): Surfaced wear pics do NOT count against the 10-photo owner-upload cap.
- D-05: Wear-pic slides carry a "Worn · [date]" badge; owner uploads stay unmarked.
- D-06: No per-user attribution on detail page (all wear pics are the watch owner's own in v7.0).
- D-07 (GOTCHA): Pin timeZone:'UTC' + 'en-US' on the badge formatter (React #418 hydration class).
- D-08: Hide control reuses the Phase 61 "Edit photos" mode — eye/hide action on wear-pic filmstrip thumbnails.
- D-09: "Hide" = removed from this watch detail carousel ONLY. Wear remains in Wears tab and Home rail.
- D-10: Hide is reversible in the same Edit mode — hidden wear pic still appears in filmstrip, greyed.
- D-11: Hide is a dedicated persistent state, separate from wear_events.visibility. Constraints: (a) must NOT alter visibility, (b) must key per wear_event, (c) union query filters hidden pics out for ALL viewers.
- D-12: Owner-gating is defense-in-depth: hide UI behind viewerCanEdit + server action ownership re-check + DAL union as real gate.
- D-13: Each surfaced wear pic carries its own wear-target like + comment layer ({type:'wear', id}). Watch-level like + CommentThread ({type:'watch'}) stay separate and unchanged.
- D-14: Inline on the active slide — like toggle + count + comment count when carousel is on a wear-pic slide.
- D-15: Tapping comment count opens wear pic's thread in a bottom sheet. Do NOT disturb unstable_instant = false lock on /w/[ref].
- D-16: Wears tab shows actual wear photo, falling back to catalog/cover image only when no photo.
- D-17 (WPIC-04): Home wear rail stays 48h-ephemeral. Must NOT change getWearRailForViewer.
- D-18 (WPIC-05): followers-only / private wear pics never surface on detail. Enforced by union filtering visibility='public' AND not-hidden, with service-role DAL as real gate.
- D-19: Wear-pic URLs live in the wear-photos bucket and must be signed via the admin/service-role client. Storage paths are {userId}/… scoped. Fail-safe-to-placeholder on signing failure.

### Claude's Discretion
- Exact hide/eye icon, "Hidden" greyed-thumbnail treatment, "Worn · [date]" badge styling/position, like control placement.
- Sheet/overlay primitive for the wear-pic comment thread.
- Optimistic-update + toast copy.
- Hide-flag data shape (column vs join table) per D-11's constraints.

### Deferred Ideas (OUT OF SCOPE)
- Full detail-page information hierarchy + deliberate comment placement — Phase 64.
- Wear note/caption shown on the wear-pic slide — deferred to Phase 64.
- Per-viewer/multi-actor attribution on wear pics — future.
- Inline grid like/comment composer — Phase 63.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WPIC-01 | A wear photo set to "public" visibility automatically surfaces on its watch's detail page | DAL union in getWatchByIdForViewer (or dedicated new function) querying wear_events WHERE visibility='public' AND watchId=X AND NOT hiddenFromDetail |
| WPIC-02 | The owner can hide a specific surfaced wear pic from the watch detail page (per-pic control) | New hiddenFromDetail boolean column on wear_events; hide/unhide server action in src/app/actions/; edit mode UI extension in WatchPhotoSection |
| WPIC-03 | Wear photos persist in the owner's Wears tab, showing the actual wear photo rather than the generic catalog image | WornTabContent WatchSummary type needs photoUrl field; WornTimeline/WornCalendar need to prefer event.photoUrl over watchMap image; page.tsx must sign wear-photo paths |
| WPIC-04 | The Home wear rail stays ephemeral — detail surfacing does not change rail behavior | getWearRailForViewer must remain byte-for-byte unchanged; no new write path touches wornDate gating |
| WPIC-05 | A non-public wear pic never surfaces on watch detail | Union WHERE clause enforces visibility='public' AND NOT hiddenFromDetail; service-role DAL is the real gate per Phase 53 RLS-subquery lesson |
| WPIC-06 | Surfaced public wear pics carry the v6.0 likes/comments interaction layer | LikeButton + toggleLikeAction already support wear targets; WearCommentHost variant='bottom-sheet' already exists; social layer reads getLikesForTargetCached, getCommentsForTarget — all target='wear' already wired |
</phase_requirements>

---

## Summary

Phase 62 is a stitching phase, not a foundational one. All the primitives are in place — the carousel is built (Phase 61), the social layer targets wear events (Phase 53/54/55/56), the comment bottom-sheet pattern is established (WearCommentHost), and the signing pattern is proven (Phase 61 admin-client approach). The work is:

1. **Schema addition** — one boolean column `hidden_from_detail` on `wear_events` (with dual-migration discipline: drizzle push locally, supabase db push --linked to prod).
2. **DAL addition** — a new function (or extension to `getWatchByIdForViewer`'s photo assembly section) that queries `wear_events WHERE visibility='public' AND NOT hidden_from_detail AND watch_id = ?` and returns signed wear-pic entries alongside the existing `SignedPhoto[]`.
3. **WatchPhotoSection extension** — the `SignedPhoto` type grows optional wear-pic metadata (wearEventId, wornDate, likeState, commentCount); the component conditionally renders the badge + inline social controls on wear-pic slides; Edit mode adds eye/hide per wear-pic thumb.
4. **Hide/unhide server action** — new action in `src/app/actions/` that re-checks ownership and flips `hidden_from_detail`.
5. **Wears tab repoint** — extend `WearEventLite` with `photoUrl?` and `WatchSummary.photoUrl?`, sign wear-photo paths in `[tab]/page.tsx`, pass to WornTimeline/WornCalendar which prefer the event's own signed URL over the watch cover.

The hard constraints are: don't touch `getWearRailForViewer`, don't use `visibility` for the hide state, sign via admin client only, keep CommentThread as an uncached RSC sibling (no 'use cache'), preserve `unstable_instant = false` and the `await connection()` opt-out on `/w/[ref]/page.tsx`.

**Primary recommendation:** Add `hidden_from_detail boolean NOT NULL DEFAULT false` to `wear_events`; build a dedicated `getPublicWearPicsForWatch(watchId, viewerId)` DAL function separate from `getWatchByIdForViewer` (keeps the viewer-resolver clean); sign results in the page.tsx RSC alongside existing photo signing.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wear-pic union query (public, not-hidden) | API/Backend (DAL) | — | Service-role Drizzle client; RLS-subquery gotcha means DAL is the real gate, not RLS |
| Wear-pic URL signing | Frontend Server (page RSC) | — | Admin client signing must stay out of DAL; mirrors existing owner-photo signing pattern |
| "Worn · [date]" badge + inline like/comment count | Browser/Client (WatchPhotoSection) | — | WatchPhotoSection is 'use client'; slide-level UI is client-rendered |
| Per-pic hide toggle (Edit mode) | Browser/Client (WatchPhotoSection) | API/Backend (server action) | UI gate is viewerCanEdit; server action re-checks ownership |
| Hide persistence (hidden_from_detail column) | Database | API/Backend (server action write) | Boolean column on wear_events; server action is sole write path |
| Wear-pic comment thread (bottom sheet) | Browser/Client (WearCommentHost) | API/Backend (comments DAL) | WearCommentHost with variant='bottom-sheet' already ships this pattern |
| Wears tab photo (actual wear photo) | Frontend Server (page RSC) | Browser/Client (WornTimeline) | RSC signs the URL; WornTimeline renders it |
| Home rail guard (unchanged) | API/Backend (getWearRailForViewer) | — | Must not be touched; 48h gate lives entirely inside that function |

---

## Standard Stack

### Core (all already installed — no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.2 | DAL queries — union, filter, insert | Project standard; already in use |
| next/cache (revalidateTag, updateTag) | 16.2.3 | Cache-tag invalidation after hide mutation | Matches existing toggleLikeAction pattern |
| @supabase/supabase-js (admin client) | existing | Signing wear-pic URLs in the wear-photos bucket | Same pattern as Phase 61 watch-photos signing |
| sonner (toast) | existing | Optimistic hide/unhide feedback | Already used for photo reorder and delete |
| lucide-react | ^1.8.0 | Eye / EyeOff icons for hide control | Already imported in WatchPhotoSection |

### No New Packages Needed
All social layer (LikeButton, toggleLikeAction, WearCommentHost, CommentList), drag/drop (dnd-kit), carousel (embla), and UI primitives (Sheet, SheetContent) are already installed and in use.

---

## Architecture Patterns

### System Architecture Diagram

```
/w/[ref]/page.tsx (RSC, dynamic via await connection())
  │
  ├── getWatchByIdForViewer() ─────── watches + profileSettings + cover subquery
  │
  ├── getWatchPhotosForWatch()  ──── watch_photos rows (owner uploads, sorted)
  │
  ├── [NEW] getPublicWearPicsForWatch()
  │     └── wear_events WHERE visibility='public'
  │           AND NOT hidden_from_detail
  │           AND watch_id = ?
  │           ORDER BY worn_date DESC
  │     └── returns { id, wornDate, photoUrl(raw), hiddenFromDetail }[]
  │
  ├── Admin-client signing (wear-photos bucket)
  │     └── signedUrl or null per entry (fail-safe-to-placeholder)
  │
  └── WatchDetail (client island)
        └── WatchPhotoSection (client)
              ├── ownerSlides: SignedPhoto[] (from watch_photos, signed)
              ├── wearSlides: SignedWearPic[] (from wear_events, signed)
              │     └── badge: "Worn · [date]" (wornDate UTC-pinned)
              │     └── [active slide] LikeButton (target={type:'wear', id})
              │     └── [active slide] comment count → opens WearCommentSheet
              └── Edit mode (viewerCanEdit=true only)
                    ├── owner thumbs: × delete + drag reorder (unchanged)
                    └── wear-pic thumbs: eye/hide toggle
                          └── onClick → hideWearPicAction(wearEventId)
                                └── re-checks watches.userId ownership
                                └── UPDATE wear_events SET hidden_from_detail = true
                                    WHERE id = ? AND watch_id IN
                                          (SELECT id FROM watches WHERE user_id = ?)

WearCommentSheet (new client component — thin wrapper)
  └── WearCommentHost variant='bottom-sheet' (existing)
        └── CommentList (existing, target={type:'wear', id})

Wears Tab: /u/[username]/[tab]/page.tsx (tab='worn')
  └── getWearEventsForViewer() — returns events with photoUrl (raw path, already in shape)
  └── [CHANGE] sign wear-photo paths in page.tsx alongside signCoverUrls
  └── [CHANGE] extend WearEventLite with photoUrl?: string | null
  └── WornTimeline / WornCalendar: prefer event.photoUrl over watchMap[id].imageUrl
```

### Recommended Project Structure (no new top-level directories needed)

```
src/
├── data/
│   └── wearEvents.ts           + getPublicWearPicsForWatch() (new export)
├── app/
│   ├── w/[ref]/page.tsx        + wear-pic union, signing, slide assembly
│   ├── u/[username]/[tab]/     + sign wear photoUrl paths, extend WearEventLite
│   └── actions/
│       └── wearEvents.ts       + hideWearPicAction / unhideWearPicAction
├── components/
│   ├── watch/
│   │   └── WatchPhotoSection.tsx   + SignedWearPic type, badge, inline social, eye-hide
│   └── profile/
│       ├── WornTimeline.tsx        + prefer photoUrl over imageUrl
│       └── WornCalendar.tsx        + prefer photoUrl over imageUrl
└── db/
    └── schema.ts               + hiddenFromDetail on wearEvents table
```

### Pattern 1: Wear-Pic Union at Read (D-01/D-02 spine)

**What:** `getWatchPhotosForWatch` returns owner uploads; new `getPublicWearPicsForWatch` returns the wear-pic side. The page.tsx RSC merges them: owner slides first (by sortOrder), then wear-pic slides (by wornDate DESC). Cover stays lowest sortOrder owner upload (Phase 60 contract).

**When to use:** On every render of `/w/[ref]` page (Branch 1 and D-06 catalog branch).

```typescript
// [VERIFIED: codebase - src/data/wearEvents.ts + src/db/schema.ts]
// New function signature (add to src/data/wearEvents.ts):
export async function getPublicWearPicsForWatch(
  watchId: string,
): Promise<Array<{ id: string; wornDate: string; photoUrl: string | null; hiddenFromDetail: boolean }>> {
  return db
    .select({
      id: wearEvents.id,
      wornDate: wearEvents.wornDate,
      photoUrl: wearEvents.photoUrl,
      hiddenFromDetail: wearEvents.hiddenFromDetail, // new column
    })
    .from(wearEvents)
    .where(
      and(
        eq(wearEvents.watchId, watchId),
        eq(wearEvents.visibility, 'public'),
        eq(wearEvents.hiddenFromDetail, false),
      ),
    )
    .orderBy(desc(wearEvents.wornDate))
}
```

The function is not viewer-scoped — the owner-identity gate is the watch-level `getWatchByIdForViewer` already called by the page. The union function only enforces the public + not-hidden filter. All viewers of the page get the same set of surfaced wear pics (D-12/D-18).

### Pattern 2: SignedWearPic Type Extension in WatchPhotoSection

**What:** Extend the existing `SignedPhoto` type with an optional discriminator for wear-pic metadata. The carousel renders differently based on whether a slide is an owner upload or a wear pic.

```typescript
// [VERIFIED: codebase - src/components/watch/WatchPhotoSection.tsx lines 61-65]
// Existing:
export interface SignedPhoto {
  id: string
  signedUrl: string | null
  sortOrder: number
}

// Extended for Phase 62 (wear-pic slides carry additional metadata):
export interface SignedWearPic {
  wearEventId: string
  signedUrl: string | null
  wornDate: string          // ISO date string 'YYYY-MM-DD'
  hiddenFromDetail: boolean // needed to render hidden state in Edit mode
  initialLikeState: { liked: boolean; count: number }
  commentCount: number
}
```

The `WatchPhotoSectionProps` receives both `photos: SignedPhoto[]` (owner uploads) and `wearPics: SignedWearPic[]` (surfaced wear pics). The component merges them into the slide order: owner photos first, wear pics appended.

### Pattern 3: Admin-Client Signing for wear-photos Bucket

**What:** Wear-pic URLs are stored as raw storage paths (`{userId}/wearEventId.jpg`) in `wear_events.photo_url`. The page RSC must sign them before passing to the client component. Matches the Phase 61 watch-photos signing pattern exactly.

```typescript
// [VERIFIED: codebase - src/app/w/[ref]/page.tsx lines 161-169]
// Mirror the existing pattern:
const supabase = createSupabaseAdminClient()
const signedWearPics = await Promise.all(
  rawWearPics.map(async (p) => {
    if (!p.photoUrl) return { ...p, signedUrl: null }
    // Fail-safe-to-placeholder: catch signing failure, return null (D-19)
    try {
      const { data } = await supabase.storage
        .from('wear-photos')          // NOTE: 'wear-photos' bucket, not 'watch-photos'
        .createSignedUrl(p.photoUrl, 60 * 60)  // 60-min TTL
      return { ...p, signedUrl: data?.signedUrl ?? null }
    } catch {
      return { ...p, signedUrl: null }
    }
  }),
)
```

Key difference from watch-photos: the bucket is `wear-photos`. Storage paths are already `{userId}/…` scoped from Phase 15 (CR-02 IDOR fix in Phase 61 applied the same prefix requirement to wear-photos). The fail-safe-to-placeholder behavior is applied here, closing the Phase 61 deferred item for non-owner cover signing.

### Pattern 4: Hide State via Boolean Column on wear_events

**What:** Add `hidden_from_detail boolean NOT NULL DEFAULT false` to `wear_events`. This is the simplest shape satisfying all D-11 constraints: (a) does not touch `visibility`, (b) keys per wear_event (the row's own PK), (c) the union query filters `WHERE NOT hidden_from_detail` for all viewers at read time.

**Why column over join table:** A join table would add a JOIN to every detail-page query and require a separate delete on unhide vs update-in-place. The column adds zero query complexity (one extra WHERE clause predicate), is non-nullable (no LEFT JOIN needed), and avoids a new table for a single boolean. With <500 watches/user the scale argument for a join table doesn't apply.

**Migration (dual-discipline):**

```sql
-- LOCAL: npx drizzle-kit push  (schema.ts change only)
-- PROD:  supabase db push --linked

ALTER TABLE wear_events ADD COLUMN IF NOT EXISTS hidden_from_detail boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS wear_events_watch_id_public_visible_idx
  ON wear_events(watch_id, worn_date DESC)
  WHERE visibility = 'public' AND hidden_from_detail = false;
```

The partial index covers the exact query shape of `getPublicWearPicsForWatch` (visibility='public', not-hidden, ordered by worn_date DESC for a given watch_id).

**Drizzle schema addition:**

```typescript
// [VERIFIED: codebase - src/db/schema.ts wearEvents table lines 294-311]
// Add to wearEvents table:
hiddenFromDetail: boolean('hidden_from_detail').notNull().default(false),
```

### Pattern 5: Hide/Unhide Server Action

**What:** A server action in `src/app/actions/wearEvents.ts` that re-checks ownership via `watches.user_id` then flips `hidden_from_detail`. The ownership re-check is against the watch's `user_id`, not the wear event's `user_id` (they are the same person here — the watch owner — but the explicit check prevents edge cases and mirrors the Phase 60/61 ownership-check pattern in `addWatchPhoto`).

```typescript
// [ASSUMED pattern — mirrors watchPhotos.ts ownership-check shape]
export async function hideWearPicAction(data: { wearEventId: string; watchId: string })
// 1. getCurrentUser()
// 2. Verify watches.user_id = user.id WHERE watches.id = watchId
// 3. UPDATE wear_events SET hidden_from_detail = true
//    WHERE id = wearEventId AND watch_id = watchId
// 4. revalidatePath('/w/[ref]') — page re-fetches union
```

### Anti-Patterns to Avoid

- **Touching visibility on hide:** Do NOT set `visibility = 'private'` for hide. D-11 explicitly requires a separate state. The hide must not affect the Wears tab or Home rail.
- **Filtering hidden pics client-side only:** The union query is the real gate (D-12). Never filter hidden pics solely in the client component — non-owners must never receive hidden entries in the payload.
- **Signing in the DAL:** DAL must remain admin-client-free (Phase 61 established pattern). Sign in the page RSC only.
- **Caching the comment thread per slide:** The bottom-sheet must use WearCommentHost (already uncached) — do NOT add 'use cache' to any component in the wear-pic comment path.
- **Using the cookie client for signing:** Any `createSupabaseServerClient()` call in a route that also calls `getLikesForTargetCached` ('use cache') would corrupt the PPR prerender boundary. Admin client only (D-19).
- **Adding wear-pic count to MAX_PHOTOS_PER_WATCH cap check:** The cap in `addWatchPhoto` counts `watch_photos` rows only. Do NOT modify it (D-04/Phase 60 D-14).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bottom-sheet comment UI | Custom drawer/portal | WearCommentHost variant='bottom-sheet' | Already ships correct CSS chain (bg-background, z-50, max-h-[60vh], safe-area-inset-bottom padding) per Phase 57.1 UAT |
| Optimistic like toggle | Custom fetch + state | LikeButton + toggleLikeAction | Already supports 'wear' targets; handles idempotency, rollback, notification logging, cache-tag invalidation |
| Wear-pic URL signing helper | New signing module | Inline admin client calls (like page.tsx lines 161-169) | signCoverUrls.ts is for 'watch-photos' bucket; wear-photos bucket is different; inline signing keeps the page.tsx assembly readable |
| Wear visibility predicate | New visibility logic | eq(wearEvents.visibility, 'public') | getWearRailForViewer lines 378-388 is the reference; D-18 says reuse, not reinvent |
| Comment count fetch per slide | Separate DAL | getCommentsForTarget count | DAL already supports wear targets; can count results.length server-side |

---

## Critical File-by-File Findings

### 1. DAL Union Slot — getWatchByIdForViewer (src/data/watches.ts:228-285)

The function currently returns `{ watch: Watch, isOwner: boolean, ownerUserId: string }`. The `watch.imageUrl` holds the cover raw path (or catalog URL) but the function does NOT return a photo array — photos are fetched separately by the page via `getWatchPhotosForWatch`. The wear-pic union follows the same split: a new `getPublicWearPicsForWatch(watchId)` function, called by the page RSC alongside `getWatchPhotosForWatch`, and merged into the slide array in the page before being passed to `WatchDetail`/`WatchPhotoSection`.

**No modification to `getWatchByIdForViewer` is needed.** The function is already 57 lines and the photo assembly is the page's responsibility.

### 2. getWearRailForViewer (src/data/wearEvents.ts:324-421) — MUST STAY UNCHANGED

The rail function's public/follows predicate (lines 372-389):
```typescript
or(
  eq(wearEvents.userId, viewerId),              // G-5 self bypass
  and(
    eq(profileSettings.profilePublic, true),    // G-4 outer gate
    or(
      eq(wearEvents.visibility, 'public'),
      and(
        eq(wearEvents.visibility, 'followers'),
        sql`${follows.id} IS NOT NULL`,          // G-3 viewer follows actor
      ),
    ),
  ),
)
```
The detail union reuses ONLY the `visibility='public'` branch — no follows check, no 48h gate. The rail's full predicate stays in the rail function exclusively. The detail union's WHERE clause is simpler:
```typescript
and(
  eq(wearEvents.watchId, watchId),
  eq(wearEvents.visibility, 'public'),
  eq(wearEvents.hiddenFromDetail, false),
)
```
This is intentionally NOT the same as the rail predicate — the rail gates on time AND follows; the detail gates on visibility AND hide only. Both are correct for their context.

### 3. hide_from_detail State (Schema — src/db/schema.ts:294-311)

Current `wearEvents` table columns: id, userId, watchId, wornDate, note, photoUrl, visibility, createdAt. No hide column exists anywhere (verified grep). Addition of `hiddenFromDetail` boolean is the sole schema change this phase. The column on `wear_events` (not a separate table) satisfies all D-11 constraints.

### 4. SignedPhoto Type (src/components/watch/WatchPhotoSection.tsx:61-65)

Current shape:
```typescript
export interface SignedPhoto {
  id: string
  signedUrl: string | null
  sortOrder: number
}
```

Phase 62 adds a parallel `SignedWearPic` interface (not a union with SignedPhoto — keep types distinct for type-narrowing in the component). `WatchPhotoSectionProps` gains `wearPics: SignedWearPic[]`. The component merges them at render time: `[...ownerSlides, ...wearSlides]`.

### 5. Admin-Client Signing Pattern (src/app/w/[ref]/page.tsx:161-169)

Current pattern for watch-photos:
```typescript
const supabase = createSupabaseAdminClient()
signedPhotos = await Promise.all(
  rawPhotos.map(async (p) => {
    const { data } = await supabase.storage
      .from('watch-photos')
      .createSignedUrl(p.storagePath, 60 * 60)
    return { id: p.id, signedUrl: data?.signedUrl ?? null, sortOrder: p.sortOrder }
  }),
)
```
The wear-pic signing is identical except: bucket is `'wear-photos'`, field is `p.photoUrl` (not `p.storagePath`), and the fail-safe-to-placeholder wraps each signing call in a try/catch returning `signedUrl: null` on failure (deferred from Phase 61). Both branches of `UnifiedWatchContent` (Branch 1 lines 158-169, D-06 branch lines 367-379) need the wear-pic signing added.

### 6. Social Layer Confirmation — All wear Targets Already Wired

- `getLikesForTarget` / `getLikesForTargetCached`: supports `{type:'wear', id}` — lines 43-51 of reactions.ts.
- `createLike` / `deleteLike` / `toggleLikeAction`: wear path dispatches to `wearLikes` table — confirmed in reactions.ts and actions/reactions.ts.
- `LikeButton`: accepts `target: LikeTarget` — already used on `/wear/[id]` page.
- `canViewerCommentOnTarget`: wear targets always return true (line 66: `if (target.type === 'wear') return true`).
- `getCommentsForTarget`: wear path queries `WHERE comments.wearEventId = target.id` — line 155-158.
- `WearCommentHost`: ships `variant='bottom-sheet'` with correct CSS chain. Already uses `CommentList` with wear target. The only missing piece is wiring it into `WatchPhotoSection` — a new `WearCommentSheet` wrapper (or direct use of `WearCommentHost`) that takes `wearEventId + open + onOpenChange`.

### 7. Wears Tab Photo Repoint (src/app/u/[username]/[tab]/page.tsx:423-456)

Current shape at line 431-441:
```typescript
const watchMap = Object.fromEntries(
  watches.map((w) => [
    w.id,
    {
      id: w.id,
      brand: w.brand,
      model: w.model,
      imageUrl: w.imageUrl ?? null,  // ← catalog/cover image, signed via signCoverUrls
    },
  ]),
)
return (
  <WornTabContent
    events={events.map((e) => ({
      id: e.id,
      watchId: e.watchId,
      wornDate: e.wornDate,
      note: e.note ?? null,
      // photoUrl is NOT passed today — it is stripped here
    }))}
```

The `getWearEventsForViewer` result already includes `photoUrl` (lines 199-210 — it's selected from the DB). The page strips it when mapping to `WearEventLite`. Fix: add `photoUrl: e.photoUrl ?? null` to the map and sign raw paths before passing.

`WornTimeline.tsx` (WatchSummary interface line 5-10):
```typescript
interface WatchSummary {
  id: string
  brand: string
  model: string
  imageUrl: string | null
}
interface WearEventLite {
  id: string
  watchId: string
  wornDate: string
  note: string | null
  // photoUrl missing — add here
}
```

Both `WornTimeline` and `WornCalendar` use `watch.imageUrl` via `getSafeImageUrl(watch.imageUrl)`. The fix is to prefer `getSafeImageUrl(event.photoUrl)` with `getSafeImageUrl(watch.imageUrl)` as fallback. The `getSafeImageUrl` helper already handles https-only filtering.

Signing wear photoUrls in the Wears tab: the raw `photoUrl` from `getWearEventsForViewer` is a storage path `{userId}/wearEventId.jpg`. The page signs it with the same admin client pattern as `signCoverUrls`. One approach: inline the signing loop (similar to the watch-photos signing in `/w/[ref]`). Another: extend `signCoverUrls` to accept a second bucket argument. Given the bucket difference (`wear-photos` vs `watch-photos`) the cleanest approach is a new `signWearPhotoUrls` parallel helper or inline.

### 8. CommentThread at /w/[ref] — DO NOT DISTURB

Current `/w/[ref]/page.tsx`:
- Line 45: `export const unstable_instant = false` — MUST NOT be removed or set to `true`.
- Line 91: `await connection()` — MUST remain above the Suspense wrapper.
- Lines 286-297: `<Suspense fallback={<CommentThreadSkeleton />}><CommentThread ... /></Suspense>` — the watch-level CommentThread is a separate uncached RSC sibling. Phase 62 does NOT modify this block.

The wear-pic comment thread is a SEPARATE surface (a bottom sheet, opened client-side from WatchPhotoSection). It uses `WearCommentHost` variant='bottom-sheet', which wraps `CommentList` (a 'use client' component). The initial comments for the sheet are fetched server-side in the page.tsx RSC (or lazily in a separate RSC wrapper) and passed as props — matching the existing WearCard/WearPhotoStreamed pattern.

**Option A (simpler, preferred):** Pre-fetch comments for ALL surfaced wear pics in the page RSC (parallel, small N with <10 wear pics cap). Pass `initialComments[]` down per slide. No per-tap network round-trip.

**Option B (lazy):** Fetch comments for the active wear-pic slide on-demand when the sheet opens (via a separate Server Action or a new RSC route segment). More complex; only useful if wear-pic comment count is high.

Given the <10 wear-pic cap and <500 watches/user scale, Option A is correct.

---

## Common Pitfalls

### Pitfall 1: React #418 on the "Worn · [date]" Badge
**What goes wrong:** `wornDate` is stored as `'YYYY-MM-DD'` text. Formatting with `new Date(wornDate).toLocaleDateString()` (no timeZone) produces different strings on the server (UTC) vs browser (local timezone) → hydration text mismatch.
**Why it happens:** D-07/MEMORY `project_react_418_date_tz_hydration` — same class of bug as Phase 61 WornTimeline fix.
**How to avoid:** Pin `timeZone:'UTC'` + `'en-US'` locale on the formatter: `new Date(wornDate + 'T00:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })`.
**Warning signs:** Hydration error in browser console mentioning text content mismatch on the badge.

### Pitfall 2: Cookie-Client Signing Corrupts PPR Prerender
**What goes wrong:** Using `createSupabaseServerClient()` (which reads `cookies()`) for signing in the same RSC that calls `getLikesForTargetCached` ('use cache') → React #419 on soft navigation.
**Why it happens:** MEMORY `project_ppr_dynamic_before_use_cache` — calling `cookies()` in a 'use cache' RSC context aborts the prerender.
**How to avoid:** Admin client only (`createSupabaseAdminClient()`) for all storage URL signing in this phase. The `await connection()` opt-out on the page already forces request-time render; signing with admin client makes the route independent of cookies for signing.
**Warning signs:** Works on hard refresh, breaks on soft navigation (back/forward).

### Pitfall 3: getWearRailForViewer Accidentally Modified
**What goes wrong:** The rail function is modified to support the detail union, breaking the 48h ephemeral guarantee (WPIC-04).
**Why it happens:** The detail union needs similar filtering logic and a developer may try to DRY it by modifying the rail function.
**How to avoid:** The new `getPublicWearPicsForWatch` is a SEPARATE function. It does NOT call or modify `getWearRailForViewer`. The rail function must have zero code changes in this phase.
**Warning signs:** Home wear rail shows wears older than 48h.

### Pitfall 4: hide_from_detail Drift Between Local and Prod Schema
**What goes wrong:** `drizzle-kit push` applied locally but `supabase db push --linked` forgotten for prod → prod queries fail on unknown column.
**Why it happens:** MEMORY `project_drizzle_supabase_db_mismatch` — dual-migration discipline required.
**How to avoid:** Always run both. Migration naming: `supabase/migrations/20260527000000_phase62_wear_hidden_from_detail.sql`.
**Warning signs:** Prod build error or runtime Postgres column-not-found exception.

### Pitfall 5: Wear-Pic Filtering in Client Only (IDOR-adjacent)
**What goes wrong:** Hidden wear pics are included in the page payload but filtered client-side — a non-owner could read the payload and see hidden pics.
**Why it happens:** Confusion between "display filtering" and "data gate."
**How to avoid:** The union query (server-side, service-role Drizzle client) filters `WHERE NOT hidden_from_detail` before any payload is sent. The client never receives hidden wear-pic data.

### Pitfall 6: Wears Tab photoUrl is Unsigned
**What goes wrong:** The raw storage path `{userId}/wearEventId.jpg` is passed to WornTimeline without signing → `getSafeImageUrl` returns null → WatchIcon placeholder shown instead of the wear photo.
**Why it happens:** signCoverUrls handles `watch-photos` bucket, not `wear-photos`.
**How to avoid:** Add a parallel signing step for wear-photo paths in the Wears tab page.tsx RSC before passing events to WornTabContent.

### Pitfall 7: Commenting Count Mismatch Between Badge and Sheet
**What goes wrong:** The comment count badge on the active slide shows a stale count after the user posts a comment in the sheet.
**Why it happens:** WearCommentHost/CommentList use optimistic updates, but the slide badge is hydrated from server-side `initialComments.length`.
**How to avoid:** Use the `onCountChange` callback already on `WearCommentHost` to propagate delta to the parent `WatchPhotoSection` client state. The pattern is already established in WearCard.tsx.

---

## Code Examples

### Exact: getWearRailForViewer Public/Follows Predicate (DO NOT TOUCH)

```typescript
// [VERIFIED: codebase - src/data/wearEvents.ts:372-389]
// The visibility predicate in getWearRailForViewer — reference only,
// NOT modified by this phase:
or(
  eq(wearEvents.userId, viewerId),              // G-5 self bypass
  and(
    eq(profileSettings.profilePublic, true),
    or(
      eq(wearEvents.visibility, 'public'),
      and(
        eq(wearEvents.visibility, 'followers'),
        sql`${follows.id} IS NOT NULL`,
      ),
    ),
  ),
)
// Phase 62 detail-union predicate (SEPARATE function, does NOT use this):
// WHERE watch_id = ? AND visibility = 'public' AND NOT hidden_from_detail
```

### Exact: Existing Admin-Client Signing Pattern to Mirror

```typescript
// [VERIFIED: codebase - src/app/w/[ref]/page.tsx:161-169]
const supabase = createSupabaseAdminClient()
signedPhotos = await Promise.all(
  rawPhotos.map(async (p) => {
    const { data } = await supabase.storage
      .from('watch-photos')
      .createSignedUrl(p.storagePath, 60 * 60)
    return { id: p.id, signedUrl: data?.signedUrl ?? null, sortOrder: p.sortOrder }
  }),
)
// Phase 62 wear-pic signing (same supabase instance, different bucket + field):
// .from('wear-photos').createSignedUrl(p.photoUrl, 60 * 60)
// with try/catch returning signedUrl: null on failure (fail-safe-to-placeholder)
```

### Exact: WearCommentHost bottom-sheet Props (Reuse As-Is)

```typescript
// [VERIFIED: codebase - src/components/wear/WearCommentHost.tsx]
<WearCommentHost
  variant="bottom-sheet"
  wearEventId={activeWearPic.wearEventId}
  open={commentSheetOpen}
  onOpenChange={setCommentSheetOpen}
  initialComments={activeWearPic.initialComments}
  canComment={true}           // wear targets always open (canViewerCommentOnTarget)
  ownerFollowsViewer={false}  // not relevant for wear gate
  viewerIsFollowing={false}   // not relevant for wear gate
  ownerUserId={ownerUserId}
  ownerUsername={ownerUsername}
  viewerId={viewerId}
  viewerAuthor={viewerAuthor}
  onCountChange={(delta) => updateSlideCommentCount(activeWearPic.wearEventId, delta)}
/>
```

### Exact: Edit-Mode Reset Pattern (Preserve)

```typescript
// [VERIFIED: codebase - src/components/watch/WatchPhotoSection.tsx:599-602]
// onPointerDown — NOT onClick — for stale-instance reset:
onPointerDown={() => setEditMode((prev) => !prev)}
// Phase 62: the hide toggle ALSO uses onPointerDown for the same reason
```

### Exact: WornTimeline Image Rendering (Current, to Change)

```typescript
// [VERIFIED: codebase - src/components/profile/WornTimeline.tsx:65]
// Current:
const safe = watch ? getSafeImageUrl(watch.imageUrl) : null
// Phase 62 change:
const wearPhotoSafe = e.photoUrl ? getSafeImageUrl(e.photoUrl) : null
const safe = wearPhotoSafe ?? (watch ? getSafeImageUrl(watch.imageUrl) : null)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| wear_events.photo_url unsigned in Wears tab | Sign with admin client at page layer | Phase 61 (IDOR fix) | Page.tsx must sign; DAL stays admin-client-free |
| Single-user watch detail route | Unified /w/[ref] with per-user + catalog resolution | Phase 59 | Both branches of UnifiedWatchContent need wear-pic union |
| WornTimeline uses watch cover image for wear events | Prefer actual wear photo | Phase 62 (this phase) | WearEventLite gains photoUrl field |
| embla v7 `draggable` option | embla v8 `watchDrag` option | Phase 61 | `emblaApi.reInit({ watchDrag: !editMode })` — already correct in WatchPhotoSection |
| Cookie client for storage signing | Admin client (createSupabaseAdminClient) | Phase 61 | Prevents PPR cache corruption; established as project pattern |

---

## Runtime State Inventory

> This phase adds a schema column and a new DAL read path. It is not a rename/refactor phase.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Existing wear_events rows — all will have hidden_from_detail = NULL until migration runs, but DEFAULT false on column handles new rows | Migration adds column with DEFAULT false; backfill of existing rows not needed (DEFAULT covers NULL gap if column is added with NOT NULL DEFAULT false via ALTER TABLE ADD COLUMN) |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | ANTHROPIC_API_KEY (unchanged), Supabase service role key (unchanged — admin client already used) | None |
| Build artifacts | None | None |

---

## Open Questions

1. **Pre-fetch all wear-pic comment threads vs lazy fetch**
   - What we know: WearCommentHost needs `initialComments` as props (it's a client component; cannot await).
   - What's unclear: Whether fetching N comment lists in parallel in the page RSC (Option A) adds meaningful latency vs. a lazy-fetch server action on sheet open.
   - Recommendation: Option A (pre-fetch all). With <10 surfaced wear pics and the service-role client already making multiple queries, the parallel overhead is negligible. Avoids a per-tap server round-trip and matches the existing WearPhotoStreamed pattern.

2. **signWearPhotoUrls — inline or new helper?**
   - What we know: `signCoverUrls` handles the `watch-photos` bucket only. Wear photos use the `wear-photos` bucket.
   - What's unclear: Whether to create a symmetric `signWearPhotoUrls` helper or inline the loop.
   - Recommendation: Inline in page.tsx first (consistent with how Phase 61 added photo signing inline). Extract to a helper only if used in more than one RSC.

3. **Wears tab: owner-only signing or all viewers?**
   - What we know: `getWearEventsForViewer` returns `photoUrl` for all permitted viewers (public/followers wears). The Wears tab signs the watch COVER for all viewers via `signCoverUrls`.
   - Recommendation: Sign wear photoUrls for all viewers who can see the wear event (consistent with the cover signing approach). The admin client signing is safe regardless of viewer identity.

---

## Environment Availability

> This phase is code/config/DB changes only. No new external tools.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (local) | DB migrations | ✓ | local dev running | — |
| Supabase (prod linked) | supabase db push --linked | ✓ | linked per MEMORY | — |
| wear-photos bucket (prod) | wear-pic URL signing | ✓ | Created in Phase 15 | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 (jsdom default) |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npx vitest run tests/` |
| Full suite command | `npx vitest run && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WPIC-01 | Public wear pic appears in carousel after union | Unit (DAL) | `npx vitest run tests/unit/getPublicWearPicsForWatch.test.ts -x` | ❌ Wave 0 |
| WPIC-01 | Non-public wear pic NOT in result | Unit (DAL) | same | ❌ Wave 0 |
| WPIC-02 | Owner hide sets hidden_from_detail=true; pic excluded from subsequent union query | Unit (DAL + action) | `npx vitest run tests/unit/hideWearPic.test.ts -x` | ❌ Wave 0 |
| WPIC-02 | Un-hide restores the wear pic to the union | Unit (DAL) | same | ❌ Wave 0 |
| WPIC-03 | WornTimeline prefers event.photoUrl over watch cover | Unit (component) | `npx vitest run tests/unit/WornTimeline.test.tsx -x` | ❌ Wave 0 |
| WPIC-04 | getWearRailForViewer unchanged (no hidden_from_detail or 48h change) | Unit (DAL) | `npx vitest run tests/unit/wearRail.test.ts -x` | ❌ Wave 0 |
| WPIC-05 | followers-only wear never returned by union | Unit (DAL) | same as WPIC-01 | ❌ Wave 0 |
| WPIC-06 | LikeButton + WearCommentHost render when slide is a wear pic | Integration/visual | prod UAT (mobile behavior) | human_needed |
| Build gate | `npm run build` exits 0 | Build | `npm run build` | ✅ (existing) |
| Static link guard | no legacy watch/catalog routes | Static | `npm run build` (prebuild vitest) | ✅ (existing) |

**Mobile/prod-only (per MEMORY feedback_mobile_ui_verify_on_prod):**
- Swipe between owner slides and wear-pic slides
- Eye/hide toggle in Edit mode on mobile
- Bottom-sheet comment thread opens/closes with swipe dismiss
- "Worn · [date]" badge renders correctly on device (no hydration flash)

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/ -x`
- **Per wave merge:** `npx vitest run && npm run build`
- **Phase gate:** `npm run build` exits 0 + prod human UAT for touch behavior

### Wave 0 Gaps
- [ ] `tests/unit/getPublicWearPicsForWatch.test.ts` — covers WPIC-01, WPIC-05 (public filter + hidden_from_detail filter)
- [ ] `tests/unit/hideWearPic.test.ts` — covers WPIC-02 (hide/unhide action + DAL re-query)
- [ ] `tests/unit/WornTimeline.test.tsx` — covers WPIC-03 (photoUrl preference over imageUrl)
- [ ] `tests/unit/wearRail.test.ts` — covers WPIC-04 (getWearRailForViewer unchanged — existing test if present; otherwise new assertion that function signature + WHERE clause is unchanged)
- [ ] `tests/shims/server-only.ts` — already exists (vitest alias)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | getCurrentUser() in hide/unhide server action |
| V3 Session Management | no | No session change |
| V4 Access Control | yes | Ownership re-check (watches.user_id) before hide mutation; DAL union filters hidden for ALL viewers |
| V5 Input Validation | yes | Zod schema on server action (wearEventId UUID, watchId UUID) |
| V6 Cryptography | no (signing is auth, not crypto) | Admin-client signed URL (TTL 60min) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR on hide action (viewer hides another user's wear pic) | Tampering | Server action re-checks `watches.user_id = currentUser.id`; WHERE clause scopes to watchId + wearEventId together |
| Visibility bypass (non-public wear leaks through union) | Information Disclosure | Service-role Drizzle client + `WHERE visibility='public'` at query time; RLS is defense-in-depth only (Phase 53 lesson: RLS-subquery-caller runs under caller's RLS, not service role) |
| Hidden wear pic served to non-owner | Information Disclosure | `WHERE NOT hidden_from_detail` in union query; client never receives hidden rows |
| Stale signed URL served from CDN/cache | Information Disclosure | Admin client signing + 60-min TTL; `await connection()` ensures request-time render (no ISR cache of signed URLs) |
| wear-photos storage path traversal | Elevation of Privilege | Paths are `{userId}/...` scoped (Phase 61 CR-02 IDOR fix); admin client signing validates the path against the bucket's folder policy |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | wear-photos bucket exists in prod (created in Phase 15) | Pattern 3 / Environment | Phase 62 signing calls would fail; bucket would need manual creation |
| A2 | wear_events.photo_url paths are already `{userId}/...` scoped in prod (Phase 61 CR-02 fix) | Pattern 3 | Unsigned paths without the prefix would sign correctly but RLS folder policy would reject them; signing would return null → placeholder (safe, but visible) |
| A3 | Pre-fetching comments for all N surfaced wear pics in parallel is within acceptable latency | Open Question 1 | If N=10 and each comment query is 50ms, that's ~50ms parallel overhead. At <10 cap this is acceptable |
| A4 | `unstable_instant = false` on /w/[ref]/page.tsx is sufficient to prevent PPR static-shell issues for the wear-pic additions | Cache Components section | If Phase 62 additions trigger new PPR aborts, the connection() opt-out already in place should cover them |

**All other claims in this research were verified directly from the codebase.**

---

## Sources

### Primary (HIGH confidence — verified from codebase)
- `src/data/watches.ts` — getWatchByIdForViewer shape (lines 228-285), getWatchPhotosForWatch signature (lines 709-722), photo assembly pattern
- `src/data/wearEvents.ts` — getWearRailForViewer public/follows predicate (lines 324-421), getWearEventsForViewer shape + photoUrl field (lines 199-210)
- `src/data/reactions.ts` — LikeTarget type, getLikesForTargetCached, toggleLikeAction wear support
- `src/data/comments.ts` — CommentTarget type, canViewerCommentOnTarget wear gate (line 66), getCommentsForTarget
- `src/db/schema.ts` — wearEvents table (lines 294-311): no hidden_from_detail column exists; wearLikes, comments, watchPhotos confirmed
- `src/lib/types.ts` — Watch, SignedPhoto (via WatchPhotoSection), WatchPhoto interfaces
- `src/components/watch/WatchPhotoSection.tsx` — SignedPhoto interface (lines 61-65), WatchPhotoSectionProps (lines 67-75), editMode/onPointerDown pattern (lines 599-602)
- `src/components/wear/WearCommentHost.tsx` — bottom-sheet variant props, CommentList reuse, CSS chain
- `src/components/shared/LikeButton.tsx` — LikeTarget usage, optimistic pattern
- `src/components/profile/WornTimeline.tsx` — WatchSummary/WearEventLite interfaces, imageUrl rendering (line 65)
- `src/app/w/[ref]/page.tsx` — unstable_instant=false (line 45), await connection() (line 91), admin-client signing pattern (lines 161-169), CommentThread as uncached RSC sibling (lines 286-297)
- `src/app/u/[username]/[tab]/page.tsx` — Wears tab event map (lines 423-456), photoUrl stripping confirmed
- `src/lib/storage/signCoverUrls.ts` — admin-client signing approach, getSafeImageUrl integration, watch-photos bucket

### Secondary (MEDIUM confidence)
- `src/app/actions/reactions.ts` — toggleLikeAction wear path confirmed (lines 65-79)
- `src/components/comment/CommentThread.tsx` — no 'use cache', uncached async RSC, wear target support
- `supabase/migrations/20260525000000_phase60_watch_photos.sql` — RLS + bucket creation precedent for migration shape
- `vitest.config.ts` — test framework configuration confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries confirmed in codebase
- Architecture: HIGH — verified from actual function signatures and component props
- Pitfalls: HIGH — all major pitfalls traced to documented incidents in project MEMORY
- Schema shape: HIGH — schema.ts verified, absence of hidden_from_detail confirmed by grep
- Social layer: HIGH — all DAL functions and components read and confirmed to support wear targets

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (stable domain; Next.js 16 + Drizzle versions pinned in package.json)
