---
phase: 16-people-search
plan: 02
type: execute
wave: 1
depends_on:
  - 16-01
files_modified:
  - src/data/search.ts
  - src/app/actions/search.ts
autonomous: true
requirements:
  - SRCH-04
  - SRCH-06
  - SRCH-07

must_haves:
  truths:
    - "searchProfiles({ q, viewerId, limit }) returns SearchProfileResult[] honoring D-18..D-22 exactly"
    - "Server-side 2-char minimum short-circuits with [] before any db.select"
    - "WHERE clause includes eq(profileSettings.profilePublic, true) (two-layer privacy)"
    - "WHERE clause uses or(ilike(username), ilike(bio)) ONLY when q.length >= 3; else username-only"
    - "Pre-LIMIT cap of 50 applied to candidate query before per-row overlap compute"
    - "Single batched inArray(follows.followingId, topIds) lookup for isFollowing — no N+1"
    - "Results sorted by overlap DESC then username ASC then sliced to limit (default 20)"
    - "searchPeopleAction Server Action validates input via Zod, gates on getCurrentUser(), wraps DAL errors"
    - "tests/data/searchProfiles.test.ts goes from RED to GREEN after this plan ships"
  artifacts:
    - path: "src/data/search.ts"
      provides: "searchProfiles DAL — the single source of truth for People search queries"
      exports: ["searchProfiles"]
    - path: "src/app/actions/search.ts"
      provides: "searchPeopleAction Server Action — auth gate + Zod validation + DAL call"
      exports: ["searchPeopleAction"]
  key_links:
    - from: "src/app/actions/search.ts"
      to: "src/data/search.ts"
      via: "import { searchProfiles }"
      pattern: "from '@/data/search'"
    - from: "src/data/search.ts"
      to: "src/db/schema (profiles, profileSettings, follows)"
      via: "innerJoin profileSettings + batched follows query"
      pattern: "profileSettings.profilePublic"
    - from: "src/data/search.ts"
      to: "src/lib/tasteOverlap"
      via: "computeTasteOverlap per-row"
      pattern: "computeTasteOverlap"
---

<objective>
Implement the search DAL and its thin Server Action wrapper.

Purpose: Phase 16 is fundamentally a "people search query" feature. This plan delivers the canonical query under two-layer privacy, the bio-search compound predicate, the per-row taste overlap computation, the batched follow lookup, and the auth-gated Server Action that the Client Component will call.

Output: 2 new files. After this plan, `tests/data/searchProfiles.test.ts` (RED from Plan 01) goes GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-people-search/16-CONTEXT.md
@.planning/phases/16-people-search/16-RESEARCH.md
@.planning/phases/16-people-search/16-VALIDATION.md

@src/data/suggestions.ts
@src/app/actions/suggestions.ts
@src/lib/tasteOverlap.ts
@src/lib/searchTypes.ts
@src/data/follows.ts
@src/data/profiles.ts
@src/lib/auth.ts
@src/lib/actionTypes.ts
@src/db/schema.ts

<interfaces>
<!-- Existing functions and types this plan builds on -->

From src/lib/searchTypes.ts (created in Plan 01):
```ts
export interface SearchProfileResult {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  bioSnippet: string | null
  overlap: number  // 0..1
  sharedCount: number
  sharedWatches: Array<{ watchId: string; brand: string; model: string; imageUrl: string | null }>
  isFollowing: boolean
}
```

From src/data/suggestions.ts (the canonical pattern this DAL mirrors):
```ts
export async function getSuggestedCollectors(
  viewerId: string,
  opts?: { limit?: number; cursor?: SuggestionCursor | null },
): Promise<SuggestionPage>
// Internal pattern: viewer state resolved once, per-candidate Promise.all overlap,
// batched follows lookup via inArray, sort by (overlap DESC, userId ASC), keyset slice.
```

From src/lib/tasteOverlap.ts:
```ts
export function computeTasteOverlap(
  viewer: { watches; preferences; tasteTags },
  owner: { watches; preferences; tasteTags },
): TasteOverlapResult
// Returns: { sharedWatches, overlapLabel: 'Strong overlap' | 'Some overlap' | 'Different taste', ... }
```

From src/db/schema.ts (column names verified):
```ts
profiles: { id (uuid), username (text), displayName (text), avatarUrl (text), bio (text) }
profileSettings: { userId (PK FK), profilePublic (bool), ... }
follows: { id, followerId, followingId, createdAt }
```

From src/lib/auth.ts:
```ts
export async function getCurrentUser(): Promise<{ id: string; email: string }>
// throws UnauthorizedError on no session
```

From src/lib/actionTypes.ts:
```ts
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```

From src/app/actions/suggestions.ts (the canonical Server Action pattern this mirrors):
```ts
// 'use server'
// const schema = z.object({...}).strict()
// 1. let user; try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
// 2. const parsed = schema.safeParse(data); if (!parsed.success) return { success: false, error: 'Invalid request' }
// 3. try { return { success: true, data: await dal(...) } } catch (err) { console.error('[name] ...', err); return { success: false, error: 'user-facing copy' } }
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create src/data/search.ts with searchProfiles DAL</name>
  <files>src/data/search.ts</files>
  <read_first>
    - src/data/suggestions.ts (the canonical pattern — same viewer-state resolution, per-candidate overlap, batched follows lookup; this DAL is structurally identical except for the WHERE clause)
    - src/lib/searchTypes.ts (Plan 01 contract — must satisfy SearchProfileResult exactly)
    - src/db/schema.ts (column names: profiles.bio, profileSettings.profilePublic, follows.followingId)
    - src/lib/tasteOverlap.ts (computeTasteOverlap signature)
    - tests/data/searchProfiles.test.ts (Plan 01 — every test in this file MUST pass after this task)
    - .planning/phases/16-people-search/16-CONTEXT.md (D-18 through D-22 — these decisions are NON-NEGOTIABLE, copy values verbatim)
    - .planning/phases/16-people-search/16-RESEARCH.md Pattern 5 (full implementation sketch — adapt verbatim)
  </read_first>
  <behavior>
    - searchProfiles({ q: 'b', viewerId, limit: 20 }) → returns [] with ZERO db.select calls (D-20)
    - searchProfiles({ q: '   bo  ', viewerId }) → trims, length is 2, runs username-only ILIKE (D-21)
    - searchProfiles({ q: 'bob', viewerId }) → runs or(ilike(username, '%bob%'), ilike(bio, '%bob%')) (D-21)
    - WHERE clause always includes eq(profileSettings.profilePublic, true) (D-18)
    - WHERE clause excludes viewer self via sql`${profiles.id} != ${viewerId}` (Pitfall 10)
    - Candidate select chain calls .limit(50) before JS sort (Pitfall 5)
    - Results sorted DESC by overlap, ASC by username; sliced to limit (default 20) (D-22)
    - One batched inArray(follows.followingId, topIds) query for isFollowing per result (Pitfall C-4)
    - Empty candidate set short-circuits (no follows query, no overlap compute)
  </behavior>
  <action>
Create `src/data/search.ts`. Top of file:

```ts
import 'server-only'

import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm'

import { db } from '@/db'
import { profiles, profileSettings, follows } from '@/db/schema'
import { computeTasteOverlap } from '@/lib/tasteOverlap'
import { computeTasteTags } from '@/lib/tasteTags'
import { getWatchesByUser } from '@/data/watches'
import { getPreferencesByUser } from '@/data/preferences'
import { getAllWearEventsByUser } from '@/data/wearEvents'
import type { SearchProfileResult } from '@/lib/searchTypes'

const TRIM_MIN_LEN = 2     // D-20 server-side 2-char minimum
const BIO_MIN_LEN = 3      // D-21 bio search only when q.length >= 3
const CANDIDATE_CAP = 50   // Pitfall 5 pre-LIMIT cap (defense-in-depth before JS sort)
const DEFAULT_LIMIT = 20   // D-22 final result LIMIT

function overlapBucket(label: 'Strong overlap' | 'Some overlap' | 'Different taste'): number {
  // Mirrors src/data/suggestions.ts overlapBucket — same numeric mapping (D-16)
  if (label === 'Strong overlap') return 0.85
  if (label === 'Some overlap') return 0.55
  return 0.20
}
```

Then export `searchProfiles`:

```ts
/**
 * Phase 16 People Search DAL (SRCH-04).
 *
 * Two-layer privacy (D-18, Pitfall C-3): WHERE profile_public = true + RLS gate
 * on profiles. Private profiles silently excluded — no count adjustment, no
 * placeholder, zero existence leak.
 *
 * Compound predicate (D-21, Pitfall C-5):
 *   q.length === 2: username ILIKE only (bio search at 2 chars is too noisy)
 *   q.length >= 3:  or(username ILIKE, bio ILIKE)
 *
 * Server-side 2-char minimum (D-20, Pitfall C-2): defense-in-depth even though
 * the client also gates the fetch.
 *
 * Order (D-22): overlap DESC, username ASC, LIMIT 20. Overlap is JS-computed so
 * sort happens in Node after a pre-LIMIT 50 cap on the candidate query (Pitfall 5).
 *
 * Anti-N+1 (Pitfall C-4): single batched inArray() follow lookup at the end —
 * mirrors src/data/suggestions.ts.
 */
export async function searchProfiles({
  q,
  viewerId,
  limit = DEFAULT_LIMIT,
}: {
  q: string
  viewerId: string
  limit?: number
}): Promise<SearchProfileResult[]> {
  // D-20 / Pitfall C-2: server-side 2-char minimum
  const trimmed = q.trim()
  if (trimmed.length < TRIM_MIN_LEN) return []

  const pattern = `%${trimmed}%`

  // D-21 / Pitfall C-5: compound predicate
  const matchExpr = trimmed.length >= BIO_MIN_LEN
    ? or(ilike(profiles.username, pattern), ilike(profiles.bio, pattern))
    : ilike(profiles.username, pattern)

  // 1. Candidate pool with two-layer privacy + viewer self-exclusion + pre-LIMIT cap
  const candidates = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
    })
    .from(profiles)
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        eq(profileSettings.profilePublic, true),  // D-18 / Pitfall C-3
        sql`${profiles.id} != ${viewerId}`,        // Pitfall 10 viewer self-exclusion
        matchExpr,
      ),
    )
    .limit(CANDIDATE_CAP)  // Pitfall 5 pre-LIMIT cap

  if (candidates.length === 0) return []

  // 2. Resolve viewer state once
  const [viewerWatches, viewerPrefs, viewerWears] = await Promise.all([
    getWatchesByUser(viewerId),
    getPreferencesByUser(viewerId),
    getAllWearEventsByUser(viewerId),
  ])
  const viewerTags = computeTasteTags({
    watches: viewerWatches,
    totalWearEvents: viewerWears.length,
    collectionAgeDays: 30,
  })

  // 3. Per-candidate overlap (mirrors src/data/suggestions.ts step 4)
  const scored = await Promise.all(
    candidates.map(async (c) => {
      const [ownerWatches, ownerPrefs, ownerWears] = await Promise.all([
        getWatchesByUser(c.userId),
        getPreferencesByUser(c.userId),
        getAllWearEventsByUser(c.userId),
      ])
      const ownerTags = computeTasteTags({
        watches: ownerWatches,
        totalWearEvents: ownerWears.length,
        collectionAgeDays: 30,
      })
      const overlapResult = computeTasteOverlap(
        { watches: viewerWatches, preferences: viewerPrefs, tasteTags: viewerTags },
        { watches: ownerWatches, preferences: ownerPrefs, tasteTags: ownerTags },
      )
      const overlap = overlapBucket(overlapResult.overlapLabel)  // D-16 numeric mapping
      return {
        userId: c.userId,
        username: c.username,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
        bio: c.bio,
        bioSnippet: c.bio,  // line-clamp-1 handled by UI (D-14); pass full bio
        overlap,
        sharedCount: overlapResult.sharedWatches.length,
        sharedWatches: overlapResult.sharedWatches.slice(0, 3).map((s) => ({
          watchId: s.viewerWatch.id,
          brand: s.viewerWatch.brand,
          model: s.viewerWatch.model,
          imageUrl: s.viewerWatch.imageUrl ?? null,
        })),
      }
    }),
  )

  // 4. D-22: sort by overlap DESC, username ASC, then slice to limit
  const ordered = scored.sort(
    (a, b) => b.overlap - a.overlap || a.username.localeCompare(b.username),
  )
  const top = ordered.slice(0, limit)

  // 5. Pitfall C-4: batched isFollowing lookup
  const topIds = top.map((r) => r.userId)
  const followingRows = topIds.length
    ? await db
        .select({ id: follows.followingId })
        .from(follows)
        .where(
          and(
            eq(follows.followerId, viewerId),
            inArray(follows.followingId, topIds),
          ),
        )
    : []
  const followingSet = new Set(followingRows.map((r) => r.id))

  return top.map((r) => ({ ...r, isFollowing: followingSet.has(r.userId) }))
}
```

NOTES:
- Per Open Question 1 in RESEARCH.md, location is NEW `src/data/search.ts` (not `src/data/profiles.ts`) — keeps the heavy taste-overlap dependency tree out of the primitive profile DAL, mirrors `src/data/suggestions.ts` precedent.
- The `signal?` parameter is intentionally omitted from the public signature — Server Actions cannot natively forward AbortSignal to the DB driver, and the abort is honored by the browser fetch transport (Assumption A1 in RESEARCH.md).
- `bioSnippet` is set equal to `bio` here; the UI applies `line-clamp-1` for visual truncation (D-14). If a future plan wants server-side truncation it can refine this field without breaking callers.
  </action>
  <verify>
    <automated>npm run test -- tests/data/searchProfiles.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/data/search.ts` returns 0
    - `grep -q "import 'server-only'" src/data/search.ts` matches
    - `grep -q 'eq(profileSettings.profilePublic, true)' src/data/search.ts` matches (D-18 / Pitfall C-3)
    - `grep -q 'inArray(follows.followingId' src/data/search.ts` matches (Pitfall C-4)
    - `grep -q 'q.trim().length < 2\\|trimmed.length < TRIM_MIN_LEN' src/data/search.ts` matches (D-20 / Pitfall C-2)
    - `grep -qE "trimmed\\.length >= BIO_MIN_LEN|q\\.length >= 3|>= 3" src/data/search.ts` matches (D-21 / Pitfall C-5)
    - `grep -Eq "limit\\(\\s*CANDIDATE_CAP\\s*\\)|limit\\(\\s*50\\s*\\)" src/data/search.ts` matches (Pitfall 5 pre-LIMIT cap)
    - `grep -Eq "limit\\(\\s*20\\s*\\)|DEFAULT_LIMIT\\s*=\\s*20" src/data/search.ts` matches (D-22)
    - `grep -q 'localeCompare' src/data/search.ts` matches (D-22 username ASC tie-break)
    - `grep -q 'sql' src/data/search.ts &amp;&amp; grep -q '!= ' src/data/search.ts` matches (viewer self-exclusion)
    - `npm run test -- tests/data/searchProfiles.test.ts` exits 0 (Plan 01 RED → GREEN)
  </acceptance_criteria>
  <done>searchProfiles DAL is GREEN against all Plan 01 tests; D-18..D-22 + Pitfalls C-2..C-5 + Pitfall 5 + Pitfall 10 verifiable by grep.</done>
</task>

<task type="auto">
  <name>Task 2: Create src/app/actions/search.ts with searchPeopleAction</name>
  <files>src/app/actions/search.ts</files>
  <read_first>
    - src/app/actions/suggestions.ts (the canonical Server Action pattern — copy structure verbatim)
    - src/lib/auth.ts (getCurrentUser + UnauthorizedError)
    - src/lib/actionTypes.ts (ActionResult shape)
    - src/data/search.ts (just created — searchProfiles signature)
    - src/lib/searchTypes.ts (SearchProfileResult)
    - .planning/phases/16-people-search/16-RESEARCH.md Pattern 1 (full action sketch)
  </read_first>
  <action>
Create `src/app/actions/search.ts` mirroring `src/app/actions/suggestions.ts` byte-for-byte for structure:

```ts
'use server'

import { z } from 'zod'

import { getCurrentUser } from '@/lib/auth'
import { searchProfiles } from '@/data/search'
import type { ActionResult } from '@/lib/actionTypes'
import type { SearchProfileResult } from '@/lib/searchTypes'

// Zod schema with .strict() rejects mass-assignment attempts. .max(200) bounds
// the input length (Server Action will reject obviously-malicious giant strings
// before they reach the DAL trim/length guard).
const searchSchema = z
  .object({
    q: z.string().max(200),
  })
  .strict()

/**
 * Phase 16 People Search Server Action (SRCH-04).
 *
 * Auth-gated (getCurrentUser → UnauthorizedError → 'Not authenticated').
 * Input validated by Zod (.strict() blocks mass-assignment per Plan 13 D-25).
 * DAL failures logged with [searchPeopleAction] prefix; user-facing copy is
 * intentionally generic so we never leak Postgres error details.
 *
 * Returns ActionResult<SearchProfileResult[]> — the Client Component
 * (Plan 03 useSearchState hook) discriminates success/error and updates state.
 *
 * The DAL enforces the 2-char server-side minimum (D-20 / Pitfall C-2). This
 * action does NOT pre-filter — keeping the gate in one place makes the
 * security invariant easier to audit. Empty results from short queries are
 * returned as { success: true, data: [] }.
 */
export async function searchPeopleAction(
  data: unknown,
): Promise<ActionResult<SearchProfileResult[]>> {
  let user
  try {
    user = await getCurrentUser()
  } catch {
    return { success: false, error: 'Not authenticated' }
  }

  const parsed = searchSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid request' }
  }

  try {
    const results = await searchProfiles({
      q: parsed.data.q,
      viewerId: user.id,
      limit: 20,  // D-22
    })
    return { success: true, data: results }
  } catch (err) {
    console.error('[searchPeopleAction] unexpected error:', err)
    return { success: false, error: "Couldn't run search." }
  }
}
```
  </action>
  <verify>
    <automated>npm run test -- tests/data/searchProfiles.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/app/actions/search.ts` returns 0
    - `grep -q "'use server'" src/app/actions/search.ts` matches
    - `grep -q 'getCurrentUser' src/app/actions/search.ts` matches
    - `grep -q 'searchSchema.safeParse' src/app/actions/search.ts` matches
    - `grep -q "z.object" src/app/actions/search.ts &amp;&amp; grep -q '.strict()' src/app/actions/search.ts` matches
    - `grep -q 'searchProfiles' src/app/actions/search.ts` matches
    - `grep -q 'Not authenticated' src/app/actions/search.ts` matches (auth gate copy)
    - `grep -q 'Invalid request' src/app/actions/search.ts` matches (validation gate copy)
    - `grep -Fq '[searchPeopleAction]' src/app/actions/search.ts` matches (log prefix; fixed-string mode)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Server Action exists, auth-gated, Zod-validated, calls DAL, returns ActionResult.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Server Action | searchPeopleAction is called from the Client Component; Next.js handles transport + CSRF (origin validation). |
| Server Action → DAL | Trusted internal call with sanitized inputs (Zod-validated q). |
| DAL → Postgres | Drizzle parameterizes ilike() bindings; no string concatenation. |
| Postgres → DAL | RLS on profiles + profile_settings tables (Phase 6 + 8) + DAL WHERE = two-layer privacy. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-16-01 | Tampering (SQLi) | src/data/search.ts | mitigate | Use Drizzle `ilike(profiles.username, pattern)` and `ilike(profiles.bio, pattern)` where `pattern` is a JS string; Drizzle binds via parameter. NEVER use `sql\`%${q}%\`` template-literal interpolation on user input. The only `sql\`...\`` usage is `sql\`${profiles.id} != ${viewerId}\`` where viewerId is a server-derived UUID, not user input. |
| T-16-03 | Information Disclosure (privacy leak via private profile search) | src/data/search.ts | mitigate | `eq(profileSettings.profilePublic, true)` in WHERE (D-18). RLS on profiles + profile_settings provides second layer (Phase 6/8). Test 5 in Plan 01 asserts the WHERE predicate is present. |
| T-16-04 | DoS (search-driven DB load) | src/data/search.ts + src/app/actions/search.ts | mitigate | Server-side 2-char minimum short-circuits before any db.select (D-20). 50-row pre-LIMIT cap on candidate query (Pitfall 5). Final 20-row LIMIT after JS sort. Server Action requires auth (getCurrentUser → 401 if anon) — no anonymous search. Zod `.max(200)` bounds input length. |
| T-16-06 | Tampering (self-follow exploitation via search self-row) | src/data/search.ts | mitigate | `sql\`${profiles.id} != ${viewerId}\`` viewer self-exclusion in WHERE (Pitfall 10). |
| T-16-07 | DoS / performance (N+1 follow lookup) | src/data/search.ts | mitigate | Single batched `inArray(follows.followingId, topIds)` query AFTER the slice — runs once regardless of result count (Pitfall C-4). Verified by Plan 01 Test 11. |
| T-16-08 | Tampering (CSRF on Server Action) | src/app/actions/search.ts | mitigate | Next 16 Server Actions enforce origin-header validation built-in. Auth gate via `getCurrentUser()` + Supabase SSR cookie ensures the actor is bound to a session. |
| T-16-01b | Tampering (Zod bypass) | src/app/actions/search.ts | mitigate | `z.object({ q: z.string().max(200) }).strict()` rejects unknown fields (mass-assignment block) and bounds string length. `safeParse` returns generic 'Invalid request' error so we never leak schema details to the caller. |
</threat_model>

<verification>
After both tasks complete:

1. `npm run test -- tests/data/searchProfiles.test.ts` exits 0 — Plan 01 RED tests are now GREEN.
2. `npm run test` — full suite GREEN (no regressions in other phases).
3. `npm run lint` — exits 0 (no ESLint violations).
4. `npx tsc --noEmit` — exits 0.
5. `grep -rn "from '@/data/search'" src/` shows only `src/app/actions/search.ts` (the only consumer this plan creates; Plans 03/05 add more consumers).
</verification>

<success_criteria>
Plan 02 succeeds when:
- `src/data/search.ts` exports `searchProfiles` honoring D-18 through D-22 (verified by grep + tests)
- `src/app/actions/search.ts` exports `searchPeopleAction` with Zod + auth gate
- All Plan 01 tests in `tests/data/searchProfiles.test.ts` pass
- Full suite GREEN
- Single commit `feat(16): searchProfiles DAL + searchPeopleAction Server Action`
</success_criteria>

<output>
After completion, create `.planning/phases/16-people-search/16-02-SUMMARY.md` recording:
- 2 files created (paths + line counts)
- Plan 01 RED → GREEN transition snapshot for `tests/data/searchProfiles.test.ts`
- Full-suite test count (before vs after)
- Note: EXPLAIN ANALYZE checkpoint (Pitfall C-1) is deferred to Plan 05 final task
</output>
