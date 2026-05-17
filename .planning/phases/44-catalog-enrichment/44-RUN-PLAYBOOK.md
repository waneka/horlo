# Phase 44: Production Enrichment Run Playbook

**Purpose:** Step-by-step operator guide for the local backfill run, factual fill,
migration generation, and prod sync (D-14). Follow these steps in order.

**Prerequisites built by Plans 01–04 (Task 1):**
- `backfill-taste.ts` — hardened with pacing, retries, D-14 migration emit
- `factual-propose.ts` — web-search LLM proposes factual values to the review file
- `factual-apply.ts` — reads approved review file, emits factual data migration
- `verify-catalog-coverage.ts` — coverage gate; exit 0 means all rows populated

---

## Step 0: Preflight

Before running anything, verify:

1. **Local Supabase is running:**
   ```bash
   supabase status
   ```
   Should show `API URL: http://127.0.0.1:54321`.

2. **Catalog rows are present (must be ~101):**
   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -c "SELECT count(*) FROM watches_catalog;"
   ```
   Expected: `101`.

   **If this returns 0 (after a `supabase db reset`):** Re-seed the catalog:
   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     < scripts/seed-bootstrap-2026-05-13.sql
   ```
   Then re-confirm the count.

3. **`.env.local` DATABASE_URL points at LOCAL — NEVER prod:**
   ```bash
   grep DATABASE_URL .env.local
   ```
   Expected: `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   (or the `postgres.horlo.*` direct supavisor URL on port 54322).
   The prod pooler URL (`db.*.supabase.co`) must be commented out.

4. **`ANTHROPIC_API_KEY` is set in `.env.local`:**
   ```bash
   grep ANTHROPIC_API_KEY .env.local | head -1
   ```
   Expected: `ANTHROPIC_API_KEY=sk-ant-...`

5. **web_search is enabled in the Claude Console:**
   Visit https://console.anthropic.com — confirm your organization has web search enabled.
   If not enabled: the scripts fall back to text-only enrichment (graceful degradation is
   built in; the run will still complete, just without web grounding).

---

## Step 1: Taste Backfill

First, preview cost without spending anything:

```bash
npm run db:backfill-taste -- --dry-run
```

Review the output:
- `rows with NULL confidence` — should be ~101 (all rows unfilled)
- `estimated cost` — should be under $5 at ~100-row scale

When satisfied with the preview, run the live backfill:

```bash
npm run db:backfill-taste
```

This will:
- Enrich each row's taste columns (formality, sportiness, heritage_score, primary_archetype,
  era_signal, design_motifs, confidence, extracted_from_photo) using the two-turn web_search
  + forced-tool LLM call
- Log each row's result: `{ event: 'backfill_row_result', catalog_id, status, confidence, timestamp }`
- Pace at ~1 row/second (INTER_ROW_DELAY_MS=1000) — a 101-row run takes ~2 minutes
- Emit a 14-digit-timestamped SQL data migration automatically (see Step 5)

**After the live run:** review the per-row logs. If any rows show `status: 'failure'`,
re-run the script — it is idempotent (skips rows where `confidence IS NOT NULL` via first-write-wins).

---

## Step 2: Factual Propose

Preview which rows have NULL factual fields:

```bash
npm run db:factual-propose -- --dry-run
```

Review the output:
- Rows with `movement_type IS NULL OR case_size_mm IS NULL OR array_length(style_tags, 1) IS NULL`

When satisfied, run the live factual-propose:

```bash
npm run db:factual-propose
```

This will:
- For each row with a NULL factual field, call the LLM with web_search to propose values
- Write one JSONL line per field per row to `catalog-factual-review.jsonl`
- Skip any `catalog_id` already in the review file (resume ledger — safe to re-run)

---

## Step 3: Operator Review

Open `catalog-factual-review.jsonl` in your editor. For each line:

1. **Set `"approved": true`** to accept the proposed value, or **`"approved": false`** to reject it.
2. For `image_source_page_url` entries: open the proposed URL in your browser, find the watch's
   cover photo on the brand or retailer page, copy the direct image URL, and update the line:
   ```json
   {"catalog_id":"...","field":"image_url","current":null,"proposed":null,"source_url":"https://brand.com/page","approved":true,"image_url":"https://brand.com/image.jpg"}
   ```
   (See D-04: LLM proposes source-page URLs only; you supply the final image URL.)
3. If a proposed value looks wrong, set `"approved": false` — that row's factual field stays NULL
   for now. Browse must tolerate missing factual data.

---

## Step 4: Factual Apply

Preview which approved rows will generate SQL (no files written):

```bash
npm run db:factual-apply -- --dry-run
```

Review the output — confirm the right `catalog_id` values appear in UPDATE statements.

When satisfied, run the live apply:

```bash
npm run db:factual-apply
```

This will:
- Read `catalog-factual-review.jsonl`, filter `approved === true` lines
- Emit `supabase/migrations/<14-digit>_phase44_factual_data.sql` with one UPDATE per approved row

Confirm the migration file was created:

```bash
ls supabase/migrations/*phase44_factual_data*
```

---

## Step 5: Confirm the Taste Migration Exists

The live `npm run db:backfill-taste` run from Step 1 **already emitted** the taste migration
automatically (D-14 — the backfill script writes the migration file itself after completing the
row loop on a non-dry-run run). You do NOT need to run a separate command.

Confirm the file exists and has a 14-digit timestamp greater than `20260517000000`:

```bash
ls supabase/migrations/*phase44_taste_data*
```

Expected output example: `supabase/migrations/20260518143027_phase44_taste_data.sql`

The timestamp must be exactly 14 digits in `YYYYMMDDHHMMSS` format. Supabase CLI silently
skips non-14-digit filenames (T-44-13).

---

## Step 6: Apply Migrations Locally and Verify Coverage

Apply both phase44 migrations to the LOCAL database:

```bash
supabase db push
```

(This applies to local. Do NOT use `--linked` here — that pushes to prod.)

Then run the coverage verification script:

```bash
npm run db:verify-catalog-coverage
```

Expected output:
```
[verify-catalog-coverage] Archetype distribution:
  dive         18 rows
  dress        15 rows
  ...
[verify-catalog-coverage] OK — taste NULL rows: 0, factual NULL/empty rows: 0 (elapsed: ...ms)
```

The script must exit 0. If it exits 1:
- `taste NULL rows: N > 0` — re-run `npm run db:backfill-taste` to fill the remaining rows
- `factual NULL/empty rows: N > 0` — add more rows to the review file (Step 2-3), then re-apply (Step 4)

Any `WARN: archetype '...' has 0 catalog rows` lines are expected (soft-warn per D-16) — they do
not require action at this phase. Note them for the v5.2 catalog expansion.

---

## Step 7: Commit the Migration Files

```bash
git add supabase/migrations/*phase44_taste_data* supabase/migrations/*phase44_factual_data*
git commit -m "feat(44): add phase44 taste + factual data migrations"
```

Confirm both files are committed:

```bash
git log --name-only -1
```

---

## Step 8: Prod Push (OPERATOR-GATED)

**This step requires operator action. Do not automate it.**

You need `SUPABASE_ACCESS_TOKEN` in your environment (non-TTY `supabase db push --linked` requires it):

```bash
# Get from: Supabase Dashboard -> Account -> Access Tokens
export SUPABASE_ACCESS_TOKEN=<your-token>
```

Push the committed migrations to production:

```bash
supabase db push --linked
```

Confirm the output shows the two `phase44_*` migrations applied (not "0 migrations applied").

Then verify coverage against prod. Update `.env.local` temporarily to point `DATABASE_URL` at
the prod direct connection, run the verification, then restore `.env.local` to local:

```bash
# After updating .env.local to prod URL temporarily:
npm run db:verify-catalog-coverage
```

Expected: same OK output as Step 6.

**CRITICAL:** After verifying prod, immediately restore `.env.local` `DATABASE_URL` back to
`postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Never leave `.env.local` pointing
at prod — future enrichment runs would write to prod directly, violating D-14.

---

## Done Criteria

- [ ] `supabase/migrations/<ts>_phase44_taste_data.sql` committed (14-digit timestamp)
- [ ] `supabase/migrations/<ts>_phase44_factual_data.sql` committed (14-digit timestamp)
- [ ] `npm run db:verify-catalog-coverage` exits 0 against local DB
- [ ] `npm run db:verify-catalog-coverage` exits 0 against prod (after `supabase db push --linked`)
- [ ] Archetype distribution reviewed; any soft-warn archetypes noted

When done, reply to the checkpoint prompt with `"approved"` (or describe any failures).

---

*Phase: 44-Catalog Enrichment*
*Playbook created: 2026-05-17*
