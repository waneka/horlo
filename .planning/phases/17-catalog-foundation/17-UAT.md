---
status: complete
phase: 17-catalog-foundation
source:
  - .planning/phases/17-catalog-foundation/17-01-SUMMARY.md
  - .planning/phases/17-catalog-foundation/17-02-SUMMARY.md
  - .planning/phases/17-catalog-foundation/17-03-SUMMARY.md
  - .planning/phases/17-catalog-foundation/17-04-SUMMARY.md
  - .planning/phases/17-catalog-foundation/17-05-SUMMARY.md
  - .planning/phases/17-catalog-foundation/17-06-SUMMARY.md
started: 2026-04-27T20:55:00Z
updated: 2026-04-27T21:14:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Bring the local Supabase stack and Next.js dev server up from scratch (`supabase start` if down, then `npm run dev`). Server boots without errors, migrations are already applied (no pending drizzle/supabase migrations), and the homepage / collection page loads with the existing watches list rendered.
result: pass

### 2. Add Watch via Form (no regression)
expected: |
  Open the Add Watch form, enter brand "Rolex", model "Submariner", reference "126610LN", fill required fields, submit. The watch appears in your collection immediately. No error toast, no broken UI. (Catalog wiring is silent — no user-visible catalog UI in Phase 17.)
result: pass

### 3. Import Watch from URL (no regression)
expected: |
  Open the URL Import flow, paste a known watch product URL (e.g., a Hodinkee or brand site listing), submit. Extraction succeeds (form pre-fills with extracted data) within a few seconds. No 500 error, no SSRF error for a valid public URL. After confirming, the watch appears in your collection.
result: pass

### 4. Verify catalog_id is populated on new add (DB spot-check)
expected: |
  After Tests 2 and 3 succeed, run a quick SQL spot-check: `docker exec -i supabase_db_horlo psql -U postgres -d postgres -c "SELECT id, brand, model, catalog_id FROM watches ORDER BY created_at DESC LIMIT 5;"` — the most recent rows have `catalog_id` populated (non-null UUID). Catalog wiring is fire-and-forget but should succeed for normal inputs.
result: pass
notes: All 5 most-recent rows have non-null catalog_id. Same brand+model collapse to one catalog row (e.g., 3× Rc-rcmohn0xrn-X / Sub share one id) — natural-key dedup confirmed.

### 5. Backfill script — first run links unlinked rows
expected: |
  Run `npm run db:backfill-catalog`. Output shows `[backfill] pass 1: linked N (cumulative N)` then `[backfill] OK — total linked: N, unlinked remaining: 0, elapsed: ...ms`. Exit code 0. No errors. (If all rows already have catalog_id from Test 4, total linked may be 0 — that's still pass.)
result: pass
notes: "linked: 0, remaining: 0, elapsed: 40ms — all rows already linked via Plan 03 wiring (expected outcome per Test 4)."

### 6. Backfill script — idempotent re-run
expected: |
  Run `npm run db:backfill-catalog` a second time immediately. Output shows `[backfill] OK — total linked: 0, unlinked remaining: 0, elapsed: ...ms`. No new catalog rows created, no errors. Exit code 0.
result: pass
notes: "linked: 0, remaining: 0, elapsed: 17ms — idempotent (faster on second run, no side effects)."

### 7. db:refresh-counts script (local cron simulator)
expected: |
  Run `npm run db:refresh-counts`. Script connects, runs the SECDEF refresh function, updates owners_count + wishlist_count on watches_catalog rows, writes today's snapshot to watches_catalog_daily_snapshots. Output reports success and exits 0.
result: pass
notes: "OK -- counts refreshed and snapshot row written, elapsed: 46ms."

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
