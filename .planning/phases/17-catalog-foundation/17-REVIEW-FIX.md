---
phase: 17-catalog-foundation
iteration: 1
fix_scope: critical_warning
fixed_at: 2026-04-27T20:50:00Z
review_path: .planning/phases/17-catalog-foundation/17-REVIEW.md
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-04-27T20:50:00Z
**Source review:** `.planning/phases/17-catalog-foundation/17-REVIEW.md`
**Iteration:** 1
**Fix scope:** critical + warning

**Summary:**
- Findings in scope: 4 (0 critical, 4 warning)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Test fixture has excess `Watch` properties — strict-mode typecheck fails

**Files modified:** `tests/actions/addwatch-catalog-resilience.test.ts`
**Commit:** `6f81454`
**Applied fix:** Removed the four non-domain fields (`userId`, `catalogId`, `createdAt`, `updatedAt`) from the `mockWatch: Watch` literal, and changed `reference: null` to `reference: undefined` to match the optional-string typing on the domain `Watch` interface. The local `viewerUserId` constant is retained — it is still used for the `getCurrentUser` mock. Verified with `npx tsc --noEmit -p tsconfig.json` — no errors in this test file (pre-existing TS errors in unrelated files were left untouched).

### WR-02: `scripts/backfill-catalog.ts` imports `dotenv` but it is not declared in `package.json`

**Files modified:** `scripts/backfill-catalog.ts`, `package.json`
**Commit:** `85536cb`
**Applied fix:** Took option 1 from the review (cleanest — matches `scripts/refresh-counts.ts`). Removed the `import { config } from 'dotenv'` and `config({ path: '.env.local' })` lines from the script, replaced with a header comment documenting the env-loading approach. Updated the `db:backfill-catalog` npm script to `tsx --env-file=.env.local scripts/backfill-catalog.ts`. JSON validity verified.

### WR-03: Missing DB-level CHECK constraints on image URL protocol

**Files modified:** `supabase/migrations/20260427000000_phase17_catalog_schema.sql`
**Commit:** `b2b0382`
**Applied fix:** Added two CHECK constraints in Section 2 (after the existing source/quality CHECK pattern):
- `watches_catalog_image_url_protocol_check` — enforces `image_url IS NULL OR image_url ~* '^https?://'`
- `watches_catalog_image_source_url_protocol_check` — same predicate for `image_source_url`

Both use `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` for idempotent re-application. The case-insensitive `~*` regex blocks `javascript:`, `data:`, `file:`, etc. while allowing `http://` and `https://`. Existing test fixtures (`phase17-image-provenance.test.ts`) already use `https://` URLs only, so no test changes required. App-level `sanitizeHttpUrl` remains the primary gate — this is layered defense.

### WR-04: `addWatch` catalog wiring shares one try/catch for upsert + link

**Files modified:** `src/app/actions/watches.ts`, `tests/actions/addwatch-catalog-resilience.test.ts`
**Commit:** `99f22a4`
**Applied fix:** Split the single try/catch into two:
1. `upsertCatalogFromUserInput` runs in its own try; on failure logs `"[addWatch] catalog upsert failed (non-fatal):"` and leaves `catalogId` as `null`.
2. `linkWatchToCatalog` runs only when `catalogId` is truthy, in its own try; on failure logs `"[addWatch] catalog link failed (non-fatal):"`.

Operationally distinct recovery paths are now identifiable in logs (per the review note: link failures auto-cure on the next nightly backfill; upsert failures need URL extraction or an explicit re-attempt). Updated the resilience test regex from `/catalog wiring failed/` to `/catalog (upsert|link) failed/` to match either log line. TypeScript check on both modified files passes.

## Skipped Issues

None — all four warnings were fixable cleanly within scope.

## Notes

- All four fixes verified at Tier 2 where applicable (TypeScript check via `tsc --noEmit -p tsconfig.json`, JSON parse for `package.json`). SQL migration verified at Tier 1 (re-read).
- Pre-existing TypeScript errors elsewhere in the repo (e.g., `tests/integration/phase17-extract-route-wiring.test.ts:50` — `null` assigned to `string | undefined`) are unrelated to these findings and were not modified.
- Info-severity findings (IN-01..IN-04) are out of scope for this `critical_warning` fix run.

---

_Fixed: 2026-04-27T20:50:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
