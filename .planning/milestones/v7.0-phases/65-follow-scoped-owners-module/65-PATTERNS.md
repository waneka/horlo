# Phase 65: Follow-Scoped Owners Module - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 6 (2 NEW + 3 MODIFIED + 1 NEW test file)
**Analogs found:** 6 / 6 — every file has an exact prior-art clone in the repo

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/data/follows.ts` (extend) — NEW fn `getFollowedOwnersForCatalog` | DAL (server-only) | viewer-scoped read → SQL JOIN (single query) | `src/data/discovery.ts:72-136` `getCollectorsForCatalog` | **exact** — near-clone +1 INNER JOIN |
| `src/components/insights/FollowedOwnersModule.tsx` — NEW | Server Component (RSC, presentational) | prop-in → conditional render-or-null | `src/components/insights/OtherOwnersRoster.tsx:1-90` | **exact** — same problem class, sibling file |
| `src/app/w/[ref]/page.tsx` — MODIFY | Page composition (RSC) | viewer auth → Promise.all DAL → prop into hero | itself (3 existing Promise.all blocks, lines 171-174 / 423-434 / B2 owned-branch) | **self-extend** — additive only |
| `src/components/watch/WatchDetailHero.tsx` — MODIFY | `'use client'` hero island (presentational composition) | prop-in → conditional render in right column | itself (right-column container at line 230; LikeButton sibling at 276; Last-Worn at 300) | **self-extend** — additive sibling |
| `tests/data/getFollowedOwnersForCatalog.test.ts` — NEW | DAL integration test | seeded fixtures → DAL call → expect | `tests/data/getCollectorsForCatalog.test.ts:1-312` | **exact** — full mirror + 2 new tests |
| `tests/static/watch-detail-ia-order.test.ts` — EXTEND (optional) | Static fs-scan guard | readFileSync → regex active-line scan | itself (existing PAGE-01/02/03/04 guards) | **self-extend** |

---

## Pattern Assignments

### `src/data/follows.ts` — extend with `getFollowedOwnersForCatalog` (DAL, server-only)

**Analog:** `src/data/discovery.ts:72-136` (`getCollectorsForCatalog`) — the structural template. Phase 65 DAL is this function + ONE extra INNER JOIN on `follows`.

**Imports already present in `src/data/follows.ts`** (lines 1-7) — `follows` table + `profiles` + `profileSettings` + `watches` are ALL already imported. No new import block needed:
```typescript
import 'server-only'

import { cache } from 'react'
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'

import { db } from '@/db'
import { follows, profiles, profileSettings, watches } from '@/db/schema'
```
**Add only:** `asc` to the drizzle-orm import (used by the analog for the secondary sort tie-breaker on `profiles.username`).

---

**Query shape pattern — verbatim from `src/data/discovery.ts:79-100`** (Drizzle relational select, NOT raw SQL):
```typescript
const rows = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      addedAt: watches.createdAt,
    })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),    // T-39b-01 layer 1
        eq(profileSettings.collectionPublic, true), // T-39b-01 layer 2 (D-39b-09 NEW)
        sql`${profiles.id} != ${viewerId}`,         // T-39b-04 self-exclusion
        inArray(watches.status, ['owned', 'wishlist', 'grail']), // A1 / Q1 — exclude sold
      ),
    )
    .orderBy(desc(watches.createdAt), asc(profiles.username))
    .limit(50) // Pitfall 3 — overfetch for JS-side dedup
```

**THE ONE NEW CLAUSE for Phase 65** (insert after the `profileSettings` innerJoin):
```typescript
    .innerJoin(
      follows,
      and(
        eq(follows.followerId, viewerId),    // viewer-as-follower
        eq(follows.followingId, profiles.id), // owner-as-followee → FOLL-02 direction
      ),
    )
```
Mnemonic from RESEARCH.md Pitfall 1: **viewer-as-follower → owner-as-followee**. NOT mutual; NOT reversed.

---

**Count pattern (Pitfall 4) — verbatim from `src/data/discovery.ts:102-118`:**
```typescript
// Pitfall 4 — separate count(DISTINCT) query for totalCount label. Identical
// WHERE clause so privacy layers and status filter apply consistently.
const totalRows = await db
    .select({ count: sql<number>`count(DISTINCT ${profiles.id})::int` })
    .from(watches)
    .innerJoin(profiles, eq(profiles.id, watches.userId))
    .innerJoin(profileSettings, eq(profileSettings.userId, profiles.id))
    .where(
      and(
        eq(watches.catalogId, catalogId),
        eq(profileSettings.profilePublic, true),
        eq(profileSettings.collectionPublic, true),
        sql`${profiles.id} != ${viewerId}`,
        inArray(watches.status, ['owned', 'wishlist', 'grail']),
      ),
    )
const totalCount = totalRows[0]?.count ?? 0
```
**Add the SAME extra INNER JOIN** to this count query — RESEARCH.md is explicit ("identical WHERE clause"; the join is structurally part of the WHERE for privacy-consistency purposes).

---

**Dedup pattern (Pitfall 3) — verbatim from `src/data/discovery.ts:120-135`:**
```typescript
// Pitfall 3 — JS dedup: keep first occurrence per userId (already
// ORDER BY created_at DESC), then slice to top-N.
const seen = new Set<string>()
const collectors: CatalogCollector[] = []
for (const r of rows) {
    if (seen.has(r.userId)) continue
    seen.add(r.userId)
    collectors.push({
      userId: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
    })
    if (collectors.length >= limit) break
}
return { collectors, totalCount }
```
For Phase 65: substitute `FollowedOwner` for `CatalogCollector` and rename the array. The shape is identical (D-02 + D-11 lock it).

---

**Schema columns confirmed (verified in `src/db/schema.ts:238-251`):**
```typescript
export const follows = pgTable(
  'follows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('follows_follower_idx').on(table.followerId),        // ← used by the new INNER JOIN
    index('follows_following_idx').on(table.followingId),
    unique('follows_unique_pair').on(table.followerId, table.followingId),
  ]
)
```
The `follows_follower_idx` index makes the new join cheap; the `follows_unique_pair` constraint guarantees the join can't multiply rows from the follow side.

---

**Type definition pattern — clone of `src/data/discovery.ts:35-40`** (per D-11, lives in `follows.ts` NOT imported from `discovery.ts`):
```typescript
export interface FollowedOwner {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}
```

---

### `src/components/insights/FollowedOwnersModule.tsx` (NEW — RSC, presentational)

**Analog:** `src/components/insights/OtherOwnersRoster.tsx` (entire file, 1-90). Same role (chip roster on a watch detail surface), same import set, same primitives.

**Imports pattern — verbatim from `OtherOwnersRoster.tsx:1-4`:**
```typescript
import Link from 'next/link'

import { AvatarDisplay } from '@/components/profile/AvatarDisplay'
import type { CatalogCollector } from '@/data/discovery'
```
**For Phase 65:** swap the type-only import to:
```typescript
import type { FollowedOwner } from '@/data/follows'
```

---

**Props shape pattern — `OtherOwnersRoster.tsx:41-44`:**
```typescript
interface OtherOwnersRosterProps {
  collectors: CatalogCollector[]
  totalCount: number
}
```
**For Phase 65** (per UI-SPEC §Component Inventory + Module Anatomy):
```typescript
interface FollowedOwnersModuleProps {
  owners: FollowedOwner[]
  totalCount: number
}
```

---

**Hide-if-empty contract — `OtherOwnersRoster.tsx:46-50`** (FOLL-01 contract is literally this two-line pattern):
```typescript
export function OtherOwnersRoster({
  collectors,
  totalCount,
}: OtherOwnersRosterProps) {
  if (collectors.length === 0) return null // D-39b-07 / D-39b-09 hide-if-empty
```

---

**Chip composition + click surface — verbatim from `OtherOwnersRoster.tsx:62-86`** (the load-bearing prior art for FOLL-03):
```typescript
{collectors.map((c) => {
  const name = c.displayName ?? `@${c.username}`
  return (
    <div
      key={c.userId}
      className="group relative flex flex-col items-center gap-2 w-16 shrink-0"
    >
      <Link
        href={`/u/${c.username}/collection`}
        aria-label={`${name}'s collection`}
        className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {/* UI-SPEC requests size=36; AvatarDisplay primitive only supports 40/64/96 — substitute 40 per RESEARCH A4 */}
      <AvatarDisplay
        avatarUrl={c.avatarUrl}
        displayName={c.displayName}
        username={c.username}
        size={40}
      />
      <p className="text-xs text-muted-foreground truncate w-full text-center">
        @{c.username}
      </p>
    </div>
  )
})}
```

**For Phase 65 (D-04 layout divergence — vertical stack instead of horizontal scroll):** Keep ALL of the click-surface primitives (absolute-inset `<Link>`, `aria-label`, `focus-visible:ring-2 focus-visible:ring-ring`, `AvatarDisplay size={40}`). Swap the outer wrapper from `flex flex-col items-center gap-2 w-16 shrink-0` (column chip in a horizontal-scroll row) to `flex items-center gap-3 min-h-[44px]` (row chip in a vertical-stack list), per UI-SPEC §Module Anatomy (lines 104-126). Wrapper element changes from `<div>` to `<li>` (UI-SPEC uses semantic `<ul>`/`<li>`).

---

**Section wrapper — `OtherOwnersRoster.tsx:52-61`:**
```typescript
return (
  <section className="space-y-2">
    {/* Quick task 260513-m31 — supersedes D-39b-09 "≤5 → suppress" rule;
        count label renders for any totalCount >= 1 with singular/plural copy. */}
    <p className="text-sm text-muted-foreground">
      {totalCount === 1
        ? '1 collector owns this'
        : `${totalCount} collectors own this`}
    </p>
    <div className="flex gap-2 overflow-x-auto scroll-smooth pb-1">
```
**For Phase 65:** keep `<section className="space-y-2">`; ADD `aria-label="People you follow who own this"` (UI-SPEC §Copywriting); SWAP the `<p>` count label for an `<h3 className="text-sm font-medium text-foreground">From your circle</h3>` (D-04a header copy); SWAP the inner horizontal `<div className="flex gap-2 overflow-x-auto …">` for `<ul className="space-y-2">`; ADD the overflow caption `{totalCount > owners.length && <p className="text-xs text-muted-foreground">and {totalCount - owners.length} more</p>}` (D-04c).

---

**Server vs client classification — `OtherOwnersRoster.tsx:1`** has NO `'use client'` directive (verified — file starts with `import Link from 'next/link'`). FollowedOwnersModule MUST be pure RSC for the same reason. The anti-pattern guard from RESEARCH.md (no `'use client'`, no `'use cache'`) applies.

---

### `src/app/w/[ref]/page.tsx` — MODIFY (3-branch call-site integration)

**Analog:** itself. Three existing `Promise.all` blocks already follow the exact pattern Phase 65 needs to extend.

---

**Existing `Promise.all` pattern — Branch 1 (per-user) at `page.tsx:171-174`:**
```typescript
const [collection, preferences] = await Promise.all([
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
])
```
**Phase 65 extension:** add a 3rd entry with the mandatory `watch.catalogId` null-guard (D-01a + Pitfall 6):
```typescript
const [collection, preferences, followedOwners] = await Promise.all([
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
  watch.catalogId
    ? getFollowedOwnersForCatalog(watch.catalogId, user.id, { limit: 5 })
    : Promise.resolve({ owners: [], totalCount: 0 }),
])
```

---

**Existing null-`catalogId` ternary pattern is already in use at `page.tsx:328-329`** — Phase 65 mirrors this exact shape:
```typescript
const sameFamily = watch.catalogId ? await getSameFamilyForCatalog(watch.catalogId) : []
const lineage = watch.catalogId ? await getLineageForReference(watch.catalogId) : []
```
And at `page.tsx:312`:
```typescript
watch.catalogId ? getCatalogById(watch.catalogId) : Promise.resolve(null),
```

---

**Existing `Promise.all` pattern — Branch 2/3 (catalog) at `page.tsx:423-434`** — `getCollectorsForCatalog` is already in this exact `Promise.all`:
```typescript
const [catalogEntry, collection, preferences, viewerOwnedRow, viewerProfile, roster, sameFamily, lineage] = await Promise.all([
  getCatalogById(ref),
  getWatchesByUser(user.id),
  getPreferencesByUser(user.id),
  findViewerWatchByCatalogId(user.id, ref),
  getProfileById(user.id),
  // Phase 39b NSV-18 — catalog other-owners roster (two-layer privacy +
  // self-exclusion + sold-status filter inside the DAL).
  getCollectorsForCatalog(ref, user.id, { limit: 5 }),
  getSameFamilyForCatalog(ref),
  getLineageForReference(ref),
])
```
**Phase 65 extension:** add `getFollowedOwnersForCatalog(ref, user.id, { limit: 5 })` as a peer to `getCollectorsForCatalog` (no ternary needed here — `ref` IS the catalogId on this branch). Tuple destructuring grows from 8 to 9 entries.

---

**Branch 2 owned-detection sub-branch (`page.tsx:456-510` block — the D-06 in-place owned render)** also needs the same DAL call, gated on `ownedWatch.catalogId` per the existing `ownedSameFamily` / `ownedLineage` ternaries at `page.tsx:512-513`:
```typescript
const ownedSameFamily = ownedWatch.catalogId ? await getSameFamilyForCatalog(ownedWatch.catalogId) : []
const ownedLineage = ownedWatch.catalogId ? await getLineageForReference(ownedWatch.catalogId) : []
```

---

**Viewer/auth resolution pattern — `page.tsx:153`:**
```typescript
const user = await getCurrentUser()
```
This already throws `UnauthorizedError` for anon viewers (per RESEARCH.md Assumption A2 + `src/lib/auth.ts:25-37`). No new auth handling needed — Phase 65 inherits.

---

**Prop wiring into `<WatchDetailHero>` — 3 existing call sites** (lines 337-355 Branch 1; lines 581-599 Branch 2 owned; Branch 3 does NOT render `WatchDetailHero` — it renders a catalog hero shell inline at lines 686-714, so Branch 3 needs a different integration target: the FollowedOwnersModule renders **directly** in page.tsx on Branch 3, NOT inside a hero). Branch 1 call site verbatim:
```typescript
<WatchDetailHero
  watch={watch}
  collection={collection}
  lastWornDate={lastWornDate}
  viewerCanEdit={isOwner}
  verdict={verdict}
  viewerId={user.id}
  initialLikeState={{ liked: likeState.viewerHasLiked, count: likeState.count }}
  commentCount={commentCount}
  signedPhotos={signedPhotos}
  userId={isOwner ? user.id : undefined}
  wearPics={signedWearPics}
  ownerUserId={ownerUserId}
  ownerUsername={ownerProfile?.username ?? ''}
  viewerAuthor={viewerAuthorForWears}
  canCommentOnWears={!isOwner && canComment}
  ownerFollowsViewerForWears={ownerFollowsViewer}
  viewerIsFollowingForWears={viewerIsFollowing}
/>
```
**Phase 65:** append two new props (matching D-10 + RESEARCH Pattern 2):
```typescript
  followedOwners={followedOwners.owners}
  followedOwnersTotal={followedOwners.totalCount}
```

---

**PPR / `await connection()` / Suspense placement — DO NOT TOUCH** (per RESEARCH.md Pitfall 5 + MEMORY `project_ppr_dynamic_before_use_cache`). Verified anchors:
- `page.tsx:50` — `export const unstable_instant = false` (DO NOT TOUCH)
- `page.tsx:96` — `await connection()` (DO NOT TOUCH; opts out of static shell)
- `page.tsx:97-101` — outer-sync default export returning `<Suspense fallback={<WatchPageSkeleton />}>` (DO NOT TOUCH)
- All Phase 65 DAL additions go INSIDE `UnifiedWatchContent` (`page.tsx:143`) — well below `await connection()`.

---

### `src/components/watch/WatchDetailHero.tsx` — MODIFY (extend props + add sibling in right column)

**Analog:** itself. The right-column container, prop-shape extension pattern, and sibling composition rhythm are all established.

---

**Props extension pattern — `WatchDetailHero.tsx:48-102`:**
```typescript
interface WatchDetailHeroProps {
  watch: Watch
  collection: Watch[]
  lastWornDate?: string | null
  /**
   * Gates owner-only UI (Edit, Delete, Mark as Worn, Flag as good deal,
   * Last worn line). Defaults to true for backward compat.
   */
  viewerCanEdit?: boolean
  /**
   * Precomputed VerdictBundle from page.tsx.
   * null means viewer collection is empty (D-10) — render empty-state slot.
   */
  verdict?: VerdictBundle | null
  // …
  /**
   * Public wear pics fetched+signed by the RSC.
   */
  wearPics?: SignedWearPic[]
  // …
}
```
**Phase 65 additions** (per D-10 + UI-SPEC §Component Inventory):
```typescript
  /**
   * Phase 65 FOLL-01..04. Pre-resolved by page.tsx via
   * getFollowedOwnersForCatalog (or [] when watch.catalogId is null on B1).
   * Hide-if-empty is enforced inside <FollowedOwnersModule/>.
   */
  followedOwners?: FollowedOwner[]
  followedOwnersTotal?: number
```
**Critical:** `FollowedOwner` MUST be imported as `import type` to preserve the `'use client'` boundary (RESEARCH.md Anti-Patterns + `WatchDetailHero.tsx:30` uses `import type { VerdictBundle }` as the precedent).

---

**Right-column container — `WatchDetailHero.tsx:229-230`** (the established mount point):
```typescript
{/* Right column: title → SpecsSublabel → verdict → like+jump → owner actions */}
<div className="space-y-6 min-w-0">
```
This `space-y-6` rhythm already accommodates the new sibling — no layout primitives need to change.

---

**Existing right-column sibling composition — `WatchDetailHero.tsx:275-319`** (the exact insertion point):
```typescript
{/* LikeButton + D-06 jump-to-comments anchor */}
{viewerId !== undefined && initialLikeState !== undefined && (
  <div className="flex items-center gap-2 mt-3">
    <LikeButton
      viewerId={viewerId}
      target={{ type: 'watch', id: watch.id }}
      initialLiked={initialLikeState.liked}
      initialCount={initialLikeState.count}
    />
    {/* Jump-to-comments anchor — hidden at zero (B1: no CommentThread import;
        commentCount is a plain number prop passed from the RSC) */}
    {(commentCount ?? 0) > 0 && (
      <a
        href="#comments"
        aria-label="Jump to comments"
        className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground px-2 min-h-[44px] hover:text-foreground transition-colors"
      >
        <MessageCircle className="size-5" aria-hidden />
        {commentCount}
        <span className="sr-only">comments</span>
      </a>
    )}
  </div>
)}

{/* Last worn line (owned/grail only, owner only — non-owners do not see owner's wear state) */}
{viewerCanEdit && (watch.status === 'owned' || watch.status === 'grail') && (
```
**Phase 65 insertion point:** BETWEEN the closing `)}` of the LikeButton block (line 298) and the comment `{/* Last worn line …` (line 300). The new module sits as a `space-y-6` peer to both blocks.
```jsx
{/* Phase 65 FOLL-01..04 — From your circle. Hide-if-empty inside the component. */}
<FollowedOwnersModule
  owners={followedOwners ?? []}
  totalCount={followedOwnersTotal ?? 0}
/>
```

---

### `tests/data/getFollowedOwnersForCatalog.test.ts` (NEW — DAL integration test)

**Analog:** `tests/data/getCollectorsForCatalog.test.ts` (entire file, 1-312). Full mirror per D-12; reuse `seedProfile` / `seedTestCatalogRow` / `seedWatchForCatalog` helpers verbatim.

**Gating boilerplate — `getCollectorsForCatalog.test.ts:22-29`** (copy verbatim):
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const hasDrizzle = Boolean(process.env.DATABASE_URL)
const hasSupabaseAdmin =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

const maybe = hasDrizzle && hasSupabaseAdmin ? describe : describe.skip
```

**Type-import pattern — `getCollectorsForCatalog.test.ts:32-34`** (swap module):
```typescript
type DalT = typeof import('@/data/follows')  // ← changed
type SchemaT = typeof import('@/db/schema')
type DbT = typeof import('@/db')
```

**Seed helpers — `getCollectorsForCatalog.test.ts:51-119`** (copy verbatim — `seedProfile`, `seedTestCatalogRow`, `seedWatchForCatalog`). Per RESEARCH.md Open Question 1: **copy-paste, do not extract** (cheaper than refactor; isolation > DRY at 2 files).

**Test 1-6 — copy verbatim from `getCollectorsForCatalog.test.ts:210-311`**, substituting:
- `dal.getCollectorsForCatalog` → `dal.getFollowedOwnersForCatalog`
- `collectors` → `owners`
- For every test that seeds a user expected to APPEAR in results: ALSO seed `(viewer → that-user)` into `follows` (otherwise they're excluded by the new join).

**ADD Test 7 + 8 — verbatim from RESEARCH.md lines 547-583** (the two new tests that validate FOLL-02 follow-direction gate):
```typescript
it('Test 7: viewer does NOT follow → owner excluded (FOLL-02)', async () => {
  const catalogId = await seedTestCatalogRow('t7')
  await seedWatchForCatalog(bob.id, catalogId, 'owned')
  // No follows row seeded for (viewer → bob).
  const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(catalogId, viewer.id)
  expect(owners.find((o) => o.userId === bob.id)).toBeUndefined()
  expect(totalCount).toBe(0)
})

it('Test 8: viewer follows alice (one-way) → alice INCLUDED (FOLL-02)', async () => {
  const catalogId = await seedTestCatalogRow('t8')
  await seedWatchForCatalog(alice.id, catalogId, 'owned')
  await dbModule.db.insert(schema.follows).values({
    followerId: viewer.id,
    followingId: alice.id,
  }).onConflictDoNothing()
  // Do NOT seed the reverse (alice → viewer); proves NOT mutual-only.
  const { owners, totalCount } = await dal.getFollowedOwnersForCatalog(catalogId, viewer.id)
  expect(owners.find((o) => o.userId === alice.id)).toBeDefined()
  expect(totalCount).toBe(1)
})
```

---

### `tests/static/watch-detail-ia-order.test.ts` — EXTEND (optional structural guard)

**Analog:** itself. The file already contains PAGE-01/02/03/04 active-line-scan assertions on `page.tsx` and `WatchDetailHero.tsx`.

**Existing helper — `watch-detail-ia-order.test.ts:26-42`** (reuse for the new assertion):
```typescript
function activeLineNumbers(lines: string[], pattern: RegExp): number[] {
  return lines.reduce<number[]>((acc, line, idx) => {
    const trimmed = line.trim()
    if (
      trimmed.startsWith('//') ||
      trimmed.startsWith('*') ||
      trimmed.startsWith('import ') ||
      trimmed === ''
    ) {
      return acc
    }
    if (pattern.test(trimmed)) {
      acc.push(idx + 1)  // 1-indexed line number for error messages
    }
    return acc
  }, [])
}
```

**Existing "no import of X" pattern — `watch-detail-ia-order.test.ts:74-90`** (clone for the new assertion that `WatchDetailHero` does NOT import `getFollowedOwnersForCatalog`):
```typescript
describe('PAGE-03: WatchDetailHero does not import CommentThread', () => {
  let content: string
  try {
    content = readFileSync(HERO_TSX, 'utf8')
  } catch {
    content = ''
  }

  it('WatchDetailHero.tsx has no import of CommentThread', () => {
    if (content === '') {
      expect.fail('WatchDetailHero.tsx not found — lands in Plan 02')
    }
    expect(content).not.toMatch(/import.*CommentThread/)
  })
})
```
**Phase 65 extension** (mirror exactly, substituting `getFollowedOwnersForCatalog`).

---

**Optional: NEW static guard `tests/static/followed-owners-module-rsc.test.ts`** (mirrors `tests/static/comment-thread-no-client.test.ts` 1-41 verbatim — change file path + assertion target):
```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('PAGE-03: FollowedOwnersModule.tsx is pure RSC', () => {
  const FILE = join('src', 'components', 'insights', 'FollowedOwnersModule.tsx')
  const content = readFileSync(FILE, 'utf8')

  it('does not contain "use client"', () => {
    const top = content.split('\n').slice(0, 5)
    expect(top.some((l) => l.trim() === "'use client'")).toBe(false)
  })

  it('does not contain "use cache"', () => {
    const top = content.split('\n').slice(0, 5)
    expect(top.some((l) => l.trim() === "'use cache'")).toBe(false)
  })
})
```

**Critical:** every file in `tests/static/` MUST start with `// @vitest-environment node` (MEMORY `project_vitest_static_node_env` — Phase 59 prod-deploy failure precedent).

---

## Shared Patterns

### Two-Layer Privacy at the DAL WHERE
**Source:** `src/data/discovery.ts:91-97` (the `where(and(...))` block)
**Apply to:** the new `getFollowedOwnersForCatalog` DAL (both the main query AND the count query)
**Rule:** `profilePublic = true` AND `collectionPublic = true` MUST both appear; never split, never override (follows do NOT grant visibility per D-05).
```typescript
.where(
  and(
    eq(watches.catalogId, catalogId),
    eq(profileSettings.profilePublic, true),    // T-39b-01 layer 1
    eq(profileSettings.collectionPublic, true), // T-39b-01 layer 2 (D-39b-09 NEW)
    sql`${profiles.id} != ${viewerId}`,         // T-39b-04 self-exclusion
    inArray(watches.status, ['owned', 'wishlist', 'grail']), // A1 / Q1 — exclude sold
  ),
)
```

### `server-only` directive on every DAL file
**Source:** `src/data/discovery.ts:1` and `src/data/follows.ts:1` both start with `import 'server-only'`
**Apply to:** the new DAL function (already in place in `follows.ts:1` — no action needed)
**Rule:** any module under `src/data/` MUST be `server-only` to prevent accidental client-bundle leak.

### Pure-presentation RSC chip composition
**Source:** `src/components/insights/OtherOwnersRoster.tsx` (entire file)
**Apply to:** `FollowedOwnersModule.tsx`
**Rule:** No `'use client'` directive. No hooks, no event handlers, no `useState`, no `cookies()`. Pre-resolved data arrives as props. Chips are plain `<Link>` elements.

### B1 sibling composition (prop-thread, never DAL-import inside `'use client'`)
**Source:** `src/components/watch/WatchDetailHero.tsx` (entire file — has `'use client'` at line 1; threads `signedPhotos` / `wearPics` / `verdict` as props, NEVER imports `@/data/*`)
**Apply to:** the modified `WatchDetailHero.tsx` (DO NOT add `import { getFollowedOwnersForCatalog }`; ONLY add `import type { FollowedOwner }` from the DAL file)
**Rule:** RESEARCH.md Anti-Patterns: "Importing the DAL into `WatchDetailHero` corrupts the PPR boundary and re-introduces the React #419 soft-nav class."

### Absolute-inset `<Link>` click surface + focus-visible ring
**Source:** `src/components/insights/OtherOwnersRoster.tsx:69-73`
**Apply to:** every chip in `FollowedOwnersModule`
**Rule (a11y):** `aria-label="{displayName ?? '@'+username}'s collection"`; `className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"`. Single tab stop per chip; no nested focusable children.

### `AvatarDisplay size={40}` constraint
**Source:** `src/components/profile/AvatarDisplay.tsx:5-12` (literal union `40 | 64 | 96`)
**Apply to:** every avatar in `FollowedOwnersModule`
**Rule:** 40 is the smallest legal value; matches `OtherOwnersRoster`; documented constraint.

### `// @vitest-environment node` header for fs-walking static tests
**Source:** every file under `tests/static/` (e.g., `tests/static/comment-thread-no-client.test.ts:1`, `tests/static/ppr-dynamic-before-use-cache.test.ts:1`, `tests/static/watch-detail-ia-order.test.ts:1`)
**Apply to:** any NEW static guard added in Phase 65
**Rule:** MEMORY `project_vitest_static_node_env` — without this header, the test passes locally under jsdom but fails the Vercel prebuild (`readFileSync` undefined). Phase 59 prod-deploy failure precedent.

### Drizzle parameterized SQL (XSS / SQLi mitigation)
**Source:** every DAL file in `src/data/*`
**Apply to:** the new DAL
**Rule:** Every value (catalogId, viewerId) flows through Drizzle's `eq()` / `sql\`\`` template-literal interpolation — produces a bound parameter, never raw SQL. No raw concatenation. Username escape is handled by React text-node auto-escape (see `OtherOwnersRoster.tsx:36-39` XSS comment).

---

## No Analog Found

None. Every Phase 65 file has a close analog in the codebase. The phase is structurally a near-clone of Phase 39b's `getCollectorsForCatalog` + `OtherOwnersRoster`, with one extra INNER JOIN, a vertical-stack instead of horizontal-scroll layout, and "From your circle" header copy.

---

## Metadata

**Analog search scope:**
- `src/data/` (DAL templates)
- `src/components/insights/` (presentational sibling components)
- `src/components/watch/` (hero island composition + props)
- `src/app/w/[ref]/page.tsx` (3-branch composition + Promise.all blocks)
- `src/db/schema.ts` (table column verification)
- `tests/data/` (DAL integration test template)
- `tests/static/` (fs-scan structural guard template + environment-header convention)

**Files scanned:** 9 (`src/data/discovery.ts`, `src/data/follows.ts`, `src/components/insights/OtherOwnersRoster.tsx`, `src/components/profile/AvatarDisplay.tsx`, `src/components/watch/WatchDetailHero.tsx`, `src/app/w/[ref]/page.tsx`, `src/db/schema.ts`, `tests/data/getCollectorsForCatalog.test.ts`, `tests/static/watch-detail-ia-order.test.ts` + corroborating reads of `tests/static/comment-thread-no-client.test.ts` and `tests/static/ppr-dynamic-before-use-cache.test.ts`)

**Pattern extraction date:** 2026-05-28
