---
dimension: stack
generated: 2026-04-21
milestone: v3.0 Production Nav & Daily Wear Loop
---
# Stack Research — v3.0 Production Nav & Daily Wear Loop

**Domain:** Navigation overhaul, notifications, people search, WYWT photo post flow
**Researched:** 2026-04-21
**Confidence:** HIGH (browser APIs, Supabase Storage), MEDIUM (sonner version, heic2any behavior)

> This document covers ONLY what is new or changed for v3.0. The existing stack (Next.js 16, React 19, Supabase Auth + Postgres, Drizzle ORM, Tailwind 4, Vitest, custom ThemeProvider) is validated in production and not re-researched here.

---

## Summary

v3.0 requires **two new npm packages** and no architectural changes:

1. **`sonner@^2.0.7`** — toast infrastructure (13.9 kB gzip; acceptable)
2. **`heic2any@^0.0.4`** — client-side HEIC → JPEG conversion (600 kB WASM; must lazy-load via Web Worker)

Everything else — Supabase Storage, getUserMedia, canvas EXIF stripping, pg_trgm, notifications schema, bottom nav — is implemented with APIs and patterns already in the stack.

```bash
npm install sonner heic2any
```

---

## Recommended Stack Additions

### sonner

| | |
|---|---|
| **Version** | `^2.0.7` (latest stable — verified via GitHub, released August 2, 2025) |
| **Purpose** | Toast notifications for wear log success/error, upload feedback |
| **Bundle** | ~13.9 kB gzipped — acceptable for a persistent UI element |
| **Integration point** | `src/components/ui/sonner.tsx` (thin wrapper); `src/app/layout.tsx` (mount) |

**Confidence:** MEDIUM — version and existence verified via GitHub. Bundle size from WebSearch/devpick. No Context7 entry found.

#### Toaster Mount Pattern (Next.js 16 App Router + cacheComponents)

`<Toaster />` can be placed in a Server Component layout. Mount inside `<body>` after `<ThemeProvider>`, outside all `<Suspense>` boundaries so toasts render regardless of streaming state:

```tsx
// src/app/layout.tsx  (add Toaster import)
import { Toaster } from '@/components/ui/sonner'

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning ...>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col bg-background">
        <ThemeProvider>
          <Suspense fallback={<HeaderSkeleton />}>
            <Header />
          </Suspense>
          <Suspense fallback={null}>
            <main className="flex-1">{children}</main>
          </Suspense>
          <Toaster />   {/* outside Suspense — always rendered */}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

#### Dark Mode Integration — CRITICAL: Custom ThemeProvider

The project does **not** use `next-themes`. It has a custom `ThemeProvider` in `src/components/theme-provider.tsx` that exposes `useTheme()` returning `{ theme, resolvedTheme, setTheme }` where `resolvedTheme` is always `'light' | 'dark'` (never `'system'`).

The shadcn-documented pattern uses `useTheme` from `next-themes` and passes `resolvedTheme` to `<Toaster theme={...}>`. The same pattern works with our custom provider — write a thin client wrapper:

```tsx
// src/components/ui/sonner.tsx  (new file)
'use client'

import { Toaster as SonnerToaster } from 'sonner'
import type { ToasterProps } from 'sonner'
import { useTheme } from '@/components/theme-provider'

export function Toaster() {
  const { resolvedTheme } = useTheme()
  return (
    <SonnerToaster
      theme={resolvedTheme as ToasterProps['theme']}
      richColors
      position="bottom-right"
    />
  )
}
```

Import `Toaster` from `@/components/ui/sonner` (not directly from `sonner`) everywhere in the app.

Do NOT use the shadcn CLI to scaffold sonner (`npx shadcn add sonner`) — it generates a `next-themes`-dependent wrapper that conflicts with the custom ThemeProvider.

#### Server Action → Toast Pattern

Server Actions run server-side and cannot call client `toast()` directly. The canonical pattern: the action returns a result; the caller checks it and fires the toast.

```tsx
// In any 'use client' component that wraps a Server Action
import { toast } from 'sonner'

// With useTransition (existing WatchPickerDialog pattern):
startTransition(async () => {
  const result = await markAsWorn(watchId)
  if (!result.success) {
    toast.error("Couldn't log that wear.")
    return
  }
  toast.success('Wear logged.')
  onOpenChange(false)
})
```

This matches the existing `WatchPickerDialog.tsx` mutation pattern — replace the `setError` state call with `toast.error(...)` and add `toast.success(...)` on the happy path.

---

### heic2any

| | |
|---|---|
| **Version** | `^0.0.4` (latest; last published April 2023 — stable but unmaintained) |
| **Purpose** | Client-side HEIC → JPEG conversion for iOS photo uploads |
| **Bundle** | ~600 kB (libheif compiled to WASM — cannot be tree-shaken) |
| **Integration point** | `src/lib/heic-worker.ts` (Web Worker only — never imported at module level) |

**Confidence:** MEDIUM — version and WASM size verified via npm and DEV Community article. No viable maintained alternative exists as of April 2026 for browser-based HEIC decoding.

#### Bundle Size Warning — Must Lazy-Load via Web Worker

Standard dynamic imports (`await import('heic2any')`) are insufficient in Next.js. Webpack/Turbopack perform static analysis at build time: seeing the import string causes the module to be included in the route's chunk group regardless of execution path. `next/dynamic` has the same problem — it wraps React components, not arbitrary libraries.

The only reliable solution is a dedicated Web Worker. Workers are emitted as separate entry points; the bundler never preloads or merges them into the route bundle. The 600 kB WASM downloads only when `convertHeicToJpeg()` is called.

```typescript
// src/lib/heic-worker.ts
self.onmessage = async (e: MessageEvent) => {
  const { buffer, toType, quality } = e.data
  const heic2any = (await import('heic2any')).default
  const blob = new Blob([buffer])
  const result = await heic2any({
    blob,
    toType: toType ?? 'image/jpeg',
    quality: quality ?? 0.85,
  })
  const output = Array.isArray(result) ? result[0] : result
  const outBuffer = await output.arrayBuffer()
  self.postMessage({ buffer: outBuffer, type: output.type }, [outBuffer])
}
```

```typescript
// src/lib/convertHeic.ts  (called from upload handler)
export async function convertHeicToJpeg(file: File): Promise<Blob> {
  const worker = new Worker(
    new URL('./heic-worker.ts', import.meta.url)
    // ^^^ The new URL() form tells webpack to emit as a separate entry point
  )
  const buffer = await file.arrayBuffer()
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      resolve(new Blob([e.data.buffer], { type: e.data.type }))
      worker.terminate()
    }
    worker.onerror = (err) => {
      reject(err)
      worker.terminate()
    }
    worker.postMessage({ buffer }, [buffer])
  })
}
```

Call `convertHeicToJpeg` only after detecting a HEIC file:

```typescript
async function handleFileChange(file: File) {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  const processedBlob = isHeic ? await convertHeicToJpeg(file) : file
  // → pass processedBlob to EXIF strip → canvas → upload
}
```

#### Browser Compatibility

heic2any uses libheif WASM and requires DOM + `window`. All target browsers support this:

| Browser | WASM + Worker Support | Notes |
|---------|----------------------|-------|
| Chrome 57+ (Android/desktop) | Full | |
| Firefox 55+ | Full | |
| Safari 14+ (desktop) | Full | |
| iOS Safari 14+ | Full | iOS 14 added WASM support in Safari |
| All non-Safari iOS browsers | Full (via WebKit) | Apple forces WebKit engine on iOS |

---

## Canvas API + EXIF Stripping (No New Library)

Canvas re-encode via `toBlob()` strips all EXIF metadata automatically — the canvas holds only raw pixel data and cannot encode EXIF into JPEG output.

```typescript
// src/lib/processWearPhoto.ts
export async function stripExifAndResize(
  blob: Blob,
  maxDimension = 1920,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))),
      'image/jpeg',
      0.85,
    ),
  )
}
```

`createImageBitmap` is preferred over `new Image()` + `onload` because it works in Worker contexts. It is supported in iOS Safari 15+ (HIGH confidence — MDN).

**Do not add `piexifjs`.** Canvas re-encode already strips everything. `piexifjs` is needed only for selective EXIF preservation, which is explicitly out of scope — all EXIF must be stripped for privacy regardless.

EXIF strip must always run on both code paths: camera capture and file upload.

---

## getUserMedia / MediaDevices (No Library)

Pure browser API. No npm package needed.

### Browser Compatibility Matrix

| Browser | Support | Critical Notes |
|---------|---------|---------------|
| Chrome (Android, desktop) | Full | HTTPS required |
| Firefox (Android, desktop) | Full | HTTPS required |
| Safari iOS 14.3+ | Supported with quirks | See below |
| Safari iOS < 14.3 | Not supported | WKWebView blocked getUserMedia before 14.3 |
| Chrome / Firefox / Edge on iOS | Inherit Safari quirks | Apple forces WebKit on iOS; all browsers have the same limitations |
| PWA standalone (iOS) | Partially buggy | WebKit bug 252465 — video stream may fail to display in standalone home screen mode |

**HTTPS already satisfied** — the app runs on Vercel at horlo.app.

### iOS Safari Quirks (HIGH confidence)

**1. User gesture required.** `getUserMedia()` must be called inside a user interaction event handler (click, touchend). Cannot be called on mount. The Wear CTA is a button, so this is already the correct entry point.

**2. `playsInline` attribute required.** The `<video>` element used for camera preview must have `playsInline={true}` (React prop) or `playsinline` (HTML attribute). Without it, Safari attempts full-screen playback, breaking the preview.

```tsx
<video ref={videoRef} autoPlay playsInline muted className="..." />
```

**3. `facingMode: 'environment'` unreliable.** Safari sometimes ignores this constraint even when `getSupportedConstraints()` reports it as supported. For reliable rear camera access, enumerate devices and select by `deviceId`:

```typescript
async function getRearCameraStream(): Promise<MediaStream> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const videoDevices = devices.filter((d) => d.kind === 'videoinput')
  // On iOS, the last videoinput is typically the rear camera
  const rearDevice = videoDevices[videoDevices.length - 1]
  return navigator.mediaDevices.getUserMedia({
    video: rearDevice
      ? { deviceId: { exact: rearDevice.deviceId } }
      : { facingMode: { ideal: 'environment' } },
    audio: false,
  })
}
```

**4. Feature detection before calling.** Always check `navigator.mediaDevices?.getUserMedia` before calling. If unavailable, fall back gracefully to `<input type="file" accept="image/*" capture="environment">`:

```typescript
const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
```

### Camera Capture Component

New file: `src/components/wear/CameraCapture.tsx`. Responsibilities:
- Stream setup via `getRearCameraStream()`
- `<video playsInline autoPlay muted>` preview
- Static dotted wrist-shot framing overlay — a positioned `<div>` with `border: 2px dashed` CSS, absolutely positioned over the video. No library. No AR. Explicitly out of scope per PROJECT.md.
- Capture trigger: `ctx.drawImage(videoEl, ...)` → canvas → `toBlob()` → EXIF strip → result callback
- `stream.getTracks().forEach(t => t.stop())` on unmount to release camera

---

## Supabase Storage (No New Library)

`@supabase/supabase-js` 2.103.0 already in package.json. The Storage API is part of the same client — no additional install needed.

### Bucket Setup

One private bucket: `wear-photos`. Path convention: `{userId}/{wearEventId}.jpg`.

**SQL (add to a Drizzle migration):**

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wear-photos',
  'wear-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
```

Or via JS SDK (run once from a setup script or Supabase Dashboard):

```typescript
await supabase.storage.createBucket('wear-photos', {
  public: false,
  fileSizeLimit: '5MB',
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
})
```

Deploy the bucket definition as part of the Supabase migrations: include the SQL `INSERT into storage.buckets` in a new Drizzle migration file and run via `supabase db push --linked --include-all` (per the project's documented prod migration workflow in `docs/deploy-db-setup.md`).

### RLS Policies

```sql
-- INSERT: users may upload only to their own folder
create policy "wear_photos_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'wear-photos'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);

-- SELECT: users may read only their own files
create policy "wear_photos_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'wear-photos'
  and (select auth.jwt()->>'sub') = owner_id
);

-- DELETE: users may delete only their own files
create policy "wear_photos_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'wear-photos'
  and (select auth.jwt()->>'sub') = owner_id
);
```

`storage.foldername(name))[1]` extracts the first path segment (the `userId` prefix). `owner_id` is auto-populated by Supabase Storage with the authenticated user's `sub` claim on INSERT.

**Note on follower-visibility photos:** The SELECT policy above restricts to owner-only reads. For "followers" and "public" visibility wears, the signed URL itself provides access — the policy allows the owner to generate a signed URL, and possession of that URL is the access credential. The visibility tier controls who receives the URL (enforced in the DAL), not the storage policy. This is the correct pattern.

### Upload Flow (Signed Upload URL Pattern)

Binary file data cannot be efficiently serialized through a Server Action boundary. The recommended pattern: Server Action generates a signed upload URL; client uploads directly to Supabase Storage.

```typescript
// src/app/actions/wearPhotos.ts
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

export async function getWearPhotoUploadUrl(wearEventId: string) {
  const user = await getCurrentUser()
  const supabase = createServerClient()
  const path = `${user.id}/${wearEventId}.jpg`
  const { data, error } = await supabase.storage
    .from('wear-photos')
    .createSignedUploadUrl(path)
  if (error) throw error
  return { path, signedUrl: data.signedUrl, token: data.token }
}
```

```typescript
// Client upload (in wear form component)
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const { error } = await supabase.storage
  .from('wear-photos')
  .uploadToSignedUrl(signedUrl, token, jpegBlob, {
    contentType: 'image/jpeg',
  })
```

### Read URLs (DAL Layer)

Store only the storage `path` in `wear_events.photo_url` (e.g. `"abc123/wear456.jpg"`). Never store a pre-generated signed URL in the DB — they expire.

At read time in the DAL, generate signed URLs for photos the viewer is authorized to see:

```typescript
// src/data/wearEvents.ts  (when assembling wear event rows)
if (wearEvent.photoUrl && viewerCanSeePhoto) {
  const { data } = await supabase.storage
    .from('wear-photos')
    .createSignedUrl(wearEvent.photoUrl, 3600) // 1 hour
  return { ...wearEvent, signedPhotoUrl: data?.signedUrl }
}
```

### next/image — Use `<img>` for Wear Photos

`next.config.ts` already has `images: { unoptimized: true }`, which makes `next/image` functionally equivalent to a plain `<img>` tag for external images. For wear photos specifically, use `<img>` directly:

- Signed URLs include a `?token=...` query parameter that changes on each generation, making Next.js image optimization cache-unfriendly even if it worked
- There is a confirmed Next.js 16 bug (issue #88873) where image optimization returns "url parameter is not allowed" for certain cloud storage domains; confirmed tracked by the Next.js team, no fix as of April 2026
- `unoptimized: true` already removes the only optimization benefit (`next/image` would provide)

**No `remotePatterns` changes needed.** `unoptimized: true` is already set.

---

## pg_trgm (Postgres Extension, No npm Package)

### What It Is

A pre-installed Postgres extension that provides GIN/GiST operator classes for `LIKE`/`ILIKE` acceleration via trigram decomposition. Required for the `/search` people-search feature to avoid sequential scans on `profiles`.

### Enabling in Supabase

pg_trgm is pre-installed on all Supabase instances including the free tier — no tier upgrade needed. Two ways to enable:

**Dashboard:** Database → Extensions → find `pg_trgm` → toggle on.

**SQL (preferred — include in a migration file):**

```sql
create extension if not exists pg_trgm with schema extensions;
```

The `with schema extensions` form is Supabase-idiomatic. Add to a new Drizzle migration file and deploy via `supabase db push --linked --include-all`.

### Index Template

```sql
-- GIN indexes for ILIKE acceleration on profiles search
create index if not exists profiles_username_trgm_idx
  on profiles
  using gin (username gin_trgm_ops);

create index if not exists profiles_bio_trgm_idx
  on profiles
  using gin (bio gin_trgm_ops);
```

GIN (not GiST) is correct here: GIN is faster for read-heavy, infrequently-updated columns. Profile usernames and bios are rarely updated.

**Important:** Standard B-tree indexes cannot accelerate leading-wildcard `ILIKE '%query%'` queries. pg_trgm GIN indexes can — this is the entire point.

### Drizzle Representation

Drizzle lacks a built-in `gin_trgm_ops` operator class helper. Define these indexes in a raw SQL migration file rather than `schema.ts`:

```
drizzle/migrations/0XXX_add_trgm_search.sql
```

Contents: the `CREATE EXTENSION` + both `CREATE INDEX` statements above.

### DAL Query Pattern

```typescript
// src/data/profiles.ts
import { ilike, or } from 'drizzle-orm'

export async function searchProfiles(query: string, limit = 20) {
  const term = `%${query}%`
  return db
    .select({
      id: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
    })
    .from(profiles)
    .where(or(ilike(profiles.username, term), ilike(profiles.bio, term)))
    .limit(limit)
}
```

With the GIN index in place, Postgres routes this through the trigram index even with leading wildcards (`%query%`).

---

## Notifications Table (Schema Work Only, No New Library)

No new npm packages. Pure Drizzle schema extension.

### Schema Addition for `src/db/schema.ts`

```typescript
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', {
      enum: ['follow', 'watch_overlap', 'price_drop', 'trending'],
    }).notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    watchId: uuid('watch_id').references(() => watches.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata'),   // { username, avatarUrl, watchBrand, watchModel, ... }
    readAt: timestamp('read_at', { withTimezone: true }),  // null = unread
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_id_idx').on(table.userId),
    index('notifications_user_unread_idx').on(table.userId, table.readAt),   // for unread count
    index('notifications_user_created_idx').on(table.userId, table.createdAt),
  ]
)
```

`readAt IS NULL` = unread. Unread count query:

```typescript
// src/data/notifications.ts
export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  return result[0]?.count ?? 0
}
```

### Supabase Realtime — Confirmed Out of Scope for v3.0

The v2.0 decision stands: "No Supabase Realtime — free tier limit of 200 concurrent WebSockets; server-rendered + `router.refresh()` is sufficient at MVP scale."

For the unread bell badge in the nav: `Header` is a Server Component that already fetches user data. Add `getUnreadCount(userId)` to the existing `Promise.all()` in `Header` — the badge renders server-side and updates on any navigation or `router.refresh()` call.

**Do NOT add:** a WebSocket library, Supabase Realtime subscription, `setInterval` polling, or any client-side real-time mechanism for unread counts in v3.0. The bell dot does not need to update live in a single-user personal app.

---

## Bottom Nav (Bespoke Component, No New Library)

Neither `@base-ui/react` 1.3.0 nor the shadcn registry includes a bottom navigation bar component. Feature requests exist in the shadcn issue tracker (#4398, #5975, #8847) but nothing has shipped as of April 2026 (MEDIUM confidence — verified via GitHub issues search).

### Recommendation: Bespoke, ~60 Lines

```
src/components/layout/BottomNav.tsx  (new file)
```

Implementation notes:

- `fixed bottom-0 inset-x-0 z-40` — above page content, below dialogs (`z-50`)
- iPhone notch clearance: `pb-[env(safe-area-inset-bottom)]` (CSS env variable — no library)
- Wear CTA center button: use negative `mt` or `translate-y-[-8px]` on the button container to achieve the elevated-above-bar effect; wrap in a `<div>` with `overflow-visible`
- Active state: `usePathname()` from `next/navigation` — compare against `/`, `/explore`, `/search`, `/watch/new`, `/u/[username]`
- Main content `<main>` in `layout.tsx` needs `pb-16 md:pb-0` (or `pb-20` if the elevated button bleeds further) to prevent content from being hidden behind the fixed bar
- Hide on desktop: `md:hidden` on the entire `<BottomNav>` — desktop uses the top header nav
- `MobileNav.tsx` (current hamburger sheet) is retired once `BottomNav` ships; delete the file and remove the import from `Header.tsx`

---

## wear_events Schema Extension

Extend the existing `wearEvents` table in `src/db/schema.ts` with two new columns. Note: `note` already exists.

```typescript
// New columns to add to wearEvents table definition
photoUrl: text('photo_url'),   // storage path: '{userId}/{wearEventId}.jpg'
visibility: text('visibility', {
  enum: ['private', 'followers', 'public'],
}).notNull().default('public'),
```

The `'followers'` tier is new across the entire codebase. It must be threaded through every wear-reading DAL function — callers that currently check `visibility === 'public'` need to additionally check `visibility === 'followers' AND viewerFollowsOwner`.

---

## What NOT to Add

| Thing | Why Not |
|-------|---------|
| `next-themes` | Project has a custom ThemeProvider; adding next-themes creates two competing theme systems. The custom provider already exposes `resolvedTheme` for Sonner integration. |
| `piexifjs` | Canvas re-encode already strips all EXIF. piexifjs is needed only for selective EXIF preservation — we want full strip for privacy. |
| `browser-image-compression` | Does not decode HEIC. Only compresses already-browser-readable formats. Not needed for v3.0. |
| `react-dropzone` | Single-file upload. Native `<input type="file">` is sufficient and zero-bundle. |
| `@tanstack/react-query` | No new client-side server-state cache needed. Server Components + `router.refresh()` covers all use cases. |
| Supabase Realtime / any WebSocket lib | Out of scope. Server-render + `router.refresh()` is sufficient at MVP scale. Free tier: 200 concurrent connections. |
| `sharp` | Server-side image processing library. Not needed — EXIF strip and resize happen client-side via canvas. |
| `react-webcam` | Wrapper over getUserMedia that adds bundle weight. The camera component is ~80 lines of raw browser API. |
| `@radix-ui/react-navigation-menu` | Already have `@base-ui/react`. Bottom nav is too simple to need a primitive — 5 links + 1 elevated button. |
| `heic-convert` | Node.js only. No browser WASM bundle. Not an alternative to heic2any for client-side conversion. |
| `setInterval` / polling for unread count | Unnecessary complexity. Server-rendered bell badge + `router.refresh()` on notifications mutations is correct for a personal app. |

---

## Installation

```bash
npm install sonner heic2any
```

Two packages. That is the complete install for v3.0.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| sonner version (2.0.7) | MEDIUM | Verified via GitHub releases; no Context7 entry |
| sonner bundle size (13.9 kB gzip) | MEDIUM | Multiple WebSearch sources agree |
| sonner + custom ThemeProvider pattern | HIGH | Derived from confirmed Sonner `theme` prop API + our known ThemeProvider interface |
| heic2any WASM size (~600 kB) | HIGH | DEV Community article with implementation detail; npm issue tracker confirms |
| heic2any Web Worker pattern in Next.js | HIGH | DEV Community article with working code; webpack behavior is well-documented |
| Supabase Storage API | HIGH | Official Supabase docs confirmed |
| Supabase RLS storage policy template | HIGH | Official Supabase docs confirmed |
| pg_trgm availability on free tier | MEDIUM | Supabase docs confirm pre-installed; tier restriction not explicitly excluded |
| getUserMedia iOS Safari quirks | HIGH | MDN + multiple official Apple/WebKit sources |
| Canvas EXIF strip behavior | HIGH | Well-established browser API behavior; MDN confirmed |
| Next.js 16 `next/image` bug with storage | HIGH | Confirmed open GitHub issue #88873; tracked by Next.js team |
| Bottom nav: no library in @base-ui or shadcn | MEDIUM | GitHub issues verified; absence of shipped component verified |

---

## Sources

- sonner GitHub (v2.0.7 release): https://github.com/emilkowalski/sonner
- sonner bundle size: https://bundlephobia.com/package/sonner
- shadcn sonner docs: https://ui.shadcn.com/docs/components/sonner
- heic2any npm: https://www.npmjs.com/package/heic2any
- heic2any Web Worker lazy-load pattern: https://dev.to/calogero_cascio/lazy-loading-a-600kb-webassembly-library-in-nextjs-without-killing-your-bundle-51l4
- Supabase Storage uploads: https://supabase.com/docs/guides/storage/uploads/standard-uploads
- Supabase createSignedUrl API: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl
- Supabase Storage RLS access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase bucket creation: https://supabase.com/docs/guides/storage/buckets/creating-buckets
- pg_trgm Supabase extensions: https://supabase.com/docs/guides/database/extensions
- getUserMedia MDN: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- getUserMedia 2026 guide: https://blog.addpipe.com/getusermedia-getting-started/
- Next.js 16 image optimization bug: https://github.com/vercel/next.js/issues/88873
- shadcn bottom nav feature request: https://github.com/shadcn-ui/ui/issues/4398

---
*Stack research for: Horlo v3.0 Production Nav & Daily Wear Loop*
*Researched: 2026-04-21*
