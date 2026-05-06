# Phase 32: DEBT-09 notesPublic Fix - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 2 (1 source modification, 1 doc modification — zero new files)
**Analogs found:** 2 / 2 (both modifications have multiple direct sibling precedents in the codebase)

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/app/actions/watches.ts` (schema add ~line 54) | server-action / zod-schema | request-response (validation only) | `src/app/actions/watches.ts` itself (existing `.optional()` boolean fields at lines 38–39) | exact (intra-file) |
| `src/app/actions/watches.ts` (revalidate insert lines 267, 340) | server-action / cache-invalidation | request-response (side effect on success) | `src/app/actions/notes.ts:53–58, 108–113` (canonical WR-07 sibling); `src/app/actions/profile.ts:34, 83`; `src/app/actions/follows.ts:53, 118` | exact (5 sibling call sites already use this pattern verbatim) |
| `.planning/ROADMAP.md` line 126 | doc / inline-correction | static-text edit | (no code analog needed — single-line wording fix) | n/a |

**No new files created.** Per CONTEXT D-06: "No new tests authored in this phase."

---

## Pattern Assignments

### `src/app/actions/watches.ts` — Schema Field Insertion (server-action / zod-schema)

**Analog:** Same file. The `insertWatchSchema` z.object body (lines 17–54) already contains nine `.optional()` fields, including two `z.boolean().optional()` siblings — `isFlaggedDeal` and `isChronometer`.

**Imports already present** (line 4):

```typescript
import { z } from 'zod'
```

No new import needed; the schema add reuses the existing `z` namespace.

**Sibling field pattern — verbatim from current `main`** (`src/app/actions/watches.ts:38–41`):

```typescript
isFlaggedDeal: z.boolean().optional(),
isChronometer: z.boolean().optional(),
notes: z.string().optional(),
imageUrl: z.string().optional(),
```

**Pattern to copy** — insert one new line in the same shape, immediately after the `notes` line (RESEARCH §"Diff Hunk 1" recommended placement), so domain-type ordering at `src/lib/types.ts:52–53` (`notes` then `notesPublic`) matches schema ordering:

```diff
   notes: z.string().optional(),
+  notesPublic: z.boolean().optional(),
   imageUrl: z.string().optional(),
```

**Why `.optional()` and NOT `.default(true)`** (CONTEXT `<code_context>` "Established Patterns"):

- DB column owns the default: `src/db/schema.ts:95` — `notesPublic: boolean('notes_public').notNull().default(true)`
- DAL fallback path: `src/data/watches.ts:43` — `mapRowToWatch` falls back to `true` when the column is null/undefined
- Phase 23 D-13/D-16 lock this contract — schema only ensures pass-through, never originates a default

**`updateWatchSchema` requires no separate edit.** Line 57 derives via `.partial()`:

```typescript
const updateWatchSchema = insertWatchSchema.partial()
```

The new `notesPublic` field auto-flows to the update path. `editWatch` validates against `updateWatchSchema` (line 299), so a single schema edit covers both `addWatch` and `editWatch`.

---

### `src/app/actions/watches.ts` — `addWatch` Revalidate Insertion (server-action / cache-invalidation)

**Insertion site:** Between line 267 (`revalidatePath('/')`) and line 277 (`revalidateTag('explore', 'max')`).

**Analog (canonical, with WR-07 commentary):** `src/app/actions/notes.ts` — `updateNoteVisibility`, lines 53–58, then the call at line 58.

**Imports already present** (`src/app/actions/watches.ts:3`):

```typescript
import { revalidatePath, revalidateTag } from 'next/cache'
```

No new imports required.

**Canonical commentary block + call (verbatim from `src/app/actions/notes.ts:53–58`):**

```typescript
// WR-07: the actual route template is `/u/[username]/[tab]` (the tab
// segment is dynamic). Revalidating `/u/[username]/notes` with a 'page'
// selector silently no-ops because it does not match a compiled route
// entry. Revalidate the layout so sibling tabs (Stats, Collection) also
// reflect the mutation without a hard navigation.
revalidatePath('/u/[username]', 'layout')
```

**Bare-call sibling (no commentary)** — `src/app/actions/profile.ts:34`:

```typescript
await profilesDAL.updateProfileFields(user.id, parsed.data)
revalidatePath('/u/[username]', 'layout')
revalidatePath('/settings')
```

And `src/app/actions/follows.ts:50–53`:

```typescript
await followsDAL.followUser(user.id, parsed.data.userId)
// FOLL-03 end-to-end reconciliation: invalidate the layout so ProfileHeader
// (which calls getFollowerCounts) re-fetches on the next navigation. WR-07
// precedent — path template must be literal with the bracketed segment.
revalidatePath('/u/[username]', 'layout')
```

**Existing pre-revalidate context in `addWatch`** (`src/app/actions/watches.ts:265–278`, verbatim):

```typescript
      } catch (err) {
        // Overlap lookup failures are non-fatal — never block the watch add.
        console.error('[addWatch] overlap lookup failed (non-fatal):', err)
      }
    }

    revalidatePath('/')

    // Phase 18 DISC-05 / DISC-06 — fan out 'explore' tag so the global
    // Trending + Gaining Traction rails (and the per-viewer Popular Collectors
    // rail, which also tags 'explore') recompute on next render. Cross-user
    // semantics via revalidateTag(tag, 'max') — Pitfall 4. Granularity is
    // intentionally broad (just 'explore') rather than per-rail, per RESEARCH
    // §Pattern 6 recommendation. Fires once regardless of status because
    // both Trending (owners + 0.5*wishlist) and Gaining Traction read the
    // denormalized counts from the catalog.
    revalidateTag('explore', 'max')
```

**Pattern to copy — diff hunk** (RESEARCH §"Diff Hunk 2"):

```diff
     revalidatePath('/')
+    revalidatePath('/u/[username]', 'layout')

     // Phase 18 DISC-05 / DISC-06 — fan out 'explore' tag so the global
     // Trending + Gaining Traction rails (and the per-viewer Popular Collectors
     // rail, which also tags 'explore') recompute on next render. Cross-user
     // semantics via revalidateTag(tag, 'max') — Pitfall 4. Granularity is
     // intentionally broad (just 'explore') rather than per-rail, per RESEARCH
     // §Pattern 6 recommendation. Fires once regardless of status because
     // both Trending (owners + 0.5*wishlist) and Gaining Traction read the
     // denormalized counts from the catalog.
     revalidateTag('explore', 'max')
```

**Optional commented variant** (RESEARCH §"Optional explanatory comment", matches `notes.ts` WR-07 verbosity):

```typescript
    revalidatePath('/')
    // DEBT-09 (Phase 32) — invalidate the user-scoped layout so the per-row
    // <NoteVisibilityPill> on /u/{username}/notes reflects the new notesPublic
    // value without a hard refresh. Layout selector (NOT 'page') because the
    // route template is /u/[username]/[tab] — see notes.ts WR-07 commentary.
    revalidatePath('/u/[username]', 'layout')

    // Phase 18 DISC-05 / DISC-06 — fan out ...
    revalidateTag('explore', 'max')
```

Either bare or commented is acceptable. The bare form matches `profile.ts`/`follows.ts`; the commented form matches `notes.ts`. Both pass the GREEN test contract (`tests/actions/watches.notesPublic.test.ts:158`).

---

### `src/app/actions/watches.ts` — `editWatch` Revalidate Insertion (server-action / cache-invalidation)

**Insertion site:** Between line 340 (`revalidatePath('/')`) and line 348 (`revalidateTag('explore', 'max')`).

**Analog:** Identical to `addWatch` insertion above. The two call sites are line-symmetric — same pre-call (`revalidatePath('/')`), same comment block following the new line, same post-call (`revalidateTag('explore', 'max')`).

**Existing pre-revalidate context in `editWatch`** (`src/app/actions/watches.ts:339–348`, verbatim):

```typescript
    const watch = await watchDAL.updateWatch(user.id, watchId, updatePayload)
    revalidatePath('/')

    // Phase 18 DISC-05 / DISC-06 — same fan-out as addWatch. editWatch can
    // change status (owned ↔ wishlist ↔ sold ↔ grail), and each transition
    // shifts the catalog's denormalized counts (owners_count, wishlist_count)
    // on the next pg_cron refresh. Even non-status edits (brand/model fixes)
    // can affect Trending if they re-link the watch to a different catalog
    // row via the upsert path. Fan-out is the safe default.
    revalidateTag('explore', 'max')
```

**Pattern to copy — diff hunk** (RESEARCH §"Diff Hunk 3"):

```diff
     const watch = await watchDAL.updateWatch(user.id, watchId, updatePayload)
     revalidatePath('/')
+    revalidatePath('/u/[username]', 'layout')

     // Phase 18 DISC-05 / DISC-06 — same fan-out as addWatch. editWatch can
     // change status (owned ↔ wishlist ↔ sold ↔ grail), and each transition
     // shifts the catalog's denormalized counts (owners_count, wishlist_count)
     // on the next pg_cron refresh. Even non-status edits (brand/model fixes)
     // can affect Trending if they re-link the watch to a different catalog
     // row via the upsert path. Fan-out is the safe default.
     revalidateTag('explore', 'max')
```

---

### `.planning/ROADMAP.md` — Single-Line Wording Correction (doc / inline-edit)

**Insertion site:** Line 126.

**No code analog.** This is a single-line wording fix mandated by D-05 to align ROADMAP success criterion #4 with the test scaffold's literal assertion at `tests/actions/watches.notesPublic.test.ts:131,158`.

**Pattern to copy — diff hunk** (RESEARCH §"ROADMAP.md Edit Hunk"):

```diff
   3. Both Server Actions persist `notesPublic` to the database on every write
-  4. Both Server Actions call `revalidatePath('/u/[username]/[tab]', 'page')` after every successful write
+  4. Both Server Actions call `revalidatePath('/u/[username]', 'layout')` after every successful write
   5. No new test failures introduced; full test suite remains GREEN
```

**Why this edit ships in the same PR as the action change** (D-05 rationale): "ROADMAP and the test cannot both be authoritative; the test is the contract per success criterion #1. A doc fix that closes the contradiction belongs alongside the fix that satisfies it."

---

## Shared Patterns

### Pattern 1 — `revalidatePath('/u/[username]', 'layout')` Layout-Scoped Revalidation

**Source authority:** `src/app/actions/notes.ts:53–58` (canonical WR-07 commentary block).

**Apply to:** Both `addWatch` (line 267 area) and `editWatch` (line 340 area) in `src/app/actions/watches.ts`.

**The literal call** — exactly as five sibling actions already write it:

```typescript
revalidatePath('/u/[username]', 'layout')
```

**Verified call sites in the codebase** (RESEARCH §"Sibling-Action Call Sites"):

| File | Function | Line | Call signature |
|------|----------|------|----------------|
| `src/app/actions/notes.ts` | `updateNoteVisibility` | 58 | `revalidatePath('/u/[username]', 'layout')` |
| `src/app/actions/notes.ts` | `removeNote` | 113 | `revalidatePath('/u/[username]', 'layout')` |
| `src/app/actions/profile.ts` | `updateProfile` | 34 | `revalidatePath('/u/[username]', 'layout')` |
| `src/app/actions/profile.ts` | `updateProfileSettings` | 83 | `revalidatePath('/u/[username]', 'layout')` |
| `src/app/actions/follows.ts` | `followUser` | 53 | `revalidatePath('/u/[username]', 'layout')` |
| `src/app/actions/follows.ts` | `unfollowUser` | 118 | `revalidatePath('/u/[username]', 'layout')` |

**Why this exact signature:** the `[username]` literal is the route template segment (NOT a resolved username). Next.js 16 matches the path argument against compiled route templates; passing the resolved username (`/u/alice`) would silently no-op. The `'layout'` second argument cascades invalidation to all `[tab]` variants beneath the layout (notes, collection, stats), per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` §"Revalidating a Layout path".

### Pattern 2 — Action-Level Revalidate Ordering: path → layout → tag

**Source authority:** Established within `src/app/actions/watches.ts` itself by the existing `revalidatePath('/')` → `revalidateTag('explore', 'max')` pair, plus `profile.ts:34–35` (path → path) and `follows.ts:53,77` (path → tag fan-out).

**Apply to:** Both `addWatch` and `editWatch` insertion sites.

**Required final ordering (per CONTEXT D-03):**

```typescript
revalidatePath('/')                                  // existing — global home revalidate
revalidatePath('/u/[username]', 'layout')            // NEW (this phase)
revalidateTag('explore', 'max')                      // existing — explore tag fan-out
```

**Rationale:** "Group path revalidates first, then tag fan-out … minimizes diff churn." (CONTEXT D-03).

### Pattern 3 — Unconditional Revalidation (no `'notesPublic' in parsed.data` gate)

**Source authority:** All three sibling action files (`notes.ts`, `profile.ts`, `follows.ts`) call their layout revalidate unconditionally on every successful write.

**Apply to:** Both `addWatch` and `editWatch` — the new `revalidatePath('/u/[username]', 'layout')` call must fire on every successful return path, NOT only when `notesPublic` is present in the payload (CONTEXT D-02).

**Why:** ROADMAP success criterion #4 specifies "after every successful write" (unconditional). The cost is one no-op call per edit that doesn't touch visibility-relevant fields; the benefit is parity with sibling action lore and a simpler call site that doesn't need to inspect payload keys.

---

## Negative / Anti-Pattern (DO NOT FOLLOW)

### `src/app/actions/wishlist.ts:206` — Tab/Page Selector Pattern

This is the **sole codebase exception** that uses a different revalidate signature, and it is explicitly **NOT** the pattern this phase follows.

**Verbatim from `src/app/actions/wishlist.ts:199–207`:**

```typescript
    // BR-02 fix — actual Next.js route is /u/[username]/[tab], NOT
    // /u/[username]/wishlist. revalidatePath matches against the route
    // definition; passing a non-matching path silently no-ops.
    // Use the dynamic [tab] placeholder so all wishlist tab variants
    // (and the collection tab, since they share the same route file)
    // invalidate. The 'page' second arg invalidates the page-level
    // render for that route.
    revalidatePath('/u/[username]/[tab]', 'page')
```

**Why NOT to use this pattern in Phase 32:**

1. **The test scaffold rejects it.** `tests/actions/watches.notesPublic.test.ts:131,158` literally asserts `revalidatePath` was called with `('/u/[username]', 'layout')`. Using `('/u/[username]/[tab]', 'page')` would fail tests #2 and #3 with arg-mismatch errors.
2. **WR-07 documents the silent no-op risk.** The `notes.ts` commentary at lines 53–58 explains that `'page'` selector with a dynamic-segment template (`[tab]`) does not match a compiled route entry. The wishlist comment at 199–205 reasons in the opposite direction (claims it works because `[tab]` is the literal placeholder), but the WR-07 finding is the more recently established lesson.
3. **5/6 sibling actions use the layout pattern.** Phase 32 follows the supermajority precedent.
4. **Layout selector is strictly broader.** `('/u/[username]', 'layout')` cascades to ALL tab variants AND ProfileHeader; `('/u/[username]/[tab]', 'page')` does NOT invalidate the layout itself, so any layout-resident UI (e.g., follower counts in `ProfileHeader`) would not re-fetch.

The `wishlist.ts:206` divergence is captured in CONTEXT.md "Deferred Ideas" as a future hygiene fix — out of scope for Phase 32.

---

## No Analog Found

**None.** Every modification in this phase has a direct, recently-shipped sibling precedent in the same `src/app/actions/` directory. The fix is mechanically identical to patterns already in use 6 times across `notes.ts`, `profile.ts`, and `follows.ts`.

---

## Metadata

**Analog search scope:**
- `src/app/actions/*.ts` — full directory survey (notes, profile, follows, wishlist, watches; plus negative-pattern flag for wishlist.ts:206)
- `src/app/actions/watches.ts` itself — intra-file zod-schema field analogs (`isFlaggedDeal`, `isChronometer`, `notes`)
- `tests/actions/watches.notesPublic.test.ts` — verified the GREEN contract assertion strings (lines 131, 158)

**Files scanned:** 5 source files, 1 test file, 1 doc file.

**Pattern extraction date:** 2026-05-06

**Confidence:** HIGH. Every pattern is taken verbatim from currently-shipped code on `main` (line numbers re-verified against `git status` clean tree on 2026-05-06). The test scaffold is the literal contract — patterns reference exact strings the test asserts on.
