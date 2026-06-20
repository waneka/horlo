---
phase: quick-260620-lbn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/watch/AddWatchFlow.tsx
  - src/components/watch/ConfirmStep.tsx
  - src/app/watch/new/page.tsx
  - src/app/actions/watches.ts
files_modified_tests:
  - src/components/watch/AddWatchFlow.test.tsx
  - src/components/watch/ConfirmStep.test.tsx
  - src/app/actions/__tests__/watches.test.ts  # if catalog-only action gets unit tests
autonomous: true
requirements:
  - SEED-018-URL-SURFACE
  - SEED-018-CATALOG-ONLY-ADMIN

must_haves:
  truths:
    - "On the Add-Watch landing (state=search-idle), a third entry-point affordance is rendered between SearchEntry and the 'Skip search — enter manually' link, labeled 'Add from URL' (or close equivalent)."
    - "Clicking the new URL affordance transitions FlowState into the existing 'extracting-url' branch (same target as StructuredEntryPanel's EXTR-07 backup link), with the URL input auto-focused."
    - "On the confirming step, an admin viewer sees a fourth 'Add to catalog only' option alongside owned/wishlist/grail."
    - "A non-admin viewer does NOT see the 'Add to catalog only' option at all (no greyed-out, no 'request admin' hint, no aria-disabled — the option is not rendered)."
    - "When an admin selects 'catalog only' and clicks the primary CTA, the server upserts the catalog row via upsertCatalogFromExtractedUrl, SKIPS the addWatch (user-side watches insert), and routes back to search-idle with a success toast."
    - "A non-admin attempting the catalog-only Server Action (via crafted client call) is REJECTED server-side with an UnauthorizedError-shaped failure (assertOwner gate)."
    - "No DB migration is introduced; no schema change; existing add-to-collection flow (owned/wishlist/grail) behaves identically when admin selects a non-catalog-only status or when non-admins use the flow."
  artifacts:
    - path: src/components/watch/AddWatchFlow.tsx
      provides: "URL affordance in search-idle branch; isAdmin prop threaded through; saveCatalogOnly handler dispatched on catalog-only confirm"
    - path: src/components/watch/ConfirmStep.tsx
      provides: "Conditional fourth radio option 'Catalog only' gated by isAdmin prop; CTA label flip; status union widened to include 'catalog-only'"
    - path: src/app/watch/new/page.tsx
      provides: "Resolves isAdmin from profiles.is_admin server-side and passes to AddWatchFlow"
    - path: src/app/actions/watches.ts
      provides: "New saveCatalogOnlyFromExtract Server Action gated by assertOwner; calls upsertCatalogFromExtractedUrl idempotently"
  key_links:
    - from: "AddWatchFlow.tsx (search-idle branch)"
      to: "handleSwitchToUrl"
      via: "new <button> onClick"
      pattern: "onClick=\\{handleSwitchToUrl\\}"
    - from: "AddWatchFlow.tsx (confirming branch)"
      to: "ConfirmStep"
      via: "isAdmin prop forwarded"
      pattern: "isAdmin=\\{isAdmin\\}"
    - from: "AddWatchFlow.tsx (handleConfirmPrimary)"
      to: "saveCatalogOnlyFromExtract"
      via: "branched dispatch when confirmStatus === 'catalog-only'"
      pattern: "saveCatalogOnlyFromExtract\\("
    - from: "saveCatalogOnlyFromExtract"
      to: "assertOwner + upsertCatalogFromExtractedUrl"
      via: "server-side admin gate before any write"
      pattern: "assertOwner\\(\\)"
---

<objective>
SEED-018 surgical slice. Two surfacing fixes to Add-Watch flow ahead of beta-tester sharing:

  1. Make URL-extraction reachable in one tap from the Add-Watch landing (currently only reachable via SearchEntry → empty-results → StructuredEntryPanel → EXTR-07 backup link).
  2. Add an admin-gated "Add to catalog only" save path that writes to `watches_catalog` without polluting the admin's own collection (unblocks editorial content seeding without one-off Node scripts).

Purpose: Beta-tester UX (fewer taps to URL-extract) + unblock author from running `scripts/seed-explore-catalog.ts` for every catalog row.
Output: Two UI affordances + one admin-gated Server Action. No DB migration, no new state branches, no new server-extract logic.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/seeds/SEED-018-add-watch-extraction-surface-and-catalog-only-save.md
@CLAUDE.md
@AGENTS.md

@src/components/watch/AddWatchFlow.tsx
@src/components/watch/ConfirmStep.tsx
@src/app/watch/new/page.tsx
@src/app/actions/watches.ts
@src/lib/auth.ts
@src/data/catalog.ts

<interfaces>
<!-- Extracted from current codebase; executor uses these directly without re-exploring. -->

From src/lib/auth.ts (the canonical admin gate — name is misleading; "assertOwner" means "assert is_admin"):
```typescript
export async function assertOwner(): Promise<{ id: string; email: string }>
// Throws UnauthorizedError('Not an admin') when profiles.is_admin is false/missing.
// Used by every src/app/actions/cms/*.ts Server Action (catalogPicker, collectionPaths, curatedLists, settings).
// The CMS DAL bypasses RLS (Drizzle direct connection) so assertOwner is the SOLE enforced write gate.
```

From src/data/catalog.ts (existing idempotent catalog upsert — already used by /api/extract-watch):
```typescript
export async function upsertCatalogFromExtractedUrl(
  input: UrlExtractedCatalogInput,
): Promise<string | null>
// ON CONFLICT ON CONSTRAINT watches_catalog_natural_key (brand, model, reference) DO UPDATE
// COALESCE semantics — first-non-null wins; safe to re-call.
// Returns catalog row id; null on shape mismatch.
```

From src/components/watch/AddWatchFlow.tsx — relevant existing handlers and state:
```typescript
// FlowState 'extracting-url' branch is already implemented (line ~615).
// handleSwitchToUrl is already defined (line ~267):
const handleSwitchToUrl = useCallback(() => {
  setUrl('')
  setState({ kind: 'extracting-url', url: '' })
}, [])
// StructuredEntryPanel already calls this via the EXTR-07 backup link;
// the new Add-Watch-landing URL affordance just needs to call the same handler.

// Confirm-status local state and dispatch (lines ~108, ~411):
const [confirmStatus, setConfirmStatus] = useState<'owned' | 'wishlist' | 'grail'>(...)
const handleConfirmPrimary = useCallback(async () => {
  // ... currently calls addWatch(payload). Catalog-only must branch BEFORE this.
}, [...])
```

From src/components/watch/ConfirmStep.tsx — locked Phase 68 D-03 prop contract (extend additively, never break):
```typescript
// Current status union (line 81):
status: 'owned' | 'wishlist' | 'grail'
onStatusChange: (next: 'owned' | 'wishlist' | 'grail') => void

// OPTIONS array (line 47) — drives the radiogroup render:
const OPTIONS: Array<{ value: 'owned' | 'wishlist' | 'grail'; label: string }> = [...]

// CTA_LABELS (line 41) — drives primary-button copy per status:
const CTA_LABELS = { owned: ..., wishlist: ..., grail: ... } as const

// WAI-ARIA radiogroup keyboard handler (line 142) uses a hardcoded
//   const values = ['owned', 'wishlist', 'grail'] as const
// This array MUST also include 'catalog-only' when isAdmin=true, or arrow-key
// nav skips the new option. Compute values dynamically from OPTIONS_FOR_VIEWER.

// Memory guardrail: font-semibold (NOT font-medium). Do NOT add raw palette values.
```

From src/app/watch/new/page.tsx:
```typescript
// user.id is available via getCurrentUser() (line 47).
// To resolve isAdmin, read profiles.is_admin once — mirror the assertOwner select pattern:
//   const supabase = await createSupabaseServerClient()
//   const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
//   const isAdmin = Boolean(data?.is_admin)
// Add to the Promise.all block alongside getProfileById; pass as isAdmin prop to AddWatchFlow.
```

From src/app/actions/cms/catalogPicker.ts and src/app/actions/cms/curatedLists.ts (canonical Server Action shape to mirror):
```typescript
// Three-block pattern: (1) assertOwner, (2) zod parse, (3) DAL call + revalidation.
export async function someCmsAction(input: unknown): Promise<ActionResult<T>> {
  try {
    await assertOwner()  // throws UnauthorizedError on non-admin
    const parsed = SomeSchema.parse(input)
    const result = await someDAL(parsed)
    revalidateTag('explore', 'max')  // when catalog changes
    return { success: true, data: result }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Surface URL extraction on Add-Watch landing (Piece 1)</name>
  <files>src/components/watch/AddWatchFlow.tsx, src/components/watch/AddWatchFlow.test.tsx</files>
  <action>
In `src/components/watch/AddWatchFlow.tsx`, edit the `search-idle` render branch (currently `state.kind === 'search-idle'`, around line 595). Between the `<SearchEntry .../>` element and the existing `"Skip search — enter manually"` button, INSERT a new `<button>` that calls the already-defined `handleSwitchToUrl` callback. Do NOT add new state, new props, or a new handler — reuse `handleSwitchToUrl` verbatim.

Copy: `"Add from URL"`. Match the visual weight of the existing skip-search link — use the EXACT same `className` string as that link: `"text-sm text-muted-foreground underline-offset-4 hover:underline hover:text-foreground"`. Use `font-semibold` ONLY if the existing skip-search link uses it (it does not — leave it off). Do NOT introduce `font-medium`, raw color tokens, or new Tailwind utilities (memory: font-medium guardrail recurrence across Phase 65/68/72/74; no-raw-palette guardrail).

Order in the search-idle `<div className="space-y-6">` container:
  1. `<SearchEntry ... />` (existing)
  2. New `<button onClick={handleSwitchToUrl}>Add from URL</button>` (insert here)
  3. `<button onClick={handleSkipSearch}>Skip search — enter manually</button>` (existing)

Accessibility: `type="button"` to prevent form submission semantics. No new aria label — the visible text is sufficient.

Tests — extend `src/components/watch/AddWatchFlow.test.tsx`: add at least one test that
  1. renders AddWatchFlow in the default `search-idle` initial state
  2. asserts the "Add from URL" button is present alongside `SearchEntry` and the existing "Skip search — enter manually" link
  3. clicks "Add from URL" and asserts the FlowState transitioned to the `extracting-url` branch (assert the URL `<Input id="extracting-url-input">` is now in the document AND the new "Add from URL" button + SearchEntry are NOT — pair appearance with disappearance per `feedback_test_assert_disappearance_too` memory).
Mirror the file's existing testing-library + Vitest patterns; jsdom env (no `// @vitest-environment node` pragma).

Out of scope here: any change to the `extracting-url` branch itself (already works). Any change to the `ConfirmStep`. Any new server logic. This task ships as a pure UI-surfacing change.
  </action>
  <verify>
    <automated>npm test -- AddWatchFlow.test 2>&1 | tail -40</automated>
  </verify>
  <done>"Add from URL" button is rendered in search-idle between SearchEntry and the skip-search link; clicking it transitions to the extracting-url branch; existing skip-search and SearchEntry behaviors unchanged; AddWatchFlow.test.tsx passes including the new test (and pairs panel-appearance with previous-affordances-disappearance).</done>
</task>

<task type="auto">
  <name>Task 2: Catalog-only save Server Action + admin-gated UI option (Piece 2)</name>
  <files>src/app/actions/watches.ts, src/app/watch/new/page.tsx, src/components/watch/AddWatchFlow.tsx, src/components/watch/ConfirmStep.tsx, src/components/watch/ConfirmStep.test.tsx, src/components/watch/AddWatchFlow.test.tsx</files>
  <action>
Five wired pieces:

(A) `src/app/actions/watches.ts` — new Server Action `saveCatalogOnlyFromExtract(input)`. Three-block pattern mirroring `src/app/actions/cms/catalogPicker.ts`:
  1. `await assertOwner()` from `@/lib/auth` — the SOLE enforced write gate (assertOwner throws UnauthorizedError when `profiles.is_admin` is false). Do NOT trust any client-supplied admin flag.
  2. Zod-parse `input` against a schema matching the subset of `ExtractedWatchData` needed by `upsertCatalogFromExtractedUrl` (brand, model, reference, movementType, caseSizeMm, lugToLugMm, waterResistanceM, crystalType, dialColor, isChronometer, productionYear, imageUrl, imageSourceUrl, styleTags, designTraits, complications). Validate brand and model are non-empty strings; reject otherwise with `{ success: false, error: 'brand and model required' }`.
  3. Call `upsertCatalogFromExtractedUrl(parsed)` from `@/data/catalog` (idempotent ON CONFLICT COALESCE — safe even if the URL-extract API route already inserted the row, which it does for the URL-backup path). Set `source: 'url_extracted'` implicitly (the DAL handles it). After success, call `revalidateTag('explore', 'max')` (mirror line 308–310 of `src/app/api/extract-watch/route.ts` — Browse counts depend on this).
  Return `{ success: true, data: { catalogId } }` (or `{ success: false, error }` on failure). Return type: existing `ActionResult<T>` pattern in this file. Critically: this action does NOT touch `watches` — no user-side insert.

(B) `src/app/watch/new/page.tsx` — resolve `isAdmin` server-side. After `getCurrentUser()`, in the existing `Promise.all` block (around line 90), add a fourth parallel query:
```
supabase.from('profiles').select('is_admin').eq('id', user.id).single()
```
Use the existing `createSupabaseServerClient` (import if needed). Compute `const isAdmin = Boolean(profileAdminRow?.data?.is_admin)`. Pass `isAdmin={isAdmin}` to `<AddWatchFlow ... />`. Defensive: a fetch error or missing row → `isAdmin = false` (fail-closed).

(C) `src/components/watch/AddWatchFlow.tsx`:
  1. Widen `AddWatchFlowProps` with `isAdmin: boolean` (additive; no default — `/watch/new/page.tsx` is the only mount site and now always supplies it). Update the destructuring at the top of the component.
  2. Widen the `confirmStatus` state union from `'owned' | 'wishlist' | 'grail'` to `'owned' | 'wishlist' | 'grail' | 'catalog-only'` in the `useState` declaration AND in the `setConfirmStatus` call sites (handleSearchPick, handleStructuredSubmit, handleUrlBackup, cachedExtract branch — all four already default to `initialStatus ?? 'wishlist'` which still satisfies the wider union).
  3. In `handleConfirmPrimary`, BRANCH at the top before the `addWatch(payload)` call: if `confirmStatus === 'catalog-only'`, instead call the new `saveCatalogOnlyFromExtract` action with a payload mapped from `captured.extracted` (brand, model, reference, movement→movementType, caseSizeMm, lugToLugMm, waterResistanceM, crystalType, dialColor, isChronometer, productionYear from `confirmYear`, imageUrl, imageSourceUrl=null, styleTags, designTraits, complications). On success: `toast.success('Saved to catalog')`, reset `setUrl('')` + `setState({ kind: 'search-idle' })`, and route back to the search-idle landing (do NOT call `router.push(dest)` for the catalog-only path — the admin stays on /watch/new to add more). On failure: `toast.error(result.error)` and reset pending. Skip the entire owned/photo-pending downstream branch.
  4. Forward `isAdmin={isAdmin}` to `<ConfirmStep />` in the existing confirming branch render.
  5. Import the new action from `@/app/actions/watches` alongside the existing `addWatch` import.

(D) `src/components/watch/ConfirmStep.tsx` — additive prop widening (Phase 68 D-03 contract: additive only, default-false equivalents preserve backward compat):
  1. Widen the `status` prop type to `'owned' | 'wishlist' | 'grail' | 'catalog-only'`. Same for `onStatusChange`.
  2. Add `isAdmin?: boolean` prop (default `false` in destructuring — preserves backward compat for any test that doesn't pass it).
  3. Extend `CTA_LABELS` with `'catalog-only': 'Save to Catalog'`.
  4. Compute the rendered options inline: `const OPTIONS_FOR_VIEWER = isAdmin ? [...OPTIONS, { value: 'catalog-only' as const, label: 'Catalog only' }] : OPTIONS`. Use `OPTIONS_FOR_VIEWER` in the `.map` (around line 251) and in the WAI-ARIA `values` array inside `handleKeyDown` (currently hardcoded at line 143 — replace with `OPTIONS_FOR_VIEWER.map(o => o.value)` so arrow-key roving-tabindex includes the new option for admins and excludes it for non-admins).
  5. Status-gated price field (around line 280): when `status === 'catalog-only'`, the price field is irrelevant (no user-side watches row). Hide the price field entirely on catalog-only (wrap section in `{status !== 'catalog-only' && (...)}`). Do NOT show a label-only field; do NOT show a disabled input.
  6. Primary CTA: when `status === 'catalog-only'`, copy is `CTA_LABELS['catalog-only']` (i.e. "Save to Catalog"). The existing `{!bannerActive && <Button>...}` wrapper stays as-is — catalog-only does not interact with the DupeBanner contract (catalog-only doesn't care about dupe state).
  7. Memory guardrail: keep `font-semibold` (NOT `font-medium`) on any new label/heading text; do not introduce raw color tokens; reuse existing `variant="outline"` + `className={cn('min-h-[44px]', status === value && 'border-primary bg-primary/10')}` on the new radio button.

(E) Tests:
  - `src/components/watch/ConfirmStep.test.tsx`: add tests asserting (i) `isAdmin={false}` renders 3 options (owned/wishlist/grail), no "Catalog only" button anywhere, no aria-disabled markers (option entirely absent — `queryByRole('radio', { name: /catalog only/i })` returns null); (ii) `isAdmin={true}` renders 4 options including "Catalog only"; (iii) `status='catalog-only'` flips the primary CTA copy to "Save to Catalog"; (iv) `status='catalog-only'` hides the price field (assert `queryByLabelText(/price/i)` returns null).
  - `src/components/watch/AddWatchFlow.test.tsx`: add tests asserting (i) handing `isAdmin={true}` and advancing to a confirming state shows the catalog-only option; (ii) handing `isAdmin={false}` does not; (iii) submitting with status='catalog-only' calls the mocked `saveCatalogOnlyFromExtract` action and NOT `addWatch`.
  - Mock the new action in the same style the file already mocks `addWatch` / `findViewerWatchByCatalogIdAction` / `moveWishlistToCollection`.

Server-side gate verification: the catalog-only action gates on `assertOwner()` which reads `profiles.is_admin` directly via Supabase; client-supplied `isAdmin` is never trusted. A non-admin executing the action (e.g. via crafted client call) hits `throw new UnauthorizedError('Not an admin')` and returns `{ success: false, error }`. NO RLS change needed — assertOwner is the SOLE write gate per the CMS pattern (catalog DAL bypasses RLS via Drizzle direct connection, mirroring the lib/auth.ts assertOwner block comment).

No DB migration. No schema change. No new flow state. The catalog-only path reuses `confirming` state with `confirmStatus = 'catalog-only'`.

Out of scope: batch URL import; catalog edit UI beyond confirm step; bulk catalog cleanup; surfacing the count of catalog-only saves to the admin; any analytics; widening the structured-input path to support a catalog-only save (the seed scope is URL-extracted only; structured-input goes through `upsertCatalogFromUserInput` which has narrower 3-field semantics — out of scope per Pitfall 5 in the API route).
  </action>
  <verify>
    <automated>npm test -- ConfirmStep.test AddWatchFlow.test 2>&1 | tail -60</automated>
  </verify>
  <done>
- New `saveCatalogOnlyFromExtract` Server Action exists in `src/app/actions/watches.ts`, gated by `assertOwner()`; calls `upsertCatalogFromExtractedUrl` and `revalidateTag('explore', 'max')`; does NOT call `addWatch`.
- `/watch/new/page.tsx` resolves `isAdmin` from `profiles.is_admin` and passes it to `AddWatchFlow`.
- `AddWatchFlow` accepts `isAdmin`, widens `confirmStatus` to include `'catalog-only'`, branches `handleConfirmPrimary` to call the new action when `confirmStatus === 'catalog-only'`, returns user to search-idle on success.
- `ConfirmStep` renders the 4th "Catalog only" radio only when `isAdmin=true`; CTA copy flips to "Save to Catalog" on catalog-only; price field hidden on catalog-only; arrow-key roving-tabindex correctly cycles all 4 options for admins and 3 for non-admins.
- All four new behavioral tests pass; existing ConfirmStep.test.tsx + AddWatchFlow.test.tsx assertions unchanged.
- `npm run build` exit 0; no new TypeScript errors attributable to the widened status union (mapping at `addWatch` payload still only uses owned/wishlist/grail — catalog-only short-circuits before the payload is built).
  </done>
</task>

</tasks>

<verification>
- Phase 1 (Piece 1):
  - On `/watch/new`, the search-idle landing renders SearchEntry, then an "Add from URL" affordance, then "Skip search — enter manually" — in that exact order, with matching visual weight on items 2 and 3.
  - Clicking "Add from URL" advances to the `extracting-url` branch (URL `<Input>` becomes visible; SearchEntry + the two link affordances unmount).
- Phase 2 (Piece 2):
  - Sign in as a non-admin user (or any user with `profiles.is_admin = false`), reach the confirming step (via search-pick or URL-extract), and confirm the radiogroup shows only owned / wishlist / grail. Arrow-key navigation cycles 3 options. No "Catalog only" button present anywhere in the DOM.
  - Sign in as an admin user (`profiles.is_admin = true`), reach the confirming step, and confirm a 4th "Catalog only" option is rendered. Arrow-key navigation cycles 4 options. Selecting it: price field hides, primary CTA copy = "Save to Catalog".
  - Click "Save to Catalog": no row inserted into `watches` (verify via Supabase Studio or `SELECT COUNT(*) FROM watches WHERE user_id = '<admin-uuid>'` before/after — count unchanged). A row IS upserted into `watches_catalog` (verify via natural-key lookup brand/model/reference). User returns to `/watch/new` search-idle (no redirect to `/u/{username}/collection`).
- `npm run build` exits 0 (per memory: build is the authoritative gate). `npm test` baseline noise (Phase 56A CommentGateLocked font-medium failure ≥1 pre-existing) does not include any newly added test failures.
- Server-side gate spot-check: from the browser devtools as a non-admin user, fire a crafted `fetch` invoking the new Server Action endpoint (or temporarily call it from a non-admin test) — confirm it returns `{ success: false, error: 'Not an admin' }` (or matching).
</verification>

<success_criteria>
- One URL-extract entry point is reachable in ≤1 tap from `/watch/new` (was ≥3).
- An admin can save 10+ catalog rows in under 5 minutes through the UI without their own `watches` table being polluted (per SEED-018 success conditions).
- Non-admin users CANNOT trigger the catalog-only save path either via UI (option not rendered) or via crafted client call (server-side `assertOwner` rejects).
- No regression to the existing owned/wishlist/grail add-to-collection flow.
- No DB migration; no schema change.
- `npm run build` exits 0.
- All new and existing AddWatchFlow + ConfirmStep tests pass.
</success_criteria>

<output>
After completion, create `.planning/quick/260620-lbn-seed-018-surgical-slice-surface-url-extr/260620-lbn-SUMMARY.md` capturing: files touched, the admin-gate pattern reused (assertOwner), the additive ConfirmStep prop change (isAdmin?, status union widened), confirmation that no DB migration was needed, and any prod-verification notes if the executor pushes a deploy.
</output>
