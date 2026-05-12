# Phase 37: Layer D — Provenance Fields + Divestments Table - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 14
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/schema.ts` | model | CRUD | `src/db/schema.ts` (existing watches + watchVariants) | exact — additive edit |
| `supabase/migrations/20260511010000_phase37_layer_d.sql` | migration | CRUD | `supabase/migrations/20260511000000_phase36_layer_c_variants.sql` | role-match (invert RLS) |
| `drizzle/0010_phase37_layer_d.sql` | migration | CRUD | `drizzle/0009_phase36_layer_c_variants.sql` | exact |
| `drizzle/meta/_journal.json` | config | batch | `drizzle/meta/_journal.json` (idx=9 entry) | exact — append |
| `src/app/actions/divestments.ts` | service | request-response | `src/app/actions/watches.ts` (`editWatch`) | role-match |
| `src/components/watch/WatchForm.tsx` | component | request-response | `src/components/watch/WatchForm.tsx` (existing Select + mode guard) | exact — additive edit |
| `src/components/watch/WatchCard.tsx` | component | request-response | `src/components/watch/WatchCard.tsx` (existing Badge line) | exact — one-line edit |
| `src/lib/types.ts` | utility | transform | `src/lib/types.ts` (existing `Watch` + `MovementType` pattern) | exact — additive edit |
| `src/lib/constants.ts` | utility | transform | `src/lib/constants.ts` (existing `MOVEMENT_TYPES`, `WATCH_STATUSES`) | exact — additive edit |
| `tests/integration/phase37-rls.test.ts` | test | request-response | `tests/integration/phase36-rls.test.ts` | role-match (invert RLS direction) |
| `tests/static/WatchForm.accordion.guards.test.ts` | test | transform | `tests/integration/phase36-rls.test.ts` (file-grep static pattern) | partial-match |
| `tests/static/WatchCard.sold-badge.test.tsx` | test | transform | `tests/integration/phase36-rls.test.ts` (file-grep static pattern) | partial-match |
| `docs/deploy-db-setup.md` | config | batch | `docs/deploy-db-setup.md` §36.0–§36.7 | role-match (fewer subsections) |

---

## Pattern Assignments

---

### `src/db/schema.ts` — pgEnums + watches columns + divestments table

**Analog:** `src/db/schema.ts` (existing `movementTypeEnum`, `watches` table, `watchVariants` table)

**pgEnum pattern** (lines 37–39 — `movementTypeEnum`, template for 3 new enums):
```typescript
// ----- Phase 35 D-01: movement type pgEnum (CAT-16) -----
export const movementTypeEnum = pgEnum('movement_type_enum', [
  'auto', 'manual', 'quartz', 'spring_drive',
] as const)
```
Copy this pattern verbatim for:
```typescript
export const conditionGradeEnum = pgEnum('condition_grade', [
  'mint', 'near_mint', 'excellent', 'good', 'fair', 'poor',
] as const)
export const currencyCodeEnum = pgEnum('currency_code', [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'HKD', 'SGD', 'CNY',
] as const)
export const boxPapersStatusEnum = pgEnum('box_papers_status', [
  'none', 'box_only', 'papers_only', 'full_set',
] as const)
```
Place these immediately after the existing Phase 35/36 enum block (before the `users` table at line 55).

**watches table addition pattern** (lines 82–83 show existing enum column usage):
```typescript
// Phase 35 D-03: movement_type enum + movement_caliber (replaces nullable text 'movement')
movementType: movementTypeEnum('movement_type'),
movementCaliber: text('movement_caliber'),
```
The 7 new columns follow the same optional-column pattern. Insert inside the existing `pgTable('watches', { ... })` block, after `notes` / `notesUpdatedAt` / `imageUrl` group and before `catalogId` (line 125):
```typescript
// Phase 37 D-01..D-08: collector provenance fields (all nullable)
serial: text('serial'),
yearOfAcquisition: integer('year_of_acquisition'),
condition: conditionGradeEnum('condition'),
boxPapers: boxPapersStatusEnum('box_papers'),
serviceHistory: text('service_history'),
paidCurrency: currencyCodeEnum('paid_currency'),
purchaseDate: date('purchase_date'),
```
NOTE: `date` must be imported from `'drizzle-orm/pg-core'` (add to the import list at line 1).

**divestments table pattern** (from `watchVariants`, lines 466–488):
```typescript
export const watchVariants = pgTable(
  'watch_variants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    catalogId: uuid('catalog_id')
      .notNull()
      .references(() => watchesCatalog.id, { onDelete: 'restrict' }),
    ...
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('watch_variants_catalog_id_idx').on(table.catalogId),
    unique('watch_variants_catalog_slug_unique').on(table.catalogId, table.slug),
  ],
)
```
Apply this structure to `divestments`. Key divergences from `watchVariants`:
- `user_id NOT NULL FK ON DELETE CASCADE` (mirrors `watches.userId`)
- `catalog_id NOT NULL FK ON DELETE RESTRICT` (entity FK per Phase 34 D-02)
- `replacedByCatalogId` nullable FK ON DELETE SET NULL
- `divestments` has NO UNIQUE constraint (D-13: 1:1 is soft convention only)
- Three indexes instead of two: `user_id`, `catalog_id`, and composite `(user_id, divested_at DESC)`

**Imports to add** (line 1 import block):
```typescript
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  numeric,
  date,        // ← ADD for purchaseDate
  index,
  unique,
} from 'drizzle-orm/pg-core'
```

---

### `supabase/migrations/20260511010000_phase37_layer_d.sql` — authoritative DDL

**Analog:** `supabase/migrations/20260511000000_phase36_layer_c_variants.sql`

**Migration wrapper pattern** (lines 15, 150):
```sql
BEGIN;
-- ... all DDL steps ...
COMMIT;
```

**Phase 36 structure to mirror:**
```
STEP 0: DO $$ pre-flight (Phase 36 has orphan check — Phase 37 is additive, NO pre-flight needed)
STEP 1: CREATE TYPE (3 pgEnums — must precede ALTER TABLE ADD COLUMN per L-04)
STEP 2: ALTER TABLE watches ADD COLUMN (7 columns)
STEP 3: CREATE TABLE divestments + 3 indexes
STEP 4: updated_at trigger (copy Phase 36 STEP 2 pattern for divestments)
STEP 5: RLS + GRANT (per-user pattern — invert from Phase 36's public-read)
STEP 6: Final DO $$ assertion block
```

**CREATE TABLE pattern** (Phase 36 lines 37–49):
```sql
CREATE TABLE watch_variants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id        uuid NOT NULL REFERENCES watches_catalog(id) ON DELETE RESTRICT,
  ...
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT watch_variants_catalog_slug_unique UNIQUE (catalog_id, slug)
);
CREATE INDEX watch_variants_catalog_id_idx ON watch_variants(catalog_id);
```

**updated_at trigger pattern** (Phase 36 lines 56–60):
```sql
CREATE OR REPLACE FUNCTION watch_variants_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS watch_variants_set_updated_at_trg ON watch_variants;
CREATE TRIGGER watch_variants_set_updated_at_trg BEFORE UPDATE ON watch_variants
  FOR EACH ROW EXECUTE FUNCTION watch_variants_set_updated_at();
```
Rename function/trigger to `divestments_set_updated_at` / `divestments_set_updated_at_trg`.

**RLS pattern — INVERSION required** (Phase 36 lines 68–71 show public-read; Phase 37 needs per-user):
```sql
-- Phase 36 (public-read — DO NOT copy for divestments):
ALTER TABLE watch_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY watch_variants_select_all ON watch_variants FOR SELECT USING (true);
GRANT SELECT ON watch_variants TO anon, authenticated;

-- Phase 37 (per-user — copy this for divestments):
ALTER TABLE divestments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "divestments_owner_select" ON divestments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "divestments_owner_insert" ON divestments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "divestments_owner_update" ON divestments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "divestments_owner_delete" ON divestments FOR DELETE USING (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON divestments TO authenticated;
```
Source for per-user pattern: `supabase/migrations/20260427000000_phase17_catalog_schema.sql` (referenced in CONTEXT.md canonical refs).

**Final assertion block pattern** (Phase 36 lines 93–148):
```sql
DO $$
DECLARE
  divestments_table_exists   boolean;
  divestments_policy_count   int;
  authenticated_can_select   boolean;
  -- ... other booleans ...
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.tables
                  WHERE table_schema='public' AND table_name='divestments')
    INTO divestments_table_exists;
  -- ... other assertions ...
  IF NOT divestments_table_exists THEN RAISE EXCEPTION 'Phase 37 failed -- divestments table missing'; END IF;
  -- ...
END $$;
```
Phase 37 assertion block is smaller (no UNIQUE constraint, no CAT-14 flip) — assert: table exists, 4 policies present, authenticated can select, 3 pgEnums exist, 7 watches columns present, FK cascade types correct.

**Key divergence from Phase 36:** NO DO $$ pre-flight (Phase 37 is purely additive — no orphan check needed). Phase 37 migration starts with `BEGIN;` then immediately `CREATE TYPE` statements (per L-04 ordering).

---

### `drizzle/0010_phase37_layer_d.sql` — idempotent structural twin

**Analog:** `drizzle/0009_phase36_layer_c_variants.sql`

**Header comment pattern** (lines 1–9):
```sql
-- Phase 36 — Layer C: watch_variants table + watches.variant_id (Drizzle-side).
-- Idempotent: this migration also runs AFTER supabase db push --linked has applied
--   supabase/migrations/20260511000000_phase36_layer_c_variants.sql (authoritative DDL).
-- Drizzle migration carries column shapes only. No RLS, no GRANT, no DO $$ pre-flight —
-- those live exclusively in the Supabase migration.
-- Per memory rule project_local_db_reset.md, local re-sync runs:
--   supabase db reset → drizzle-kit push → docker exec psql < supabase/migrations/...sql
-- so every CREATE / ALTER must be IF NOT EXISTS.
```

**CREATE TABLE IF NOT EXISTS pattern** (lines 11–23):
```sql
CREATE TABLE IF NOT EXISTS "watch_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "catalog_id" uuid NOT NULL,
  ...
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

**ADD COLUMN IF NOT EXISTS pattern** (line 42):
```sql
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "variant_id" uuid;
```
Apply this for all 7 watches columns:
```sql
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "serial" text;
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "year_of_acquisition" integer;
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "condition" "condition_grade";
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "box_papers" "box_papers_status";
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "service_history" text;
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "paid_currency" "currency_code";
ALTER TABLE "watches" ADD COLUMN IF NOT EXISTS "purchase_date" date;
```

**DO $$ FK guard pattern** (lines 25–36):
```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'watch_variants_catalog_id_fk'
      AND conrelid = 'watch_variants'::regclass
  ) THEN
    ALTER TABLE "watch_variants"
      ADD CONSTRAINT "watch_variants_catalog_id_fk"
      FOREIGN KEY ("catalog_id") REFERENCES "public"."watches_catalog"("id")
      ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
```
Apply for `divestments.catalog_id` (RESTRICT), `divestments.user_id` (CASCADE), `divestments.replaced_by_catalog_id` (SET NULL).

**CREATE INDEX IF NOT EXISTS pattern** (line 38):
```sql
CREATE INDEX IF NOT EXISTS "watch_variants_catalog_id_idx" ON "watch_variants" USING btree ("catalog_id");
```

**Key divergence from Phase 36:** Phase 37 Drizzle migration has NO `ALTER COLUMN SET NOT NULL` (Phase 37 is additive only — no NOT NULL flips). Also NO `UNIQUE` constraint block (divestments has no unique constraint per D-13).

**Note on pgEnum in Drizzle migration:** Drizzle-generated SQL uses `"condition_grade"` (quoted) as the column type when referencing a pgEnum. The `CREATE TYPE` statements are NOT included in the Drizzle migration (they live in the Supabase migration exclusively per L-06). If running `drizzle-kit push` against a fresh local DB that already has the Supabase migration applied, the types exist; if not, wrap in a `DO $$ IF NOT EXISTS` guard or accept that local re-sync always follows the pattern: supabase db reset → Supabase migration applied first via docker exec psql → then drizzle-kit push.

---

### `drizzle/meta/_journal.json` — idx=10 append

**Analog:** `drizzle/meta/_journal.json` (existing idx=9 entry, lines 68–74)

**Existing last entry** (lines 68–74):
```json
{
  "idx": 9,
  "version": "7",
  "when": 1778534674854,
  "tag": "0009_phase36_layer_c_variants",
  "breakpoints": true
}
```

**New entry to append** (inside `"entries": [...]` array, after idx=9):
```json
{
  "idx": 10,
  "version": "7",
  "when": 1778534674855,
  "tag": "0010_phase37_layer_d",
  "breakpoints": true
}
```
`when` value is cosmetic (must be >= idx=9's value; use `Date.now()` at write time). `tag` must match the SQL filename prefix exactly. The journal outer structure (`version`, `dialect`, `entries`) is unchanged.

---

### `src/app/actions/divestments.ts` — recordDivestment Server Action

**Analog:** `src/app/actions/watches.ts` — `editWatch` function (lines 297–361)

**File header pattern** (watches.ts lines 1–13):
```typescript
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import * as watchDAL from '@/data/watches'
import { getCurrentUser } from '@/lib/auth'
import type { ActionResult } from '@/lib/actionTypes'
import type { Watch } from '@/lib/types'
```
For `divestments.ts`, the import set will be:
```typescript
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import * as watchDAL from '@/data/watches'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/db'
import { divestments } from '@/db/schema'
import type { ActionResult } from '@/lib/actionTypes'
import type { CurrencyCode } from '@/lib/types'
```

**Auth + zod-validate pattern** (watches.ts lines 297–308):
```typescript
export async function editWatch(watchId: string, data: unknown): Promise<ActionResult<Watch>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const parsed = updateWatchSchema.safeParse(data)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const summary = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${(errors ?? []).join(', ')}`)
      .join('; ')
    return { success: false, error: `Invalid watch data: ${summary}` }
  }
  ...
}
```

**DAL ownership-check pattern** (watches.ts line 332):
```typescript
const currentRow = await watchDAL.getWatchById(user.id, watchId)
```
Returns `Watch | null` — null means not found or not owned (RLS enforced). Return `{ success: false, error: 'Not found' }` on null.

**revalidatePath + revalidateTag pattern** (watches.ts lines 342–351):
```typescript
revalidatePath('/')
revalidatePath('/u/[username]', 'layout')
revalidateTag('explore', 'max')
```
Apply the same three calls after a successful divestment insert.

**Error catch pattern** (watches.ts lines 354–360):
```typescript
  } catch (err) {
    console.error('[editWatch] unexpected error:', err)
    if (err instanceof Error && err.message.includes('not found or access denied')) {
      return { success: false, error: 'Not found' }
    }
    return { success: false, error: 'Failed to update watch' }
  }
```
Rename to `[recordDivestment]` and `'Failed to record divestment'`.

**db.transaction() pattern** — Not currently in watches.ts (RESEARCH §4 open question). Use Drizzle's standard transaction API:
```typescript
await db.transaction(async (tx) => {
  await tx.insert(divestments).values({ ... })
  await tx.update(watches).set({ status: 'sold' }).where(...)
})
```
This wraps both the INSERT into `divestments` and the UPDATE `watches.status='sold'` atomically per D-11.

**Return type:** `ActionResult<{ divestmentId: string }>` (follows existing `ActionResult<Watch>` shape from `editWatch`).

**Key divergences from `editWatch`:**
- Takes `watchId: string` + optional `data` object (not unknown — shape is known)
- Verifies `watch.catalogId IS NOT NULL` before inserting (post-CAT-14 invariant, D-11 step 2)
- Wraps two writes in `db.transaction()` (editWatch does not use transactions)
- Returns `{ divestmentId: string }` not `Watch`
- Input zod schema is simpler — 5 optional fields vs 25+ watch fields

---

### `src/components/watch/WatchForm.tsx` — Accordion + 7 provenance inputs

**Analog:** `src/components/watch/WatchForm.tsx` (existing Select pattern lines 417–435; mode guard line 614–625; Textarea pattern lines 633–643)

**mode guard pattern** (lines 614–625 — create-only guard, mirror for edit-only):
```tsx
{/* Phase 19.1 D-19: Reference Photo (create mode only) */}
{mode === 'create' && (
  <CatalogPhotoUploader
    onPhotoReady={(blob) => { ... }}
    ...
  />
)}
```
Mirror as edit-only guard for the Accordion Card:
```tsx
{mode === 'edit' && (
  <Card>
    <Accordion.Root>
      ...
    </Accordion.Root>
  </Card>
)}
```
The Accordion goes after the Notes Card (lines 627–655) and before the Actions row.

**Select field pattern** (lines 417–435 — movement Select):
```tsx
<div className="space-y-2">
  <Label htmlFor="movement">Movement *</Label>
  <Select
    value={formData.movement}
    onValueChange={(value) => {
      if (value) {
        setFormData((prev) => ({ ...prev, movement: value as MovementType }))
      }
    }}
  >
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {MOVEMENT_TYPES.map((type) => (
        <SelectItem key={type} value={type}>
          {MOVEMENT_LABELS[type]}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```
Apply for `condition`, `box_papers`, `paid_currency` selects. No `*` in label (all nullable). No `if (value)` guard needed — allow clearing to `undefined`.

**Input number pattern** (lines 438–452 — caseSizeMm):
```tsx
<div className="space-y-2">
  <Label htmlFor="caseSizeMm">Case Size (mm)</Label>
  <Input
    id="caseSizeMm"
    type="number"
    value={formData.caseSizeMm ?? ''}
    onChange={(e) =>
      setFormData((prev) => ({
        ...prev,
        caseSizeMm: e.target.value ? Number(e.target.value) : undefined,
      }))
    }
    placeholder="e.g., 42"
  />
</div>
```
Apply for `yearOfAcquisition` (type="number", min="1900", max="2100").

**Textarea pattern** (lines 633–643 — notes):
```tsx
<Textarea
  value={formData.notes}
  onChange={(e) =>
    setFormData((prev) => ({ ...prev, notes: e.target.value }))
  }
  placeholder="Any additional notes about this watch..."
  rows={4}
/>
```
Apply for `serviceHistory` (rows={3}, different placeholder).

**Accordion import + core pattern** (from `WatchSearchRowsAccordion.tsx` lines 5, 7):
```typescript
import { Accordion } from '@base-ui/react/accordion'
import { ChevronDown } from 'lucide-react'
```
```tsx
<Accordion.Root>
  <Accordion.Item value="collectors-record">
    <Accordion.Header>
      <Accordion.Trigger
        className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-foreground data-[panel-open]:[&>svg]:rotate-180 [&>svg]:transition-transform"
      >
        <span>Collector's Record</span>
        <ChevronDown className="h-4 w-4" aria-hidden />
      </Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Panel
      className="overflow-hidden px-6 pb-4 data-[open]:animate-in data-[open]:fade-in-0 data-[ending-style]:animate-out data-[ending-style]:fade-out-0 duration-150"
    >
      {/* 7 provenance field inputs */}
    </Accordion.Panel>
  </Accordion.Item>
</Accordion.Root>
```
CRITICAL: `Accordion.Root` has NO `defaultValue` or `value` prop → renders collapsed. Do NOT import from `@/components/ui/accordion` — that file does not exist (L-07).

**date input pattern** (researcher-derived, no existing analog — use `<Input type="date">`):
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

**FormData type extension:** The existing `FormData` type at the top of WatchForm.tsx mirrors the `Watch` interface. Extend it to add the 7 new optional fields:
```typescript
type FormData = {
  // ... existing fields ...
  serial?: string
  yearOfAcquisition?: number
  condition?: ConditionGrade
  boxPapers?: BoxPapersStatus
  serviceHistory?: string
  paidCurrency?: CurrencyCode
  purchaseDate?: string   // YYYY-MM-DD string
}
```
Also extend `initialFormData` with `undefined` for all 7 fields, and seed them from `watch` prop in edit-mode initialization (same pattern as all other optional fields in the existing `useState` initializer).

**Key divergences from existing WatchForm patterns:**
- Imports `Accordion` from `@base-ui/react/accordion` (new import — not a shadcn Select)
- New 7-field section is conditional on `mode === 'edit'` (create page gets nothing)
- `purchaseDate` is `type="date"` not `type="text"` (only date-type input in the form)
- No validation added for any of the 7 fields (existing validator only checks brand + model)

---

### `src/components/watch/WatchCard.tsx` — sold badge treatment

**Analog:** `src/components/watch/WatchCard.tsx` (lines 51–73)

**Existing badge line** (line 52):
```tsx
<Badge variant="outline">{watch.status}</Badge>
```

**Phase 37 replacement** (one-line change):
```tsx
<Badge variant={watch.status === 'sold' ? 'secondary' : 'outline'}>
  {watch.status}
</Badge>
```

No other changes to WatchCard. Badge position (`absolute top-2 right-2 flex flex-col items-end gap-1`) is unchanged. The `secondary` variant renders with `--muted` background and `--secondary-foreground` text (CSS chain verified: `badge.tsx` cva variant → `bg-secondary text-secondary-foreground` → `globals.css` `--secondary`).

---

### `src/lib/types.ts` — Watch extension + new interfaces/types

**Analog:** `src/lib/types.ts` (existing type export pattern, lines 1–13; Watch interface lines 23–72)

**Existing type export pattern** (lines 1–13):
```typescript
export type WatchStatus = 'owned' | 'wishlist' | 'sold' | 'grail'
export type MovementType = 'auto' | 'manual' | 'quartz' | 'spring_drive'
```

**Phase 37 new type exports** (add after existing type block, before `Watch` interface):
```typescript
export type ConditionGrade = 'mint' | 'near_mint' | 'excellent' | 'good' | 'fair' | 'poor'
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'AUD' | 'CAD' | 'HKD' | 'SGD' | 'CNY'
export type BoxPapersStatus = 'none' | 'box_only' | 'papers_only' | 'full_set'
```

**Watch interface extension** (add 7 optional fields after `catalogId` at line 65, before the sortOrder field):
```typescript
// Phase 37 D-01..D-08: collector provenance fields (all nullable)
serial?: string
yearOfAcquisition?: number
condition?: ConditionGrade
boxPapers?: BoxPapersStatus
serviceHistory?: string
paidCurrency?: CurrencyCode
purchaseDate?: string  // ISO date string 'YYYY-MM-DD'
```

**New Divestment interface** (add after Watch interface):
```typescript
export interface Divestment {
  id: string
  catalogId: string
  userId: string
  divestedAt: string       // ISO timestamp string
  replacedByCatalogId?: string | null
  salePrice?: number
  saleCurrency?: CurrencyCode
  notes?: string
  createdAt: string
  updatedAt: string
}
```

---

### `src/lib/constants.ts` — 3 new as-const arrays

**Analog:** `src/lib/constants.ts` (existing `MOVEMENT_TYPES`, `WATCH_STATUSES` patterns, lines 76 and 131–136)

**Existing pattern** (lines 76, 131–136):
```typescript
export const MOVEMENT_TYPES = ['auto', 'manual', 'quartz', 'spring_drive'] as const
...
export const WATCH_STATUSES = [
  'owned',
  'wishlist',
  'sold',
  'grail',
] as const
```

**Phase 37 additions** (append after existing constants):
```typescript
// Phase 37 D-02: condition grade values (pgEnum mirrors: condition_grade)
export const CONDITION_GRADES = [
  'mint', 'near_mint', 'excellent', 'good', 'fair', 'poor',
] as const

// Phase 37 D-03: currency code values (pgEnum mirrors: currency_code)
export const CURRENCY_CODES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'HKD', 'SGD', 'CNY',
] as const

// Phase 37 D-05: box/papers status values (pgEnum mirrors: box_papers_status)
export const BOX_PAPERS_STATUSES = [
  'none', 'box_only', 'papers_only', 'full_set',
] as const
```
Also add display label maps if WatchForm uses them (mirrors `MOVEMENT_LABELS` pattern at line 80):
```typescript
export const CONDITION_GRADE_LABELS: Record<ConditionGrade, string> = {
  mint: 'Mint', near_mint: 'Near Mint', excellent: 'Excellent',
  good: 'Good', fair: 'Fair', poor: 'Poor',
}
export const BOX_PAPERS_LABELS: Record<BoxPapersStatus, string> = {
  none: 'None', box_only: 'Box only', papers_only: 'Papers only', full_set: 'Full set',
}
```
Import `ConditionGrade`, `BoxPapersStatus`, `CurrencyCode` from `./types` (mirrors existing `import type { MovementType } from './types'` at line 1).

---

### `tests/integration/phase37-rls.test.ts`

**Analog:** `tests/integration/phase36-rls.test.ts` (complete file — read in full above)

**localhost guard pattern** (lines 23–28):
```typescript
const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))

const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && dbUrlIsLocal
  ? describe : describe.skip
```
Copy verbatim.

**has_table_privilege pattern** (lines 35–41 — but INVERTED for Phase 37):
```typescript
// Phase 36 (anon CAN select — public-read):
it('has_table_privilege: anon can SELECT watch_variants', async () => {
  const result = await db.execute<{ can: boolean }>(sql`
    SELECT has_table_privilege('anon', 'public.watch_variants', 'SELECT') AS can
  `)
  const row = (result as unknown as Array<{ can: boolean }>)[0]
  expect(row.can).toBe(true)    // ← Phase 37 inverts to toBe(false)
})
```
For Phase 37:
```typescript
it('has_table_privilege: anon CANNOT SELECT divestments (per-user RLS)', async () => {
  const result = await db.execute<{ can: boolean }>(sql`
    SELECT has_table_privilege('anon', 'public.divestments', 'SELECT') AS can
  `)
  const row = (result as unknown as Array<{ can: boolean }>)[0]
  expect(row.can).toBe(false)   // ← PER-USER RLS, not public-read
})
```

**column-presence assertion pattern** (lines 85–96):
```typescript
it('watch_variants table has all 10 expected columns in order', async () => {
  const result = await db.execute<{ column_name: string }>(sql`
    SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='watch_variants'
     ORDER BY ordinal_position
  `)
  const cols = (result as unknown as Array<{ column_name: string }>).map(r => r.column_name)
  expect(cols).toEqual([
    'id', 'catalog_id', 'name', 'slug', 'dial_color', 'bezel',
    'bracelet_variant', 'image_url', 'created_at', 'updated_at',
  ])
})
```
For Phase 37 divestments:
```typescript
expect(cols).toEqual([
  'id', 'catalog_id', 'user_id', 'divested_at', 'replaced_by_catalog_id',
  'sale_price', 'sale_currency', 'notes', 'created_at', 'updated_at',
])
```

**FK confdeltype pattern** (lines 122–131):
```typescript
it('watches.variant_id FK has ON DELETE SET NULL', async () => {
  const result = await db.execute<{ confdeltype: string }>(sql`
    SELECT c.confdeltype FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
     WHERE c.contype='f' AND c.conrelid='watches'::regclass AND a.attname='variant_id'
  `)
  const row = (result as unknown as Array<{ confdeltype: string }>)[0]
  expect(row?.confdeltype).toBe('n')  // 'n' = SET NULL
})
```
Phase 37 needs three FK checks: `catalog_id` confdeltype='r' (RESTRICT), `user_id` confdeltype='c' (CASCADE), `replaced_by_catalog_id` confdeltype='n' (SET NULL).

**FK orphan rejection pattern** (lines 158–165):
```typescript
it('INSERT into watch_variants with non-existent catalog_id fails with FK violation', async () => {
  await expect(
    db.execute(sql`
      INSERT INTO watch_variants (catalog_id, name, slug)
      VALUES (${randomUUID()}, 'OrphanVariant', 'orphan-variant')
    `)
  ).rejects.toMatchObject({ cause: { code: '23503' } })
})
```

**pgEnum existence pattern** (new for Phase 37 — no Phase 36 equivalent):
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

**Static file-grep pattern** (Phase 36 lines 169–188 — for §37 docs heading check):
```typescript
it('Phase 36 supabase migration has DO $$ as its FIRST statement after BEGIN', async () => {
  const fs = await import('node:fs/promises')
  const path = 'supabase/migrations/20260511000000_phase36_layer_c_variants.sql'
  const content = await fs.readFile(path, 'utf8')
  ...
})
```
Phase 37 adaptation: check that `docs/deploy-db-setup.md` contains `## Phase 37` heading:
```typescript
it('docs/deploy-db-setup.md contains Phase 37 section heading (V-14)', async () => {
  const fs = await import('node:fs/promises')
  const content = await fs.readFile('docs/deploy-db-setup.md', 'utf8')
  expect(content).toContain('## Phase 37')
})
```

**Key divergences from Phase 36 test:**
- RLS assertions are INVERTED: anon cannot SELECT (was: anon CAN)
- 4 RLS policies expected (was: 1 — public-read only)
- authenticated GRANT covers SELECT + INSERT + UPDATE + DELETE (was: SELECT only)
- 3 additional pgEnum existence tests (Phase 36 had none)
- watches column presence test for 7 new columns
- No `DO $$` first-statement test (Phase 37 migration has no pre-flight)

---

### `tests/static/WatchForm.accordion.guards.test.ts`

**Analog:** Phase 36 RLS test static file-grep pattern (lines 169–188)

**File-grep static assertion pattern**:
```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('WatchForm accordion guards (static)', () => {
  const source = readFileSync('src/components/watch/WatchForm.tsx', 'utf8')

  it('imports Accordion from @base-ui/react/accordion (not shadcn)', () => {
    expect(source).toContain("from '@base-ui/react/accordion'")
    expect(source).not.toContain("from '@/components/ui/accordion'")
  })

  it('Accordion is gated on mode === "edit" (edit-only guard)', () => {
    expect(source).toContain("mode === 'edit'")
  })

  it('Accordion.Root has no defaultValue or value prop pointing to collectors-record', () => {
    expect(source).not.toMatch(/defaultValue.*collectors-record/)
  })
})
```

---

### `tests/static/WatchCard.sold-badge.test.tsx`

**Analog:** Phase 36 RLS test static file-grep pattern (same approach)

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('WatchCard sold badge (static)', () => {
  const source = readFileSync('src/components/watch/WatchCard.tsx', 'utf8')

  it('sold status uses variant="secondary" (not outline)', () => {
    expect(source).toContain("watch.status === 'sold' ? 'secondary' : 'outline'")
  })
})
```

---

### `docs/deploy-db-setup.md` — §37 append

**Analog:** `docs/deploy-db-setup.md` lines 829–1010 (§36.0–§36.7)

**Phase 36 heading hierarchy** (lines 829–1010):
```
## Phase 36 — Layer C: Variant Split + CAT-14 NOT NULL Deploy Steps
### Preconditions
### 36.0 — Pre-flight pg_depend check
### 36.1 — Safety re-link backfill
### 36.2 — Zero-NULL verification
### 36.3 — Apply migrations to prod
### 36.4 — Smoke-test SELECTs (post-deploy)
### 36.5 — CAT-14 hard-fail recovery flow
### 36.6 — Local DB re-sync after Phase 36
### 36.7 — Backout plan
```

**Phase 37 heading hierarchy** (FEWER subsections — additive only, no pre-flight, no recovery flow):
```
## Phase 37 — Layer D: Provenance Fields + Divestments Table Deploy Steps
### Preconditions
### 37.0 — Apply migrations to prod
### 37.1 — Smoke-test SELECTs + RLS (post-deploy)
### 37.2 — Local DB re-sync after Phase 37
### 37.3 — Backout plan (if Phase 37 must be reverted)
```
Phase 37 drops: §36.0 (pg_depend pre-check — not needed for additive), §36.1 (backfill — not needed), §36.2 (zero-NULL check — not applicable), §36.5 (CAT-14 hard-fail recovery — not applicable).

---

## Shared Patterns

### Authentication (getCurrentUser)
**Source:** `src/app/actions/watches.ts` lines 297–299
**Apply to:** `src/app/actions/divestments.ts`
```typescript
let user
try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
```

### ActionResult return type
**Source:** `src/lib/actionTypes.ts` (imported in watches.ts line 12)
**Apply to:** `src/app/actions/divestments.ts`
```typescript
import type { ActionResult } from '@/lib/actionTypes'
// Return type: ActionResult<{ divestmentId: string }>
// Shape: { success: true; data: T } | { success: false; error: string }
```

### Error handling (console.error + typed check)
**Source:** `src/app/actions/watches.ts` lines 354–360
**Apply to:** `src/app/actions/divestments.ts`
```typescript
} catch (err) {
  console.error('[recordDivestment] unexpected error:', err)
  if (err instanceof Error && err.message.includes('not found or access denied')) {
    return { success: false, error: 'Not found' }
  }
  return { success: false, error: 'Failed to record divestment' }
}
```

### revalidatePath + revalidateTag fan-out
**Source:** `src/app/actions/watches.ts` lines 342–351
**Apply to:** `src/app/actions/divestments.ts`
```typescript
revalidatePath('/')
revalidatePath('/u/[username]', 'layout')
revalidateTag('explore', 'max')
```

### Zod schema (partial update shape)
**Source:** `src/app/actions/watches.ts` lines 17–58
**Apply to:** `src/app/actions/divestments.ts` (simpler schema — 5 optional fields)
```typescript
const recordDivestmentSchema = z.object({
  salePrice: z.number().optional(),
  saleCurrency: z.enum(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'HKD', 'SGD', 'CNY']).optional(),
  replacedByCatalogId: z.string().uuid().optional(),
  notes: z.string().optional(),
})
```

### DAL ownership check
**Source:** `src/app/actions/watches.ts` line 332
**Apply to:** `src/app/actions/divestments.ts` — check `watch.catalogId IS NOT NULL` after ownership verification
```typescript
const currentRow = await watchDAL.getWatchById(user.id, watchId)
if (!currentRow) return { success: false, error: 'Not found' }
if (!currentRow.catalogId) return { success: false, error: 'Watch has no catalog link — cannot record divestment' }
```

### Localhost guard for integration tests
**Source:** `tests/integration/phase36-rls.test.ts` lines 23–28
**Apply to:** `tests/integration/phase37-rls.test.ts`
```typescript
const dbUrlIsLocal =
  typeof process.env.DATABASE_URL === 'string' &&
  (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'))
const maybe = process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && dbUrlIsLocal
  ? describe : describe.skip
```

### .cause.code error assertion pattern
**Source:** `tests/integration/phase36-rls.test.ts` lines 75–82, 158–165
**Apply to:** `tests/integration/phase37-rls.test.ts` FK orphan + NOT NULL tests
```typescript
).rejects.toMatchObject({ cause: { code: '23503' } })  // FK violation
).rejects.toMatchObject({ cause: { code: '23502' } })  // NOT NULL violation
```

---

## No Analog Found

All Phase 37 files have analogs. No files require falling back to RESEARCH.md patterns exclusively.

| Note | Detail |
|------|--------|
| `db.transaction()` | The Drizzle transaction API is standard (`drizzle-orm ^0.45.2`+) but no existing usage in the codebase. RESEARCH §4 open question. Planner should verify `db.transaction(async tx => {...})` API shape from drizzle-orm docs before implementing. |
| `<input type="date">` | No existing date-picker in the codebase. RESEARCH §8 confirms using native `<Input type="date">` with `<Input>` wrapper is the correct approach. |

---

## Landmine Registry (executor must not repeat these)

| ID | Risk | Pattern Contract |
|----|------|-----------------|
| L-07 | `@/components/ui/accordion.tsx` does not exist | Import from `'@base-ui/react/accordion'` only |
| L-01 | `acquisition_date` is text and NOT rendered in current WatchForm | Do not add it as a new input in Phase 37 |
| L-02 | `service_history` is separate from `notes` | Goes inside Accordion; existing Notes Card unchanged |
| L-03 | `price_paid` already exists as `pricePaid` | Add only `paid_currency`; do NOT add a second price input |
| L-04 | pgEnum `CREATE TYPE` must precede `ALTER TABLE ADD COLUMN` in migration | Order: CREATE TYPE → ALTER TABLE → CREATE TABLE |
| L-06 | Drizzle migration must NOT include RLS/GRANT | Structural DDL only in `drizzle/0010_*.sql` |
| L-09 | `watches.catalogId` remains nullable in Drizzle (Phase 38 defers .notNull()) | Do NOT add `.notNull()` to catalogId in schema.ts |

---

## Metadata

**Analog search scope:** `src/db/`, `src/app/actions/`, `src/components/watch/`, `src/lib/`, `tests/integration/`, `tests/static/`, `supabase/migrations/`, `drizzle/`, `docs/`
**Files scanned:** 15 source files read in full
**Pattern extraction date:** 2026-05-11
