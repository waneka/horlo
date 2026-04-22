---
phase: 260421-rdb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/data/watches.ts
  - src/app/watch/[id]/page.tsx
  - src/components/watch/WatchDetail.tsx
  - tests/data/getWatchByIdForViewer.test.ts
autonomous: true
requirements:
  - BUG-260421-RDB
tags: [privacy, dal, bugfix]

must_haves:
  truths:
    - "Viewer (signed in as account A) can load /watch/[id] for a watch owned by account B when B's profile_public=true AND the relevant per-tab flag is true"
    - "Owner always loads their own watch detail page regardless of privacy settings"
    - "Non-owner viewing a private watch gets 404 (same path as non-existent watch — no info leak)"
    - "Owner-only actions (Edit / Delete / Mark as Worn / Flag as a good deal) are hidden when the viewer is not the owner"
    - "Existing owner-only call sites (edit page, markAsWorn action) remain owner-scoped and unchanged"
  artifacts:
    - path: "src/data/watches.ts"
      provides: "getWatchByIdForViewer(viewerId, watchId) — privacy-aware DAL that returns {watch, isOwner} or null"
      exports: ["getWatchByIdForViewer"]
    - path: "src/app/watch/[id]/page.tsx"
      provides: "Route that calls getWatchByIdForViewer and passes viewerCanEdit to WatchDetail"
    - path: "src/components/watch/WatchDetail.tsx"
      provides: "Detail view that gates owner-only actions behind viewerCanEdit prop"
    - path: "tests/data/getWatchByIdForViewer.test.ts"
      provides: "Unit (mocked Drizzle) + integration (gated on Supabase env) privacy matrix"
      contains: "describe('getWatchByIdForViewer"
  key_links:
    - from: "src/app/watch/[id]/page.tsx"
      to: "src/data/watches.ts::getWatchByIdForViewer"
      via: "await call in Promise.all"
      pattern: "getWatchByIdForViewer\\(user\\.id, id\\)"
    - from: "src/data/watches.ts::getWatchByIdForViewer"
      to: "profile_settings table"
      via: "innerJoin + WHERE on profile_public / collection_public / wishlist_public"
      pattern: "profileSettings"
    - from: "src/components/watch/WatchDetail.tsx"
      to: "viewerCanEdit prop"
      via: "conditional render around Edit/Delete/Mark-as-Worn/Flag-as-a-good-deal"
      pattern: "viewerCanEdit"
---

<objective>
Fix 404 on watch detail pages for watches owned by other users. Current route `src/app/watch/[id]/page.tsx:16` calls `getWatchById(user.id, id)` which filters `WHERE userId = ? AND id = ?` — so ANY watch not owned by the viewer returns null and the page calls `notFound()`. This broke as of Phase 10 because Network Home (activity feed, WYWT rail, recommendations) and Phase 9 profile pages now link to watches owned by other users.

Add a viewer-aware DAL `getWatchByIdForViewer(viewerId, watchId)` that mirrors `getWearRailForViewer`'s privacy pattern exactly: owner always sees own; non-owner sees the watch only if `profile_public=true` AND the relevant per-tab flag (`collection_public` for owned/sold/grail, `wishlist_public` for wishlist) is true. Non-existent and private return the same `null` (uniform path — no info leak).

Do NOT rename or remove `getWatchById(userId, watchId)` — the edit page and `markAsWorn` server action legitimately need the owner-only version.

Purpose: Restore the ability to view a shared watch without abandoning privacy. Two-layer enforcement (RLS already at DB level, DAL WHERE clause here).
Output: Three files modified, one test file created, 404 goes away for public watches, stays for private/missing watches.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@./AGENTS.md
@./CLAUDE.md

@src/data/watches.ts
@src/data/wearEvents.ts
@src/app/watch/[id]/page.tsx
@src/components/watch/WatchDetail.tsx
@tests/data/getWearRailForViewer.test.ts

<interfaces>
<!-- Key types and contracts. Extracted from the codebase — do not re-explore. -->

Domain Watch type — src/lib/types.ts (abbreviated):
```typescript
type WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'
interface Watch {
  id: string
  brand: string
  model: string
  status: WatchStatus
  // ...full shape already returned by mapRowToWatch in src/data/watches.ts
}
```

Drizzle tables (src/db/schema.ts):
```typescript
// watches — has userId FK
watches.id (uuid, pk)
watches.userId (uuid, FK users.id)
watches.status (enum: 'owned' | 'wishlist' | 'sold' | 'grail')
// ...all other Watch fields

// profile_settings — pk on userId
profileSettings.userId (uuid, pk, FK users.id)
profileSettings.profilePublic (boolean, default true)
profileSettings.collectionPublic (boolean, default true)
profileSettings.wishlistPublic (boolean, default true)
profileSettings.wornPublic (boolean, default true)
```

Existing owner-only DAL (unchanged by this plan — keep as-is):
```typescript
// src/data/watches.ts (existing, line 98)
export async function getWatchById(userId: string, watchId: string): Promise<Watch | null>
// callers that MUST keep using this:
//   src/app/watch/[id]/edit/page.tsx:13
//   src/app/actions/wearEvents.ts:28
```

Precedent pattern — privacy-aware DAL (src/data/wearEvents.ts):
```typescript
// getWearRailForViewer: innerJoin profileSettings, WHERE self OR (profile_public AND worn_public)
// getPublicWearEventsForViewer: two-step — look up settings, short-circuit on wornPublic=false
// Either shape is acceptable here. Prefer the single JOIN form for watch detail: one query, owner short-circuit via OR.
```

mapRowToWatch (src/data/watches.ts:17) — reuse as-is; it converts the Drizzle row to the Watch domain type. The new DAL function must return through this mapper (do NOT duplicate the mapping).
</interfaces>

<privacy_matrix>
<!-- The complete matrix the DAL must satisfy. Derived from constraints block. -->
| Relationship | watch.status | profile_public | status_flag | Result |
|--------------|-------------|----------------|-------------|--------|
| viewer == owner | any | any | any | watch + isOwner=true |
| viewer != owner | owned/sold/grail | true | collection_public=true | watch + isOwner=false |
| viewer != owner | wishlist | true | wishlist_public=true | watch + isOwner=false |
| viewer != owner | any | false | any | null (same as missing) |
| viewer != owner | owned/sold/grail | true | collection_public=false | null |
| viewer != owner | wishlist | true | wishlist_public=false | null |
| anyone | watch missing | — | — | null |
</privacy_matrix>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write failing unit + integration tests for getWatchByIdForViewer</name>
  <files>tests/data/getWatchByIdForViewer.test.ts</files>
  <behavior>
    Mirror the structure of tests/data/getWearRailForViewer.test.ts exactly — two parts:

    PART A — Unit tests (always run; mock @/db):
    - Unit 1: returns null when DB yields no rows
    - Unit 2: owner path — viewerId === watch.userId returns { watch, isOwner: true } (single select call, no profile_settings join required — OR owner branch short-circuits in JOIN form)
    - Unit 3: non-owner + profile_public=false path — returns null
    - Unit 4: non-owner + owned watch + collection_public=true → returns { watch, isOwner: false }
    - Unit 5: non-owner + owned watch + collection_public=false → returns null
    - Unit 6: non-owner + wishlist watch + wishlist_public=true → returns { watch, isOwner: false }
    - Unit 7: non-owner + wishlist watch + wishlist_public=false → returns null
    - Unit 8: non-owner + sold watch uses collection_public (verify by returning collection_public=true and asserting non-null)
    - Unit 9: non-owner + grail watch uses collection_public (same assertion)
    - Unit 10: maps DB row through mapRowToWatch — returned `watch.id`, `watch.brand`, `watch.status` match input row fields

    PART B — Integration tests (gated `const hasLocalDb = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY); const maybe = hasLocalDb ? describe : describe.skip`):
    - Seed two users A + B via seedTwoUsers fixture (same as getWearRailForViewer.test.ts)
    - Seed B's profile_settings with profilePublic=true, collectionPublic=true, wishlistPublic=true
    - Seed B with 1 owned + 1 wishlist watch
    - Integration 1: A views B's owned watch → returns { watch, isOwner: false }
    - Integration 2: B views B's own watch → returns { watch, isOwner: true }
    - Integration 3: flip B.collection_public=false → A sees null for B's owned watch; B still sees own
    - Integration 4: flip B.collection_public back, B.wishlist_public=false → A sees null for B's wishlist watch; A still sees B's owned watch
    - Integration 5: flip B.profile_public=false → A sees null for BOTH owned and wishlist; B still sees own (profile_public acts as outer gate)
    - Integration 6: non-existent watchId → null regardless of viewer
    - Cleanup: delete seeded watches + restore settings in afterAll (best-effort try/catch like the precedent)

    Follow the precedent exactly for the mock chain shape (makeWatchChain with from/innerJoin/where that records calls). This is the first step — the DAL function does not exist yet, so the import will fail compilation. That is the desired RED state.
  </behavior>
  <action>
    Create `tests/data/getWatchByIdForViewer.test.ts` following the EXACT structure of `tests/data/getWearRailForViewer.test.ts`:

    1. Top-of-file: `import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'` and `import type { Watch } from '@/lib/types'`.

    2. PART A scaffolding (before imports of the DAL):
       - A `calls: Call[]` array
       - A `makeWatchChain()` helper that returns an object with `from`, `innerJoin`, `where` methods. `where` should return a Promise resolving to `watchRows` (a mutable let-binding). Reset state in `beforeEach`.
       - `vi.mock('@/db', () => ({ db: { select: (...args) => { calls.push(...); return makeWatchChain() } } }))`
       - `import { getWatchByIdForViewer } from '@/data/watches'` (import AFTER the mock block)

    3. PART A test cases (Unit 1..10) per the behavior spec above. Construct DB rows with the full watch field set (copy the shape from the existing wear test's seedWatch → mapRowToWatch round-trip if helpful; fields: id, userId, brand, model, status, movement, complications, styleTags, designTraits, roleTags, + nullable fields as null + createdAt/updatedAt as new Date()). Also include the profileSettings joined columns (profilePublic, collectionPublic, wishlistPublic) in the row — since the DAL uses innerJoin, the row shape is the select projection, not the table row.

    4. PART B scaffolding (`const hasLocalDb = ...; const maybe = hasLocalDb ? describe : describe.skip`):
       - Import `seedTwoUsers` from `../fixtures/users` (the fixture the precedent uses)
       - In `beforeAll`: seed profiles + profile_settings for both users via direct `db.insert(...).onConflictDoNothing()`. Use the same trigger-aware pattern from STATE.md ("Phase 10 Plan 09 trigger-aware integration seeding") — if profiles rows are auto-created by a trigger, UPDATE them instead of INSERT to avoid PK collisions.
       - Use `watchDAL.createWatch(userId, {...})` to seed watches (same pattern as getWearRailForViewer.test.ts).
       - `afterAll` cleans up watches and settings flips, then calls `seed.cleanup()`.

    5. Do NOT add the DAL function yet — the test must fail (RED) because `getWatchByIdForViewer` is not exported from `@/data/watches`. Confirm RED before marking this task done.

    Project context note: Per AGENTS.md, this is Next.js 16 — no API changes in test files are relevant, but do not import from `next/server` or similar without checking. Vitest is already configured (see STATE.md: 697 tests passing, 18 test files).
  </action>
  <verify>
    <automated>npx vitest run tests/data/getWatchByIdForViewer.test.ts 2>&amp;1 | tail -40</automated>
  </verify>
  <done>Test file exists. Running `npx vitest run tests/data/getWatchByIdForViewer.test.ts` produces compilation/import errors or "getWatchByIdForViewer is not a function" failures — this is the desired RED state. The file scaffolding (mocks, fixtures, describe blocks, all Unit 1..10 and Integration 1..6 cases) is fully written; it just can't pass yet because the DAL function doesn't exist.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement getWatchByIdForViewer DAL + wire route + gate owner-only actions</name>
  <files>src/data/watches.ts, src/app/watch/[id]/page.tsx, src/components/watch/WatchDetail.tsx</files>
  <behavior>
    After this task:
    - Unit tests 1..10 from Task 1 pass
    - Integration tests 1..6 from Task 1 pass (when Supabase env is set)
    - Existing tests in tests/data/getWearRailForViewer.test.ts, getFeedForUser.test.ts, isolation.test.ts continue to pass (no regressions)
    - Manual: signed in as A, visiting `/watch/{B-owned-public}` renders the detail page without the Edit / Delete / Mark as Worn / Flag-as-good-deal controls
    - Manual: signed in as A, visiting `/watch/{B-owned-private}` renders 404
    - Manual: signed in as B, visiting `/watch/{B-owned}` renders the detail page with all owner actions
    - Compile: `npm run lint` clean; no new TypeScript errors anywhere in the project
  </behavior>
  <action>
    GREEN implementation in three files — this is the smallest change that turns Task 1 tests green.

    **2a. src/data/watches.ts — add `getWatchByIdForViewer` (do NOT touch existing `getWatchById`):**

    Append after the existing `getWatchById` function:

    ```typescript
    /**
     * Viewer-aware fetch for /watch/[id]. Returns { watch, isOwner } or null.
     *
     * Privacy gate (mirrors getWearRailForViewer — two-layer per CLAUDE.md + STATE.md):
     *   - OUTER: RLS on watches (MR-03 when added) is owner-only at anon-key.
     *   - INNER (this WHERE clause): self-include short-circuits (OR owner branch);
     *     non-owner rows require profile_public=true AND the per-tab flag for the
     *     watch's status (collection_public for owned/sold/grail, wishlist_public
     *     for wishlist).
     *
     * Missing watch and "exists but private" both return null — uniform path
     * avoids leaking existence of private watches (precedent: Phase 10 WYWT DAL).
     */
    export async function getWatchByIdForViewer(
      viewerId: string,
      watchId: string,
    ): Promise<{ watch: Watch; isOwner: boolean } | null> {
      const rows = await db
        .select({
          watch: watches,
          profilePublic: profileSettings.profilePublic,
          collectionPublic: profileSettings.collectionPublic,
          wishlistPublic: profileSettings.wishlistPublic,
        })
        .from(watches)
        .innerJoin(profileSettings, eq(profileSettings.userId, watches.userId))
        .where(
          and(
            eq(watches.id, watchId),
            or(
              eq(watches.userId, viewerId), // owner short-circuit
              and(
                eq(profileSettings.profilePublic, true),
                // per-tab gate by status — wishlist uses wishlist_public,
                // owned/sold/grail use collection_public
                sql`(
                  (${watches.status} = 'wishlist' AND ${profileSettings.wishlistPublic} = true)
                  OR (${watches.status} IN ('owned','sold','grail') AND ${profileSettings.collectionPublic} = true)
                )`,
              ),
            ),
          ),
        )
        .limit(1)

      const row = rows[0]
      if (!row) return null
      return {
        watch: mapRowToWatch(row.watch),
        isOwner: row.watch.userId === viewerId,
      }
    }
    ```

    Update imports at top of file to include `or` and `sql` from `drizzle-orm`, and add `profileSettings` to the existing `@/db/schema` import:

    ```typescript
    import { eq, and, or, sql } from 'drizzle-orm'
    import { watches, profileSettings } from '@/db/schema'
    ```

    Why this shape: mirrors `getWearRailForViewer` (single JOIN + WHERE with `or` branch for self-include). The `select({ watch: watches, ... })` pattern returns the full table row keyed under `watch` so `mapRowToWatch(row.watch)` keeps the existing mapper untouched.

    **2b. src/app/watch/[id]/page.tsx — swap DAL call and pass viewerCanEdit:**

    Replace:
    ```typescript
    import { getWatchById, getWatchesByUser } from '@/data/watches'
    // ...
    const [watch, collection, preferences] = await Promise.all([
      getWatchById(user.id, id),
      getWatchesByUser(user.id),
      getPreferencesByUser(user.id),
    ])
    if (!watch) notFound()
    const lastWornDate = await getMostRecentWearDate(user.id, watch.id)
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <WatchDetail watch={watch} collection={collection} preferences={preferences} lastWornDate={lastWornDate} />
      </div>
    )
    ```

    With:
    ```typescript
    import { getWatchByIdForViewer, getWatchesByUser } from '@/data/watches'
    // ...
    const [result, collection, preferences] = await Promise.all([
      getWatchByIdForViewer(user.id, id),
      getWatchesByUser(user.id),
      getPreferencesByUser(user.id),
    ])
    if (!result) notFound()
    const { watch, isOwner } = result
    // lastWornDate is OWNER-SCOPED (wear events of the watch owner, not the viewer).
    // When viewer != owner, owner's worn_public was NOT consulted here because the
    // detail page renders lastWornDate in the owner's context as a published fact
    // of the watch. If that leaks too much, gate on owner's worn_public in a
    // follow-up — for this bugfix, match existing behavior: look up by owner.
    const lastWornDate = isOwner
      ? await getMostRecentWearDate(user.id, watch.id)
      : await getMostRecentWearDate(watch /* we only have watch.id; userId is on the row — see note */, watch.id)
    ```

    ACTUALLY — simpler: `getMostRecentWearDate(userId, watchId)` needs the owner's userId. The current `result` doesn't carry `watch.userId` because `mapRowToWatch` strips it. Two options:
    - (A) Extend `getWatchByIdForViewer` to return `{ watch, isOwner, ownerId }`.
    - (B) Only fetch lastWornDate when `isOwner === true` (skip for non-owners — the "Last worn" line in WatchDetail is already inside `(watch.status === 'owned' || watch.status === 'grail')` and arguably the non-owner shouldn't see owner's wear dates anyway — it's governed by `worn_public`).

    Pick (B). The "Last worn" and "Last Worn" tracking card in WatchDetail already surface owner's private wear data; showing these to non-owners would bypass `worn_public`. Set `lastWornDate = null` for non-owners and let the component's existing nullability handle render. Final shape:

    ```typescript
    const lastWornDate = isOwner ? await getMostRecentWearDate(user.id, watch.id) : null

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <WatchDetail
          watch={watch}
          collection={collection}
          preferences={preferences}
          lastWornDate={lastWornDate}
          viewerCanEdit={isOwner}
        />
      </div>
    )
    ```

    Rationale: `worn_public` is NOT checked here — the simplest correct default is "non-owner never sees wear dates from the detail page." If later we want to honor `worn_public` for non-owners, it's a one-line lookup add. For this bugfix, the conservative default is "don't leak."

    **2c. src/components/watch/WatchDetail.tsx — gate owner-only actions:**

    1. Extend the props interface:
       ```typescript
       interface WatchDetailProps {
         watch: Watch
         collection: Watch[]
         preferences: UserPreferences
         lastWornDate?: string | null
         viewerCanEdit?: boolean  // defaults to true for backward compat with existing callers
       }
       ```

    2. Default the prop in the destructure:
       ```typescript
       export function WatchDetail({ watch, collection, preferences, lastWornDate, viewerCanEdit = true }: WatchDetailProps)
       ```

    3. Wrap the entire "Actions" block (`<div className="flex flex-wrap gap-2">` around line 169 containing Mark as Worn, Edit, Dialog/Delete) in `{viewerCanEdit && (...)}`.

    4. Wrap the "Flag as a good deal" block (the `{isWishlistLike && (...)}` around line 152) in an additional condition: `{isWishlistLike && viewerCanEdit && (...)}`.

    5. Wrap the "Last worn line" block (around line 134, `{(watch.status === 'owned' || watch.status === 'grail') && (...)}`) in `{viewerCanEdit && (...)}` — non-owners should not see owner's wear state on the detail page (matches the route's decision to pass `lastWornDate = null` to non-owners, but also hides the "Not worn yet" placeholder text).

    6. Leave the "Tracking" card's "Last Worn" cell alone — it already falls back to `formatDate(undefined)` → 'Never' when `lastWornDate` is null. (If the product later wants to hide the entire Tracking card for non-owners, that's a UI-SPEC decision — out of scope for this bugfix.)

    Do NOT change anything about the Server Actions themselves (`editWatch`, `removeWatch`, `markAsWorn` in `src/app/actions/*`) — they already double-verify auth and scope by userId. A client-side UI gate is the UX fix; the server-side enforcement is already correct.

    **Verification order:**
    1. Run the new test file → all Unit 1..10 pass (GREEN).
    2. Integration 1..6 pass when Supabase env vars are set locally (skipped otherwise).
    3. Run the full suite → no regressions.
    4. Run `npm run lint` → clean.
    5. Manual smoke (out-of-scope for automated verify but worth doing before commit): `npm run dev`, sign in as A, visit `/watch/{any-B-owned-public-watch}` → page renders, no Edit/Delete/Mark-as-Worn/Flag buttons visible.
  </action>
  <verify>
    <automated>npx vitest run tests/data/getWatchByIdForViewer.test.ts tests/data/getWearRailForViewer.test.ts tests/data/isolation.test.ts 2>&amp;1 | tail -30 &amp;&amp; npm run lint 2>&amp;1 | tail -10</automated>
  </verify>
  <done>
    All Unit tests 1..10 in getWatchByIdForViewer.test.ts pass. Integration 1..6 pass when Supabase env is set (auto-skipped otherwise). No regressions in existing DAL tests (getWearRailForViewer, isolation, getFeedForUser). `npm run lint` is clean. The three source files (watches.ts, page.tsx, WatchDetail.tsx) compile cleanly. Owner can still see own watches with full actions; non-owner sees public watches without owner-only controls; non-owner sees 404 for private/missing watches via uniform null return.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → server (App Router RSC) | Viewer's session (`getCurrentUser()`) is trusted at proxy.ts edge; the DAL must not trust viewer-supplied `watchId` as an authorization signal |
| DAL → Postgres | Direct queries via Drizzle. RLS at DB is defense-in-depth; the DAL WHERE clause is the enforceable privacy gate for server-rendered pages running under postgres role |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-RDB-01 | Information Disclosure | `getWatchByIdForViewer` — private watch visibility | mitigate | WHERE clause requires `profile_public=true AND status-appropriate flag=true` for non-owners; owner short-circuit is scoped to `watches.userId === viewerId` |
| T-RDB-02 | Information Disclosure | `getWatchByIdForViewer` — existence leak via differential responses | mitigate | Non-existent watch AND exists-but-private both return `null`; the route calls `notFound()` in both cases — identical 404 response (precedent: Phase 10 WYWT DAL "identical error on missing vs private" — STATE.md) |
| T-RDB-03 | Information Disclosure | Detail page `lastWornDate` | mitigate | Non-owner never receives `lastWornDate` (page passes `null`); conservative default honors `worn_public` intent without adding a separate flag lookup |
| T-RDB-04 | Elevation of Privilege | Owner-only actions rendered to non-owners | mitigate | `viewerCanEdit` prop gates Edit/Delete/Mark as Worn/Flag UI; server-side Server Actions (`editWatch`, `removeWatch`, `markAsWorn`) already double-verify auth+ownership so a crafted client cannot bypass |
| T-RDB-05 | Information Disclosure | `collection` and `preferences` passed to WatchDetail reflect VIEWER's data, not owner's | accept | Intentional — similarity/gapFill insights are computed against the viewer's own collection+preferences (this is the existing design; out of scope for a privacy bugfix). The watch being viewed is owned by someone else, but the SimilarityBadge compares it against the viewer's taste — which is the core value prop |
| T-RDB-06 | Tampering | Client-side prop manipulation to re-enable Edit button | accept | Mitigated by server-side double-verified auth in Server Actions (STATE.md DATA-04). Even if a user dev-tools-flips `viewerCanEdit=true`, `editWatch` / `removeWatch` / `markAsWorn` all verify the watch belongs to `user.id` in the DAL layer |
</threat_model>

<verification>
1. `npx vitest run tests/data/getWatchByIdForViewer.test.ts` — all Unit 1..10 pass
2. `npx vitest run tests/data/` — no regressions (697 tests should remain passing + 10 new unit tests = 707 minimum; +6 integration when local Supabase is running)
3. `npm run lint` — clean
4. Manual smoke (recommended, not automated):
   - Sign in as account A
   - Visit a watch URL owned by B (find via activity feed or B's public profile)
   - Confirm: page renders, NO Edit / Delete / Mark-as-Worn / Flag-as-good-deal buttons, NO "Last worn" line
   - Sign in as B
   - Visit the same URL
   - Confirm: page renders WITH all owner controls and Last worn line populated
   - As A, flip B.collection_public=false in DB (or via settings UI)
   - Revisit B's owned watch URL → 404
   - Flip back, set B.profile_public=false → all of B's watches return 404 for A
</verification>

<success_criteria>
- Viewing a public watch owned by another user no longer returns 404
- Owner still sees own watches regardless of privacy
- Private watches return 404 (same path as non-existent — no info leak)
- Owner-only actions (Edit, Delete, Mark as Worn, Flag as good deal, Last worn line) hidden for non-owners
- Existing owner-scoped code paths (`/watch/[id]/edit`, `markAsWorn` action) unchanged and still work
- 10 unit tests + 6 integration tests passing (integration gated on local Supabase env)
- No lint or type errors
- No regressions in existing 697 tests
</success_criteria>

<output>
After completion, create `.planning/quick/260421-rdb-fix-404-on-watch-detail-pages-for-watche/260421-rdb-SUMMARY.md` documenting:
- The privacy matrix implemented (owner short-circuit + profile_public + per-tab flag)
- The decision to pass `lastWornDate = null` for non-owners (conservative `worn_public` default without adding a flag lookup)
- The existing `getWatchById` function retained unchanged for owner-only call sites
- The `viewerCanEdit` prop with `= true` default preserves backward compatibility with any future WatchDetail consumers
</output>
