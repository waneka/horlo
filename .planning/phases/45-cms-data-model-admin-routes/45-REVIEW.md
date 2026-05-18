---
phase: 45-cms-data-model-admin-routes
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - src/db/schema.ts
  - src/lib/auth.ts
  - src/lib/storage/cmsCovers.ts
  - src/data/curatedLists.ts
  - src/data/collectionPaths.ts
  - src/data/cmsSettings.ts
  - src/app/actions/cms/curatedLists.ts
  - src/app/actions/cms/collectionPaths.ts
  - src/app/actions/cms/settings.ts
  - src/app/actions/cms/catalogPicker.ts
  - src/app/admin/layout.tsx
  - src/app/admin/lists/page.tsx
  - src/app/admin/lists/[id]/page.tsx
  - src/app/admin/paths/page.tsx
  - src/app/admin/paths/[id]/page.tsx
  - src/components/admin/AdminSubNav.tsx
  - src/components/admin/WatchPicker.tsx
  - src/components/admin/MarkdownEditor.tsx
  - src/components/admin/CmsCoverUploader.tsx
  - src/components/admin/ListIndexClient.tsx
  - src/components/admin/ListEditorClient.tsx
  - src/components/admin/PathIndexClient.tsx
  - src/components/admin/PathEditorClient.tsx
  - supabase/migrations/20260518200000_phase45_cms_tables.sql
findings:
  critical: 2
  warning: 7
  info: 5
  total: 14
status: issues_found
---

# Phase 45: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 45 ships a CMS data model (5 tables) and an owner-gated admin authoring surface. The owner-gating in Server Actions is consistently applied — every CMS action begins with `assertOwner()` in a try/catch, and every zod schema uses `.strict()`. The FK `ON DELETE RESTRICT` on catalog-referencing columns is correctly placed.

However, two BLOCKER-class issues stand: (1) the "three-layer security" claim repeated throughout the code is materially false — the Drizzle DAL connects directly to Postgres and **bypasses RLS entirely**, so RLS is not a layer for any DAL read or write path, and the public-read draft-leak defense reduces to a single layer; and (2) markdown preview renders through `react-markdown` with no HTML sanitizer, and the FK-RESTRICT delete-block claimed by the plan is not actually translated into a user-visible error in the Server Action layer.

Several reorder/concurrency and error-surfacing defects round out the WARNING tier.

## Critical Issues

### CR-01: Drizzle DAL bypasses RLS — "three-layer security" is effectively one layer

**File:** `src/db/index.ts` (DAL client) — affecting `src/data/curatedLists.ts`, `src/data/collectionPaths.ts`, `src/data/cmsSettings.ts`, and the comments in `src/lib/auth.ts:42-44`, `src/app/actions/cms/curatedLists.ts:50-52`, `supabase/migrations/20260518200000_phase45_cms_tables.sql:104-359`

**Issue:** The Drizzle `db` client connects via `DATABASE_URL` — a direct Postgres connection that authenticates as the role in the connection string, not as `authenticated`/`anon`. RLS policies in `20260518200000_phase45_cms_tables.sql` only apply to the Supabase JS client (`createSupabaseServerClient`), which uses the user JWT. **No CMS DAL function uses the Supabase client** — `getPublishedLists`, `getAllListsForOwner`, `createList`, `updateList`, `deleteList`, every reorder swap, etc. all run through `db`. Therefore:

- The RLS write policies (`*_insert_own`, `*_update_own`, `*_delete_own`) are **never enforced on any code path in this phase**. The only thing standing between an unauthenticated HTTP POST and a destructive write is `assertOwner()`.
- The `curated_lists_select_published` / `collection_paths_select_published` RLS draft-leak guard is **never enforced for DAL reads**. The "two-layer draft defense" (D-03) collapses to one layer: the explicit `WHERE status='published'` in `getPublishedLists`/`getPublishedPaths`. If any future public-read DAL function forgets that filter, drafts leak with no RLS backstop.

The repeated comment "Three-layer security: RLS write policies (DB) + layout redirect (UX) + assertOwner() (SA)" is false. It is two layers (layout UX + `assertOwner`), and for reads it is one layer (the explicit WHERE).

This is a BLOCKER because the code, schema comments, and migration all assert a defense-in-depth posture that does not exist. A reviewer or future contributor trusting the "RLS is layer 1" comment could remove an `assertOwner()` call or a `WHERE status` filter believing RLS will catch it — it will not.

**Fix:** Either (a) route CMS DAL reads/writes through the RLS-aware Supabase client so the policies are genuinely a layer, or (b) correct every comment to state the truth: `assertOwner()` is the *sole* write gate and the explicit `WHERE status='published'` is the *sole* draft-leak gate for DAL paths; RLS only protects direct Supabase-client access (e.g. a hypothetical future client-side query). Recommended minimum: fix the comments in `src/lib/auth.ts`, all three `src/app/actions/cms/*.ts`, the migration header, and the D-03 comment blocks in `src/data/curatedLists.ts:8-12` and `src/data/collectionPaths.ts:7-11`.

### CR-02: Markdown preview renders unsanitized — and intro markdown has no render-time XSS guard

**File:** `src/components/admin/MarkdownEditor.tsx:61`

**Issue:** `<ReactMarkdown>{previewContent}</ReactMarkdown>` is rendered with no `rehype-sanitize` plugin (confirmed absent from `node_modules`). react-markdown 10.x does not parse raw HTML by default, so a literal `<script>` tag in the source is escaped — but it *does* by default render link/image URLs, and without a sanitizer schema a `[click](javascript:alert(1))` link produces an `href="javascript:..."` anchor. The intro markdown is owner-authored today (lower immediate risk), but:

1. The CMS exists to publish content to all site visitors (Phase 47). The same `introMarkdown` string authored here will be rendered on public surfaces. If the public renderer also omits a sanitizer, a `javascript:` URL or `data:` URI ships to every visitor.
2. `introMarkdown` is validated only for length (`z.string().max(5000)`) in `createListSchema`/`updateListSchema` — no content validation. There is no defense between the textarea and the renderer.

Because this is the authoring surface for content that becomes public, shipping a markdown pipeline with no URL/HTML sanitization is a security defect that should be fixed before the content model is relied upon.

**Fix:** Add `rehype-sanitize` and pass it to both the preview renderer and any public renderer:
```tsx
import rehypeSanitize from 'rehype-sanitize'
// ...
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>{previewContent}</ReactMarkdown>
```
At minimum, enforce a URL-protocol allow-list (`http`/`https`/`mailto`) via the sanitize schema so `javascript:` and `data:` hrefs cannot render.

## Warnings

### WR-01: FK-RESTRICT delete error never reaches the FK-error branch — wrong toast shown

**File:** `src/app/actions/cms/curatedLists.ts:100-114`, `src/app/actions/cms/collectionPaths.ts:95-108`; consumers `src/components/admin/ListIndexClient.tsx:103-114`, `ListEditorClient.tsx:92-100`, `PathIndexClient.tsx:126-137`, `PathEditorClient.tsx:75-83`

**Issue:** The plan's headline guarantee is that deleting a catalog watch referenced by a list/path item is blocked by `ON DELETE RESTRICT`. The client components carefully detect FK errors by string-matching `result.error` for `'restrict'`, `'foreign key'`, `'referenced'`, `'FK'`. But `deleteCuratedList`/`deleteCollectionPath` catch the DB error and return a **generic, hard-coded** string: `"Couldn't delete list. Try again."` — which contains none of those tokens. The raw Postgres error message (`update or delete on table ... violates foreign key constraint`) is swallowed by `console.error` and never forwarded. Result: the FK-restrict branch in every client is dead code; a blocked delete shows the generic "Try again" toast, misleading the owner into retrying an operation that can never succeed.

Note this specific delete path (deleting a `curated_lists` row) actually cascades to `curated_list_items` rather than being restricted — the RESTRICT is on `catalog_id`, fired only when deleting a `watches_catalog` row. So the FK-restrict branch in `ListIndexClient`/`PathIndexClient` delete handlers can never fire at all for *list/path* deletes. The whole FK-error-detection UX is wired to the wrong actions and would never trigger even if the error string were forwarded.

**Fix:** Forward a discriminable error from the catch block (e.g. detect `err.message.includes('foreign key')` in the action and return a specific message or an error code), and/or remove the dead FK-detection branches from list/path delete handlers since those deletes never hit RESTRICT. The genuine RESTRICT surface is catalog-watch deletion, which is not a Phase 45 action at all.

### WR-02: Reorder up/down has a lost-update race — non-transactional read-then-swap

**File:** `src/app/actions/cms/curatedLists.ts:183-285`, `src/app/actions/cms/collectionPaths.ts:151-195`

**Issue:** `moveListUp`/`moveListDown`/`moveListItemUp`/`moveListItemDown`/`movePathUp`/`movePathDown` each do: fetch the ordered list → compute neighbor indices in JS → call a swap. The fetch and the swap are separate round-trips with no transaction or row lock spanning them. If the owner clicks two reorder buttons quickly (or the list changed between fetch and swap), the `sortOrder` values captured (`current.sortOrder`, `above.sortOrder`) are stale and the swap writes incorrect values — producing duplicate `sortOrder`s or a scrambled order. The swap itself is transactional, but the read that feeds it is not part of that transaction.

This is single-user admin tooling so the blast radius is small, but the result is silent data corruption of the ordering, not a visible error.

**Fix:** Perform the neighbor lookup and the swap inside one `db.transaction(...)` (re-select inside the tx), or compute the swap directly in SQL with a single statement keyed by the two ids.

### WR-03: `addWatchToList` does not revalidate the hero cache; commentary/reorder actions revalidate nothing

**File:** `src/app/actions/cms/curatedLists.ts:118-285`

**Issue:** `publishCuratedList`/`unpublishCuratedList` call `revalidateTag('explore:hero', 'max')`. But `addWatchToList`, `removeWatchFromList`, `updateListItemCommentary`, and all four reorder actions do not. A published list that is also pinned as hero can have its items changed, reordered, or its commentary edited with no hero-cache invalidation — the public hero will serve stale list contents indefinitely (until the next publish toggle). The same applies to `updateCuratedList` (title/cover/intro edits on a published, pinned list).

**Fix:** Call `revalidateTag('explore:hero', 'max')` after any mutation that can affect a published list's rendered content, or scope the decision explicitly (e.g. only revalidate when the affected list is currently published/pinned).

### WR-04: `result` read before guaranteed assignment via `result!` non-null assertion

**File:** `src/components/admin/ListIndexClient.tsx:65-80`, `src/components/admin/PathIndexClient.tsx:88-104`

**Issue:** `let result: Awaited<...>` is declared uninitialized, assigned inside an async callback passed to `startTransition`, then read as `result!.success`. The `await new Promise(resolve => startTransition(async () => { result = ...; resolve() }))` pattern *happens* to work because `resolve()` is called after assignment — but `startTransition`'s callback contract does not guarantee the transition's async work is awaited, and the `!` assertion silences the compiler's correct warning that `result` may be unassigned. If the action throws before assignment, `resolve()` never runs and the promise hangs; if it is ever refactored, `result!` will dereference `undefined`.

**Fix:** Assign the awaited result directly: `const result = await createCuratedList({...})` inside the transition is unnecessary here — `createCuratedList` is a Server Action, calling it directly already works without `startTransition` for this navigate-after pattern. Remove the Promise/`startTransition` wrapper and the `!` assertions, or initialize `result` to a known failure value.

### WR-05: `getPathWithNodes` fetches nodes for a path that may not exist

**File:** `src/data/collectionPaths.ts:48-55`

**Issue:** `getPathWithNodes` runs `getPathById` and `getPathNodes` in `Promise.all`, then returns `null` if the path is absent. When the path id is invalid, `getPathNodes` still issues a DB query for nodes of a nonexistent path. Harmless functionally (returns `[]`), but it is a wasted query on every `notFound()` path-editor hit and an inconsistency with `getListWithItems` (`src/data/curatedLists.ts:43-48`), which correctly short-circuits on missing list before fetching items.

**Fix:** Mirror `getListWithItems`: `const path = await getPathById(pathId); if (!path) return null; const nodes = await getPathNodes(pathId)`.

### WR-06: `setPathNode` rationale edit silently no-ops via `onConflictDoNothing`

**File:** `src/data/collectionPaths.ts:70-86`, consumed by `src/components/admin/PathEditorClient.tsx:267-275`

**Issue:** `setPathNode` inserts with `.onConflictDoNothing()`. In `PathEditorClient`, editing a follow-on node's rationale calls `setPathNode({ pathId, slot, catalogId, rationale })` again for the *same* node (same `path_id` + `sort_order` slot). But there is no UNIQUE constraint on `(path_id, sort_order)` in the migration (`collection_path_nodes` has only two plain indexes, no unique). So `onConflictDoNothing` has no conflict target to act on — the "re-set the node to update rationale" comment describes an UPDATE that **never happens**. Editing a node's rationale inserts a *duplicate* row in the same slot (or, if a unique constraint were added later, silently discards the edit). Either way the owner's rationale edit is lost.

**Fix:** Add a dedicated `updatePathNodeRationale(nodeId, rationale)` DAL function + Server Action and call it on blur, instead of re-inserting via `setPathNode`. Separately, decide whether `(path_id, sort_order)` should be UNIQUE — currently nothing prevents two nodes in slot 0.

### WR-07: `searchCatalogForPicker` returns `success: true, data: []` for short queries — masks the min-length contract

**File:** `src/app/actions/cms/catalogPicker.ts:31-34`, consumed by `src/components/admin/WatchPicker.tsx:48-59`

**Issue:** Minor robustness gap: the action enforces a 2-char minimum and the client *also* enforces it. The duplicated guard is fine, but the action returns an empty success for sub-minimum input, indistinguishable from "searched, found nothing." If the client guard is ever removed, a 1-char query silently shows "No matches" rather than prompting the user to type more. Low severity, but the contract is implicit.

**Fix:** Acceptable as-is for now; consider a distinct sentinel or documenting that `[]` may mean "query too short."

## Info

### IN-01: Stale `previewContent` when switching tabs without re-clicking Preview

**File:** `src/components/admin/MarkdownEditor.tsx:31-43`

**Issue:** `previewContent` updates only on the Preview `TabsTrigger`'s `onClick`. If the user is on the Preview tab, switches to Edit, types, then switches back to Preview *via keyboard arrow navigation* (Tabs primitives support arrow-key selection) rather than a mouse click, `onClick` may not fire and the preview shows stale content. Use the Tabs `onValueChange` callback instead of the trigger's `onClick`.

### IN-02: `users` shadow-table comment vs. real owner gate

**File:** `src/db/schema.ts:69-76`, `src/db/schema.ts:216-231`

**Issue:** No defect. Note for clarity: `profiles.isAdmin` is the owner flag and is correctly documented as "never app-writable" — confirmed, no Server Action or DAL function writes `is_admin`. The only writer is the migration `UPDATE` keyed by email. Good.

### IN-03: `coverUrl` empty-string vs. null inconsistency

**File:** `src/components/admin/ListEditorClient.tsx:111,326-332`

**Issue:** `coverUrl` state is initialized to `''` (not null) and `onRemove` sets it back to `''`. `handleSaveDraft` converts `coverUrl || null` correctly, but the immediate `onUpload` persist at line 329 sends only `{ id, coverUrl: url }` and the `onRemove` path never persists the removal at all — removing a cover updates local state only; the DB still holds the old URL until a subsequent Save Draft. Minor UX inconsistency: upload persists immediately, remove does not.

### IN-04: `WatchPicker` debounced async result can apply out of order

**File:** `src/components/admin/WatchPicker.tsx:41-65`

**Issue:** The 200ms debounce clears the *timer* on each keystroke but does not cancel an *in-flight* `searchCatalogForPicker` call. A slow response for an older query can resolve after a newer one and overwrite `results` with stale data. Add a request-id/abort guard (compare the query at resolve time, or use an `AbortController`-style stale check).

### IN-05: `generateCmsCoverFilename` crypto fallback is non-cryptographic but acceptable

**File:** `src/lib/storage/cmsCovers.ts:42-48`

**Issue:** No defect. `Math.random()`-based fallback filename is fine here — the path is collision-avoidance, not a security token, and `crypto.randomUUID()` is available in all supported browsers. Noted only to confirm it is not a security-relevant `Math.random()` use.

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
