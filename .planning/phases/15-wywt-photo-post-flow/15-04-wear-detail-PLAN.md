---
phase: 15
plan: 04
type: execute
wave: 4
depends_on: ["15-03b"]
files_modified:
  - src/data/wearEvents.ts
  - src/app/wear/[wearEventId]/page.tsx
  - src/components/wear/WearDetailHero.tsx
  - src/components/wear/WearDetailMetadata.tsx
  - tests/integration/phase15-wear-detail-gating.test.ts
autonomous: false
requirements_addressed:
  - WYWT-17
  - WYWT-18
nyquist_compliant: true
tags: [wear-detail, routing, signed-url, privacy, uat]

must_haves:
  truths:
    - "Visiting `/wear/[wearEventId]` for an existing wear you own renders the detail page (hero + metadata)"
    - "Visiting `/wear/[wearEventId]` for a public wear event of another user renders if their profile_public=true"
    - "Visiting `/wear/[wearEventId]` for a followers-only wear renders ONLY if you follow the actor"
    - "Visiting `/wear/[wearEventId]` for a private wear of another user returns a 404 (uniform with non-existent ids)"
    - "The photo hero loads via a per-request Supabase signed URL (60 min TTL); NEVER minted inside a cached function"
    - "No-photo wear events fall back to the watch's imageUrl, and then to a muted placeholder with brand/model"
    - "WYWT rail tile tap continues to open WywtOverlay (Phase 10 pattern) — no regression"
  artifacts:
    - path: "src/data/wearEvents.ts"
      provides: "Add `getWearEventByIdForViewer(viewerId, wearEventId)` mirroring the three-tier predicate of getWearEventsForViewer"
      exports: ["getWearEventByIdForViewer"]
    - path: "src/app/wear/[wearEventId]/page.tsx"
      provides: "Server Component detail page; calls notFound() uniformly on missing-or-denied; mints signed URL per request (outside any 'use cache')"
      contains: "notFound"
    - path: "src/components/wear/WearDetailHero.tsx"
      provides: "Full-bleed image hero with signed-URL img or watch-image fallback or muted placeholder"
      exports: ["WearDetailHero"]
    - path: "src/components/wear/WearDetailMetadata.tsx"
      provides: "Avatar + linked username + watch card + note + relative time per UI-SPEC"
      exports: ["WearDetailMetadata"]
    - path: "tests/integration/phase15-wear-detail-gating.test.ts"
      provides: "Wave 0 — 9-cell privacy matrix (3 visibility × 3 viewer relations) + uniform-404 assertion"
      exports: []
  key_links:
    - from: "src/app/wear/[wearEventId]/page.tsx"
      to: "src/data/wearEvents.ts"
      via: "await getWearEventByIdForViewer(viewerId, wearEventId)"
      pattern: "getWearEventByIdForViewer"
    - from: "src/app/wear/[wearEventId]/page.tsx"
      to: "next/navigation"
      via: "import { notFound } from 'next/navigation'; notFound() when DAL returns null"
      pattern: "notFound"
    - from: "src/app/wear/[wearEventId]/page.tsx"
      to: "src/lib/supabase/server.ts"
      via: "supabase.storage.from('wear-photos').createSignedUrl(photoUrl, 60*60) — per-request mint"
      pattern: "createSignedUrl"
---

<objective>
Ship the `/wear/[wearEventId]` detail route: viewer-aware DAL with three-tier privacy gate, uniform 404 on missing-or-denied, per-request signed URL minting, full-bleed hero layout with fallback chain, and Phase 10 overlay non-regression. Include the final Manual iOS UAT task that aggregates the Phase 15 manual checklist.

Purpose: WYWT-17 requires a durable URL for wear events (for future notification/feed click-throughs, per WYWT-18). WYWT-18 requires Phase 10's rail-overlay pattern to remain unchanged for non-self tile taps. This plan ships the URL without touching the overlay flow. Signed URL discipline (Pitfall F-2) is architecturally enforced by minting in the Server Component (page.tsx), never in the DAL.

Output: One new DAL function + one new route with 2 supporting components + one Wave 0 integration test file + one manual iOS UAT checkpoint. After this plan ships, Phase 15 is complete.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/15-wywt-photo-post-flow/15-CONTEXT.md
@.planning/phases/15-wywt-photo-post-flow/15-RESEARCH.md
@.planning/phases/15-wywt-photo-post-flow/15-UI-SPEC.md
@.planning/phases/15-wywt-photo-post-flow/15-VALIDATION.md
@.planning/phases/15-wywt-photo-post-flow/15-01-SUMMARY.md
@.planning/phases/15-wywt-photo-post-flow/15-02-SUMMARY.md
@.planning/phases/15-wywt-photo-post-flow/15-03a-SUMMARY.md
@.planning/phases/15-wywt-photo-post-flow/15-03b-SUMMARY.md
@.planning/research/PITFALLS.md
@./CLAUDE.md
@./AGENTS.md

# Existing files the executor will read/modify:
@src/data/wearEvents.ts
@src/lib/auth.ts
@src/lib/supabase/server.ts
@src/lib/timeAgo.ts
@src/db/schema.ts
@src/components/home/WywtRail.tsx
@src/components/home/WywtOverlay.tsx
@src/components/ui/avatar.tsx
@tests/integration/home-privacy.test.ts

<interfaces>
<!-- Key types and contracts the executor needs. -->

From existing codebase (verified):
```typescript
// src/data/wearEvents.ts (existing) — the pattern to mirror
export async function getWearEventsForViewer(
  viewerUserId: string | null,
  profileUserId: string,
): Promise<Array<{id, userId, watchId, wornDate, note, photoUrl, visibility, createdAt}>>

// Three-tier logic: self-bypass (G-5) → profile_public outer gate (G-4) →
// visibility predicate (public; followers requires viewerFollowsActor)
```

From next/navigation (Next.js 16):
```typescript
import { notFound } from 'next/navigation'
// notFound() throws NEXT_HTTP_ERROR_FALLBACK;404 which Next renders as
// the nearest not-found.tsx. Uniform path for missing AND denied.
```

From `@/lib/auth`:
```typescript
export class UnauthorizedError extends Error
export async function getCurrentUser(): Promise<{id: string, email: string}>  // throws UnauthorizedError on no session
```

From Supabase server client:
```typescript
// src/lib/supabase/server.ts (existing)
export async function createSupabaseServerClient(): Promise<SupabaseClient>
// supabase.storage.from('wear-photos').createSignedUrl(path, ttl)
// returns { data: { signedUrl: string } | null, error: ... }
```

NEW contracts this plan creates:

```typescript
// src/data/wearEvents.ts
export async function getWearEventByIdForViewer(
  viewerUserId: string | null,
  wearEventId: string,
): Promise<{
  id: string
  userId: string
  watchId: string
  wornDate: string
  note: string | null
  photoUrl: string | null
  visibility: WearVisibility
  createdAt: Date
  // JOINed:
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  brand: string
  model: string
  watchImageUrl: string | null
} | null>

// src/app/wear/[wearEventId]/page.tsx
export default async function WearDetailPage({
  params,
}: {
  params: Promise<{ wearEventId: string }>  // Next 16 App Router: params is a Promise
}): Promise<JSX.Element>

// src/components/wear/WearDetailHero.tsx
export function WearDetailHero(props: {
  signedUrl: string | null
  watchImageUrl: string | null
  brand: string
  model: string
  altText: string  // e.g. "{username} wearing {brand} {model}"
}): JSX.Element

// src/components/wear/WearDetailMetadata.tsx
export function WearDetailMetadata(props: {
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  brand: string
  model: string
  watchImageUrl: string | null
  note: string | null
  createdAt: Date
}): JSX.Element
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add getWearEventByIdForViewer DAL + create 9-cell privacy matrix integration test</name>
  <files>src/data/wearEvents.ts, tests/integration/phase15-wear-detail-gating.test.ts</files>
  <read_first>
    - src/data/wearEvents.ts (lines 102-162 — getWearEventsForViewer as the canonical three-tier predicate to MIRROR)
    - src/db/schema.ts (wear_events, profileSettings, follows, profiles, watches schemas)
    - tests/integration/home-privacy.test.ts (integration harness shape + Supabase env gating)
    - tests/integration/phase12-visibility-matrix.test.ts (9-cell matrix pattern — visibility × viewer-relation grid)
    - RESEARCH.md §Pattern 9 — Detail-route viewer-aware DAL (full code block)
    - RESEARCH.md §Pitfall 7 — Signed URL inside 'use cache' (IMPORTANT: DAL must return raw path, NOT a signed URL)
    - CONTEXT.md D-20 / D-21 / D-22 (layout + fallback + gating)
    - VALIDATION.md row WYWT-17 — automated command
    - .planning/phases/12-visibility-ripple-in-dal/12-CONTEXT.md §D-03 (three-tier predicate reference — mirror, don't re-invent)
  </read_first>
  <behavior>
    9-cell matrix (3 visibility × 3 viewer relations):
    - Cell 1 (owner / public) → visible
    - Cell 2 (owner / followers) → visible
    - Cell 3 (owner / private) → visible (G-5 self bypass)
    - Cell 4 (follower / public) → visible
    - Cell 5 (follower / followers) → visible
    - Cell 6 (follower / private) → null (404)
    - Cell 7 (stranger / public) → visible IFF actor.profile_public = true
    - Cell 8 (stranger / followers) → null (404)
    - Cell 9 (stranger / private) → null (404)

    Additional tests:
    - Cell 10 (non-existent wearEventId) → null (same 404 — uniform)
    - Cell 11 (stranger / public BUT actor.profile_public = false) → null (G-4 outer gate)
    - Cell 12 (unauthenticated viewer / public wear / profile_public=true) → visible (viewer null path)
    - Cell 13 (unauthenticated viewer / followers wear) → null (no follow relationship exists for null viewer)
  </behavior>
  <action>
    Step 1 — Add to `src/data/wearEvents.ts`. Place AFTER `getWearEventsForViewer` (around line 162):
    ```typescript
    /**
     * Three-tier viewer-aware single-wear reader (WYWT-17, CONTEXT.md D-22).
     *
     * Mirrors the three-tier predicate of getWearEventsForViewer but for a
     * single `wear_events.id` lookup. JOINs `profile_settings`, `profiles`,
     * `watches` so the caller (Server Component page) has everything needed
     * to render hero + metadata without additional round trips.
     *
     * Returns null for:
     *   - Missing row (wearEventId does not exist)
     *   - Actor's profile_public = false (G-4 outer gate) and viewer != actor
     *   - visibility='private' and viewer != actor
     *   - visibility='followers' and viewer does not follow actor
     *
     * The page calls Next.js `notFound()` uniformly when this returns null,
     * so missing and denied responses are INDISTINGUISHABLE from the outside.
     * Mirrors Phase 8 notes-IDOR mitigation and Phase 10 WYWT overlay precedent.
     *
     * IMPORTANT: This function returns `photoUrl` as the RAW Storage path,
     * NEVER a signed URL. The page.tsx Server Component mints the signed URL
     * per request with createSignedUrl() — Pitfall F-2 (signed URLs must NOT
     * live inside any 'use cache'-wrapped function).
     */
    export async function getWearEventByIdForViewer(
      viewerUserId: string | null,
      wearEventId: string,
    ) {
      const rows = await db
        .select({
          id: wearEvents.id,
          userId: wearEvents.userId,
          watchId: wearEvents.watchId,
          wornDate: wearEvents.wornDate,
          note: wearEvents.note,
          photoUrl: wearEvents.photoUrl,
          visibility: wearEvents.visibility,
          createdAt: wearEvents.createdAt,
          // JOINed metadata for the detail page
          actorProfilePublic: profileSettings.profilePublic,
          username: profiles.username,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          brand: watches.brand,
          model: watches.model,
          watchImageUrl: watches.imageUrl,
        })
        .from(wearEvents)
        .innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
        .innerJoin(profiles, eq(profiles.id, wearEvents.userId))
        .innerJoin(watches, eq(watches.id, wearEvents.watchId))
        .where(eq(wearEvents.id, wearEventId))
        .limit(1)

      const row = rows[0]
      if (!row) return null  // 404 for missing

      // G-5 self bypass — owner always sees regardless of visibility/profile_public
      if (viewerUserId && row.userId === viewerUserId) {
        return row
      }

      // G-4 outer profile_public gate for ALL non-owner branches
      if (!row.actorProfilePublic) return null

      // Three-tier
      if (row.visibility === 'public') return row
      if (row.visibility === 'private') return null
      // Followers tier: viewer must be authenticated AND follow actor
      if (row.visibility === 'followers') {
        if (!viewerUserId) return null
        const followRows = await db
          .select({ id: follows.id })
          .from(follows)
          .where(
            and(
              eq(follows.followerId, viewerUserId),
              eq(follows.followingId, row.userId),
            ),
          )
          .limit(1)
        return followRows.length > 0 ? row : null
      }
      return null  // unreachable but defensive
    }
    ```
    The existing file already imports `db`, `wearEvents`, `profileSettings`, `follows`, `profiles`, `watches`, `eq`, `and`, `desc`, `inArray`, `gte`, `or`, `sql` — no new imports needed.

    Step 2 — Create `tests/integration/phase15-wear-detail-gating.test.ts` modeled on `tests/integration/home-privacy.test.ts`:
    - Gate activation:
      ```typescript
      const ENABLED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
      const describeIf = ENABLED ? describe : describe.skip
      ```
    - Test fixtures (beforeAll):
      - userA (actor, profile_public=true) + 3 wear events (public/followers/private) each with a watch
      - userA_private (actor, profile_public=false) + 1 wear event (public) — for cell 11
      - userF (follower of userA) — seed follow row
      - userS (stranger, no follow)
      - unauthenticated viewer = null viewerId
    - Cleanup afterAll: delete seeded rows in reverse dependency order (wear_events → follows → profile_settings → profiles → users)
    - Write out all 13 cells (9 matrix + 4 edge cases) as individual `it` blocks
    - Each `it` asserts `expect(result).toBe(null)` OR `expect(result).toMatchObject({ id: wearEventId, username: ... })` with discriminating fields

    Step 3 — Verify the DAL returns EXACTLY the fields in the <interfaces> signature. Grep:
    ```bash
    grep -A 20 "getWearEventByIdForViewer" src/data/wearEvents.ts
    ```
    Check select-list alignment.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run test -- tests/integration/phase15-wear-detail-gating.test.ts</automated>
  </verify>
  <done>
    - `getWearEventByIdForViewer` exported from `src/data/wearEvents.ts`; signature matches <interfaces>
    - Return includes JOINed fields: username, displayName, avatarUrl, brand, model, watchImageUrl
    - `photoUrl` returned is the RAW STORAGE PATH (not a signed URL) — verified by reading the function body
    - 13 tests in `tests/integration/phase15-wear-detail-gating.test.ts`; activated-or-skipped based on env var gate
    - When activated: ALL 13 tests pass (9 matrix cells + 4 edge cases)
    - No `'use cache'` directive anywhere in `src/data/wearEvents.ts`
    - No `createSignedUrl` call anywhere in `src/data/wearEvents.ts`
  </done>
</task>

<task type="auto">
  <name>Task 2: Create /wear/[wearEventId] Server Component page + WearDetailHero + WearDetailMetadata components (uniform 404, signed URL mint inline)</name>
  <files>src/app/wear/[wearEventId]/page.tsx, src/components/wear/WearDetailHero.tsx, src/components/wear/WearDetailMetadata.tsx</files>
  <read_first>
    - src/data/wearEvents.ts (just-added getWearEventByIdForViewer — note the return shape)
    - src/lib/timeAgo.ts (formatRelativeTime helper — existing Phase 10 feed helper)
    - src/components/ui/avatar.tsx (Avatar primitive)
    - src/lib/auth.ts (getCurrentUser + UnauthorizedError)
    - src/lib/supabase/server.ts (createSupabaseServerClient)
    - node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md (canonical notFound behavior)
    - node_modules/next/dist/docs/01-app/01-getting-started/11-layouts-and-pages.md (App Router params-as-Promise pattern in Next 16)
    - RESEARCH.md §Pattern 9 — Detail-route code (page.tsx full example)
    - RESEARCH.md §Pitfall 7 — Signed URL inside 'use cache'
    - RESEARCH.md §Anti-Patterns — Using redirect instead of notFound leaks existence
    - RESEARCH.md §Open Question 4 — Whether segment-level not-found.tsx is needed
    - RESEARCH.md §Common Operation 4 — Mint a signed URL
    - RESEARCH.md §Code Examples + Don't Hand-Roll (native <img> on signed URL, NOT next/image)
    - CONTEXT.md D-20 / D-21 / D-23 / D-24
    - UI-SPEC.md §/wear/[wearEventId] detail page — full layout spec
    - UI-SPEC.md §Accessibility Contract — img alt text pattern
    - UI-SPEC.md §Copywriting Contract — no-photo + no watch image fallback placeholder
    - next.config.ts (confirm images.unoptimized: true is set)
  </read_first>
  <action>
    Step 1 — Create `src/components/wear/WearDetailHero.tsx`. Can be a Server Component (no client state):
    ```tsx
    import type { JSX } from 'react'

    /**
     * Hero image for the wear detail page (D-20, D-21).
     *
     * Fallback chain:
     *   1. signedUrl present → native <img src={signedUrl}> (Pitfall F-2 — native
     *      img, NOT next/image which strips query params on optimized variants
     *      and breaks the signed-URL token).
     *   2. No photo but watch has imageUrl → use watch imageUrl as hero.
     *   3. Neither → muted placeholder with "{brand} {model}" centered.
     *
     * Aspect ratio: 4:5 (portrait — matches typical wrist-shot composition)
     * per CONTEXT.md D-20.
     */
    export function WearDetailHero({
      signedUrl,
      watchImageUrl,
      brand,
      model,
      altText,
    }: {
      signedUrl: string | null
      watchImageUrl: string | null
      brand: string
      model: string
      altText: string
    }): JSX.Element {
      const url = signedUrl ?? watchImageUrl
      if (url) {
        return (
          <div className="w-full aspect-[4/5] overflow-hidden bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
            <img
              src={url}
              alt={altText}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        )
      }
      return (
        <div className="w-full aspect-[4/5] flex items-center justify-center bg-muted md:rounded-lg md:max-w-[600px] md:mx-auto">
          <span className="text-sm font-semibold text-muted-foreground">
            {brand} {model}
          </span>
        </div>
      )
    }
    ```

    Step 2 — Create `src/components/wear/WearDetailMetadata.tsx`. Server Component:
    ```tsx
    import Link from 'next/link'
    import type { JSX } from 'react'
    import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
    import { formatRelativeTime } from '@/lib/timeAgo'

    /**
     * Metadata stack below the hero on /wear/[wearEventId] (D-20).
     * Collector row → watch row → note. No engagement mechanics (no like/comment/share).
     */
    export function WearDetailMetadata({
      username,
      displayName,
      avatarUrl,
      brand,
      model,
      watchImageUrl,
      note,
      createdAt,
    }: {
      username: string | null
      displayName: string | null
      avatarUrl: string | null
      brand: string
      model: string
      watchImageUrl: string | null
      note: string | null
      createdAt: Date
    }): JSX.Element {
      const initial = (displayName ?? username ?? '?').slice(0, 1).toUpperCase()
      return (
        <div className="flex flex-col gap-4 px-4 pb-6 md:max-w-[600px] md:mx-auto">
          {/* Collector row */}
          <div className="flex items-center gap-3">
            {username ? (
              <Link href={`/u/${username}`} className="flex items-center gap-3">
                <Avatar className="size-8">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold">
                  {displayName ?? username}
                </span>
              </Link>
            ) : (
              <>
                <Avatar className="size-8">
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold text-muted-foreground">
                  Unknown collector
                </span>
              </>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {formatRelativeTime(createdAt)}
            </span>
          </div>

          {/* Watch row */}
          <div className="flex items-center gap-3">
            {watchImageUrl ? (
              <img src={watchImageUrl} alt="" className="size-10 rounded-md object-cover" />
            ) : (
              <div className="size-10 rounded-md bg-muted" aria-hidden />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{brand}</span>
              <span className="text-sm text-muted-foreground">{model}</span>
            </div>
          </div>

          {/* Note */}
          {note && (
            <p className="text-sm text-foreground whitespace-pre-wrap">{note}</p>
          )}
        </div>
      )
    }
    ```
    Confirm `formatRelativeTime` is imported from the correct path (`src/lib/timeAgo.ts` — look up exact export name; if it's `formatTimeAgo` or similar, use that exact identifier). Grep before assuming.

    Step 3 — Create `src/app/wear/[wearEventId]/page.tsx` Server Component. Use RESEARCH §Pattern 9 code verbatim with ONE adjustment (remove the `viewerId` null-coalesce on the imported action since we handle it inline):
    ```tsx
    import { notFound } from 'next/navigation'
    import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
    import { getWearEventByIdForViewer } from '@/data/wearEvents'
    import { createSupabaseServerClient } from '@/lib/supabase/server'
    import { WearDetailHero } from '@/components/wear/WearDetailHero'
    import { WearDetailMetadata } from '@/components/wear/WearDetailMetadata'

    /**
     * Wear detail page (WYWT-17, WYWT-18).
     *
     * DAL applies three-tier visibility gate; page calls notFound() uniformly
     * for missing OR denied — mirrors Phase 8 notes-IDOR mitigation precedent.
     *
     * Signed URL is minted INLINE here (NOT in the DAL). Pitfall F-2: signed
     * URLs are per-request and per-user; caching them across either axis is
     * a security + freshness bug.
     *
     * Deliberately NO 'use cache' directive on this page.
     */
    export default async function WearDetailPage({
      params,
    }: {
      params: Promise<{ wearEventId: string }>
    }) {
      const { wearEventId } = await params

      let viewerId: string | null = null
      try {
        const user = await getCurrentUser()
        viewerId = user.id
      } catch (err) {
        // Anonymous viewer is allowed for public wear events on profile_public profiles
        if (!(err instanceof UnauthorizedError)) throw err
      }

      const wear = await getWearEventByIdForViewer(viewerId, wearEventId)
      if (!wear) notFound()

      let signedUrl: string | null = null
      if (wear.photoUrl) {
        const supabase = await createSupabaseServerClient()
        const { data } = await supabase.storage
          .from('wear-photos')
          .createSignedUrl(wear.photoUrl, 60 * 60)  // 60 min TTL (D-23)
        signedUrl = data?.signedUrl ?? null
      }

      const altText =
        wear.username
          ? `${wear.username} wearing ${wear.brand} ${wear.model}`
          : `Watch on wrist — ${wear.brand} ${wear.model}`

      return (
        <article className="flex flex-col gap-4">
          <WearDetailHero
            signedUrl={signedUrl}
            watchImageUrl={wear.watchImageUrl}
            brand={wear.brand}
            model={wear.model}
            altText={altText}
          />
          <WearDetailMetadata
            username={wear.username}
            displayName={wear.displayName}
            avatarUrl={wear.avatarUrl}
            brand={wear.brand}
            model={wear.model}
            watchImageUrl={wear.watchImageUrl}
            note={wear.note}
            createdAt={wear.createdAt}
          />
        </article>
      )
    }
    ```

    Step 4 — `not-found.tsx`? Per RESEARCH §Open Question 4, check the repo for a root-level `src/app/not-found.tsx`. Preflight discovery confirmed **none exists**. Decision: do NOT create one in this task — Next's default 404 page is sufficient for MVP. Document in Summary. If later the user wants a branded 404, create `src/app/not-found.tsx` as a quick task outside Phase 15.

    Step 5 — `images.unoptimized: true` is already set in `next.config.ts` (verified in RESEARCH). Native `<img src={signedUrl}>` works without adding Supabase to `remotePatterns`. No next.config changes.

    Step 6 — Verify WywtRail non-self tile tap still opens WywtOverlay (NO regression):
    ```bash
    grep -n "WywtOverlay" src/components/home/WywtRail.tsx
    grep -n "WywtOverlay" src/components/home/WywtTile.tsx
    ```
    Confirm both files still import and use `WywtOverlay` (the Reels overlay preserved per WYWT-18). If Plan 03b Task 4 accidentally removed this, the executor MUST restore it.

    Step 7 — Run the existing home-privacy integration test to confirm non-regression:
    ```bash
    npm run test -- tests/integration/home-privacy.test.ts
    ```
    Must pass unchanged (WYWT-18 non-regression).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm run lint && npm run test -- tests/integration/phase15-wear-detail-gating.test.ts tests/integration/home-privacy.test.ts</automated>
  </verify>
  <done>
    - `src/app/wear/[wearEventId]/page.tsx` exists as a Server Component (no 'use client', no 'use cache')
    - `params` typed as `Promise<{ wearEventId: string }>` and awaited (Next 16 pattern)
    - `notFound()` called uniformly when DAL returns null (no discriminating error between missing vs denied)
    - `createSignedUrl('wear-photos', photoUrl, 60*60)` called INLINE in the page (not in DAL); 60-min TTL
    - `WearDetailHero` renders native `<img>` (NOT `next/image`) with fallback chain: signedUrl → watchImageUrl → muted placeholder
    - `WearDetailMetadata` renders collector row (Avatar + linked username), watch row, note; uses formatRelativeTime for timestamp
    - `grep -n "'use cache'" src/app/wear/` returns 0 matches
    - `grep -n "createSignedUrl" src/data/` returns 0 matches (DAL discipline)
    - `grep -n "next/image" src/app/wear/` returns 0 matches (native img discipline)
    - `grep -n "WywtOverlay" src/components/home/WywtRail.tsx` still returns matches (Phase 10 overlay preserved)
    - `npm run test -- tests/integration/home-privacy.test.ts` passes (non-regression)
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manual iOS UAT — Phase 15 aggregate checklist</name>
  <files>n/a — checkpoint task (manual UAT only, no code changes)</files>
  <action>See <how-to-verify> below. This is a human-executed checklist requiring a physical iPhone + HTTPS tunnel; no automated action.</action>
  <verify>
    <automated>MANUAL — see VALIDATION.md §Manual-Only Verifications for the canonical list. No automated command; this is a manual iOS UAT checkpoint.</automated>
  </verify>
  <done>User replies "approved" confirming every checklist item passed on a real iOS device, OR provides a bulleted list of failures for gap closure.</done>
  <what-built>
    Phase 15 is fully composed by this point:
    - Photo pipeline (Plan 01): EXIF strip, HEIC worker, PhotoUploader, CameraCaptureView, WristOverlaySvg, uploadWearPhoto
    - Sonner infrastructure (Plan 02): ThemedToaster in root layout
    - Wear backend (Plan 03a): logWearWithPhoto + getWornTodayIdsForUserAction Server Actions, DAL helpers, duplicate-day server catch, orphan cleanup
    - Wear frontend (Plan 03b): WywtPostDialog orchestrator, ComposeStep (D-07 three-handler split), VisibilitySegmentedControl, extended WatchPickerDialog, NavWearButton/WywtRail call-site swaps, Sonner toast
    - Wear detail route (Plan 04 Tasks 1-2): /wear/[wearEventId] with three-tier gate, signed URL, full-bleed hero
  </what-built>
  <how-to-verify>
    Manual iOS UAT is MANDATORY before `/gsd-verify-work`. jsdom cannot simulate iOS Safari gesture context; iOS Simulator does not grant real camera access. A physical iPhone + HTTPS tunnel is required.

    ## Setup
    1. Run `npm run dev` on your development machine
    2. Start an HTTPS tunnel to `http://localhost:3000`:
       - Fast option: `npx ngrok http 3000` (rotating URL, free tier)
       - OR: `cloudflared tunnel --url http://localhost:3000` (stable URL, requires Cloudflare account)
    3. Open the HTTPS URL on an iPhone running iOS 16+ in Safari
    4. Log in as a test user with ≥2 owned watches

    ## Checklist (from VALIDATION.md §Manual-Only Verifications + CONTEXT.md + RESEARCH.md)

    ### WYWT-04 — Camera gesture + overlay
    - [ ] Tap bottom-nav Wear CTA → WywtPostDialog opens at Step 1 (picker)
    - [ ] Pick a watch → advances to Step 2 (compose)
    - [ ] Tap "Take wrist shot" → iOS prompts for camera permission (first time) or opens live preview (subsequent)
    - [ ] Live video preview renders with the wrist-overlay SVG (two horizontal arm lines, two concentric circles with 10:10 hands, small crown at 3 o'clock — NO hour markers, NO lugs, NO strap)
    - [ ] Tap Capture → preview image replaces the camera view; X button + "Retake" link visible

    ### WYWT-06 — Upright orientation across rotations
    - [ ] Capture a portrait-mode wrist shot → submit → visit `/wear/[id]` → hero renders UPRIGHT (not sideways)
    - [ ] Repeat with landscape-orientation (rotate iPhone 90° before capturing)
    - [ ] Repeat with upside-down (180°)
    - [ ] All three cases render upright on `/wear/[id]`

    ### WYWT-04 (D-3) — Permission denied UX
    - [ ] iOS Settings → Safari → Camera → Deny for your dev URL
    - [ ] Reload the app in Safari, tap Wear → pick watch → tap "Take wrist shot"
    - [ ] Verify inline `role="alert"` error banner shows "Camera access denied — use Upload photo instead."
    - [ ] Verify Upload photo still works (pick a photo from Photos; submit; toast fires)
    - [ ] Reset camera permission to allow after testing

    ### WYWT-05 / A2 — HEIC worker chunk emission
    - [ ] Open Safari DevTools (Mac → Safari → Develop → iPhone → yourtunnel.ngrok.io)
    - [ ] Network tab → tap Upload Photo → select a `.heic` file from Photos
    - [ ] Verify a `heic-worker.*.js` chunk loads ONLY on this interaction, not on initial route load
    - [ ] Verify the upload completes (HEIC converts to JPEG, EXIF stripped, resize applied, submit succeeds)
    - [ ] If the worker chunk is folded into the main bundle → file a follow-up issue; verify fallback works (executor already considered `/public/workers/heic-worker.js` path per Plan 01 Task 2 spike)

    ### WYWT-06 / T-15-03 — EXIF GPS stripped
    - [ ] Pick an iPhone photo with known GPS EXIF (enable Camera > Location in Settings before shooting)
    - [ ] Upload via file picker; submit
    - [ ] On your dev machine: download the Storage object (via Supabase Studio or CLI)
    - [ ] Run `exiftool path/to/downloaded.jpg` — confirm `GPSLatitude` and `GPSLongitude` fields are absent
    - [ ] Alternative: `node -e "const {parse} = require('exifr'); require('fs').readFile('path.jpg', (_,b) => parse(b, {gps:true}).then(console.log))"` should log `undefined` or `{}`

    ### WYWT-12 — Duplicate-day preflight + server catch
    - [ ] Log a wear for watchA today
    - [ ] Reopen the Wear CTA → watchA is disabled in the picker (opacity-50, "Worn today" micro-label)
    - [ ] Attempt a direct Server Action invocation via Safari DevTools console (simulate a malicious client):
      ```js
      // Replace with actual watchId + a fresh UUID
      await window.__next_f /* or use fetch to the Server Action */
      ```
      OR: remove the `disabled` attr on the watchA button via DevTools and force-select → force-submit
    - [ ] Verify the inline `role="alert"` banner shows "Already logged this watch today"
    - [ ] Verify the Storage object (if photo was attached) is removed after the 23505 catch (check Storage bucket for the `{userId}/{wearEventId}.jpg` path — should not exist)

    ### WYWT-16 — Sonner toast on success
    - [ ] Submit a valid wear → modal closes → Sonner toast "Wear logged" appears at bottom-center
    - [ ] Toast auto-dismisses after ~4s
    - [ ] Switch theme to dark (Settings or system) → submit → toast renders in dark theme
    - [ ] Switch to light → submit → toast renders in light theme

    ### WYWT-17 — `/wear/[id]` three-tier gating
    - Use TWO accounts for this (ideally via two iOS devices OR iPhone + desktop Safari):
    - [ ] As userA, log a wear with visibility='followers'; note the URL `/wear/[id]` (from Supabase studio or server log)
    - [ ] As userB (NOT following userA), visit that URL → Safari shows a 404 page (uniform; no JSON leak)
    - [ ] userB follows userA → revisit the URL → wear detail renders (hero + metadata)
    - [ ] Repeat with visibility='private' — userB (even as follower) gets 404; userA sees their own post
    - [ ] Non-existent UUID (e.g., `/wear/00000000-0000-0000-0000-000000000000`) → same 404

    ### WYWT-18 — Rail overlay non-regression
    - [ ] On home page, tap a non-self WYWT tile → Reels-style `WywtOverlay` opens (Phase 10 pattern — full-screen, embla carousel, close button)
    - [ ] Close overlay; home page intact, nav visible
    - [ ] Tap the self-placeholder tile → `WywtPostDialog` opens (Phase 15 flow — the same two-step modal as NavWearButton)

    ## Resume signal

    Reply with one of:
    - `approved` — all checklist items pass, Phase 15 ready for `/gsd-verify-work`
    - A bulleted list of items that failed, with what was observed vs what was expected (planner will create gap-closure tasks)
  </how-to-verify>
  <resume-signal>Type "approved" or paste a bulleted list of failures</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Anonymous viewer → public wear detail | Unauthenticated user can see public wear events on public profiles |
| Authenticated viewer → followers-tier wear | Follow-relationship check gates access |
| URL guess → non-existent wearEventId | Same response as denied (uniform 404) |
| Page → Supabase signed URL mint | Must be per-request; never cached |
| Signed URL token → browser copy-paste | 60-min TTL bounds exfiltration window |

## STRIDE Threat Register

| Threat ID | Category | Severity | Component | Mitigation Plan |
|-----------|----------|----------|-----------|-----------------|
| T-15-07 | I (Response differential leaks existence) | HIGH | page.tsx + DAL | DAL returns null for BOTH missing and denied; page calls notFound() uniformly — no HTTP/headers/body diff. Mirrors Phase 8 notes-IDOR + Phase 10 WYWT overlay precedent. |
| T-15-21 | I (Signed URL leak via cache) | HIGH | page.tsx | Signed URL minted INLINE in Server Component (not DAL). Page has no 'use cache'. Verified by grep. Smart CDN caches per-unique-token so cross-user contamination is impossible even if the URL were accidentally cached. |
| T-15-22 | I (Signed URL leak via long TTL) | LOW | page.tsx | 60-min TTL bounds exfiltration. Revisitable if users report stale-URL breakage from long-open tabs; can shorten to 5-15 min if concern rises. |
| T-15-23 | S (Three-tier gate bypass via DAL hole) | HIGH | getWearEventByIdForViewer | 9-cell matrix integration test enforces all 9 visibility × viewer-relation combinations + 4 edge cases (13 total). Test suite MUST be green before ship. |
| T-15-24 | T (Viewer identity tampering — client sends fake viewerId) | HIGH | page.tsx | viewerId derived from `getCurrentUser()` session (server-side); not taken from client input. |
| T-15-25 | I (profile_public=false bypass for public wear) | HIGH | getWearEventByIdForViewer G-4 outer gate | ALL non-owner branches first check `actorProfilePublic === true`. Integration Cell 11 asserts this. |
| T-15-26 | E (next/image strips signed-URL query params) | MED | WearDetailHero | Uses native `<img>` NOT next/image (images.unoptimized:true already set; avoids the breakage by architecture). |
</threat_model>

<verification>
## Plan-Level Verification

- `npx tsc --noEmit` exits 0
- `npm run lint` exits 0
- `npm run test -- tests/integration/phase15-wear-detail-gating.test.ts` — 13 tests pass (or skip-gated on missing env vars)
- `npm run test -- tests/integration/home-privacy.test.ts` — Phase 10 tests still pass (WYWT-18 non-regression)
- `grep -n "'use cache'" src/app/wear/` returns 0 matches
- `grep -n "createSignedUrl" src/data/` returns 0 matches (DAL discipline)
- `grep -n "next/image" src/app/wear/` returns 0 matches (native img discipline)
- `grep -n "WywtOverlay" src/components/home/` returns ≥ 2 matches (WywtRail + WywtTile preserved)
- Manual iOS UAT task 3 signed off by user
</verification>

<success_criteria>
## Plan Success Criteria

1. `getWearEventByIdForViewer` returns null for all denied cases uniformly with missing-row case
2. `/wear/[wearEventId]` renders hero + metadata for visible cases; returns 404 via `notFound()` for denied cases
3. Signed URL minted inline in Server Component page with 60-min TTL; never cached
4. No-photo fallback to watch imageUrl; no-watch-image fallback to muted placeholder
5. Native `<img>` used for hero (not next/image); images.unoptimized already configured
6. Phase 10 WywtOverlay pathway unchanged (WYWT-18 non-regression)
7. 9-cell privacy matrix + 4 edge-case integration tests all green when env vars present
8. Manual iOS UAT checklist signed off — camera gesture, EXIF upright, permission-denied UX, HEIC worker chunk, GPS strip, duplicate-day preflight + server catch, Sonner toast light+dark, 9-cell /wear/[id] gating, rail overlay non-regression
</success_criteria>

<output>
After completion, create `.planning/phases/15-wywt-photo-post-flow/15-04-SUMMARY.md` documenting:
- Whether a segment-level `not-found.tsx` was created (NO is fine if the root not-found default is acceptable)
- Manual UAT results per checklist item (pass / fail / notes)
- Any EXIF orientation edge cases observed on real device (e.g., particular iPhone model / iOS version)
- Signed URL TTL chosen (60 min per Discretion) and rationale
- Whether A5 smoke from Plan 03a held at scale (does `.list()` under session client still work for the existence probe?)
</output>
