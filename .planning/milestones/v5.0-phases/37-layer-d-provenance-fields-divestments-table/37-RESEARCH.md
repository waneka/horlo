# Phase 37: Layer D — Provenance Fields + Divestments Table — Research

**Researched:** 2026-05-11
**Domain:** Postgres schema migration (additive columns + new table), Server Action, WatchForm Accordion disclosure, WatchCard badge, RLS, Drizzle ORM
**Confidence:** HIGH

---

## Quick Summary

- **WatchForm uses plain `useState` + shadcn `<Select>` dropdowns** — no react-hook-form, no chip-group primitive for finite-set fields. Every finite-set field currently uses `<Select>` from `@/components/ui/select`. The planner must choose between adding a chip-style button group (hand-roll or small shadcn Button group) or continuing with `<Select>` for `condition`, `box_papers`, `paid_currency`. The Accordion disclosure must use `@base-ui/react/accordion` (not a shadcn file) — `@/components/ui/accordion.tsx` does NOT exist in the codebase.
- **WatchCard already imports `Badge` from `@/components/ui/badge` and renders a `<Badge variant="outline">{watch.status}</Badge>` at top-right.** A sold-specific badge is a one-line conditional variant change, not a new pattern.
- **The status field in WatchForm is a `<Select>` that includes `'sold'`** (from `WATCH_STATUSES = ['owned', 'wishlist', 'sold', 'grail']`). There is no separate StatusToggle component. The `recordDivestment` call must be injected in `handleSubmit` (form-submit path), gated on `parsedData.status === 'sold' && originalStatus !== 'sold'` — or more simply, the Server Action `editWatch` detects the `owned → sold` transition server-side.
- **FilterBar has NO status chip group.** `watchStore.ts` has a `status: 'all' | WatchStatus` filter field defaulting to `'all'`, but FilterBar does not render any status chips — only style/role/dialColor/price filters. The D-14a question resolves to: nothing to change in Phase 37; the status filter is not surfaced in the current FilterBar.
- **Migration filename must be strictly greater than `20260511000000`.** Use `20260511010000_phase37_layer_d.sql`. Drizzle journal idx=10 appends to 9 existing entries (idx=0..9).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward from prior phases (DO NOT re-litigate):**
- Phase 35 D-03 / D-10 / D-11: pgEnum for finite-known sets; free text for collector-subjective values
- Phase 17 D-04 / D-06: Per-user RLS `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE
- Phase 19.1 / 17: Drizzle = TS type source of truth; Supabase migration = authoritative DDL (RLS, GRANT, DO $$)
- Phase 34 D-02: `ON DELETE RESTRICT` for entity FKs; `ON DELETE CASCADE` for user_id FKs; `ON DELETE SET NULL` for soft-hint FKs
- Phase 34 / 35 / 36: 14-digit migration filename strictly greater than highest existing; idempotent Drizzle twin; journal append (idx=10) MANDATORY
- Phase 36 Plan 01 Rule 4: `watches.catalogId .notNull()` Drizzle tightening DEFERRED to Phase 38 — Phase 37 does NOT fix it
- Memory `project_drizzle_supabase_db_mismatch.md` rules 1–4 apply; Rule 4 (pg_depend) N/A for Phase 37 (additive only — no drops/type-changes on existing columns)
- Memory `project_db_wipeable_2026_05_09.md`: Phase 37 does NOT wipe; schema-only + Server Action; user-count-independent

**D-01 — `year_of_acquisition` (nullable int) coexists with existing `acquisition_date` (text). No migration of existing data. UI priority: purchase_date → acquisition_date → year_of_acquisition.**

**D-02 — `condition` is pgEnum `condition_grade` with 6 values: `mint`, `near_mint`, `excellent`, `good`, `fair`, `poor`.**

**D-03 — `paid_currency` is pgEnum `currency_code` with 10 values: `USD`, `EUR`, `GBP`, `JPY`, `CHF`, `AUD`, `CAD`, `HKD`, `SGD`, `CNY`.**

**D-04 — `divestments.sale_currency` uses same `currency_code` pgEnum (additive beyond ROADMAP letter).**

**D-05 — `box_papers` is pgEnum `box_papers_status` with 4 ROADMAP-locked values: `none`, `box_only`, `papers_only`, `full_set`.**

**D-06 — `service_history` is free text (nullable). No structured shape.**

**D-07 — `serial` is free text (nullable). No validation.**

**D-08 — `purchase_date` is Postgres `date` type (nullable).**

**D-09 — `divestments` table shape (see CONTEXT.md §Specifics for full DDL):**
- PK, catalog_id NOT NULL FK ON DELETE RESTRICT, user_id NOT NULL FK ON DELETE CASCADE, divested_at NOT NULL DEFAULT now(), replaced_by_catalog_id nullable FK ON DELETE SET NULL, sale_price real, sale_currency currency_code, notes text, created_at, updated_at
- Indexes: user_id, catalog_id, (user_id, divested_at DESC)

**D-10 — RLS mirrors `watches`: `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE. GRANT SELECT/INSERT/UPDATE/DELETE to `authenticated` (NOT anon). NOT public-read.**

**D-11 — `recordDivestment(watchId, data?)` Server Action: verify ownership → verify catalog_id IS NOT NULL → INSERT divestments → UPDATE watches.status='sold' → revalidatePath → return `{ok, divestmentId}`.**

**D-12 — Phase 37 wires the action; no sell-dialog UI. Empty-metadata divestment rows are valid.**

**D-13 — 1:1 soft convention (no UNIQUE constraint). See confirmation in §D-13 section below.**

**D-14 — Sold watches stay in `/collection` with sold badge. No new surface. No DAL change.**

**D-14a — Default filter chip selection is DEFERRED (Phase 39 polish). Phase 37 only adds the sold badge.**

**D-15 — "Collector's Record" Accordion disclosure on edit page only. Collapsed by default. Uses `@base-ui/react/accordion` (see §Accordion Primitive Landmine below).**

### Claude's Discretion

- Plan structure (Wave 1 parallel: 01 Drizzle schema, 02 Supabase migration, 03 Drizzle migration twin; Wave 2: 04 Server Action + UI; Wave 3: 05 integration test + deploy docs + prod push checkpoint)
- Migration filename (strictly > `20260511000000`)
- pgEnum naming (`condition_grade`, `currency_code`, `box_papers_status`)
- Server Action location (`src/app/actions/watches.ts` vs new `src/app/actions/divestments.ts`) — researcher recommends new file (see §Server Action Placement)
- Server Action input shape and zod schema
- WatchCard sold badge visual treatment (researcher: variant="secondary" or destructive on the existing outline badge)
- `condition` / `box_papers` / `paid_currency` UI: chip-style button group vs `<Select>` (researcher: use `<Select>` to match existing form aesthetic; see §Chip-Group Patterns)
- date input primitive for `purchase_date` (researcher: `<input type="date">` — see §Date Input Pattern)

### Deferred Ideas (OUT OF SCOPE)

- Divestment dialog UI (v5.x)
- `replaced_by_catalog_id` UI capture (v5.x)
- v6.0 market-value math
- SEED-002 recommender consuming `divestments.divested_at`
- Drizzle `watches.catalogId .notNull()` tightening (Phase 38)
- Default filter chip selection change (Phase 39 polish)
- `divestments.watch_id` FK + UNIQUE on `(user_id, watch_id)`
- Structured `service_history` (future enrichment)
- `serial` validation (brand-specific format)
- Sold-watch read-only edit page
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-18 | Provenance columns added to `watches`: `serial`, `year_of_acquisition`, `condition`, `box_papers` (chip enum: none / box-only / papers-only / full-set), `service_history`, `paid_currency`, `purchase_date`. New `divestments` table with `(catalog_id NOT NULL, user_id, divested_at, replaced_by_catalog_id, sale_price, notes)`. Existing `watches.status = 'sold'` enum value remains. Status transition `'owned' → 'sold'` writes a row to `divestments`. Provenance UI ships as collapsed "Collector's Record" disclosure on the WatchForm edit page. Divestment dialog UI scope deferred. | Schema DDL confirmed via src/db/schema.ts. Form patterns confirmed via WatchForm.tsx. Action pattern confirmed via src/app/actions/watches.ts. Badge pattern confirmed via WatchCard.tsx. RLS pattern confirmed via Phase 36/17 migrations. |
</phase_requirements>

---

## 1. WatchForm Internals

**File:** `src/components/watch/WatchForm.tsx` (737 lines) [VERIFIED: read in full]

### Form Architecture

WatchForm uses **plain `useState`** — no react-hook-form, no Formik, no zod on the client side. The form data lives in a single `const [formData, setFormData] = useState<FormData>()` object (line 102). Validation is a hand-written `validate()` function (lines 139–150) that checks `brand` and `model` are non-empty; all other fields are optional.

```typescript
// WatchForm.tsx lines 102–135 — state initialization
const [formData, setFormData] = useState<FormData>(
  watch
    ? { brand: watch.brand, model: watch.model, ... }  // edit mode: seed from prop
    : { ...initialFormData, status: lockedStatus ?? defaultStatus ?? initialFormData.status }  // create mode
)
const [errors, setErrors] = useState<Record<string, string>>({})
```

### No chip-group primitive exists

WatchForm uses **`<Select>` from `@/components/ui/select`** for ALL finite-set fields: status (line 323), movement (line 417), strapType (line 509), crystalType (line 530), dialColor (line 550). There is no chip-group or button-group primitive in use anywhere in WatchForm. For the 3 new provenance enums (`condition`, `box_papers`, `paid_currency`), the planner must choose:

**Option A (recommended): Continue `<Select>` pattern** — zero new primitives, exactly matches existing form aesthetic. Lowest implementation risk.

**Option B: Button-group chips** — visually richer for small finite sets (4–6 values). Requires a hand-rolled `<button>` group with active/inactive styling using the `cn()` utility (the FilterBar uses exactly this pattern for style/role/dialColor chips). The FilterBar chip pattern is available as a reference (see §9).

### Current status field rendering (lines 311–341)

```tsx
// WatchForm.tsx lines 311–341 — status field
<div className="space-y-2">
  <Label htmlFor="status">Status *</Label>
  {lockedStatus ? (
    // Phase 20.1 D-12: read-only chip for locked status
    <div id="status" aria-readonly="true"
      className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm capitalize">
      {lockedStatus}
    </div>
  ) : (
    <Select
      value={formData.status}
      onValueChange={(value) => {
        if (!value) return
        setFormData((prev) => ({ ...prev, status: value as WatchStatus }))
      }}
    >
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {WATCH_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            <span className="capitalize">{status}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )}
</div>
```

`WATCH_STATUSES` is `['owned', 'wishlist', 'sold', 'grail']` — 'sold' is already included [VERIFIED: `src/lib/constants.ts` line 131–136].

### How `editWatch` is called (lines 223–226)

```tsx
// WatchForm.tsx lines 223–226
const result =
  mode === 'edit' && watch
    ? await editWatch(watch.id, formData)
    : await addWatch(submitData)
```

The Server Action is called directly inside the `run()` callback from `useFormFeedback` — not via `<form action={...}>`. The hook handles the pending/success/error state. This is standard Next.js 16 `'use client'` calling pattern — not progressive enhancement.

### Edit vs. create page divergence

The `mode` prop (`'create' | 'edit'`) is the branching mechanism. Phase 37's Accordion must be gated on `mode === 'edit'` (line 615 shows the existing `mode === 'create'` guard for the CatalogPhotoUploader as the exact mirror pattern):

```tsx
{/* CatalogPhotoUploader — create mode only */}
{mode === 'create' && (
  <CatalogPhotoUploader ... />
)}

// Phase 37 Accordion — edit mode only (mirror the guard):
{mode === 'edit' && (
  <Accordion.Root ...>
    ...
  </Accordion.Root>
)}
```

### Where to insert the Accordion

The form has 4 Card sections in order: Basic Information, Specifications, Complications, (create-only: CatalogPhotoUploader), Notes. The Accordion "Collector's Record" should be inserted **after Notes** (before the Actions row with Save/Cancel buttons — lines 673–699). This keeps provenance fields at the end so they don't clutter the primary save flow.

### `pricePaid` already exists

The existing `watches.price_paid` column (`pricePaid` in Drizzle) is at line 79 of the schema and line 376–387 of WatchForm. It is NOT a new Phase 37 field. Phase 37 adds only `paid_currency` as the companion. The planner MUST NOT add a second `pricePaid` column.

### `acquisition_date` is text, not date

`acquisitionDate: text('acquisition_date')` in schema.ts line 104. It maps to `formData.acquisitionDate: string | undefined`. `type="text"` input (not date input). Phase 37 must NOT alter this column or its UI. The new `purchase_date` (date type) is a separate field.

---

## 2. WatchCard + Badge Surface

**File:** `src/components/watch/WatchCard.tsx` [VERIFIED: read in full]

### Existing badge structure (lines 51–73)

The card already renders badges in a top-right overlay (`absolute top-2 right-2 flex flex-col items-end gap-1`):

```tsx
// WatchCard.tsx lines 51–72
<div className="absolute top-2 right-2 flex flex-col items-end gap-1">
  <Badge variant="outline">{watch.status}</Badge>   // ← renders "sold" already!
  {isDeal && (
    <Badge variant="secondary" className="gap-1">
      <Sparkles className="h-3 w-3" aria-hidden />
      Deal
    </Badge>
  )}
  {gapFill && (
    <Badge variant="outline" className="gap-1" ...>
      ...
    </Badge>
  )}
</div>
```

**The current badge already renders `watch.status` verbatim**, so sold watches already show a "sold" badge with `variant="outline"`. The Phase 37 requirement is a **visual distinction** for sold status — not to add a badge where none exists.

### Badge primitive

`src/components/ui/badge.tsx` exists [VERIFIED]. It uses `@base-ui/react` internals with `cva` variants: `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`.

### Minimum-disruption sold treatment

**Option A (recommended):** Change the variant for `status === 'sold'` to `variant="secondary"` (muted background, stands out from outline without being alarming). One-line conditional:

```tsx
<Badge variant={watch.status === 'sold' ? 'secondary' : 'outline'}>
  {watch.status}
</Badge>
```

**Option B:** Add a small opacity overlay or strikethrough on the title — more disruptive, not recommended.

**Option C:** Use `variant="destructive"` — semantically "this watch is gone" but visually heavy (red background). Acceptable if the user wants sold to be visually prominent.

### WatchCard does NOT currently condition visuals on `status`

Beyond `const isOwned = watch.status === 'owned'` (line 22) and `isWishlistLike` (line 23) gating deal/gapFill logic, there is no visual treatment for sold status. The status badge is `variant="outline"` for all statuses.

---

## 3. FilterBar Default State (D-14a Confirmation)

**Files:** `src/components/filters/FilterBar.tsx`, `src/store/watchStore.ts` [VERIFIED: read in full]

### Current status filter

`watchStore.ts` defines:
```typescript
const defaultFilters: WatchFilters = {
  status: 'all',   // line 18-19 — default is 'all' (all statuses visible)
  styleTags: [],
  ...
}
```

### FilterBar does NOT render status chips

**FilterBar renders: Style, Role, Dial Color, Price Range — no status chips.** The `filters.status` field in the store exists but is not wired to any UI in `FilterBar.tsx`. This matches the comment in the old types:

```typescript
// watchStore.ts line 5-6
export interface WatchFilters {
  status: 'all' | WatchStatus   // field exists but FilterBar doesn't render it
  ...
}
```

### D-14a resolution

**Phase 37 ships ZERO changes to FilterBar or watchStore.** The status filter field (`'all'`) is a store artifact from an earlier phase; FilterBar never exposed it. There is no "sold chip default state" to change — the chip doesn't exist in the current UI. The deferred Phase 39 polish item would need to ADD status chips to FilterBar, not just change a default.

---

## 4. StatusToggle Wire-up Point (D-12)

**Critical finding:** There is NO separate `StatusToggle` component. Status transitions happen in two places:

1. **WatchForm status `<Select>`** — user changes status via dropdown, clicks "Save Changes", `editWatch()` is called. This is the ONLY UI path where `owned → sold` can happen in edit mode.
2. **Potentially a `StatusToggle.tsx`** — searched, not found. `grep -r "StatusToggle"` returns zero results.

### Injection point for `recordDivestment`

The `editWatch` Server Action is the injection point. Two options:

**Option A (recommended): Server-side detection in `editWatch`** — inside `editWatch`, after validating the update payload, check `if (parsed.data.status === 'sold')` then check the current row's status; if transitioning from non-sold to sold, call `recordDivestment` (or inline the insert). This is transparent to the WatchForm and matches D-12 ("writes a row" without shipping a dialog UI).

**Option B: Client-side injection in WatchForm `handleSubmit`** — add a check `if (formData.status === 'sold' && watch?.status !== 'sold')` before calling `editWatch`, then call `recordDivestment` separately. Two server calls, not atomic.

**Option A is correct** per D-11's requirement: "INSERT into divestments + UPDATE watches.status='sold' in the SAME server action (dual-write)." The Server Action must be atomic.

### How `editWatch` calls the DAL (lines 341)

```typescript
// watches.ts line 341
const watch = await watchDAL.updateWatch(user.id, watchId, updatePayload)
```

`updateWatch` does a single `db.update(watches).set(data).where(userId + watchId)`. The `recordDivestment` logic must run BEFORE or as part of this update — or the action does two writes: first INSERT divestments row, then UPDATE watches.status. Since both are in the same Server Action function, they share the same server-side execution context but are NOT in a Postgres transaction unless explicitly wrapped with `db.transaction()`.

**Recommendation:** Use `db.transaction()` in `recordDivestment` to wrap both the INSERT into divestments and the UPDATE watches.status='sold' atomically. This prevents a scenario where the divestment row is created but the status update fails (or vice versa).

---

## 5. Server Action Placement

**Files:** `src/app/actions/watches.ts` (392 lines) [VERIFIED: read in full]

### Current actions/watches.ts size and complexity

`watches.ts` has 3 exported actions: `addWatch` (lines 66–288), `editWatch` (lines 297–361), `removeWatch` (lines 369–391). The file is already large (392 lines) with heavy fire-and-forget side effects (catalog upsert, taste enrichment, activity logging, notification fan-out). Adding a 6th function (recordDivestment) to this file would make it harder to navigate.

**Researcher recommendation: New file `src/app/actions/divestments.ts`.** Rationale:
- `divestments` is a distinct resource with distinct DAL operations (INSERT divestments, UPDATE watches.status)
- Keeps watches.ts focused on the CRUD of the watches table itself
- Makes the file system reflect the domain boundary

### Existing action pattern to mirror

The `editWatch` pattern (lines 297–361) is the closest template:

```typescript
// watches.ts lines 297–302
export async function editWatch(watchId: string, data: unknown): Promise<ActionResult<Watch>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const parsed = updateWatchSchema.safeParse(data)
  if (!parsed.success) { ... return { success: false, error: ... } }
  ...
}
```

### revalidatePath usage in `editWatch` (lines 342–351)

```typescript
// watches.ts lines 342–352
revalidatePath('/')
revalidatePath('/u/[username]', 'layout')
revalidateTag('explore', 'max')
```

For `recordDivestment`, the same paths apply:
- `revalidatePath('/')` — home
- `revalidatePath('/u/[username]', 'layout')` — user profile

`revalidateTag('explore', 'max')` is needed only if the explore rails compute from sold status (they probably do — `owners_count` / `wishlist_count` changes on status flip). Include it to match the `editWatch` pattern.

### DAL ownership-check pattern

```typescript
// watches.ts line 332 — getWatchById for ownership verification
const currentRow = await watchDAL.getWatchById(user.id, watchId)
```

`getWatchById(userId, watchId)` returns `Watch | null` — returns null if not found OR not owned by userId (RLS enforces this). The action returns `{ success: false, error: 'Not found' }` on null.

### ActionResult type

`import type { ActionResult } from '@/lib/actionTypes'` — located in `src/lib/actionTypes.ts`. The `recordDivestment` return type should be `ActionResult<{ divestmentId: string }>`.

### TS types for new enums

Phase 37 adds `CurrencyCode`, `ConditionGrade`, `BoxPapersStatus` as TypeScript types. These should be added to `src/lib/types.ts` alongside `WatchStatus`, `MovementType`, etc. The new `Watch` fields (7 optional provenance columns) and the `Divestment` interface also belong in `src/lib/types.ts`.

---

## 6. Migration Filename + Drizzle Journal Mechanics

### Migration filename calculation

Phase 36's filename: `20260511000000_phase36_layer_c_variants.sql` [VERIFIED: `ls supabase/migrations/`]

Today's date: 2026-05-11. The timestamp is `YYYYMMDDHHMMSS`. Phase 36 used `000000` (midnight). Phase 37 must use a strictly greater value on the same day.

**Recommended filename: `20260511010000_phase37_layer_d.sql`**

This uses `01:00:00` (1 AM) on 2026-05-11 — clearly after Phase 36's `00:00:00`. If Supabase CLI applies migrations in lexical order (it does), `20260511010000` > `20260511000000` ✓.

**Drizzle filename: `drizzle/0010_phase37_layer_d.sql`**

### Drizzle journal idx=10

Current `drizzle/meta/_journal.json` has 10 entries (idx=0 through idx=9) [VERIFIED: read in full]. The last entry is:

```json
{
  "idx": 9,
  "version": "7",
  "when": 1778534674854,
  "tag": "0009_phase36_layer_c_variants",
  "breakpoints": true
}
```

New idx=10 entry to append:
```json
{
  "idx": 10,
  "version": "7",
  "when": <timestamp_ms_at_creation>,
  "tag": "0010_phase37_layer_d",
  "breakpoints": true
}
```

`when` must be a Unix timestamp in milliseconds — use `Date.now()` at write time (e.g., `1778534674854 + 1` is fine for ordering; actual value is cosmetic). The critical field is `tag` matching the SQL filename prefix exactly.

**MANDATORY:** The journal MUST be appended, not regenerated. Existing entries idx=0..9 must remain untouched. The Phase 34 Plan 01 lesson: without journal append, `drizzle-kit migrate` silently skips the migration.

**DEBT-12 note:** Prod's `drizzle.__drizzle_migrations` has only idx=0. Phase 37 must NOT run `drizzle-kit migrate` against prod — use `supabase db push --linked` only (same pattern as Phase 36). The Drizzle migration is retained for local re-sync only.

---

## 7. Integration Test Template Excerpts

**File:** `tests/integration/phase36-rls.test.ts` [VERIFIED: read in full]

### Localhost guard pattern (lines 23–28)

```typescript
const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))

const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && dbUrlIsLocal
  ? describe : describe.skip
```

Phase 37 test uses the exact same `maybe` pattern. All tests inside `maybe(...)` skip automatically if not running against local Docker.

### `.cause.code` assertion pattern (lines 75–82, 158–165)

Drizzle-orm wraps the underlying postgres-js error. The SQLSTATE code is on `.cause.code`, not the top-level error:

```typescript
// For NOT NULL violation (23502):
await expect(
  db.execute(sql`INSERT INTO watches (..., catalog_id) VALUES (..., NULL)`)
).rejects.toMatchObject({ cause: { code: '23502' } })

// For FK violation (23503):
await expect(
  db.execute(sql`INSERT INTO divestments (catalog_id, ...) VALUES (${randomUUID()}, ...)`)
).rejects.toMatchObject({ cause: { code: '23503' } })
```

Phase 37 tests for: FK orphan rejection (`23503`), RLS violation (`42501`), and must use `.cause.code` not top-level `.code`.

### pgEnum existence assertion pattern

Phase 36 test does not include a pgEnum existence test. For Phase 37, use:

```typescript
it('condition_grade pgEnum exists', async () => {
  const result = await db.execute<{ typname: string }>(sql`
    SELECT typname FROM pg_type WHERE typname = 'condition_grade'
  `)
  const rows = (result as unknown as Array<{ typname: string }>)
  expect(rows.length).toBe(1)
  expect(rows[0].typname).toBe('condition_grade')
})
```

Repeat for `currency_code` and `box_papers_status`.

### Column-presence assertion pattern (lines 84–95)

```typescript
it('divestments table has all expected columns in order', async () => {
  const result = await db.execute<{ column_name: string }>(sql`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='divestments'
     ORDER BY ordinal_position
  `)
  const cols = (result as unknown as Array<{ column_name: string }>).map(r => r.column_name)
  expect(cols).toEqual([
    'id', 'catalog_id', 'user_id', 'divested_at', 'replaced_by_catalog_id',
    'sale_price', 'sale_currency', 'notes', 'created_at', 'updated_at',
  ])
})
```

### Phase 36 vs Phase 37 RLS inversion

Phase 36 tests PUBLIC-READ RLS (`has_table_privilege('anon', 'public.watch_variants', 'SELECT')` expects `true`). Phase 37 tests PER-USER RLS — anon CANNOT SELECT divestments, authenticated user CAN SELECT their own rows. The test must:

1. Confirm `has_table_privilege('anon', 'public.divestments', 'SELECT')` returns **`false`** (or the supabase-js anon client gets an empty array / 403)
2. Confirm authenticated user can INSERT their own row (requires supabase-js client with a real auth token — or mock via service-role with explicit `auth.uid()` set)

**Practical approach for Phase 37 integration test:** Use the service-role-direct `db` client (which bypasses RLS) for INSERT/SELECT, then confirm via `has_table_privilege` that anon cannot read. The RLS negative-test for divestments is structurally simpler than an auth-token integration test.

---

## 8. Chip-Group and Date Input Patterns (Q10 + Q11)

### Chip-group pattern in FilterBar (verbatim — planner reference for condition/box_papers/paid_currency)

The only chip-group in the codebase is in `FilterBar.tsx` (lines 139–157). Phase 37 can mirror this for provenance enum fields in WatchForm:

```tsx
// FilterBar.tsx lines 141–155 — chip-group pattern (style tags)
<div className="flex flex-wrap gap-2">
  {STYLE_TAGS.map((tag) => (
    <Badge
      key={tag}
      variant={filters.styleTags.includes(tag) ? 'default' : 'outline'}
      className={cn(
        'cursor-pointer capitalize transition-colors',
        filters.styleTags.includes(tag)
          ? ''
          : 'hover:bg-accent hover:text-accent-foreground'
      )}
      onClick={() => toggleStyleTag(tag)}
    >
      {tag}
    </Badge>
  ))}
</div>
```

For a single-select enum (condition, box_papers, paid_currency), adapt to:

```tsx
// Single-select chip group pattern (researcher adaptation)
<div className="flex flex-wrap gap-2">
  {(['mint', 'near_mint', 'excellent', 'good', 'fair', 'poor'] as const).map((grade) => (
    <Badge
      key={grade}
      variant={formData.condition === grade ? 'default' : 'outline'}
      className={cn(
        'cursor-pointer capitalize transition-colors',
        formData.condition !== grade && 'hover:bg-accent hover:text-accent-foreground'
      )}
      onClick={() => setFormData((prev) => ({
        ...prev,
        condition: prev.condition === grade ? undefined : grade
      }))}
    >
      {grade.replace('_', ' ')}
    </Badge>
  ))}
</div>
```

**However**, the existing WatchForm aesthetic exclusively uses `<Select>` for all finite-set fields. The researcher recommendation is to use `<Select>` for consistency and zero-new-primitive posture. The planner has discretion here.

### Date input pattern for `purchase_date`

WatchForm has NO existing date-picker. The only date-adjacent field is `acquisitionDate` (text input, lines 79 in `initialFormData`). It is NOT in the current WatchForm JSX — there is no `acquisition_date` input rendered in WatchForm. Only `productionYear` (integer input, lines 471–488) approaches date-related fields.

**No shadcn DatePicker primitive is registered** (`src/components/ui/` has no date-picker file).

**Researcher recommendation: `<input type="date">`** — native HTML date input, zero new primitives, works with all browsers, consistent with form field styling via `<Input>` component (which just wraps `<input>`). Use:

```tsx
<Input
  type="date"
  value={formData.purchaseDate ?? ''}
  onChange={(e) =>
    setFormData((prev) => ({
      ...prev,
      purchaseDate: e.target.value || undefined,
    }))
  }
/>
```

The value format for `<input type="date">` is `YYYY-MM-DD`, which is exactly what Postgres `date` type expects when sent as a string via Drizzle.

---

## 9. D-13 1:1 Soft Convention Confirmation

**From CONTEXT.md D-13:**

> "A watch can only be sold once per its lifetime in the user's collection. Phase 37 does NOT enforce a UNIQUE constraint on `(user_id, watch_id)` because there's no `watch_id` column on divestments — the link is via `catalog_id` (which can repeat across users and re-buys). 1:1 is a soft convention, not a schema constraint."

**Researcher confirmation:** This is correct and deliberate. The `divestments` table links to `watches_catalog.id` (not `watches.id`). A single `watches_catalog` row (e.g., "Rolex Submariner 16610") can have N divestment rows — one per user who sold it, or even multiple per user who sold and re-bought the same Reference. The 1:1 is a collector UX convention ("I sold this watch once"), not a schema invariant. No `UNIQUE` constraint is needed or appropriate.

**Implication for Server Action (D-11 step 1 note):** When `recordDivestment` is called, it does NOT need to check for an existing divestment row on the same `(user_id, catalog_id)`. It simply inserts a new row. The soft 1:1 expectation means the UI should call `recordDivestment` only once per sell event — the Server Action does not need to guard against duplicates.

---

## 10. Accordion Primitive — Critical Landmine

**CRITICAL:** `@/components/ui/accordion.tsx` does NOT exist in the codebase. The CONTEXT.md D-15 cites "CollectionFitCard accordion pattern already in the app" — but `CollectionFitCard.tsx` contains NO accordion import. The accordion in this codebase is in `WatchSearchRowsAccordion.tsx` and uses `@base-ui/react/accordion` directly.

```typescript
// WatchSearchRowsAccordion.tsx line 5 — the ONLY accordion in the codebase
import { Accordion } from '@base-ui/react/accordion'
```

**What this means for Phase 37:**

1. The Accordion disclosure in WatchForm must import from `@base-ui/react/accordion`, NOT from a shadcn path.
2. The base-ui Accordion API uses `Accordion.Root`, `Accordion.Item`, `Accordion.Header`, `Accordion.Trigger`, `Accordion.Panel` — not shadcn's `<Accordion>`, `<AccordionItem>`, `<AccordionTrigger>`, `<AccordionContent>`.
3. `Accordion.Panel` uses `data-[open]:` selectors for animation (not `data-[state=open]:`).
4. A single-section accordion means one `Accordion.Item` wrapping the "Collector's Record" header + the 7 field inputs.

**Pattern to mirror (from WatchSearchRowsAccordion.tsx lines 131–154):**

```tsx
import { Accordion } from '@base-ui/react/accordion'
import { ChevronDown } from 'lucide-react'

// Single-section accordion for "Collector's Record"
{mode === 'edit' && (
  <Card>
    <Accordion.Root>
      <Accordion.Item value="collectors-record">
        <Accordion.Header>
          <Accordion.Trigger className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-foreground data-[panel-open]:[&>svg]:rotate-180 [&>svg]:transition-transform">
            <span>Collector's Record</span>
            <ChevronDown className="h-4 w-4" aria-hidden />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel className="overflow-hidden px-6 pb-4 data-[open]:animate-in data-[open]:fade-in-0 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 duration-150">
          {/* 7 provenance field inputs */}
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  </Card>
)}
```

The `value` prop on `Accordion.Root` is not set (uncontrolled) or set to `[]` for collapsed default. Do NOT set `defaultValue` or the panel will open on render.

---

## 11. Landmines

### L-01: `acquisition_date` is text — do NOT touch it

`watches.acquisition_date` is `text('acquisition_date')` in schema.ts (line 104). Phase 37 adds `year_of_acquisition` (int) and `purchase_date` (date) as separate columns per D-01. WatchForm must NOT migrate `acquisitionDate` values or add any cross-link validation. `acquisition_date` does not currently appear as an input in WatchForm's JSX (it's in `formData` initial state but not rendered) — do not add it as a new input in Phase 37.

### L-02: `service_history` is SEPARATE from `notes`

`watches.notes` already exists (`text('notes')`, schema line 111). Phase 37 adds `service_history` as a separate `text` column. The WatchForm Notes card must remain unchanged. The `service_history` textarea goes inside the Accordion disclosure body — do not conflate it with the existing `notes` field.

### L-03: Do NOT add a duplicate `paid_price` column

`watches.price_paid` (`pricePaid: real('price_paid')`) exists at schema line 77. WatchForm renders it at lines 373–387. Phase 37 adds ONLY `paid_currency` (the companion column). The `pricePaid` in the Accordion should display/link to the EXISTING `pricePaid` field (read-only label or cross-reference), not add a new column.

### L-04: pgEnum CREATE TYPE must precede ALTER TABLE ADD COLUMN in same migration

The `ADD COLUMN condition condition_grade` ADD COLUMN statement requires the `condition_grade` type to already exist in the same transaction. The supabase migration statement ordering MUST be:

```sql
BEGIN;
CREATE TYPE condition_grade AS ENUM (...);
CREATE TYPE currency_code AS ENUM (...);
CREATE TYPE box_papers_status AS ENUM (...);
ALTER TABLE watches ADD COLUMN condition condition_grade, ...;  -- after CREATE TYPE
CREATE TABLE divestments (..., sale_currency currency_code, ...);  -- after CREATE TYPE
...
COMMIT;
```

Never put `ADD COLUMN` before its pgEnum `CREATE TYPE` in the same migration.

### L-05: ALTER TYPE ADD VALUE is NOT needed in Phase 37

Phase 37 creates 3 new pgEnum types from scratch (`CREATE TYPE`). The "ALTER TYPE ADD VALUE requires commit before use" gotcha applies only to ADDING values to EXISTING enums — not relevant here.

### L-06: Drizzle migration must NOT include RLS/GRANT

The Drizzle migration (`drizzle/0010_phase37_layer_d.sql`) follows the Phase 36 split: structural DDL only. RLS policies, GRANT statements, triggers, and DO $$ blocks live exclusively in `supabase/migrations/20260511010000_phase37_layer_d.sql`. [VERIFIED: Phase 36 Drizzle migration has zero RLS/GRANT]

### L-07: Accordion primitive is `@base-ui/react/accordion`, NOT `@/components/ui/accordion`

Confirmed above. `@/components/ui/accordion.tsx` does not exist. Using `from '@/components/ui/accordion'` will cause a build error.

### L-08: WatchForm is a client component — Server Action called directly

WatchForm is `'use client'` (line 1). Server Actions are called via `await editWatch(watch.id, formData)` inside an async callback. The `recordDivestment` action will be called the same way — direct async call inside a `'use server'` import, not via `<form action={...}>`.

### L-09: `watches.catalogId` remains nullable in Drizzle (Phase 38 defers the .notNull() tightening)

Phase 37 must not add `.notNull()` to `catalogId` in schema.ts. The Drizzle type is still `uuid('catalog_id').references(...)` (no `.notNull()`). The prod DB column IS NOT NULL (Phase 36 applied it), but the TypeScript side remains nullable until Phase 38 does the DAL flow rewrite.

### L-10: No `npm run db:push` or `npm run db:migrate` script exists in package.json

Neither `db:push` nor `db:migrate` are in `package.json` scripts [VERIFIED: grep of package.json]. Phase 37 deploy uses:
- `supabase db push --linked` (for supabase migration — authoritative)
- `npx drizzle-kit push` (for local dev schema sync)
- `npx drizzle-kit migrate` is explicitly SKIPPED for prod (DEBT-12)

---

## 12. Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` [VERIFIED]. This section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (inferred from `tests/integration/phase36-rls.test.ts` imports) |
| Config file | Likely `vitest.config.ts` or in `package.json` |
| Quick run command | `npx vitest run tests/integration/phase37-rls.test.ts` |
| Full suite command | `npx vitest run` |

### Validation Stages

| Stage | Signal | Assertion Method |
|-------|--------|-----------------|
| **V-01: Schema types** | Drizzle compiles, tsc passes | `npx tsc --noEmit` exits 0 after schema.ts edits |
| **V-02: Column presence** | 7 new columns on `watches` exist in DB | SQL: `SELECT column_name FROM information_schema.columns WHERE table_name='watches'` includes all 7 |
| **V-03: pgEnum presence** | 3 new pgEnums exist | SQL: `SELECT typname FROM pg_type WHERE typname IN ('condition_grade','currency_code','box_papers_status')` returns 3 rows |
| **V-04: divestments table shape** | Table has all 10 expected columns in order | SQL: `information_schema.columns WHERE table_name='divestments'` |
| **V-05: divestments FK cascade** | catalog_id ON DELETE RESTRICT, user_id ON DELETE CASCADE, replaced_by_catalog_id ON DELETE SET NULL | SQL: `pg_constraint` confdeltype checks |
| **V-06: RLS policies exist** | 4 policies on divestments | SQL: `SELECT count(*) FROM pg_policies WHERE tablename='divestments'` returns 4 |
| **V-07: anon cannot SELECT** | `has_table_privilege('anon', 'public.divestments', 'SELECT')` returns false | SQL assertion |
| **V-08: authenticated GRANT** | `has_table_privilege('authenticated', 'public.divestments', 'SELECT/INSERT/UPDATE/DELETE')` returns true | SQL assertion |
| **V-09: FK orphan rejection** | INSERT with non-existent catalog_id fails with 23503 | vitest: `.rejects.toMatchObject({ cause: { code: '23503' } })` |
| **V-10: Server Action writes divestment** | `recordDivestment` inserts row + updates watches.status | Unit/integration: mock DAL or run against local DB |
| **V-11: WatchForm Accordion renders** | Accordion is present in DOM on edit page | Static vitest: render WatchForm with mode='edit' + watch prop; accordion root exists |
| **V-12: WatchForm Accordion absent on create** | Accordion NOT present on create page | Static vitest: render WatchForm with mode='create'; accordion root absent |
| **V-13: WatchCard sold badge** | status='sold' renders visually distinct badge | Static vitest: render WatchCard with status='sold'; badge variant != 'outline' OR separate test on variant |
| **V-14: docs/deploy-db-setup.md §37.0..§37.5** | Section headings exist in file | Static file-grep: `grep "## Phase 37" docs/deploy-db-setup.md` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-18 | 7 watches columns present | integration | `npx vitest run tests/integration/phase37-rls.test.ts` | ❌ Wave 0 |
| CAT-18 | divestments table shape | integration | same file | ❌ Wave 0 |
| CAT-18 | divestments RLS anon blocked | integration | same file | ❌ Wave 0 |
| CAT-18 | divestments RLS authenticated allowed | integration | same file | ❌ Wave 0 |
| CAT-18 | 3 pgEnums exist | integration | same file | ❌ Wave 0 |
| CAT-18 | recordDivestment dual-write | integration | same file | ❌ Wave 0 |
| CAT-18 | WatchForm Accordion edit-only | static | `npx vitest run tests/static/WatchForm.accordion.test.tsx` | ❌ Wave 0 |
| CAT-18 | WatchCard sold badge | static | `npx vitest run tests/static/WatchCard.sold-badge.test.tsx` | ❌ Wave 0 |
| CAT-18 | docs §37 headings | static file-grep | built into integration test file | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (schema + types changes)
- **Per wave merge:** `npx vitest run tests/integration/phase37-rls.test.ts && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/phase37-rls.test.ts` — covers V-01 through V-10, V-14; mirror of phase36-rls.test.ts with per-user RLS inversion
- [ ] `tests/static/WatchForm.accordion.test.tsx` — covers V-11, V-12 (edit-only accordion; collapsed default)
- [ ] `tests/static/WatchCard.sold-badge.test.tsx` — covers V-13 (sold badge visual distinction)

---

## 13. Sources

### Primary (HIGH confidence — verified by reading source files)

- `src/components/watch/WatchForm.tsx` — form architecture, status Select, mode branching, editWatch call pattern
- `src/components/watch/WatchCard.tsx` — Badge import, existing badge structure, status handling
- `src/components/filters/FilterBar.tsx` — no status chips confirmed, chip-group pattern for reference
- `src/store/watchStore.ts` — `status: 'all'` default confirmed, FilterBar does not render status filter
- `src/app/actions/watches.ts` — editWatch pattern, revalidatePath set, ActionResult type, getCurrentUser pattern, getWatchById ownership check
- `src/db/schema.ts` — watches table columns (pricePaid exists, acquisitionDate is text), movementTypeEnum pattern for new pgEnums, watchVariants as divestments table template
- `src/lib/types.ts` — Watch interface confirmed (pricePaid present, no provenance fields yet), WatchStatus includes 'sold'
- `src/lib/constants.ts` — WATCH_STATUSES includes 'sold'
- `tests/integration/phase36-rls.test.ts` — localhost guard, .cause.code pattern, column-presence assertions, has_table_privilege pattern
- `drizzle/meta/_journal.json` — 10 entries (idx=0..9), last is idx=9 `0009_phase36_layer_c_variants`
- `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` — migration structure, DO $$ pattern, RLS/GRANT shape, BEGIN/COMMIT wrapper
- `drizzle/0009_phase36_layer_c_variants.sql` — idempotent CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DO $$ FK guards
- `src/components/search/WatchSearchRowsAccordion.tsx` — `@base-ui/react/accordion` is the ONLY accordion in codebase; `data-[open]` selectors
- `src/components/ui/` directory listing — confirmed no `accordion.tsx` exists
- `src/components/ui/badge.tsx` — Badge variants: default, secondary, destructive, outline, ghost, link
- `.planning/config.json` — `nyquist_validation: true` confirmed
- `package.json` — no `db:push` or `db:migrate` scripts; `drizzle-kit` at `^0.31.10`

### Secondary (HIGH confidence — planning artifacts verified)

- `.planning/phases/37-layer-d-provenance-fields-divestments-table/37-CONTEXT.md` — all D-NN decisions, divestments DDL, pgEnum values
- `.planning/REQUIREMENTS.md` §CAT-18 — full requirement text
- `docs/deploy-db-setup.md` §36.0..§36.7 — heading hierarchy template for §37.0..§37.5

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `vitest.config.ts` exists and the test runner command is `npx vitest run` | §12 Validation Architecture | Test commands in VALIDATION.md would be wrong — low risk, easy to correct |
| A2 | base-ui Accordion.Root with no `value` prop renders closed by default | §10 Accordion Primitive | The accordion might render open — should be verified against base-ui docs before Plan 04 |
| A3 | `<input type="date">` with `value="YYYY-MM-DD"` serializes correctly through the Zod schema and Drizzle's `date()` column type | §8 Date Input | Date format mismatch between HTML and Postgres — low risk if zod schema uses `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` |

---

## Open Questions (RESOLVED)

1. **Zod schema for `purchase_date` date field** — RESOLVED: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()` to match `<input type="date">` output format. Adopted by Plan 04 Task 1 (`recordDivestmentSchema`) and Plan 04 Task 3 (`updateWatchSchema` extension).

2. **`recordDivestment` transaction wrapper** — RESOLVED: Drizzle `db.transaction()` API is available in `drizzle-orm ^0.45.2` (confirmed standard since v0.28+). Plan 04 Task 1 introduces the FIRST transaction in the codebase using `await db.transaction(async (tx) => { ... })` with `tx.insert(divestments)` + `tx.update(watches)` inside the closure.

3. **Static test for WatchForm Accordion** — RESOLVED: simpler grep/static assertion approach adopted. Plan 05 Task 1 ships `tests/static/WatchForm.accordion.guards.test.ts` doing file-grep assertions confirming the `@base-ui/react/accordion` import exists and the `mode === 'edit'` guard is present, rather than a full render test that would require `useRouter` mocking.

---

## RESEARCH COMPLETE

All 14 research questions answered with verified code citations. The single highest-risk finding is the accordion primitive: `@/components/ui/accordion.tsx` does not exist — the planner must use `@base-ui/react/accordion` directly, mirroring `WatchSearchRowsAccordion.tsx`. All other patterns (schema, migration, Server Action, badge, FilterBar) have direct verified precedents in the codebase.
