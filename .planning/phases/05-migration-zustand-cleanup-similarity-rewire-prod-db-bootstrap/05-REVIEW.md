---
phase: 05-migration-zustand-cleanup-similarity-rewire-prod-db-bootstrap
reviewed: 2026-04-15T19:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/lib/filtering.ts
  - src/store/watchStore.ts
  - src/components/insights/SimilarityBadge.tsx
  - src/components/watch/CollectionView.tsx
  - src/components/watch/WatchGrid.tsx
  - src/components/watch/WatchCard.tsx
  - src/components/watch/WatchDetail.tsx
  - src/components/watch/WatchForm.tsx
  - src/components/filters/FilterBar.tsx
  - src/components/filters/StatusToggle.tsx
  - src/components/preferences/PreferencesClient.tsx
  - src/app/page.tsx
  - src/app/insights/page.tsx
  - src/app/preferences/page.tsx
  - src/app/watch/[id]/page.tsx
  - src/app/watch/[id]/edit/page.tsx
  - src/app/actions/watches.ts
  - src/app/actions/preferences.ts
  - drizzle/0000_flaky_lenny_balinger.sql
  - src/db/schema.ts
  - src/data/watches.ts
  - src/data/preferences.ts
findings:
  critical: 0
  high: 0
  medium: 3
  low: 4
  nit: 3
  total: 10
status: dirty
---

# Phase 5 Code Review

**Depth:** standard
**Scope:** Source files touched by Plans 05-01 through 05-05 plus the drizzle migration from 05-06. Docs-only changes (runbook) skipped.

## Summary

Phase 5 delivers a clean structural refactor: Zustand is correctly demoted to filter-only
ephemeral state, list pages are genuine Server Components (async + DAL), SimilarityBadge
reads `collection` + `preferences` from required props, and `filterWatches` is a real pure
function. Auth boundary is correct at every Server Component and Server Action — userId is
always sourced from `getCurrentUser()` and never from the client. DAL queries are
consistently scoped with `and(eq(userId), eq(id))`. Drizzle migration matches `src/db/schema.ts`
column-for-column.

No CRITICAL or HIGH findings. Three MEDIUM findings worth addressing before the next phase,
all related to error plumbing / unused surface area rather than correctness regressions.
The remaining items are LOW / NIT polish.

## MEDIUM

### MR-01: `PreferencesClient` swallows all save failures — user can silently lose edits

**File:** `src/components/preferences/PreferencesClient.tsx:47-56`
**Issue:** `updatePreferences` calls `savePreferences(patch)` fire-and-forget inside
`startTransition` and never inspects the returned `ActionResult`. If the server action
returns `{ success: false, error: ... }` (auth failure, validation error, DB error),
the local state already reflects the patch but the server never persisted it. The user
sees their change "stick" in the UI until the next full navigation, at which point the
Server Component re-fetches and the edit silently reverts. No toast, no error state,
no `console.error`. The only visibility is that the `_, startTransition` tuple
throws away the pending boolean, so the UI also gives no "saving" feedback.

**Why it matters:** Preferences are small-stakes but the pattern trains users to trust
the UI. Any transient auth expiration (cookie refresh race during a deploy) would result
in hours of lost config with no warning.

**Fix:**
```tsx
const [isSaving, startTransition] = useTransition()
const [saveError, setSaveError] = useState<string | null>(null)

const updatePreferences = (patch: Partial<UserPreferences>) => {
  const next = { ...preferences, ...patch }
  setLocalPreferences(next)
  setSaveError(null)
  startTransition(async () => {
    const result = await savePreferences(patch)
    if (!result.success) {
      setSaveError(result.error)
      // Roll the optimistic update back so local state matches what actually persisted.
      setLocalPreferences((cur) => ({ ...cur, ...invertPatch(patch, preferences) }))
    }
  })
}
```
At minimum, surface a toast / inline error banner on `!result.success`. Rolling back is
optional but the silent-revert-on-next-nav behavior is worse than an explicit error.

---

### MR-02: `UnauthorizedError` imported but unused in both Server Action files

**File:** `src/app/actions/watches.ts:6` and `src/app/actions/preferences.ts:6`
**Issue:** Both action files import `UnauthorizedError` alongside `getCurrentUser` but
never reference it. The `try { user = await getCurrentUser() } catch { return ... }` block
catches any error indiscriminately, which means a database client misconfiguration thrown
from `createSupabaseServerClient()` would also be reported to the user as "Not
authenticated" — masking real infrastructure failures as auth failures during debugging.

**Why it matters:** (a) ESLint `no-unused-vars` will start failing if the project ever
tightens lint rules (currently passes because of Next's default config). (b) More
importantly, the catch-all hides the distinction between "real auth failure" (expected,
user-facing) and "Supabase client construction blew up" (unexpected, should be logged
loudly). Future auth debugging will waste cycles chasing phantom session issues.

**Fix:**
```ts
let user
try {
  user = await getCurrentUser()
} catch (err) {
  if (err instanceof UnauthorizedError) {
    return { success: false, error: 'Not authenticated' }
  }
  console.error('[addWatch] auth lookup failed:', err)
  return { success: false, error: 'Auth check failed' }
}
```
Apply the same shape to `editWatch`, `removeWatch`, and `savePreferences`.

---

### MR-03: No RLS on `public.users` / `public.watches` / `public.user_preferences`

**File:** `drizzle/0000_flaky_lenny_balinger.sql` (entire file)
**Issue:** The migration creates the three public tables but never runs
`alter table ... enable row level security` or defines any policies. This is consistent
with the architectural decision to make the DAL the enforcement boundary (all queries go
through `src/db/index.ts`'s `postgres` superuser role via the pooler, not through
PostgREST / anon-key), and the `src/data/watches.ts` functions do scope every query by
`userId`. **But** Supabase's default posture is that the anon key can reach PostgREST
(`rest/v1/watches`) directly, and `rest/v1` IS exposed on a Supabase project unless
explicitly locked down. If the anon key is ever used in a context that hits PostgREST
(client-side Supabase queries, a future feature that uses `@supabase/supabase-js` on the
browser, or accidental exposure of the service role), every watch in every user's
collection is trivially readable/writable.

**Why it matters:** Defense-in-depth. The DAL is a correct enforcement boundary *today*
because nothing else touches the DB, but Supabase is designed around RLS-as-the-default-
enforcement-layer. The first time anyone adds `createSupabaseBrowserClient().from('watches').select()`
for any reason, the missing RLS will become a silent data leak. The project PROJECT.md
explicitly says "Per-user data isolation must remain correct even after multi-user auth
is added."

**Fix:** Add a new migration (post-Phase 5 is fine; don't mutate 0000) that enables RLS
and installs the standard Supabase pattern:
```sql
alter table public.watches enable row level security;
alter table public.user_preferences enable row level security;
alter table public.users enable row level security;

create policy "users read own watches" on public.watches
  for select using (auth.uid() = user_id);
create policy "users write own watches" on public.watches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- repeat for user_preferences
```
Note: the current DAL uses the pooler superuser role which bypasses RLS, so enabling RLS
does NOT break DAL calls — it only gates PostgREST / anon-key access paths. This is
pure hardening.

Alternatively, explicitly document in `.planning/PROJECT.md` that PostgREST is disabled
on the prod Supabase project, and add a runbook step to verify it on every deploy.

## LOW

### LR-01: `WatchDetail` ignores `result.error` from failed mutations — UI stays stuck pending

**File:** `src/components/watch/WatchDetail.tsx:64-92`
**Issue:** Three inline handlers (`handleDelete`, `handleMarkAsWorn`, `handleFlagDealChange`)
inspect `result.success` but ignore `result.error` on failure. On failure the transition
simply ends with no refresh, no navigation, no error surfaced. The Delete button stays
clickable (good — `isPending` flips back), but the user has no indication that the delete
failed. `handleFlagDealChange` is worse: the checkbox visually flipped because its
`checked` prop is `watch.isFlaggedDeal` which comes from the server payload, so a failed
save leaves the checkbox in its old state — looks like a no-op click rather than an
error.

**Fix:** Add a local `const [mutationError, setMutationError] = useState<string | null>(null)`
and render it near the action row. On `!result.success`, set the error. Minor, but
consistent with the error handling pattern you already have in `WatchForm`.

---

### LR-02: `FilterBar` `useEffect` reads `filters.priceRange.min/max` but only depends on the whole `filters.priceRange` object reference

**File:** `src/components/filters/FilterBar.tsx:77-90`
**Issue:** The effect depends on `[priceCap, filters.priceRange, setFilter]`. Zustand
returns a fresh `filters.priceRange` object on every `setFilter` call for a *different*
key (because the whole `filters` object is rebuilt by `setFilter`). That means toggling
a style tag or role tag will re-run this effect, even though neither `priceCap` nor
`priceRange` contents changed. The guard `if (priceCap !== prev)` prevents the effect
from doing anything harmful, so this is not a correctness bug — but it is wasted work
on every filter toggle and a subtle invitation to break the guard later.

**Fix:** Narrow the dependency or pull the min/max out:
```tsx
const priceMin = filters.priceRange.min
const priceMax = filters.priceRange.max
// ...
useEffect(() => {
  // same body, but only touching priceMin/priceMax
}, [priceCap, priceMin, priceMax, setFilter])
```

---

### LR-03: `WatchForm.initialFormData` omits `isChronometer`; silently divergent from `Watch` shape

**File:** `src/components/watch/WatchForm.tsx:41-66` and `:73-102`
**Issue:** `type FormData = Omit<Watch, 'id'>` implies `isChronometer?: boolean` is a
valid field, and `handleUrlImport` (line 174) explicitly writes `isChronometer` into
state. But `initialFormData` does not declare it, and the edit-mode initializer (lines
75-100) also fails to copy `watch.isChronometer`. Today this does not corrupt data on
update because:
  1. Zod `updateWatchSchema.partial()` strips unknown/absent keys
  2. DAL `mapDomainToRow` gates on `'isChronometer' in data`
…but editing a chronometer-certified watch and pressing Save will round-trip form state
that has no memory of the field. If anyone ever switches the DAL to set-everything-
explicitly (a reasonable refactor), the field silently flips to the default `false` on
every edit.

**Fix:** Add `isChronometer: watch.isChronometer` to the edit-branch object literal and
`isChronometer: undefined` to `initialFormData`. Two lines, removes the footgun.

---

### LR-04: `WatchGrid` empty-state copy says "Your collection is empty" even when filters hide everything

**File:** `src/components/watch/WatchGrid.tsx:36-48`
**Issue:** The early return checks `watches.length === 0` against the already-filtered
prop, so a user with 20 watches who applies a filter that matches nothing sees "Your
collection is empty. Add your first watch to begin tracking…" — misleading. Pre-
existing issue, not a Phase 5 regression, but the Phase 5 refactor routed a new
`collection: Watch[]` prop through `WatchGrid` which would let you distinguish
"collection empty" from "filters matched nothing" at essentially zero cost.

**Fix:**
```tsx
if (watches.length === 0) {
  if (collection.length === 0) {
    return <EmptyCollectionMessage />
  }
  return <NoMatchesMessage onClearFilters={...} />
}
```

## NIT

### NR-01: `CollectionView` filter selector is whole-object, forces rerender on unrelated state

**File:** `src/components/watch/CollectionView.tsx:26`
**Issue:** `const filters = useWatchStore((s) => s.filters)` is a wide selector; any
change to any filter triggers a `CollectionView` re-render plus recomputation of
`filterWatches`. Phase 5 target is <500 watches so this is not a performance problem,
but individual selectors (or `useShallow` from zustand v5) would be idiomatic and cheap.

**Fix:** Use `useShallow` or split into per-key selectors. Non-blocking.

---

### NR-02: `WatchForm` edit-mode initializer is a verbose prop-by-prop copy

**File:** `src/components/watch/WatchForm.tsx:75-100`
**Issue:** 26 lines of manual field-copy duplicating the shape of `Watch`. Already caused
the `isChronometer` omission in LR-03. `{ ...watch, reference: watch.reference ?? '', notes: ..., imageUrl: ... }`
achieves the same with less surface to maintain.

**Fix:** Collapse to a spread plus the three string-default overrides, or factor a
`watchToFormData(watch: Watch): FormData` helper. Non-blocking.

---

### NR-03: `PreferencesClient` uses `const [, startTransition] = useTransition()` — throws away `isPending`

**File:** `src/components/preferences/PreferencesClient.tsx:45`
**Issue:** Pending state is discarded, so checkboxes/inputs do not show a "saving…"
indicator. Combined with MR-01's silent-failure mode, the user gets zero signal that
a save is in flight or that it failed. If you address MR-01, grab the pending boolean
at the same time.

**Fix:** `const [isSaving, startTransition] = useTransition()` and thread `disabled={isSaving}`
onto inputs, or show a small "Saving…" label in the header.

---

## Positive Observations

(Not findings — just worth noting what went right so reviewers can trust the diff.)

- **Auth boundary is clean everywhere.** Every Server Component calls `getCurrentUser()`
  first and then scopes DAL reads by `user.id`. No `params.userId` or client-passed IDs
  exist anywhere. `src/app/watch/[id]/page.tsx` correctly passes `user.id` into both
  `getWatchById` and `getWatchesByUser`, so the detail page cannot render another user's
  watch even if someone guesses the UUID.
- **DAL ownership enforcement is consistent.** `getWatchById`, `updateWatch`, and
  `deleteWatch` all use `and(eq(userId), eq(id))` — a direct object reference attack
  returns null/throws "not found or access denied" rather than leaking a row. No
  redundant ownership checks outside the query predicates.
- **No N+1.** Every list page parallelizes its DAL fetches via `Promise.all`. `CollectionView`
  receives the full collection once and passes it to children as props.
- **`filterWatches` is genuinely pure.** No global reads, no side effects, deterministic
  output for given inputs.
- **Drizzle migration matches `src/db/schema.ts` column-for-column** (29 columns on
  `watches`, 15 on `user_preferences`, both FK constraints, both indexes). No drift.
- **No leftover Zustand reads in Server Components.** `grep` for `useWatchStore` inside
  `src/app/` returns nothing. `useIsHydrated` and `preferencesStore` are fully deleted.
- **No `NEXT_PUBLIC_` leakage of server-only secrets.** The only `NEXT_PUBLIC_` vars are
  the Supabase URL and anon key, which are by design public. `DATABASE_URL` and
  `ANTHROPIC_API_KEY` remain server-only.
- **`router.refresh()` pattern on inline mutations is correct.** `revalidatePath('/')`
  in the server action invalidates the cache; `router.refresh()` tells the client router
  to re-fetch. Without the explicit refresh, the user would not see the updated
  `lastWornDate` until the next full navigation (Pitfall 3 from 05-RESEARCH.md).
- **`CollectionView` reads `filters` from the store, not `watches`.** The wishlist
  deal-sort branch in `WatchGrid` reads a single `filters.status` selector, not the
  whole collection. Store demotion preserved.

---

_Reviewed: 2026-04-15T19:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
