# Phase 8: Self Profile & Privacy Controls - Research

**Researched:** 2026-04-19
**Domain:** Next.js 16 App Router dynamic routing, React 19 optimistic UI, Supabase RLS with cross-row visibility joins, profile DAL patterns, custom calendar component
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Routing** — `/u/[username]/[tab]` server routes. Default redirect `/u/[username]` → `/u/[username]/collection`. Tabs: `collection | wishlist | worn | notes | stats`.

**D-02: Settings location** — `/settings` route (full page, desktop + mobile). Not a modal.

**D-03: Home page (`/`) preserved** — `/` remains private dashboard. `/u/[me]` is public-facing. Phase 10 introduces feed at `/`.

**D-04: Mobile + desktop responsive** — both viewports built simultaneously. Reuses existing dark mode.

**D-05: Profile header** — username, bio, inline stats (followers · following · watches · wishlist), taste tag pills, avatar. Avatar: URL field only (no upload). Editable: display name, avatar URL, bio.

**D-06: Taste tags (PROF-10)** — rule-based, server-derived, capped at 3. Rules: Vintage Collector (>40% pre-2000), {Brand} Fan (any brand >30%), Sport/Dress/Dive tags (>40-50% roleTags), Daily Rotator (avg wear events/week > 5). No ML.

**D-07: Collection tab** — 4-col desktop grid, 1-col mobile. Status badges, filter chips from roleTags, search input, "+ Add Watch" card (own profile only).

**D-08: Wishlist tab** — reuse Collection card layout. Filter to `status in ('wishlist', 'grail')`. Show target price + notes.

**D-09: Worn tab** — Timeline + Calendar toggle. Per-watch filter dropdown. "+ Log Today's Wear" CTA. Calendar: week-grid (Sun–Sat), day cells show watch image if worn.

**D-10: Notes tab** — list of watches with non-empty `notes` field. Per-note visibility pill (Public/Private) toggles `notes_public`. 3-dot menu.

**D-11: Stats tab** — Most Worn, Least Worn, Style Distribution, Role Distribution cards. Full-width Collection Observations.

**D-12: Privacy controls scope** — 4 functional toggles: PRIV-01 (Profile), PRIV-02 (Collection), PRIV-03 (Wishlist), PRIV-04 (Worn). Plus Notes visibility default dropdown. Rest of Settings page structure rendered but non-functional.

**D-13: Per-note visibility** — add `notes_public: boolean default true` + `notes_updated_at: timestamp` to `watches` table (Option A). Per-note pill toggles `notes_public` directly.

**D-14: Locked private profile (PRIV-06)** — Letterboxd pattern. Private visitors see avatar, username, bio, follower/following counts, Follow button. Tab area replaced by lock icon + "This profile is private." Owner always sees their full profile.

**D-15: Privacy enforcement** — RLS on `wear_events`, `activities` PLUS DAL WHERE clause checks. Two-layer enforcement.

### Claude's Discretion

None specified — all significant decisions locked in CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)

- Avatar image upload (URL only this phase)
- Notifications functionality (UI non-functional)
- Data Preferences (Download Data, Export Collection) — non-functional
- Account section (Change Password, Blocked Users, Delete Account) — non-functional except dialog render
- "Show Collection Value" / "Activity Status" / generic "New Watch Visibility" toggles
- Theme toggle UI (already supported app-wide)
- Follow button functionality (rendered, non-functional)
- Common Ground taste overlap (Phase 9)
- Activity feed (Phase 10)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROF-01 | Profile page at `/u/[username]` with header (avatar, username, stats, taste tags) | DAL pattern: `getProfileByUsername`, `getFollowerCounts`, taste tag computation from watches |
| PROF-02 | Collection tab — owned watches in grid with filters | Reuse `getWatchesByUser` filtered to `status = 'owned'`; filter chips from `roleTags` |
| PROF-03 | Wishlist tab — target price, notes, status | Filter `getWatchesByUser` to `status in ('wishlist', 'grail')` |
| PROF-04 | Worn tab — timeline + calendar | `getWearEventsByWatch` + new `getWearEventsByUser` query returning all events |
| PROF-05 | Notes tab — watch-linked notes with visibility toggle | Filter `getWatchesByUser` to `notes IS NOT NULL`; new `updateNoteVisibility` SA |
| PROF-06 | Stats tab — collection composition + insights | Aggregate queries over `watches` + `wear_events`; reuse insights page logic |
| PROF-07 | Edit profile (display name, avatar URL, bio) | New `updateProfile` SA writing to `profiles` table; inline edit form |
| PROF-10 | Auto-derived taste tags from collection composition | Server-side pure function taking `Watch[]` → `string[]`; no DB storage needed |
| PRIV-01 | Profile visibility toggle | `updateProfileSettings` SA; `profile_settings.profile_public` |
| PRIV-02 | Collection visibility toggle | `profile_settings.collection_public` |
| PRIV-03 | Wishlist visibility toggle | `profile_settings.wishlist_public` |
| PRIV-04 | Worn history visibility toggle | `profile_settings.worn_public` |
| PRIV-05 | Privacy enforced at RLS + DAL | New RLS migration for `wear_events` + `watches` conditional on `profile_settings`; DAL visibility gate |
| PRIV-06 | Locked profile state for private profiles | `getProfileByUsername` returns settings; page renders `LockedProfileState` if `!profile_public && !isOwner` |
</phase_requirements>

---

## Summary

Phase 8 builds the self-profile surface and privacy system on top of the social tables shipped in Phase 7. The work falls into four discrete layers: (1) schema additions to `watches` for per-note visibility; (2) new RLS policies that gate reads on `profile_settings` flags; (3) a profile DAL and Server Actions for reads and mutations; (4) React components for the profile page, tabs, settings page, and optimistic privacy toggles.

The routing architecture is straightforward: nested dynamic segments `/u/[username]/[tab]/page.tsx` with `params` as a `Promise` (Next.js 16 requirement). The tab navigation is URL-driven — no React state — using `usePathname()` to derive active state on the client. This matches the existing `HeaderNav` pattern.

The most complex technical question is the RLS strategy for privacy-gated reads. Supabase RLS cannot perform a subquery JOIN to `profile_settings` without a `SECURITY DEFINER` function or accepting that the current user's token cannot read rows they don't own. The correct approach is to keep RLS as the blunt owner-only gate, then have the DAL perform the conditional visibility check for public reads — two-layer enforcement as specified in D-15. This avoids the circular-RLS problem described below.

**Primary recommendation:** Ship plans in dependency order: (1) schema migration → (2) profile + settings DAL and Server Actions → (3) page routes and components wave → (4) settings page. Privacy toggle optimistic updates use `useOptimistic` from React 19 (already available; App Router ships with React canary).

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| Next.js | 16.2.3 | App Router dynamic routes, Server Components, Server Actions | Locked |
| React | 19.2.4 | `useOptimistic`, `use(params)` in Client Components | Locked |
| Drizzle ORM | ^0.45.2 | Schema additions, typed queries | Locked |
| Supabase (via `@supabase/ssr`) | ^0.10.2 | RLS migration target | Locked |
| Tailwind CSS 4 | ^4 | All styling | Locked |
| `@base-ui/react` | ^1.3.0 | Tabs, Dialog, DropdownMenu | Locked |
| `lucide-react` | ^1.8.0 | Lock icon, ChevronLeft/Right for calendar nav | Locked |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `recharts` | ^3.8.0 | Already in package.json — check if chart.tsx covers stats before building custom | Check `chart.tsx` first; if insufficient, use `div`-based bars per UI-SPEC |
| `clsx` + `tailwind-merge` | present | `cn()` helper | All conditional classes |

**No new packages needed.** `date-fns` is NOT in package.json — confirmed absent. Use native `Date` for calendar arithmetic. [VERIFIED: package.json inspection]

**Installation:** None required.

---

## Architecture Patterns

### Routing Structure

```
src/app/
├── u/
│   └── [username]/
│       ├── page.tsx                 # Server Component: redirect to /u/[username]/collection
│       ├── layout.tsx               # Server Component: fetches profile, passes to children
│       └── [tab]/
│           └── page.tsx             # Server Component: renders tab content
└── settings/
    └── page.tsx                     # Server Component: renders settings form
```

**Layout approach:** A shared layout at `src/app/u/[username]/layout.tsx` fetches the profile once and passes it to all tab pages. This avoids re-fetching the profile header on every tab switch. Tab content pages receive `{ params }` as a Promise and `await params` to get `{ username, tab }`.

### Pattern 1: Async Params (Next.js 16 REQUIRED)

In Next.js 16, `params` is a Promise in both Server and Client Components.

```typescript
// src/app/u/[username]/[tab]/page.tsx
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md

export default async function ProfileTabPage({
  params,
}: {
  params: Promise<{ username: string; tab: string }>
}) {
  const { username, tab } = await params
  // ... fetch data and render
}
```

In Client Components, use React's `use()` to unwrap the promise:

```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md
'use client'
import { use } from 'react'

export function SomeClientComponent({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params)
  // ...
}
```

**Critical:** Forgetting `await params` in Server Components or `use(params)` in Client Components will cause a runtime error in Next.js 16. [VERIFIED: official Next.js 16.2.3 docs]

### Pattern 2: URL-Driven Tab Active State

Tabs are not controlled by React state — the URL segment determines the active tab. Match the existing `HeaderNav` pattern:

```typescript
// src/components/profile/ProfileTabs.tsx
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS = ['collection', 'wishlist', 'worn', 'notes', 'stats']

export function ProfileTabs({ username }: { username: string }) {
  const pathname = usePathname()

  return (
    <TabsList variant="line">
      {TABS.map((tab) => (
        <TabsTrigger
          key={tab}
          value={tab}
          render={<Link href={`/u/${username}/${tab}`} />}
          data-active={pathname.endsWith(`/${tab}`) || undefined}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
```

**Note:** The base-ui Tabs `data-active` attribute drives the underline style — set it based on `pathname.endsWith()` comparison. The `Tabs` root `value` prop is not needed for URL-driven navigation; use `render` prop on `TabsTrigger` to wrap in a `Link`. [VERIFIED: tabs.tsx inspection]

### Pattern 3: Server Action with `ActionResult<T>` (existing pattern)

```typescript
// src/app/actions/profile.ts
'use server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'

export async function updateProfileSettings(
  field: 'profile_public' | 'collection_public' | 'wishlist_public' | 'worn_public',
  value: boolean
): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  try {
    await profileSettingsDAL.update(user.id, { [field]: value })
    revalidatePath('/settings')
    revalidatePath(`/u/${user.username}`)  // requires username lookup or pass as param
    return { success: true, data: undefined }
  } catch (err) {
    console.error('[updateProfileSettings] unexpected error:', err)
    return { success: false, error: 'Couldn\'t save your privacy settings. Try again.' }
  }
}
```

### Pattern 4: Optimistic Privacy Toggle (React 19)

```typescript
// src/components/settings/PrivacyToggleRow.tsx
'use client'
import { useOptimistic } from 'react'

// Source: node_modules/next/dist/docs/01-app/02-guides/forms.md (optimistic updates section)

export function PrivacyToggleRow({
  label,
  description,
  field,
  initialValue,
  action,
}: {
  label: string
  description: string
  field: string
  initialValue: boolean
  action: (value: boolean) => Promise<ActionResult<void>>
}) {
  const [optimisticValue, setOptimistic] = useOptimistic(initialValue)

  async function handleToggle() {
    const newValue = !optimisticValue
    setOptimistic(newValue)
    const result = await action(newValue)
    if (!result.success) {
      // revert happens automatically when the server response comes back
      // and the optimistic state is reconciled with the actual server state
    }
  }

  return (
    <div className="flex items-center justify-between min-h-12">
      <div>
        <p className="text-sm font-normal">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={handleToggle}
        className={cn(
          "w-10 h-6 rounded-full transition-colors duration-150",
          optimisticValue ? "bg-accent" : "bg-muted"
        )}
      >
        {/* toggle thumb */}
      </button>
    </div>
  )
}
```

**Important:** `useOptimistic` is called directly from `react`, not `next/*`. It is stable in React 19 (shipped with Next.js 16 App Router). [VERIFIED: forms.md reference, package.json confirms React 19.2.4]

### Pattern 5: DAL for Profile Reads

```typescript
// src/data/profiles.ts
import 'server-only'
import { db } from '@/db'
import { profiles, profileSettings, follows } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function getProfileByUsername(username: string) {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1)
  return rows[0] ?? null
}

export async function getProfileSettings(userId: string) {
  const rows = await db
    .select()
    .from(profileSettings)
    .where(eq(profileSettings.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

export async function getFollowerCounts(userId: string): Promise<{ followers: number; following: number }> {
  // Two count queries or a single lateral join — keep simple for MVP
  const [followerResult, followingResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followingId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followerId, userId)),
  ])
  return {
    followers: followerResult[0]?.count ?? 0,
    following: followingResult[0]?.count ?? 0,
  }
}
```

### Pattern 6: Taste Tag Computation (Server-Side Pure Function)

```typescript
// src/lib/tasteTags.ts
import type { Watch } from '@/lib/types'

export function computeTasteTags(watches: Watch[], wearCountByWatch: Map<string, number>): string[] {
  const owned = watches.filter(w => w.status === 'owned')
  if (owned.length === 0) return []

  const tags: string[] = []

  // Vintage Collector: >40% pre-2000
  const vintageCount = owned.filter(w => w.productionYear && w.productionYear < 2000).length
  if (vintageCount / owned.length > 0.4) tags.push('Vintage Collector')

  // {Brand} Fan: any brand >30%
  const brandCounts: Record<string, number> = {}
  owned.forEach(w => { brandCounts[w.brand] = (brandCounts[w.brand] ?? 0) + 1 })
  for (const [brand, count] of Object.entries(brandCounts)) {
    if (count / owned.length > 0.3) { tags.push(`${brand} Fan`); break }
  }

  // Role-based tags
  const allRoles = owned.flatMap(w => w.roleTags)
  const sportCount = allRoles.filter(r => r.toLowerCase().includes('sport')).length
  const dressCount = allRoles.filter(r => r.toLowerCase().includes('dress')).length
  const diveCount = allRoles.filter(r => r.toLowerCase().includes('dive')).length

  if (sportCount / allRoles.length > 0.5) tags.push('Sport Watch Collector')
  else if (dressCount / allRoles.length > 0.5) tags.push('Dress Watch Lover')
  else if (diveCount / allRoles.length > 0.4) tags.push('Diver')

  // Daily Rotator: avg wear events / week > 5
  // wearCountByWatch is total events per watch; derive weekly avg
  // (Implementation detail: compute from total events over collection lifetime vs 7-day window — keep simple: total events / (collection age in weeks))

  return tags.slice(0, 3)
}
```

**Placement:** `src/lib/tasteTags.ts` — pure TypeScript, no DB access. Called from the Server Component page after fetching watches. No DB storage. Recomputed on each profile render. [ASSUMED: no cache needed at this scale (<500 watches); revisit if profiling shows slowness]

### Anti-Patterns to Avoid

- **Do NOT use `params` synchronously** — Next.js 16 makes it a Promise. Accessing `.username` directly without `await` will throw.
- **Do NOT control tab state with `useState`** — tabs are URL-driven. Using React state breaks deep linking and back/forward navigation.
- **Do NOT call `redirect()` inside a try/catch** — `redirect()` works by throwing a special error. Catching it swallows the redirect. Call it outside try blocks. [VERIFIED: redirect.md]
- **Do NOT hardcode dark: overrides for base colors** — use the existing CSS variable system. The `dark:` prefix is only for structural differences.
- **Do NOT import IBM Plex Sans** — the project font is Geist Sans (`--font-geist-sans`). UI-SPEC explicitly bans IBM Plex Sans.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toggle switch component | Custom CSS toggle | Build thin wrapper — no library has exact design | Base-ui has no switch primitive; build 1 component once per D-12 spec |
| Calendar date arithmetic | Custom month/week logic | Native `Date` (verified no date-fns in project) | `new Date(year, month, 0).getDate()` gives days in month; no library needed |
| Horizontal bar chart | recharts/chart.js | `div`-based bars per UI-SPEC | check `chart.tsx` first; if it only wraps recharts for complex charts, use simple div bars |
| Profile fetch + settings fetch | Two separate page fetches | Single `Promise.all([...])` in layout | Parallel fetches reduce waterfall |
| Toast/error notification | Custom component | Check if shadcn sonner is installed — it is NOT | Use existing pattern (inspect current error handling in WatchForm.tsx) |

---

## RLS Policy Strategy

### The Core Problem

Privacy-gated reads for Phase 8 mean: "User B can read User A's `wear_events` row IF `profile_settings.worn_public = true` for User A."

A naive RLS policy on `wear_events` would be:

```sql
-- BAD: Circular subquery — profile_settings SELECT policy allows all authenticated,
-- but the JOIN itself may still cause planning issues, and more critically:
-- this allows reads even when the DAL hasn't checked visibility.
CREATE POLICY wear_events_select_public ON public.wear_events FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT worn_public FROM public.profile_settings WHERE user_id = wear_events.user_id)
  );
```

This naive form works but has two risks:
1. Supabase applies this per-row — it will work correctly but requires a LATERAL join internally
2. It silently allows reads that the DAL hasn't validated — bypassing the two-layer enforcement model

### Recommended Strategy: Owner-only RLS + DAL Visibility Gate

The Phase 7 RLS already sets `wear_events` SELECT to owner-only. **Do not change this for Phase 8.** Instead:

- Keep `wear_events_select_own`: `USING (user_id = (SELECT auth.uid()))`
- The DAL reads `wear_events` for another user using the **service role** (which bypasses RLS), but ONLY after checking `profile_settings.worn_public = true`

```typescript
// src/data/wearEvents.ts — public read with DAL visibility gate
export async function getPublicWearEventsByUser(
  viewerUserId: string,  // the person requesting
  profileUserId: string  // whose events to read
): Promise<WearEvent[]> {
  // 1. Check visibility setting
  const settings = await getProfileSettings(profileUserId)
  if (!settings?.wornPublic) return []  // DAL gate

  // 2. Owner can always read their own
  if (viewerUserId === profileUserId) {
    return db.select().from(wearEvents).where(eq(wearEvents.userId, profileUserId))
  }

  // 3. Non-owner, settings say public — service role bypasses RLS
  return db.select().from(wearEvents).where(eq(wearEvents.userId, profileUserId))
}
```

**Why this works:** The Drizzle `db` client uses the service role key (set in `@/db`), which bypasses RLS. RLS is the safety net for direct anon-key queries. The DAL is the application-layer gate. Two-layer enforcement as specified in D-15. [VERIFIED: existing DAL uses service role by inspecting db.ts pattern from Phase 5; ASSUMED: `@/db` uses service role — verify before implementing]

### New RLS Migration Needed

For Phase 8, the existing `wear_events` RLS stays as-is (owner-only). **No new RLS policies needed for wear_events** since the service role DAL handles cross-user reads.

However, a **new migration IS needed** for the `watches` schema addition (`notes_public`, `notes_updated_at`). The existing `watches` RLS from Phase 6 already restricts to owner — no change needed there either. The DAL handles public note reads via the same pattern.

**Migration file needed:**
```sql
-- Phase 8: Add notes visibility columns to watches
ALTER TABLE public.watches
  ADD COLUMN notes_public boolean NOT NULL DEFAULT true,
  ADD COLUMN notes_updated_at timestamptz;

-- No RLS changes needed: watches SELECT is already owner-only (Phase 6)
-- Public note reads go through DAL with profile_settings check
```

**Migration ordering:**
1. `supabase/migrations/{timestamp}_phase8_notes_columns.sql` — `ALTER TABLE watches ADD COLUMN`
2. Drizzle schema update (`src/db/schema.ts`) to add the two columns — run `drizzle-kit generate` to produce matching Drizzle migration
3. Apply Drizzle migration (`drizzle-kit push`) to sync Drizzle meta — but the actual SQL was already applied via supabase migration
4. Alternatively: let Drizzle generate the migration SQL and use it as the Supabase migration (consistent with Phase 7 approach)

**Per Phase 7 pattern:** Generate the Drizzle migration, use that SQL as the Supabase migration file, push via `supabase db push --linked`. Do not use `drizzle-kit push` directly against prod.

---

## Calendar Component Approach

No external date library is available (date-fns absent from package.json). Build a custom week-grid calendar using native `Date` arithmetic.

```typescript
// Key date arithmetic for WornCalendar — native Date only
function getCalendarGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0) // day 0 of next month = last day of this month
  const startDow = firstDay.getDay() // 0 = Sunday
  const weeks: Date[][] = []
  let current = new Date(firstDay)
  current.setDate(1 - startDow) // back up to the Sunday of the first week

  while (current <= lastDay || current.getDay() !== 0) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
    if (current > lastDay && current.getDay() === 0) break
  }
  return weeks
}
```

**State management:** `currentMonth` and `currentYear` in `useState` — local to the `WornCalendar` component. No global state needed. [VERIFIED: UI-SPEC confirms custom calendar with native Date]

---

## Existing Filter/Sort Utilities to Reuse

From `src/app/insights/page.tsx` (confirmed by inspection):

- `calculateDistribution(watches, getValues)` — computes tag distribution percentages for Style/Role charts
- `observationCopy(goal, ownedWatches)` — collection observations string (reusable for Stats tab)
- `daysSince(dateString)` from `src/lib/wear.ts` — used in "Last worn X ago" labels

From `src/components/watch/WatchCard.tsx`:
- `getSafeImageUrl(url)` from `src/lib/images.ts` — always use for image URLs
- Existing `Image` component with `fill` + `sizes` pattern

From `src/data/wearEvents.ts`:
- `getWearEventsByWatch(userId, watchId)` — returns all events per watch, ordered desc
- `getMostRecentWearDates(userId, watchIds[])` — batch query for multiple watches

**New DAL functions needed in `src/data/wearEvents.ts`:**
- `getAllWearEventsByUser(userId)` — all wear events for a user (Worn tab timeline + calendar)

**Existing component patterns to match:**
- `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` for Collection tab grid
- `WatchCard` base for `ProfileWatchCard` — extend with `lastWornDate` prop and status badge overlay

---

## Component Inventory (from UI-SPEC.md)

| Component | File Path | Key Dependencies |
|-----------|-----------|-----------------|
| ProfileHeader | `src/components/profile/ProfileHeader.tsx` | AvatarDisplay, TasteTagPill, Badge |
| TasteTagPill | `src/components/profile/TasteTagPill.tsx` | Badge with accent override |
| ProfileTabs | `src/components/profile/ProfileTabs.tsx` | `usePathname`, Link, Tabs primitives |
| ProfileWatchCard | `src/components/profile/ProfileWatchCard.tsx` | WatchCard extension |
| FilterChips | `src/components/profile/FilterChips.tsx` | Badge (interactive) |
| WornTimeline | `src/components/profile/WornTimeline.tsx` | Card |
| WornCalendar | `src/components/profile/WornCalendar.tsx` | Native Date only |
| ViewTogglePill | `src/components/profile/ViewTogglePill.tsx` | Two buttons in pill wrapper |
| NoteRow | `src/components/profile/NoteRow.tsx` | Card, DropdownMenu, AlertDialog |
| NoteVisibilityPill | `src/components/profile/NoteVisibilityPill.tsx` | Badge + Server Action call |
| StatsCard | `src/components/profile/StatsCard.tsx` | Card |
| HorizontalBarChart | `src/components/profile/HorizontalBarChart.tsx` | div-based (no recharts) |
| CollectionObservations | `src/components/profile/CollectionObservations.tsx` | Card |
| LockedProfileState | `src/components/profile/LockedProfileState.tsx` | Lock (Lucide), Button |
| PrivacyToggleRow | `src/components/settings/PrivacyToggleRow.tsx` | `useOptimistic` |
| SettingsSection | `src/components/settings/SettingsSection.tsx` | Card |
| AvatarDisplay | `src/components/profile/AvatarDisplay.tsx` | next/image, initials fallback |
| ProfileEditForm | `src/components/profile/ProfileEditForm.tsx` | Input, Textarea, Label, Button |

**Alert for NoteRow:** UI-SPEC requires `AlertDialog` for "Remove Note" confirmation. `dialog.tsx` exists in `/ui/`. Verify it exports `AlertDialog` or adapt the existing `Dialog` component.

---

## Common Pitfalls

### Pitfall 1: Forgetting `await params` in Next.js 16
**What goes wrong:** `params.username` is `undefined` or throws; profile not found; 404 appears for valid profiles.
**Why it happens:** Next.js 16 changed `params` from a sync object to a Promise. Pre-v15 code worked without `await`.
**How to avoid:** Always type `params` as `Promise<{...}>` and `await params` before destructuring in Server Components; use `use(params)` in Client Components.
**Warning signs:** TypeScript won't catch this if types are loose. Add explicit type annotation.

### Pitfall 2: `redirect()` called inside try/catch
**What goes wrong:** The redirect never fires; user stays on error page or sees blank screen.
**Why it happens:** `redirect()` works by throwing a special `NEXT_REDIRECT` error. A catch block catches it and swallows it.
**How to avoid:** Call `redirect()` outside any try/catch. Fetch data inside try/catch, redirect after it resolves.
**Warning signs:** Page renders but URL doesn't change after expected redirect.

### Pitfall 3: DAL service role assumption
**What goes wrong:** `getPublicWearEventsByUser` returns empty array for all users.
**Why it happens:** If `@/db` uses the anon key rather than service role, RLS blocks cross-user reads.
**How to avoid:** Verify `@/db/index.ts` uses `SUPABASE_SERVICE_ROLE_KEY` (not `NEXT_PUBLIC_SUPABASE_ANON_KEY`). All existing DALs use `import 'server-only'` which is the right gate — verify the DB client key.
**Warning signs:** Owner reads work; cross-user reads silently return empty arrays.

### Pitfall 4: N+1 on Worn tab
**What goes wrong:** Worn tab loads 500 watch thumbnails with 500 individual `getWatchById` calls.
**Why it happens:** WornCalendar maps over wear events and fetches each watch individually.
**How to avoid:** Batch-fetch all watches in a single query before rendering the calendar. Pass `watchMap: Map<watchId, Watch>` to the calendar component.
**Warning signs:** Worn tab loads slowly; DB query logs show many identical single-row SELECTs.

### Pitfall 5: Tabs re-fetch profile on every tab switch
**What goes wrong:** Profile header flickers or shows loading state on each tab navigation.
**Why it happens:** Profile data fetched inside tab pages instead of shared layout.
**How to avoid:** Fetch profile and settings in `src/app/u/[username]/layout.tsx`, pass to children via shared layout data (Next.js layout streaming). Tab pages only fetch their own tab data.
**Warning signs:** Network waterfall shows profile fetch on every tab click.

### Pitfall 6: `useOptimistic` state not reverting on error
**What goes wrong:** Privacy toggle shows optimistic state even after a server error; appears toggled when it isn't.
**Why it happens:** `useOptimistic` revert relies on the parent component re-rendering with the server truth. If `revalidatePath` is not called on error, the parent doesn't re-render.
**How to avoid:** On error path in the Server Action, do NOT call `revalidatePath` — the optimistic state will revert when the server returns the error response and the component re-renders with the original `initialValue` prop. Confirm this works via testing; alternatively add explicit state tracking.

### Pitfall 7: Notes tab shows watches without notes
**What goes wrong:** Notes tab shows all watches, including those with empty `notes` field.
**Why it happens:** SQL `WHERE notes IS NOT NULL` doesn't filter out empty strings.
**How to avoid:** Use `WHERE notes IS NOT NULL AND notes != ''` in the DAL query, or filter in application code after fetch.

### Pitfall 8: Profile settings row missing for existing users
**What goes wrong:** Privacy toggles throw or return null on first visit.
**Why it happens:** The Phase 7 trigger creates `profile_settings` on new signup, but existing users may not have a row if the backfill step wasn't completed.
**How to avoid:** DAL `getProfileSettings` should handle null row gracefully by returning safe defaults (`all public`). Alternatively use `INSERT ... ON CONFLICT DO NOTHING` in the trigger backfill. Verify the Phase 7 Task 3 backfill was applied.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `params` as sync object | `params` as `Promise<{...}>` | Next.js 15 → 16 transition | Must `await params` in Server Components |
| `useOptimistic` as experimental | Stable in React 19 | React 19.0 | Import from `react`, not experimental APIs |
| getStaticPaths | generateStaticParams | Next.js 13+ | Profile pages are dynamic; don't use generateStaticParams (user content, not static) |

---

## Suggested Plan Breakdown

### Plan 08-01: Schema Migration + Profile DAL

**Wave 1 (no dependencies)**

- Drizzle schema: add `notes_public: boolean` and `notes_updated_at: timestamp` to `watches` table
- Generate Drizzle migration SQL; use as Supabase migration file with timestamp `20260420000003_phase8_notes_columns.sql`
- Push via `supabase db push --linked`
- Create `src/data/profiles.ts` — `getProfileByUsername`, `getProfileSettings`, `updateProfileSettings`, `updateProfile`, `getFollowerCounts`
- Create `src/data/wearEvents.ts` addition — `getAllWearEventsByUser(userId)` (all events for worn tab)
- Create `src/app/actions/profile.ts` — `updateProfileSettings`, `updateProfile`, `updateNoteVisibility`
- Create `src/lib/tasteTags.ts` — `computeTasteTags(watches, wearCountByWatch)` pure function

### Plan 08-02: Profile Route Shell + Header

**Wave 2 (requires Plan 08-01)**

- `src/app/u/[username]/layout.tsx` — fetches profile, settings, follower counts; renders `ProfileHeader` + `ProfileTabs`; passes data to children
- `src/app/u/[username]/page.tsx` — `redirect()` to `/u/[username]/collection`
- `src/components/profile/ProfileHeader.tsx` — avatar, username, bio, stats row, taste tags, edit mode with `ProfileEditForm`
- `src/components/profile/AvatarDisplay.tsx` — URL-based with initials fallback
- `src/components/profile/TasteTagPill.tsx`
- `src/components/profile/ProfileTabs.tsx` — URL-driven active state
- `src/components/profile/ProfileEditForm.tsx` — inline edit for display name, avatar URL, bio
- `src/components/profile/LockedProfileState.tsx` — lock icon + "This profile is private." + Follow button

### Plan 08-03: Tab Content Pages (Collection, Wishlist, Worn, Notes, Stats)

**Wave 3 (requires Plan 08-02)**

- `src/app/u/[username]/[tab]/page.tsx` — routes `tab` to correct content component; handles unknown tab with 404/redirect
- `src/components/profile/ProfileWatchCard.tsx` — extends WatchCard with last-worn + status badge
- `src/components/profile/FilterChips.tsx` — derived from roleTags, interactive
- Collection tab: grid + filter chips + search + add-watch card (own-only)
- Wishlist tab: grid with target price + notes
- `src/components/profile/WornTimeline.tsx` + `WornCalendar.tsx` + `ViewTogglePill.tsx`
- `src/components/profile/NoteRow.tsx` + `NoteVisibilityPill.tsx` (AlertDialog for remove)
- Stats tab: `StatsCard`, `HorizontalBarChart`, `CollectionObservations`

### Plan 08-04: Settings Page

**Wave 4 (requires Plan 08-01; can parallel with 08-03)**

- `src/app/settings/page.tsx` — server component; fetches current user's settings
- `src/components/settings/SettingsSection.tsx` — card wrapper with section title
- `src/components/settings/PrivacyToggleRow.tsx` — `useOptimistic` toggle; calls `updateProfileSettings`
- Settings page layout: Privacy Controls (functional) + Appearance/Notifications/Data/Account sections (non-functional rendered structure)
- Delete Account dialog (renders but non-functional per D-12 out-of-scope)

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is code/schema changes only. External dependencies (Supabase, Vercel) are production-verified from Phases 6-7. No new external tools required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + React Testing Library 16.3.2 |
| Config file | vitest.config.ts (from Phase 2 test foundation) |
| Quick run command | `npm test -- --run src/lib/tasteTags.test.ts` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-10 | computeTasteTags returns correct tags for collection compositions | unit | `npm test -- --run src/lib/tasteTags.test.ts` | No — Wave 0 |
| D-06 | taste tag rules: vintage, brand fan, sport/dress/dive, daily rotator | unit | same file | No — Wave 0 |
| D-13 | notes_public default true, updateNoteVisibility flips correctly | integration | Manual (DB required) | No |
| PRIV-06 | LockedProfileState renders when profile_public=false | unit | `npm test -- --run src/components/profile/LockedProfileState.test.tsx` | No — Wave 0 |
| PRIV-05 | DAL visibility gate returns [] when worn_public=false | unit (mocked) | `npm test -- --run src/data/profiles.test.ts` | No — Wave 0 |

### Sampling Rate

- Per task commit: `npm test -- --run`
- Per wave merge: `npm test -- --run`
- Phase gate: Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- `src/lib/tasteTags.test.ts` — covers PROF-10, D-06 taste tag rules
- `src/components/profile/LockedProfileState.test.tsx` — covers PRIV-06 render condition
- No new framework install needed (Vitest already configured)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` in every Server Action (existing pattern) |
| V3 Session Management | no | Handled by Supabase Auth (Phase 4) |
| V4 Access Control | yes | DAL visibility gate (PRIV-05); owner check before edit mutations |
| V5 Input Validation | yes | Zod schemas on all Server Action inputs (existing pattern) |
| V6 Cryptography | no | No new crypto surface |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user profile data read | Information Disclosure | DAL visibility gate checks `profile_settings`; owner-only RLS blocks direct anon-key reads |
| Username enumeration via profile 404 | Information Disclosure | Return same `notFound()` response whether profile doesn't exist or is private (Letterboxd pattern) |
| Privilege escalation via Server Action | Elevation of Privilege | `getCurrentUser()` called first in every SA; userId never trusted from client |
| Mass assignment on profile update | Tampering | Zod schema in `updateProfile` SA — only allow display_name, avatar_url, bio fields |
| Note visibility bypass | Information Disclosure | `notes_public` flag stored server-side; client cannot supply visibility value directly |
| IDOR on note visibility toggle | Elevation of Privilege | `updateNoteVisibility(watchId)` SA checks `watch.userId === user.id` before patching |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@/db` index uses service role key, not anon key | RLS Strategy | Cross-user DAL reads return empty arrays; privacy gate silently fails |
| A2 | Phase 7 Task 3 backfill created `profile_settings` rows for all existing users | Pitfall 8 | Existing users see errors or null on settings page; need backfill script in Plan 08-01 |
| A3 | `computeTasteTags` doesn't need caching at <500 watches | Taste Tags section | If perf profiling shows slowness, can memoize or move to DB stored proc |
| A4 | `wearEvents.wornDate` is stored as ISO date string `YYYY-MM-DD` | Calendar component | Calendar date matching logic must use same string format; confirmed by Phase 7 DAL |
| A5 | `revalidatePath('/u/[username]/[tab]', 'layout')` syntax valid in Next.js 16 | Server Actions | Profile data may not refresh after edit; use literal path with layout type param |

---

## Open Questions

1. **`@/db` key verification**
   - What we know: All DALs use `import 'server-only'` and `@/db`
   - What's unclear: Whether `@/db/index.ts` uses SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY
   - Recommendation: Read `src/db/index.ts` in Plan 08-01 to verify. If anon key, switch to service role for cross-user reads.

2. **Username lookup for revalidatePath in Settings page**
   - What we know: `updateProfileSettings` SA needs to call `revalidatePath('/u/[username]')` but only knows `user.id`
   - What's unclear: Whether to JOIN `profiles` inside the SA or accept `username` as a parameter
   - Recommendation: Accept `username` as a parameter to the SA (caller supplies it from page context); validate it belongs to `getCurrentUser()` inside the SA.

3. **AlertDialog vs Dialog for note removal**
   - What we know: `dialog.tsx` exists in `/ui/`; UI-SPEC requires AlertDialog for "Remove Note"
   - What's unclear: Whether the existing `dialog.tsx` exports `AlertDialog` primitives
   - Recommendation: Inspect `dialog.tsx` exports in Plan 08-03. If no AlertDialog, use the Dialog component with destructive variant button — same UX pattern.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md` — params as Promise pattern
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` — page component props
- `node_modules/next/dist/docs/01-app/02-guides/forms.md` — useOptimistic pattern
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` — redirect outside try/catch
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` — revalidatePath signature
- `src/db/schema.ts` — confirmed table structure for profiles, profileSettings, wearEvents, watches
- `src/data/watches.ts` — confirmed DAL pattern (mapRowToWatch, mapDomainToRow)
- `src/data/wearEvents.ts` — confirmed wear events DAL functions
- `src/app/actions/watches.ts` — confirmed ActionResult pattern, getCurrentUser usage
- `src/components/ui/tabs.tsx` — confirmed base-ui Tabs pattern with data-active
- `src/components/layout/HeaderNav.tsx` — confirmed usePathname active state pattern
- `src/app/globals.css` — confirmed CSS token system, dark mode variables
- `package.json` — confirmed React 19.2.4, recharts ^3.8.0 present, date-fns absent
- `supabase/migrations/20260420000001_social_tables_rls.sql` — confirmed existing RLS policies

### Secondary (MEDIUM confidence)
- `src/app/insights/page.tsx` — distribution calculation utilities for Stats tab reuse (inspected, confirmed)

### Tertiary (LOW confidence)
- None — all claims verified against codebase or official docs

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified from package.json
- Architecture: HIGH — patterns verified from existing codebase and official Next.js 16 docs
- RLS Strategy: MEDIUM — logic is sound; A1 assumption about service role key must be verified
- Taste Tag Computation: HIGH — pure function, deterministic rules confirmed from CONTEXT.md
- Calendar: HIGH — native Date arithmetic verified sufficient; date-fns confirmed absent

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable stack; 30-day window)
