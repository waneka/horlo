# Phase 5: Zustand Cleanup, Similarity Rewire & Prod DB Bootstrap — Research

**Researched:** 2026-04-13
**Domain:** Next.js 16 Server Component conversion, Zustand demotion, Supabase/Drizzle prod ops
**Confidence:** HIGH (all critical claims verified against bundled Next.js 16 docs and live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (scope):** MIG-01 and MIG-02 are removed. No localStorage import banner. No Zod-validated bulk import. Phase 5 starts the cloud collection empty for the developer-user; prior localStorage state is abandoned, not migrated.
- **D-02 (cleanup):** No localStorage cleanup code ships. Existing keys (`watch-collection`, `user-preferences`) become orphaned. Browser retains them until user clears site data manually.
- **Runbook location:** `docs/deploy-db-setup.md` (locked in success criterion 4).
- **Prod Supabase project ref:** `wdntzsckjaoqodsyscns` (locked).
- **Prod app URL:** `horlo.app` (locked).
- **Migration command in prod:** `drizzle-kit migrate` (Phase 3 D-16 names it — locked).
- **Zustand persist removal:** `watchStore` must lose `persist` middleware, CRUD methods, and all collection data storage.
- **Preferences store removal:** `usePreferencesStore` is removed entirely. Preferences flow from the DAL via Server Components.

### Claude's Discretion

- Exact final shape of `watchStore` after demotion (filter keys, whether to keep Zustand at all or move to per-page `useState`/URL params).
- Whether `getFilteredWatches` becomes a pure helper `filterWatches(watches, filters)` in `src/lib/filtering.ts` or a store selector accepting `watches` as an argument.
- Server-Component data flow: single shared collection provider vs. per-page fetch.
- Filter state reset behavior on navigation (reset recommended as "ephemeral").
- Per-file classification for the 12 Zustand consumers.
- Loading/pending UI placement (which component holds `useTransition`).
- Whether to also smoke-test add-watch during OPS-01 execution (success criterion only requires signup+logout).

### Deferred Ideas (OUT OF SCOPE)

- localStorage import banner / self-service migration flow (dropped, not deferred)
- Zod-validated bulk import Server Action (dropped, not deferred)
- Optimistic UI updates after mutations
- Filter state persistence across navigation
- Multi-environment runbook (staging + prod)
- CI/CD pipeline for Vercel deploys
- Shared "collection provider" context wrapping the whole authenticated layout

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-05 | Similarity engine remains client-side and receives collection + preferences as props instead of reading from Zustand | SimilarityBadge currently reads both stores directly (verified in source). `analyzeSimilarity` already accepts `(targetWatch, collection, preferences)` — pure function, no store dependency. Rewire is prop-threading only. |
| OPS-01 | `docs/deploy-db-setup.md` runbook for solo operator to link prod Supabase, apply all migrations, push Drizzle schema, set Vercel env vars, smoke-test signup+logout on horlo.app | One migration file exists (`20260413000000_sync_auth_users.sql`). No drizzle migrations folder yet — `drizzle-kit generate` + `drizzle-kit migrate` must be documented. DATABASE_URL footgun (port 5432 vs 6543) is well-documented below. |

</phase_requirements>

---

## Summary

Phase 5 has two parallel tracks. Track A is a mechanical refactor: strip `persist` middleware and CRUD from `watchStore`, delete `preferencesStore`, convert five `'use client'` pages to Server Components that fetch from the existing DAL, and update 12 Zustand-consuming files to receive data via props or Server Actions instead. Track B is operational: write and execute a verified runbook that bootstraps the prod Supabase project (`wdntzsckjaoqodsyscns`) and Vercel deployment (`horlo.app`).

**Critical Next.js 16 deviation from training data:** The mutation-refresh pattern changed. `router.refresh()` from `next/navigation` is still available on the client, but the idiomatic Next.js 16 Server Action pattern for refreshing data uses `refresh()` from `next/cache` (called inside a Server Action) OR `revalidatePath()` from `next/cache`. The CONTEXT.md correctly calls out `router.refresh()` as a valid client-side option, but `revalidatePath('/')` called in the existing Server Actions (already wired in Phase 3 D-13) is the primary mechanism — it is already present and working. No additional refresh call is needed in client components if the Server Action calls `revalidatePath`. The only case where a client-side navigation is needed is `WatchForm` after create/edit, which calls `router.push('/')` to navigate away anyway.

**Primary recommendation:** Keep Zustand for filter state (Option A) — the filter components (`FilterBar`, `StatusToggle`, `WatchGrid`) are tightly coupled to Zustand's `setFilter` / `filters` interface and share filter state across siblings. Rewriting them to `useState` would require prop-drilling or a context layer, making the diff larger. Remove `persist` and all collection data from the store; filters become ephemeral Zustand state with zero localStorage interaction.

---

## Standard Stack

This phase has no new library dependencies. All tools are already installed.

### Core (already installed)
| Library | Installed Version | Purpose in Phase 5 |
|---------|------------------|---------------------|
| Next.js | 16.2.3 | Server Component conversion; `refresh()` / `revalidatePath()` |
| Zustand | ^5.0.12 | Retained for filter-only ephemeral state after demotion |
| `src/data/watches.ts` | existing DAL | `getWatchesByUser`, `getWatchById` — already implemented |
| `src/data/preferences.ts` | existing DAL | `getPreferencesByUser` — already implemented |
| `src/lib/auth.ts` | existing | `getCurrentUser()` — called at the top of every Server Component page |
| drizzle-kit | 0.31.10 (devDep) | `drizzle-kit generate` + `drizzle-kit migrate` for prod DB bootstrap |
| Supabase CLI | 2.90.0 (global) | `supabase link` + `supabase db push` for prod trigger migration |

### New installations required for OPS-01
| Tool | Install Command | Purpose |
|------|-----------------|---------|
| Vercel CLI | `npm i -g vercel` | `vercel env add` for prod env var setup |

**Version verification:**
- `drizzle-kit` — `npx drizzle-kit --version` → v0.31.10 [VERIFIED: local]
- `supabase` CLI — `supabase --version` → 2.90.0 [VERIFIED: local]
- `drizzle-orm` — ^0.45.2 [VERIFIED: package.json]
- No drizzle migrations folder exists yet — `drizzle-kit generate` must be run before `drizzle-kit migrate` [VERIFIED: `ls drizzle/` returns empty]

---

## Architecture Patterns

### Pattern 1: Async Server Component Page — The Canonical Conversion

This is the pattern every converted page must follow. Verified from bundled Next.js 16 docs (`05-server-and-client-components.md`, `06-fetching-data.md`).

**Rules:**
- No `'use client'` directive at the top of the file (absence = Server Component)
- Page function is `async` (can `await` directly)
- `params` is `Promise<{ id: string }>` — must be `await`-ed, NOT `use(params)` (that hook is client-only)
- Data fetching calls DAL directly; no hooks, no store access
- Pass fetched data down as props to client subtree

```typescript
// Source: node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
// + node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md

// src/app/page.tsx — AFTER conversion
import { getCurrentUser } from '@/lib/auth'
import { getWatchesByUser } from '@/data/watches'
import { CollectionView } from '@/components/watch/CollectionView'
import { redirect } from 'next/navigation'

export default async function Home() {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    redirect('/login')
  }
  const watches = await getWatchesByUser(user.id)
  return <CollectionView watches={watches} />
}
```

```typescript
// src/app/watch/[id]/page.tsx — AFTER conversion (dynamic segment)
import { getCurrentUser } from '@/lib/auth'
import { getWatchById } from '@/data/watches'
import { notFound } from 'next/navigation'

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params   // await, NOT use(params) — no 'use client' in file
  const user = await getCurrentUser()  // throws UnauthorizedError → proxy catches redirect
  const watch = await getWatchById(user.id, id)
  if (!watch) notFound()
  return <WatchDetail watch={watch} />
}
```

### Pattern 2: Mutation Refresh — How Stale UI Is Avoided After Server Action

[VERIFIED: bundled Next.js 16 docs `07-mutating-data.md`]

Two complementary mechanisms:

**Mechanism A — `revalidatePath` inside Server Action (already wired):**
The existing Server Actions in `src/app/actions/watches.ts` already call `revalidatePath('/')` (Phase 3 D-13). After any watch mutation, the next time the Server Component page renders, it fetches fresh data from the DAL. No client-side refresh call needed.

**Mechanism B — `refresh()` from `next/cache` (Next.js 16 Server Action pattern):**
For read-your-own-writes (user sees change immediately), call `refresh()` inside the Server Action instead of or in addition to `revalidatePath`. This is the Next.js 16 canonical approach.

```typescript
// Source: node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
'use server'
import { refresh } from 'next/cache'  // Next.js 16 — import from next/cache, NOT next/navigation

export async function createPost(formData: FormData) {
  // ... mutate ...
  refresh()  // triggers client router refresh, re-renders Server Component subtree
}
```

**Important:** `router.refresh()` from `next/navigation` still exists and works on the client side as a hook-based trigger. The CONTEXT.md references it as a valid approach for `WatchForm` after mutation. However, `revalidatePath('/')` in the Server Action is already sufficient — the page will re-render with fresh data on next load. `router.push('/')` in `WatchForm.handleSubmit` after a create/edit naturally triggers a server re-render of the home page.

**Conclusion:** The existing `revalidatePath` calls in Server Actions + `router.push('/')` after form submit cover the refresh need completely. No new `router.refresh()` calls are needed. The only edge case is `WatchDetail`'s "Flag as deal" / "Mark as worn" inline mutations — these will need to trigger `router.refresh()` client-side after the Server Action resolves (since there's no navigation away).

### Pattern 3: Client Component With Server Action Call

```typescript
// Source: node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
'use client'
import { useTransition } from 'react'
import { markAsWorn } from '@/app/actions/watches'

export function WornButton({ watchId }: { watchId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await markAsWorn(watchId)
          if (result.success) router.refresh()  // client-side refresh for inline mutations
        })
      }}
    >
      {isPending ? 'Marking...' : 'Mark as Worn'}
    </button>
  )
}
```

### Pattern 4: Demoted Zustand Store — Filter Only

```typescript
// src/store/watchStore.ts — AFTER demotion
import { create } from 'zustand'
import type { Watch, WatchStatus } from '@/lib/types'

export interface WatchFilters {
  status: 'all' | WatchStatus
  styleTags: string[]
  roleTags: string[]
  dialColors: string[]
  priceRange: { min: number | null; max: number | null }
}

interface WatchFilterStore {
  filters: WatchFilters
  setFilter: <K extends keyof WatchFilters>(key: K, value: WatchFilters[K]) => void
  resetFilters: () => void
}

const defaultFilters: WatchFilters = {
  status: 'all',
  styleTags: [],
  roleTags: [],
  dialColors: [],
  priceRange: { min: null, max: null },
}

export const useWatchStore = create<WatchFilterStore>()((set) => ({
  filters: defaultFilters,
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),
}))
```

**What is removed:** `watches: Watch[]`, `addWatch`, `updateWatch`, `deleteWatch`, `markAsWorn`, `getWatchById`, `getFilteredWatches`, `persist(...)` wrapper, `version: 2`, `migrate`, `partialize`.

**What stays:** `filters`, `setFilter`, `resetFilters`. The exported `WatchFilters` interface stays (consumed by `FilterBar`, `StatusToggle`, `WatchGrid`).

### Pattern 5: Pure Filter Function

`getFilteredWatches` currently is a store selector. After demotion it becomes a pure function in `src/lib/filtering.ts`:

```typescript
// src/lib/filtering.ts — new file
import type { Watch } from '@/lib/types'
import type { WatchFilters } from '@/store/watchStore'

export function filterWatches(watches: Watch[], filters: WatchFilters): Watch[] {
  return watches.filter((watch) => {
    if (filters.status !== 'all' && watch.status !== filters.status) return false
    if (filters.styleTags.length > 0 && !filters.styleTags.some((t) => watch.styleTags.includes(t))) return false
    if (filters.roleTags.length > 0 && !filters.roleTags.some((t) => watch.roleTags.includes(t))) return false
    if (filters.dialColors.length > 0 && watch.dialColor && !filters.dialColors.includes(watch.dialColor)) return false
    const { min, max } = filters.priceRange ?? { min: null, max: null }
    if (min != null || max != null) {
      if (watch.marketPrice == null) return false
      if (min != null && watch.marketPrice < min) return false
      if (max != null && watch.marketPrice > max) return false
    }
    return true
  })
}
```

This function is called in the client component that receives `watches` as a prop from the Server Component page.

### Recommended Project Structure After Phase 5

```
src/
├── app/
│   ├── page.tsx                    # Server Component — fetches watches + passes to client subtree
│   ├── insights/page.tsx           # Server Component — fetches watches + prefs, no 'use client'
│   ├── preferences/page.tsx        # Server Component — fetches prefs, passes to PreferencesClient
│   ├── watch/[id]/page.tsx         # Server Component — awaits params, calls getWatchById
│   └── watch/[id]/edit/page.tsx    # Server Component — awaits params, calls getWatchById
├── components/
│   ├── watch/
│   │   ├── CollectionView.tsx      # NEW 'use client' wrapper: holds filters from watchStore, calls filterWatches
│   │   ├── WatchGrid.tsx           # stays 'use client', reads filter from watchStore (no CRUD)
│   │   ├── WatchCard.tsx           # stays 'use client', receives collection+prefs as props (no store)
│   │   ├── WatchForm.tsx           # stays 'use client', calls Server Actions (no store)
│   │   └── WatchDetail.tsx         # stays 'use client', calls Server Actions (no store)
│   ├── filters/
│   │   ├── FilterBar.tsx           # stays 'use client', reads/writes watchStore filter state only
│   │   └── StatusToggle.tsx        # stays 'use client', reads/writes watchStore filter state only
│   └── insights/
│       ├── SimilarityBadge.tsx     # stays 'use client', receives collection+prefs as props (no store)
│       └── BalanceChart.tsx        # already prop-driven, no change
├── store/
│   └── watchStore.ts               # filter-only, no persist, no CRUD
├── lib/
│   └── filtering.ts                # NEW pure filterWatches() helper
└── docs/
    └── deploy-db-setup.md          # NEW OPS-01 runbook
```

### Anti-Patterns to Avoid

- **Re-adding `'use client'` to a page file** during refactor defeats DATA-05. The Server Component conversion is the point — doing data fetching in `useEffect` on a client component is not equivalent.
- **`use(params)` in a Server Component** — `use()` is a client-only React hook. Async Server Components use `await params` directly.
- **Calling `router.refresh()` when `revalidatePath` already covers the case** — redundant for post-create/edit navigations since `router.push('/')` re-renders the page server-side anyway.
- **Passing non-serializable values as props from Server to Client** — `Watch[]` and `UserPreferences` are plain objects, safe to pass. [VERIFIED: Next.js 16 docs state props must be serializable]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data freshness after mutation | Custom cache invalidation | `revalidatePath('/')` in Server Action | Already wired in Phase 3 D-13 |
| Watch-not-found in Server Component | Custom error class | `notFound()` from `next/navigation` | Integrates with Next.js error boundary |
| Auth redirect from Server Component | Manual redirect logic | `redirect('/login')` from `next/navigation` (or let proxy handle it) | Already handled by `proxy.ts` deny-by-default |
| Filter logic | Store-internal filtering | `filterWatches(watches, filters)` in `src/lib/filtering.ts` | Already implemented in store; extract as pure function |
| Similarity engine | Any new compute layer | `analyzeSimilarity(watch, collection, preferences)` in `src/lib/similarity.ts` | Already pure — just pass props |

---

## Per-File Classification (12 Zustand Consumers)

This is the key planning input. Each file is classified as (A) Server Component reading DAL, (B) client component receiving props, or (C) client component calling Server Action.

| File | Classification | Notes |
|------|---------------|-------|
| `src/app/page.tsx` | **(A) → Server Component** | Remove `'use client'`, `useWatchStore`, `useIsHydrated`. Fetch watches via `getWatchesByUser`. Pass to new `CollectionView` client wrapper. |
| `src/app/insights/page.tsx` | **(A) → Server Component** | Remove `'use client'`, both stores, `useIsHydrated`, all `useMemo`. All distribution math moves to server. Pass computed data to child components. `SimilarityBadge` not used here — it lives on watch detail. |
| `src/app/preferences/page.tsx` | **(A) → Server Component shell** | Remove `'use client'`, `usePreferencesStore`, `useIsHydrated`. Fetch prefs via `getPreferencesByUser`. Pass to `PreferencesClient` (new client component wrapping the form). |
| `src/app/watch/[id]/page.tsx` | **(A) → Server Component** | Remove `'use client'`, `useWatchStore`, `useIsHydrated`, `use(params)`. Use `await params`, `await getWatchById(user.id, id)`. Call `notFound()` if null. |
| `src/app/watch/[id]/edit/page.tsx` | **(A) → Server Component** | Same as detail page. Pass `watch` to `WatchForm mode="edit"`. |
| `src/components/watch/WatchGrid.tsx` | **(B) client receives props** | Remove `useWatchStore` read of `statusFilter`. Instead, accept `watches: Watch[]` and render them (filtering already done by parent). Note: currently reads `statusFilter` for deal-sorting on wishlist — this sort logic moves to where filtering happens (the `CollectionView` wrapper or `filterWatches`). |
| `src/components/watch/WatchCard.tsx` | **(B) client receives props** | Remove `usePreferencesStore` and `useWatchStore`. Add props `collection: Watch[]` and `preferences: UserPreferences`. Used for `computeGapFill`. All call sites (WatchGrid) must be updated to pass these. |
| `src/components/watch/WatchForm.tsx` | **(C) client calls Server Action** | Remove `useWatchStore().addWatch` / `updateWatch`. On create: call `addWatch(formData)` Server Action, on success `router.push('/')`. On edit: call `editWatch(watchId, formData)` Server Action, on success `router.push('/')`. Wrap in `useTransition` for pending state. |
| `src/components/watch/WatchDetail.tsx` | **(C) client calls Server Action** | Remove `useWatchStore` CRUD calls and `usePreferencesStore`. Receive `collection: Watch[]` and `preferences: UserPreferences` as props. On delete: call `removeWatch(watchId)` Server Action, then `router.push('/')`. On markAsWorn/updateWatch: call Server Action, then `router.refresh()`. Pass `collection` and `preferences` down to `SimilarityBadge`. |
| `src/components/filters/FilterBar.tsx` | **(B) client stays, reads filter store only** | Already only reads/writes `watchStore` filter state — no collection data needed. No change in classification, but `useWatchStore` now returns filter-only store. The `watches` prop for computing price max must come from the `CollectionView` parent (currently `FilterBar` computes price max from `get().watches` — this must change to a prop). |
| `src/components/filters/StatusToggle.tsx` | **(B) client stays, reads filter store only** | Reads `filters.status` and calls `setFilter`. No change needed beyond the store demotion. |
| `src/components/insights/SimilarityBadge.tsx` | **(B) client receives props** | Remove `useWatchStore` and `usePreferencesStore`. Add props: `collection: Watch[]` and `preferences: UserPreferences`. `analyzeSimilarity(watch, collection, preferences)` signature unchanged. |

**Non-obvious details:**

- `FilterBar` currently computes the price slider max from `get().watches` (line ~50 in current source). After demotion, `watches` is no longer in the store. The `CollectionView` client wrapper must pass `watches` as a prop to `FilterBar`, or `FilterBar` accepts a `maxPrice` prop.
- `WatchGrid` currently sorts by deal status using `statusFilter` from the store. This sort belongs in `filterWatches` or in the `CollectionView` wrapper — not in `WatchGrid` which should just render what it receives.
- `WatchDetail` is the most complex rewire: it needs `collection` and `preferences` for `SimilarityBadge` and `computeGapFill`. The Server Component page (`/watch/[id]/page.tsx`) must fetch both watches and preferences and pass them as props to `WatchDetail`.
- `src/app/watch/new/page.tsx` — currently a Server Component (no `'use client'`, no store). No change needed. `WatchForm` is a client component it renders; that component is the one being rewired.

---

## DAL Coverage Verification

**Finding:** `getWatchById(userId, watchId)` already exists in `src/data/watches.ts`. [VERIFIED: read file]

Signature:
```typescript
export async function getWatchById(userId: string, watchId: string): Promise<Watch | null>
```

**Behavior:** Returns `Watch | null`. Returns `null` (not a throw) if not found or wrong user — per Phase 3 D-08, not-found is an expected outcome. The Server Component page calls `notFound()` when null is returned. This is the correct pattern.

**No new DAL functions needed for Phase 5.** All required DAL functions exist:
- `getWatchesByUser(userId)` — used by home page, insights page
- `getWatchById(userId, watchId)` — used by detail and edit pages
- `getPreferencesByUser(userId)` — used by insights page, detail page (for preferences passed to SimilarityBadge), preferences page

---

## Common Pitfalls

### Pitfall 1: Re-introducing `'use client'` on converted pages

**What goes wrong:** Developer adds `'use client'` back to `src/app/insights/page.tsx` or `src/app/page.tsx` because a hook import breaks a build. This silently defeats DATA-05 — the page becomes a client component doing `useEffect`-based fetching instead of a true Server Component.
**Why it happens:** TypeScript errors from hooks disappear when `'use client'` is added; the fix "works" but is wrong.
**How to avoid:** Grep check in acceptance criteria: `grep -L "'use client'" src/app/insights/page.tsx src/app/page.tsx src/app/preferences/page.tsx src/app/watch/*/page.tsx`.
**Warning signs:** `useEffect`, `useState`, `useRouter` appearing in a file that should be a Server Component.

### Pitfall 2: `use(params)` in a Server Component

**What goes wrong:** The existing `use(params)` call pattern from the client component pages is copy-pasted into the new Server Component page. `use()` is a React hook — it cannot be called in a Server Component.
**Why it happens:** Both patterns unwrap a Promise; the difference is only in context.
**How to avoid:** Server Component pages use `await params` (direct await in async function). `use(params)` is for client components. [VERIFIED: Next.js 16 docs — Server Components are async functions]

### Pitfall 3: Missing `router.refresh()` for inline mutations (non-navigation mutations)

**What goes wrong:** `WatchDetail` calls a Server Action (e.g., markAsWorn, flag as deal) and the UI stays stale because no navigation occurs and no client-side refresh is triggered. `revalidatePath` runs on the server but the client doesn't know to re-render.
**Why it happens:** `revalidatePath` invalidates the server cache, but the client router needs a signal to refetch.
**How to avoid:** For inline mutations (no navigation away), call `router.refresh()` on the client after the Server Action resolves. For post-create/edit navigations (`router.push('/')`), `revalidatePath` plus the navigation itself is sufficient.

### Pitfall 4: DATABASE_URL pointing at pooled connection for `drizzle-kit migrate`

**What goes wrong:** Running `drizzle-kit migrate` with a transaction-mode pooled connection string (port 6543) can cause migration failures or silent transaction errors. Prepared statements are not supported in transaction pool mode.
**Why it happens:** The `.env.example` documents the pooled string (`port 6543`) as `DATABASE_URL` because it's better for serverless runtime queries. Migrations need the direct connection.
**How to avoid:** For `drizzle-kit migrate` (prod bootstrap), use the **Direct Connection string (port 5432)** from the Supabase dashboard → Project Settings → Database → Connection string → Direct connection. For the running Next.js app, the session-mode pooler (port 5432 via Supavisor) or transaction-mode pooler (port 6543) is appropriate. The runbook must document two separate DATABASE_URL values: one for migration commands, one for production `vercel env add`.
**Citation:** [CITED: supabase.com/docs/guides/database/connecting-to-postgres] — "Direct connection string connects directly to your Postgres instance" vs pooler for managing many transient connections.

### Pitfall 5: Vercel env var scoped to wrong environment

**What goes wrong:** `vercel env add DATABASE_URL` without specifying `production` puts the variable in the wrong environment scope and `horlo.app` doesn't receive it.
**How to avoid:** Always specify the environment: `vercel env add DATABASE_URL production`. The command will prompt for the value. [CITED: vercel.com/docs/cli/env]

### Pitfall 6: Running `drizzle-kit migrate` with uncommitted local schema changes

**What goes wrong:** Local schema changes exist but `drizzle-kit generate` has not been run, so migration files are stale. Running `drizzle-kit migrate` against prod applies old migrations and misses the new schema.
**How to avoid:** The runbook must include: (1) `drizzle-kit generate` to snapshot the current schema into a migration file under `./drizzle/`, (2) commit the migration file, (3) then run `drizzle-kit migrate`.

### Pitfall 7: Forgetting that `useIsHydrated` becomes dead code on converted pages

**What goes wrong:** `useIsHydrated` is deleted from `src/lib/hooks/useIsHydrated.ts` before all callers are removed, causing import errors. Or it is left as an orphaned import after the page conversion.
**How to avoid:** `useIsHydrated` is imported in 5 files: `src/app/page.tsx`, `src/app/insights/page.tsx`, `src/app/preferences/page.tsx`, `src/app/watch/[id]/page.tsx`, `src/app/watch/[id]/edit/page.tsx`. All five are Server Component conversions in this phase. After converting all five, the hook file itself can be deleted. The hook is not used in any component that stays as a client component. [VERIFIED: grep output — all 5 callers are the pages being converted]

### Pitfall 8: `FilterBar` price-max computation breaks after store demotion

**What goes wrong:** `FilterBar` currently computes the price slider maximum from `get().watches` inside the store. After demotion, `watches` is no longer in the store. Build succeeds but the price slider always shows `PRICE_MAX_FLOOR` (1000).
**How to avoid:** `FilterBar` must receive a `maxPrice: number` prop from its parent, or a `watches: Watch[]` prop to compute it locally. The `CollectionView` client wrapper (which receives `watches` from the Server Component page) is the right place to compute `maxPrice` and pass it down.

---

## OPS-01 Runbook Research Findings

### Migration files in `supabase/migrations/`

[VERIFIED: ls output]

Only one file exists:
- `supabase/migrations/20260413000000_sync_auth_users.sql` — Phase 4's shadow-user trigger

No Drizzle migration files exist yet (`./drizzle/` folder does not exist). The runbook must walk through:
1. `drizzle-kit generate` — generates SQL migration from the schema in `src/db/schema.ts` → creates `./drizzle/<timestamp>_snapshot.sql`
2. `drizzle-kit migrate` — applies pending migrations to prod using the direct connection `DATABASE_URL`

### Supabase CLI commands (exact syntax)

[CITED: supabase.com/docs/reference/cli/supabase-db-push]

```bash
# Step 1: Link local project to prod Supabase project
supabase link --project-ref wdntzsckjaoqodsyscns

# Step 2: Apply the shadow-user trigger migration to prod
supabase db push --linked

# Alternative for the trigger migration (if supabase db push applies it):
# supabase db push --linked --include-all
```

`supabase db push` reads from `supabase/migrations/` and applies any unapplied migrations. It creates `supabase_migrations.schema_migrations` on first run. The `--linked` flag targets the linked remote project. The `--dry-run` flag previews without applying.

### drizzle-kit migrate (prod Drizzle schema)

[CITED: orm.drizzle.team/docs/drizzle-kit-migrate]

```bash
# Generate migration from current schema (creates ./drizzle/ folder)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@db.wdntzsckjaoqodsyscns.supabase.co:5432/postgres" \
  npx drizzle-kit generate

# Apply migrations to prod (direct connection — port 5432)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@db.wdntzsckjaoqodsyscns.supabase.co:5432/postgres" \
  npx drizzle-kit migrate
```

`drizzle-kit migrate` reads the `./drizzle/` folder for migration files. The `DATABASE_URL` in `drizzle.config.ts` is used unless overridden by env. The config uses `process.env.DATABASE_URL` — so setting it in the shell command overrides `.env.local`.

### DATABASE_URL: pooled vs direct — definitive answer

[CITED: supabase.com/docs/guides/database/connecting-to-postgres]

| Use Case | URL Pattern | Port | Why |
|----------|-------------|------|-----|
| `drizzle-kit generate` / `drizzle-kit migrate` | Direct connection | **5432** | Needs full session support; no transaction pool mode limitations |
| `supabase db push` (trigger migration) | Handled by Supabase CLI using project ref | n/a | CLI manages its own connection |
| Running Next.js app (Vercel prod) | Session-mode pooler or transaction-mode pooler | **5432** (session) or **6543** (transaction) | Serverless = transaction mode (6543) preferred |

**Recommendation for runbook:** Document `DATABASE_URL` as the **session-mode pooler** (port 5432 via Supavisor, NOT the 6543 transaction-mode pooler) for the Vercel production environment variable. For migration commands, use the direct connection (also port 5432 but via `db.` subdomain, not `pooler.`).

**Where to find the values in Supabase dashboard:**
- Project Settings → Database → Connection string → "Direct connection" (for migration)
- Project Settings → Database → Connection string → "Session mode" (for Vercel env var)
- Project Settings → API → `NEXT_PUBLIC_SUPABASE_URL` and `anon public` key

### Vercel env var setup

[CITED: vercel.com/docs/cli/env]

```bash
# Install Vercel CLI if not present
npm i -g vercel

# Authenticate
vercel login

# Link to the horlo.app project
vercel link

# Add the three required env vars to production
echo "https://wdntzsckjaoqodsyscns.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "<anon-key>" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "postgresql://postgres.wdntzsckjaoqodsyscns:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" | vercel env add DATABASE_URL production

# Trigger redeploy (env vars don't take effect until next deploy)
vercel --prod
```

### Smoke test specification

The runbook must walk through:
1. Open `horlo.app` in a browser — should redirect to `/login`
2. Click "Sign up" → enter email + password → submit
3. Should be logged in and redirected to `/` (collection page, empty)
4. Click "Log out" in the header user menu
5. Should redirect to `/login`
6. Verification: open Supabase dashboard → Authentication → Users — should see the test user
7. Delete the test user from the Supabase dashboard

### Rollback / safety

The runbook must include:
- **If `drizzle-kit migrate` fails:** Connect directly to prod DB with `psql "postgresql://..."` and inspect `drizzle.__drizzle_migrations`. Drop the failed migration entry if partially applied. Correct the schema and re-run.
- **If `supabase db push` fails on the trigger migration:** The migration is idempotent (`create or replace function`, `drop trigger if exists`) — safe to re-run.
- **If Vercel env vars are wrong:** `vercel env rm DATABASE_URL production` then re-add. Redeploy.
- **If signup gets stuck:** Check Supabase dashboard → Authentication → Logs for the error. Common: email verification enabled (should be off per Phase 4 D-09).
- **Rollback Vercel deployment:** Vercel dashboard → Deployments → find previous deploy → Promote to production.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed in Phase 2) |
| Config file | `vitest.config.ts` (or `vitest.config.mjs` — verify exists) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |
| Build check command | `npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| DATA-05 | `SimilarityBadge` receives `collection` + `preferences` as props, no store calls | grep/structural | `grep -r "useWatchStore\|usePreferencesStore" src/components/insights/SimilarityBadge.tsx` → must return no matches | No unit test needed — structural |
| DATA-05 | Insights page is a Server Component (no `'use client'`) | grep/structural | `grep "'use client'" src/app/insights/page.tsx` → must return no matches | Structural check |
| DATA-05 | `analyzeSimilarity` still works when called with props (no regression) | existing unit tests | `npm test -- --run src/lib/similarity` | Tests existed before Phase 5 |
| DATA-04 | `watchStore` has no `persist`, no CRUD, no collection data | grep/structural | `grep "persist\|addWatch\|deleteWatch\|watches:" src/store/watchStore.ts` → must return no matches | Structural check |
| General | TypeScript build passes after each conversion step | type check | `npm run build` | Run after each file converted |
| OPS-01 | Runbook commands produce expected output | manual execution | Operator runs runbook end-to-end, reports results | Execution gate in plan |
| OPS-01 | Prod signup + logout works | smoke test | Manual: signup on horlo.app → logout → verify /login redirect | Operator executes during phase |
| Cross-browser parity | Same collection on two browsers after refresh | smoke test | Manual: two-browser test | Verifies Zustand is no longer source of truth |

### Grep-Verifiable Acceptance Criteria (executable by the planner)

```bash
# 1. watchStore has no persist, CRUD, or collection data
grep -E "persist|addWatch|deleteWatch|markAsWorn|updateWatch|watches\s*:" src/store/watchStore.ts
# expected: no output

# 2. insights page is a Server Component
grep "'use client'" src/app/insights/page.tsx
# expected: no output

# 3. SimilarityBadge has no store imports
grep -E "useWatchStore|usePreferencesStore" src/components/insights/SimilarityBadge.tsx
# expected: no output

# 4. useIsHydrated is gone from all converted pages
grep -r "useIsHydrated" src/app/
# expected: no output

# 5. No 'use client' on any converted page
grep "'use client'" src/app/page.tsx src/app/insights/page.tsx src/app/preferences/page.tsx
# expected: no output
```

### Sampling Rate
- **After each file converted:** `npm run build` — catches TypeScript errors immediately
- **After all conversions complete:** full `npm test` suite
- **Phase gate:** `npm run build` passes + grep acceptance criteria all pass + operator has run the OPS-01 runbook end-to-end

### Wave 0 Gaps

- No new test files needed for Phase 5 — the phase is a refactor with structural/grep verification plus manual smoke tests.
- The existing similarity test suite (`src/lib/similarity.test.ts` or equivalent — written in Phase 2) must remain green; it tests the pure function that Phase 5 rewires to. Run it as a regression check.

*If no gap: "None — Phase 5 is a refactor; validation is grep-based + build-clean + manual smoke tests. Existing test infrastructure covers all relevant logic."*

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | OPS-01 runbook — `supabase link`, `supabase db push` | Yes | 2.90.0 | None — required |
| drizzle-kit | OPS-01 runbook — `drizzle-kit generate`, `drizzle-kit migrate` | Yes (devDep) | 0.31.10 | None — required |
| Vercel CLI | OPS-01 runbook — `vercel env add`, `vercel --prod` | No (not installed) | — | Install: `npm i -g vercel` |
| Node.js | Runtime | Yes | (project uses it) | — |
| Direct DB connection to prod Supabase | `drizzle-kit migrate` | Requires password from operator | — | None — operator must retrieve from dashboard |

**Missing dependencies with no fallback:**
- Vercel CLI — must be installed before executing OPS-01. Add `npm i -g vercel` as first step in runbook.
- Prod DB password — operator must retrieve from Supabase dashboard → Project Settings → Database → Database password.

**Missing dependencies with fallback:**
- None.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Session-mode pooler (port 5432 via Supavisor) is available for the prod Supabase project | OPS-01 Runbook | Low — Supabase free tier includes session mode pooler. If not, use direct connection for runtime too. |
| A2 | `vercel link` will associate correctly with the `horlo.app` project when run | OPS-01 Runbook | Low — may prompt to select from existing projects; operator chooses the right one |
| A3 | No additional Drizzle migrations exist beyond the initial schema snapshot | OPS-01 Runbook | Low — `drizzle-kit generate` + `drizzle-kit migrate` covers whatever the current schema is |
| A4 | `WatchCard` is only rendered inside `WatchGrid`, so updating `WatchGrid` call sites covers all `WatchCard` callers | Per-file classification | Low — grep for `<WatchCard` would confirm |

**Verified claims (not assumed):**
- `getWatchById` exists with correct signature [VERIFIED: read `src/data/watches.ts`]
- `useIsHydrated` is used in exactly 5 page files [VERIFIED: grep output]
- One migration file exists in `supabase/migrations/` [VERIFIED: ls output]
- `drizzle/` folder does not yet exist [VERIFIED: ls output]
- `SimilarityBadge` currently calls both stores directly [VERIFIED: read source]
- `analyzeSimilarity` signature: `(targetWatch, collection, preferences)` [VERIFIED: read `src/lib/similarity.ts`]
- `refresh()` imported from `next/cache` (not `next/navigation`) for Server Action refresh [VERIFIED: bundled Next.js 16 docs]
- `params` in Server Component pages must be `await`-ed [VERIFIED: bundled Next.js 16 docs]
- Supabase CLI 2.90.0 installed globally [VERIFIED: `supabase --version`]
- drizzle-kit 0.31.10 in devDependencies [VERIFIED: package.json]
- DATABASE_URL in `.env.example` points to pooled port 6543 [VERIFIED: read `.env.example`]

---

## Open Questions

1. **`FilterBar` price max after demotion**
   - What we know: `FilterBar` currently reads `get().watches` to compute the collection's max price for the price slider ceiling. After demotion, `watches` is no longer in the store.
   - What's unclear: Should `FilterBar` accept `watches: Watch[]` as a prop (slightly couples it to collection data), or should it accept a `maxPrice: number` prop (simpler), or should the `CollectionView` wrapper pass `maxPrice`?
   - Recommendation: `CollectionView` computes `maxPrice = Math.max(...watches.map(w => w.marketPrice ?? 0))` and passes it as a `maxPrice` prop to `FilterBar`. This keeps `FilterBar` decoupled from collection shape.

2. **`WatchDetail` needs collection + preferences**
   - What we know: `WatchDetail` uses both for `SimilarityBadge` and `computeGapFill`. The watch detail Server Component page currently only fetches one watch.
   - What's unclear: Does the detail page need to fetch the full collection? (Yes — `SimilarityBadge` compares the target watch against the full collection.)
   - Recommendation: Detail page fetches `watch`, `watches`, and `preferences` from DAL (three awaited calls). Passes all three to `WatchDetail` as props.

3. **`WatchForm` Server Action signature for edit**
   - What we know: Phase 4 D-02 dropped `userId` from Server Action signatures. The Server Actions already updated.
   - What's unclear: Does `editWatch` Server Action exist with a `watchId` parameter? Need to confirm the existing action signature.
   - Recommendation: Planner confirms by reading `src/app/actions/watches.ts` in full before writing the WatchForm rewire task.

---

## Security Domain

Phase 5 does not introduce new security surface. No new auth flows, no new API routes, no new data ingestion paths.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 4 already addressed) | Existing `getCurrentUser()` |
| V3 Session Management | No | Existing `@supabase/ssr` cookie handling |
| V4 Access Control | Yes (preserved) | Every new Server Component page calls `getCurrentUser()` before any DAL call |
| V5 Input Validation | No (Server Actions already have Zod) | Existing Zod schemas in Server Actions |
| V6 Cryptography | No | No new crypto operations |

**The one security property to preserve:** Every converted Server Component page must call `getCurrentUser()` before calling any DAL function. The proxy handles redirect for unauthenticated users, but Server Components must independently verify (defense in depth per Phase 4 D-12). Do not assume proxy coverage is sufficient.

---

## State of the Art

| Old Approach | Current Approach (Phase 5 target) | When Changed | Impact |
|--------------|-----------------------------------|--------------|--------|
| `router.refresh()` from `next/navigation` | `refresh()` from `next/cache` inside Server Action | Next.js 16 | The server-side `refresh()` is the idiomatic approach; `router.refresh()` still works client-side |
| `middleware.ts` | `proxy.ts` | Next.js 16 | Already handled in Phase 4 — no action in Phase 5 |
| Zustand + persist as source of truth | Server Components + DAL as source of truth | Phase 5 | Eliminates hydration mismatch and cross-browser data divergence |
| `use(params)` in client pages | `await params` in async Server Component pages | Next.js 16 | Server Components don't use React hooks |

**Deprecated/outdated patterns being removed:**
- `persist` middleware from Zustand for collection data
- `useIsHydrated` hook (hydration shimming for localStorage Zustand store — becomes unnecessary when there's no persisted store)
- Synchronous store-based data access for watch collection and preferences

---

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — Server/Client Component rules, async page pattern, props serialization
- `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` — ORM/DB data fetching in Server Components, `await params` pattern
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` — Server Actions, `refresh()` from `next/cache`, `revalidatePath`, `useTransition` + pending UI
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md` — `refresh()` API reference, Server Action only, import from `next/cache`
- `node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md` — `revalidatePath` / `revalidateTag` / `updateTag` semantics
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` — proxy.ts rename confirmed
- `src/data/watches.ts` — `getWatchById` signature verified
- `src/data/preferences.ts` — `getPreferencesByUser` signature verified
- `src/lib/auth.ts` — `getCurrentUser()` signature verified
- `src/lib/similarity.ts` — `analyzeSimilarity` signature verified
- `src/store/watchStore.ts` — current shape verified (per-field listing for demotion)
- `src/store/preferencesStore.ts` — current shape verified
- `supabase/migrations/` — one file enumerated (`20260413000000_sync_auth_users.sql`)
- `package.json` — drizzle-kit 0.31.10, drizzle-orm ^0.45.2 confirmed
- `supabase --version` → 2.90.0 [local command]
- `npx drizzle-kit --version` → 0.31.10 [local command]

### Secondary (MEDIUM confidence)
- [supabase.com/docs/reference/cli/supabase-db-push](https://supabase.com/docs/reference/cli/supabase-db-push) — `supabase db push --linked` syntax
- [supabase.com/docs/guides/database/connecting-to-postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) — pooled vs direct connection guidance
- [vercel.com/docs/cli/env](https://vercel.com/docs/cli/env) — `vercel env add [name] [environment]` syntax
- [orm.drizzle.team/docs/drizzle-kit-migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate) — migrate command reads `./drizzle/` folder

### Tertiary (LOW confidence)
- None — all OPS-01 claims were verified against official documentation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools verified locally or in bundled docs
- Architecture patterns: HIGH — all patterns read from bundled Next.js 16 docs in node_modules
- Pitfalls: HIGH — all verified against actual codebase (grep outputs, source reads)
- Per-file classification: HIGH — all 12 files read and analyzed
- OPS-01 runbook details: MEDIUM — Supabase CLI and Vercel CLI syntax from official docs; the specific prod DB bootstrap must be executed by operator to be "verified" (that's OPS-01's definition of done)

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable Next.js 16 and Supabase CLI — likely valid longer)
