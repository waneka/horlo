---
phase: 12-visibility-ripple-in-dal
reviewed: 2026-04-22T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - drizzle/0003_phase12_drop_worn_public.sql
  - next.config.ts
  - src/app/actions/profile.ts
  - src/app/actions/watches.ts
  - src/app/actions/wearEvents.ts
  - src/app/actions/wishlist.ts
  - src/app/settings/page.tsx
  - src/app/u/[username]/[tab]/page.tsx
  - src/components/profile/WornTabContent.tsx
  - src/components/settings/SettingsClient.tsx
  - src/data/activities.ts
  - src/data/profiles.ts
  - src/data/wearEvents.ts
  - src/db/schema.ts
  - src/lib/feedTypes.ts
  - src/lib/wearVisibility.ts
  - src/lib/wywtTypes.ts
  - supabase/migrations/20260424000001_phase12_drop_worn_public.sql
  - supabase/migrations/20260423000003_phase11_pg_trgm.sql
  - tests/data/getFeedForUser.test.ts
  - tests/data/getWearRailForViewer.test.ts
  - tests/data/profiles.test.ts
  - tests/integration/phase12-visibility-matrix.test.ts
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 12 rips out the tab-level `profile_settings.worn_public` boolean and replaces it with per-row `wear_events.visibility` (public/followers/private). Overall the ripple is well-executed: the four visibility surfaces (profile worn tab, WYWT rail, feed, wishlist-from-wear action) use consistent three-tier semantics, owner bypass is applied first in every branch, the G-3 follow direction is correct (`followerId = viewer`, `followingId = actor`), the feed uses Postgres NULL semantics as an intentional fail-closed mechanism for legacy rows, and non-owner gate failures return uniform "not found" strings rather than leaking existence.

The one critical issue is a stale RLS policy comment that still names `worn_public` after the column was dropped. Warnings center on: (1) integration tests that will fail compilation because they still seed `wornPublic` against a schema that no longer has it, (2) a subtle follower-predicate fragility in the feed DAL when combined with uncached legacy data, (3) a feed predicate that does not account for the `->>` vs `->` distinction if `visibility` is ever written as a non-string JSON value, and (4) the wishlist action's JOIN behavior on missing `profile_settings` rows. Info items are mostly code-quality.

## Critical Issues

### CR-01: Stale `worn_public` reference in Phase 10 RLS policy comment contradicts dropped column

**File:** `supabase/migrations/20260422000000_phase10_activities_feed_select.sql:5`
**Issue:** The Phase 10 migration comment states "Per-event privacy gates (collection_public / wishlist_public / worn_public from profile_settings) are enforced at the DAL WHERE clause." After Phase 12 drops `worn_public`, this comment is misleading to future readers auditing the RLS + DAL privacy pairing. The RLS policy body itself is correct (it does not reference `worn_public`), but the contract comment is now false — the DAL gate for `watch_worn` now reads `metadata->>'visibility'`, not `profile_settings.worn_public`.

This is categorized Critical because in a privacy-first design, the two-layer OUTER/INNER contract (RLS + DAL) is the primary auditing artifact. A future engineer who reads this migration comment while debugging a visibility leak will be looking at the wrong column and may re-add a `worn_public` reference to the DAL, partially reverting Phase 12. Since migrations are append-only, this staleness cannot be edited in place — it must be superseded by a follow-up migration or a documented NOTE.

**Fix:**
```sql
-- Add a follow-up migration (e.g. 20260424000002_phase12_amend_activities_select_doc.sql)
-- or a corresponding comment in the Phase 12 drop migration itself:

-- NOTE (Phase 12 / WYWT-11): the preceding comment refers to a column
-- that no longer exists. The watch_worn privacy gate is now per-row via
-- wear_events.visibility (mirrored in activities.metadata->>'visibility').
-- See src/data/activities.ts getFeedForUser() WHERE clause.
```
Alternatively, append a note to the Phase 12 drop migration header referencing the superseded Phase 10 comment so auditors grepping for `worn_public` land on the correction.

## Warnings

### WR-01: Integration tests will fail to compile against the new schema — `wornPublic` removed from ProfileSettings type

**File:** `tests/data/getFeedForUser.test.ts:297,311,420,462-475`, `tests/data/getWearRailForViewer.test.ts:124,139,164,188,309,323,394,479,487-540`, `tests/integration/home-privacy.test.ts:100-107`, `tests/data/getSuggestedCollectors.test.ts:176`, `tests/actions/wishlist.test.ts:69,121,123,237-239`, `tests/data/getRecommendationsForViewer.test.ts:52`, `tests/components/home/PersonalInsightsGrid.test.tsx:101,409,460`, `tests/data/getWatchByIdForViewer.test.ts:286,294`
**Issue:** `src/db/schema.ts:178-187` removes the `wornPublic` column from the `profileSettings` Drizzle table (confirmed by the comment at line 183). Every test file above passes `wornPublic: true|false` into `db.insert(schema.profileSettings).values(...)`. Drizzle's TypeScript inference will reject these inserts at type-check time because the column no longer exists on the table definition. Even where tests mock Drizzle and only pass mock row objects (e.g. `tests/data/getFeedForUser.test.ts` unit tests), the `profileSeed` helper still inserts against real `schema.profileSettings` in Part B, which will now be a compile error.

This is the largest downstream ripple from the schema drop and indicates Plan 06 did not complete test migration alongside the production code. It is flagged Warning rather than Critical because the production privacy paths are correct — these are test-only failures — but CI will break immediately and block deploys.

**Fix:** Remove every `wornPublic` field from test fixtures. Where tests previously flipped `wornPublic: false` to exercise the tab-level gate, replace with per-wear visibility seeding:

```typescript
// Before (getWearRailForViewer.test.ts:309-323):
const seedProfile = async (u, username, wornPublic = true) => {
  await dbModule.db.insert(schema.profileSettings).values({
    userId: u.id, profilePublic: true, collectionPublic: true,
    wishlistPublic: true, wornPublic,  // <-- remove
  }).onConflictDoNothing()
}

// After: drop the parameter; gate at wear-insert time instead:
const seedProfile = async (u, username) => {
  await dbModule.db.insert(schema.profileSettings).values({
    userId: u.id, profilePublic: true, collectionPublic: true,
    wishlistPublic: true,
  }).onConflictDoNothing()
}
// ...then for Test 4 (line 479), seed the wear with visibility='private':
await seedWear(bob.id, watchBob, today(), undefined, { visibility: 'private' })
```

Also update the mock-object `wornPublic` fields in `getWearRailForViewer.test.ts:124-188` — the Unit tests assemble synthetic DB rows and the new DAL does not select `wornPublic` (confirmed by `src/data/wearEvents.ts:184-200`), so those fields are dead keys that will fail `.toEqual()` assertions (see `Unit 8` at line 196 which expects an exact-match tile shape now missing `wornPublic`).

### WR-02: Feed follower simplification relies on a load-bearing JOIN invariant with no compile-time anchor

**File:** `src/data/activities.ts:139-165`
**Issue:** The `watch_worn` branch of the WHERE clause is:
```sql
(activities.type = 'watch_worn' AND activities.metadata->>'visibility' IN ('public','followers'))
```
This is correct *only because* the outer `innerJoin(follows, and(eq(follows.followerId, viewerId), eq(follows.followingId, activities.userId)))` already restricts admitted rows to followed actors (so a `'followers'` row is automatically follower-visible). The code comment (lines 147-153) correctly notes this invariant and warns future readers. But there is no structural guardrail: a future change that widens the JOIN (e.g., replacing innerJoin with a leftJoin + OR on "popular actors", or folding the self-tile path back into the same query per a future plan) will silently leak `'followers'` wears to non-followers. The assumption lives entirely in a code comment.

This is a fragility, not a current bug. Flagged Warning rather than Info because the security impact of a future refactor ignoring the comment is high (privacy leak on follow direction inversion) and the fix is cheap.

**Fix:** Add a runtime assertion in a test or a DAL-local helper that proves the invariant. The simplest anchor is a test assertion that the `watch_worn` WHERE branch is ONLY reached from followed actors:

```typescript
// tests/data/getFeedForUser.test.ts — add a new "invariant" test
it('Phase 12 invariant: watch_worn followers rows only admitted when viewer follows actor', async () => {
  // Seed a follower-only watch_worn row from a NON-FOLLOWED actor.
  // Expect it to be filtered — this test fails if the JOIN is ever widened.
  // ...
})
```
Alternatively, extract the "assumes followed-only" predicate into a named helper that takes the joined-table invariant as a type parameter, so any future rewrite of the JOIN must also rewrite this predicate's signature.

### WR-03: Feed `metadata->>'visibility'` does not defend against non-string JSON values

**File:** `src/data/activities.ts:164`
**Issue:** Postgres `->>` coerces the JSON value to text regardless of its underlying type (string, number, bool, null). If a future write path ever stores `metadata: { visibility: true }` or some other non-string type by mistake (e.g., a client-side serialization bug or a dev inserting test fixtures with the wrong shape), `->>'visibility'` returns the stringified form (`'true'`) which will NOT match `IN ('public','followers')` — so the row fails closed. That is the *correct* failure mode.

However, `src/data/activities.ts:197-211` (`normalizeMetadata`) accepts any raw value and only validates it when reading, not when writing. The write path (`logActivity` overload at lines 65-70, called from `src/app/actions/wearEvents.ts:39-44`) has a TypeScript type that enforces `visibility: WearVisibility`, but that type is not validated at runtime — `db.insert(activities).values({ ..., metadata })` accepts any JS value as metadata. If a future caller bypasses the typed overloads (e.g., a raw Drizzle insert from a test or a migration backfill), a malformed visibility key could land in the table.

Flagged Warning because the feed read path fails closed as designed, and the write path is currently type-guarded — but there is no defense-in-depth at the DB layer (no CHECK constraint on `metadata->>'visibility'` values).

**Fix:** Either (a) document the fail-closed behavior prominently in `WatchWornMetadata` as a contract (so future implementers know `->>` is load-bearing), or (b) add a CHECK constraint:

```sql
-- supabase/migrations/YYYYMMDD_activities_visibility_check.sql
ALTER TABLE activities
  ADD CONSTRAINT activities_watch_worn_visibility_check
  CHECK (
    type != 'watch_worn'
    OR metadata->>'visibility' IS NULL   -- legacy rows allowed; excluded by DAL
    OR metadata->>'visibility' IN ('public','followers','private')
  );
```
This preserves the legacy fail-closed (DAL filters `IS NULL` rows out) while rejecting new malformed writes at the DB boundary.

### WR-04: `addToWishlistFromWearEvent` uses `innerJoin` on `profile_settings` — silently drops wear events whose owner has no settings row

**File:** `src/app/actions/wishlist.ts:61-81`
**Issue:** The JOIN chain is:
```typescript
.from(wearEvents)
.innerJoin(watches, eq(watches.id, wearEvents.watchId))
.innerJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
```
If an actor somehow has `wear_events` rows but no `profile_settings` row (which is prevented by the Phase 7 signup trigger and the Plan 01 backfill, but is defended against in `getProfileSettings` via DEFAULT_SETTINGS at `src/data/profiles.ts:54-69`), this innerJoin will drop those rows and the action returns `'Wear event not found'`. That's a uniform error for the viewer and fails closed for privacy — acceptable.

However: the viewer's OWN wear events could be dropped the same way. If the current user somehow lost their `profile_settings` row (impossible via signup, possible via a manual SQL reset during dev or a future cascade bug), `addToWishlistFromWearEvent` would refuse to add their OWN wear — contradicting the G-5 self-bypass contract documented in lines 34-37.

This is flagged Warning (not Info) because the self-bypass rule in the surrounding DAL (`getWearEventsForViewer` at `src/data/wearEvents.ts:107-109` uses `getAllWearEventsByUser` which touches only `wear_events`, not `profile_settings`) is asymmetric — the wishlist action's JOIN changes the error semantics for the owner vs every other read path.

**Fix:** Either resolve self-bypass BEFORE the JOIN (cheapest), or switch the profile_settings join to a leftJoin with a null-safe predicate:

```typescript
// Option A: self-check first (one extra query on the self path only)
const selfRows = await db.select({ ... })
  .from(wearEvents)
  .innerJoin(watches, eq(watches.id, wearEvents.watchId))
  .where(and(eq(wearEvents.id, parsed.data.wearEventId), eq(wearEvents.userId, user.id)))
  .limit(1)
if (selfRows[0]) { /* self-bypass path */ }
// else fall through to the join-against-profile_settings path

// Option B: leftJoin with null-safety (preserves single-query flow)
.leftJoin(profileSettings, eq(profileSettings.userId, wearEvents.userId))
// then in the canSee branch, treat missing settings as fail-closed for non-owners:
const profilePublic = row.profilePublic ?? false
```

### WR-05: Worn-tab legacy tab-lock removal removes a defense-in-depth seam

**File:** `src/app/u/[username]/[tab]/page.tsx:107-111` (and the removed LockedTabCard branch)
**Issue:** Phase 12 intentionally removed the `LockedTabCard` branch for the `worn` tab because per-row visibility now makes a tab-level lock "unreachable" (empty events array → WornTabContent's empty state handles the zero-visibility case). The removal is correct for current semantics, but it also removes the one seam where a server-side bug (e.g., `getWearEventsForViewer` accidentally returning the wrong user's wears) would have been caught by the secondary tab-level gate.

The page now trusts `getWearEventsForViewer` as the *sole* gate. If that function is ever refactored to skip the `eq(profileSettings.profilePublic, true)` outer gate (G-4), the worn tab leaks *silently* — the viewer just sees wears instead of a lock card. This shifts all the defensive burden onto a single DAL function with no page-level backstop.

Flagged Warning because it is a privacy-posture regression (loss of defense-in-depth) even though it is correct under current DAL behavior.

**Fix:** Add a page-level assertion that mirrors the DAL gate as a cheap secondary check. After `getProfileSettings(profile.id)` (already fetched at line 62) is resolved:
```typescript
if (tab === 'worn' && !isOwner && !settings.profilePublic) {
  // Mirror G-4 outer gate: profile_public=false hides worn tab entirely.
  // This is a belt-and-suspenders check — getWearEventsForViewer already
  // enforces it, but a page-level short-circuit is cheap defense-in-depth.
  return <LockedTabCard tab="worn" displayName={displayName} username={profile.username} />
}
```
This also avoids the empty-state "No public wear events to show" message leaking the fact that a non-public profile *might* have wears behind it.

## Info

### IN-01: Unused `UnauthorizedError` import in `src/app/actions/watches.ts`

**File:** `src/app/actions/watches.ts:7`
**Issue:** `UnauthorizedError` is imported but never referenced in this file. The auth error is caught generically via `try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }` at lines 51, 102, 134. No `instanceof UnauthorizedError` discriminator is used.

**Fix:**
```typescript
import { getCurrentUser } from '@/lib/auth'
```
(Drop `UnauthorizedError` from the import list. The generic catch is intentional — a thrown non-Unauthorized error would propagate, but the current pattern correctly collapses any auth-layer failure into 'Not authenticated' for ActionResult consumers.)

### IN-02: Dead code — `handleNoteDefaultChange` writes to localStorage that has no read path

**File:** `src/components/settings/SettingsClient.tsx:65-73`
**Issue:** The control is disabled (line 113) and documented as "coming soon" until `insertWatchSchema` consumes the stored default. The handler and localStorage read/write (`useEffect` at lines 53-63 and `handleNoteDefaultChange` at lines 65-73) are preserved intentionally per the WR-02 comment so re-enablement is one-line. This is dead code by design, and documented.

**Fix:** None — leaving the dead code is a deliberate engineering choice documented in the comment. Consider wrapping in a conditional flag (`const NEW_NOTE_VIS_ENABLED = false`) to make the disabled state more explicit and to surface the feature gate in search.

### IN-03: `getWearRailForViewer` returns `r.visibility as WearVisibility` — unchecked cast on a trusted column

**File:** `src/data/wearEvents.ts:250`
**Issue:** The tile construction uses `visibility: r.visibility as WearVisibility`. Drizzle's `pgEnum` declaration constrains this column to `'public' | 'followers' | 'private'` at insert time, so the cast is safe in practice. But the cast loses the compiler's ability to surface a future enum expansion (e.g., adding `'mutuals'`) as a type error at this call site — the cast swallows any new enum value.

**Fix:**
```typescript
// Remove the `as WearVisibility` — the pgEnum type inference already matches:
visibility: r.visibility,
// If Drizzle's inferred type is too loose (text), instead add a runtime guard:
function toVisibility(v: unknown): WearVisibility {
  if (v === 'public' || v === 'followers' || v === 'private') return v
  // Unknown value from DB — fail closed:
  return 'private'
}
```
This is Info because the current behavior is correct; the note is about future-safety only.

### IN-04: Duplicated `toISOString().slice(0, 10)` date helpers across files

**File:** `src/data/wearEvents.ts:175`, `src/app/actions/wearEvents.ts:33`
**Issue:** Both files compute today-as-YYYY-MM-DD inline:
- `const today = new Date().toISOString().split('T')[0]` (actions/wearEvents.ts)
- `const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10)` (data/wearEvents.ts)

Minor inconsistency (`split('T')[0]` vs `.slice(0, 10)` produce identical outputs but look different). No bug, just a code-quality smell.

**Fix:** Extract to `src/lib/dateUtils.ts`:
```typescript
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
```
Use consistently across the codebase.

### IN-05: Typed-enum safety gap in `updateProfileSettings` action

**File:** `src/app/actions/profile.ts:45-49`
**Issue:** `VISIBILITY_FIELDS` contains only three entries: `profilePublic`, `collectionPublic`, `wishlistPublic`. The matching Zod enum at line 53 will correctly reject any client-sent field that isn't one of these — good mass-assignment protection (T-08-04 noted at line 43). The file correctly excludes `wornPublic` now that the column is gone.

However, if a future visibility field is added to `profileSettings` (e.g., `notesPublic` as a user-level default), adding it to `VISIBILITY_FIELDS` is a hand-curated step with no compile-time link back to the schema. A typo or omission here silently disables the new setting.

**Fix (future-proofing only):** Link the allow-list to the schema:
```typescript
import { profileSettings } from '@/db/schema'
// Derive keys from the schema table — any schema column that is a boolean
// and ends in 'Public' is automatically allowed:
const VISIBILITY_FIELDS = (Object.keys(profileSettings) as (keyof typeof profileSettings)[])
  .filter((k) => k.endsWith('Public') && typeof profileSettings[k] === 'object')
```
This is Info because the current hand-curation is correct and the three fields are the only ones today.

---

_Reviewed: 2026-04-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
