---
dimension: pitfalls
generated: 2026-04-26
milestone: v4.0 Discovery & Polish
---
# Pitfalls Research — v4.0 Discovery & Polish

**Domain:** Adding canonical `watches_catalog` + /explore + /search Watches/Collections + /evaluate flow + Settings expansion (Account/Notifications/Appearance) + custom SMTP (Resend) + profile nav prominence + empty-state CTAs + WYWT auto-nav + form polish + dead-stub notification cleanup, into an existing Next.js 16 / React 19 / Supabase / RLS / Drizzle / `cacheComponents: true` app (Horlo, post v3.0).

**Researched:** 2026-04-26

**Confidence:** HIGH (catalog FK + ON CONFLICT semantics, Cache Components rules already proven in Phase 11–16, RLS two-layer patterns, Supabase Auth `updateUser` flow, ALTER TYPE ADD/DROP VALUE constraints, pg_cron availability, BottomNav muscle-memory risk), MEDIUM (Resend deliverability under DKIM lag, Server Action + `useTransition` + `router.push` ordering across React 19 changes, Sonner toast persistence across Cache Components revalidation), LOW (exact UX copy for two-link email confirmation in Settings — UX decision, not a verifiable claim)

**Legend:**
- 🆕 NEW pitfall introduced by v4.0 features
- ♻️ KNOWN pattern that needs reapplying (proven in v3.0; risk if forgotten)
- 🔁 HYBRID — old pattern operating in a new context where it can break differently

---

## Critical Pitfalls

### Pitfall 1: Catalog Migration Backfill Half-Completes; `catalog_id` Left NULL on a Subset, Then SET NOT NULL Forced Too Early 🆕

**What goes wrong:**
The expand-contract pattern requires three deploys: (1) add nullable `catalog_id` + create `watches_catalog`, (2) backfill, (3) tighten constraints. If a phase plan tries to do all three in one phase — particularly if it ends with `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL` — and the backfill skips any row (typo'd brand, NULL reference colliding with another NULL reference under default UNIQUE semantics, or a transient connection drop mid-batch), the SET NOT NULL fails with `column "catalog_id" contains null values` and the entire migration aborts on production. Recovery is painful because half the catalog rows are inserted but none are linked.

**Why it happens:**
Drizzle migration scripts are tempting to write linearly: schema change → backfill → constraint tighten in one file. The local Supabase Docker instance has only a handful of seed watches, so the backfill always succeeds locally. Production has hundreds of rows including `null reference` values that collide under `UNIQUE (brand, model, reference)` if `NULLS NOT DISTINCT` is forgotten (Postgres 14 and earlier default to `NULLS DISTINCT`; Postgres 15+ supports `NULLS NOT DISTINCT` as an explicit option, but Drizzle's `uniqueIndex().on(...)` does not emit `NULLS NOT DISTINCT` by default — you must drop to raw SQL).

**How to avoid:**
- Split into THREE phases / migration files: (1) additive (table + nullable FK + UNIQUE with explicit `NULLS NOT DISTINCT` via raw SQL — never via `drizzle-kit push`), (2) backfill (Node script `scripts/backfill-watches-catalog.ts`, idempotent, batched, with COUNT(*) WHERE catalog_id IS NULL assertion at the end), (3) DO NOT add SET NOT NULL in v4.0 — keep `catalog_id` nullable indefinitely (a user-typed "rough draft" watch may legitimately not match any catalog row).
- Backfill script must run AFTER prod migration ships (read MEMORY: drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked --include-all`).
- Backfill script ends with: `SELECT COUNT(*) FROM watches WHERE catalog_id IS NULL` — if non-zero, log every unlinked row's `(brand, model, reference)` for human review BEFORE retrying.
- Fall back to `UNIQUE (brand, model, COALESCE(reference, ''))` if `NULLS NOT DISTINCT` proves fragile under Drizzle introspection.

**Warning signs:**
- Migration file contains both `ADD COLUMN catalog_id` AND `ALTER COLUMN catalog_id SET NOT NULL` in the same up().
- Backfill script lacks a final `WHERE catalog_id IS NULL` assertion.
- UNIQUE constraint uses Drizzle's `uniqueIndex(...)` without explicit `NULLS NOT DISTINCT` raw SQL, AND `reference` is nullable.
- Local works; staging works; prod migration aborts. (Local seed has fewer collisions.)

**Phase to address:** Phase 1 of v4.0 (Catalog Schema + Backfill).

---

### Pitfall 2: `INSERT … ON CONFLICT (brand, model, reference) DO NOTHING` Silently Skips Catalog Enrichment 🆕

**What goes wrong:**
The catalog populates from three sources (`user_promoted`, `url_extracted`, `admin_curated`). When a user URL-imports a watch via `/api/extract-watch` and the LLM stage pulls a better spec sheet (lugToLug, water resistance) than a previously user-promoted catalog row, the natural code is `INSERT INTO watches_catalog (...) VALUES (...) ON CONFLICT (brand, model, reference) DO NOTHING`. This is **wrong** — `DO NOTHING` discards the higher-quality URL-extracted data entirely. The catalog row stays at its `user_promoted` quality forever.

**Why it happens:**
`ON CONFLICT DO NOTHING` is the safest-feeling dedup primitive and is what every "Drizzle deduplication" SO answer gravitates toward. The merge nuance ("enrich missing NULL columns from new insert, never overwrite non-null") is real product logic that doesn't fit on the `ON CONFLICT` line alone.

**How to avoid:**
- Two-step pattern in the URL-extracted insert path:
  ```sql
  INSERT INTO watches_catalog (brand, model, reference, ...specs..., source)
  VALUES (...) 
  ON CONFLICT (brand, model, reference) DO UPDATE
  SET 
    movement = COALESCE(watches_catalog.movement, EXCLUDED.movement),
    case_size_mm = COALESCE(watches_catalog.case_size_mm, EXCLUDED.case_size_mm),
    -- ...for every nullable spec column...
    source = CASE 
      WHEN watches_catalog.source = 'admin_curated' THEN watches_catalog.source
      ELSE EXCLUDED.source 
    END,
    updated_at = NOW()
  RETURNING id;
  ```
- Use plain `DO NOTHING` ONLY for the user-promoted path inside `addWatch` (don't enrich from typed input — too much typo risk).
- Never overwrite `admin_curated` rows from any automated path — pin via the CASE on `source`.

**Warning signs:**
- The `addWatch` and the `/api/extract-watch` paths share the same insert helper.
- Code review finds `ON CONFLICT DO NOTHING` and the test only asserts "row exists" not "spec sheet was enriched."
- After a known better-quality URL extract for an existing catalog row, `SELECT lug_to_lug_mm FROM watches_catalog WHERE brand=... AND model=...` is still NULL.

**Phase to address:** Phase 1 (Catalog Schema) — design the two helpers (`upsertCatalogFromUserInput` vs. `upsertCatalogFromExtractedUrl`) before any insert path is wired.

---

### Pitfall 3: Catalog Identity Fragmentation from Typo / Casing — User Types "Rolex", "ROLEX", "rolex"; Three Catalog Rows Created 🆕

**What goes wrong:**
The natural-key UNIQUE is `(brand, model, reference)` — case-sensitive by default in Postgres `text` columns. A user adding "Rolex Submariner 116610LN" creates a different catalog row than another user adding "ROLEX Submariner 116610LN" or "rolex submariner 116610ln". Three catalog rows for the same physical watch. `/explore` "trending watches" double-counts; /search Watches finds three results; `owners_count` is fragmented.

**Why it happens:**
- Postgres `text` UNIQUE is case-sensitive.
- `CITEXT` would solve case but introduces a new column type the codebase doesn't use elsewhere; whitespace/punctuation drift ("Sub-mariner" vs "Submariner") still escapes both `text` and `CITEXT` UNIQUE.
- Existing v1.0 watches have ~years of casing inconsistency that the catalog backfill will inherit and explode into duplicate rows on the first INSERT pass.

**How to avoid:**
- Normalize at the Server Action boundary BEFORE the UNIQUE check fires: `brand.trim().toLowerCase()`, `model.trim().toLowerCase()`, `reference?.trim().toLowerCase() ?? null`. Store the normalized values in a separate column (`brand_normalized`, `model_normalized`, `reference_normalized`) and put the UNIQUE on the normalized trio. Display the original-cased value (preserve user input on screen).
- Pattern: `brand TEXT NOT NULL` (display) + `brand_normalized TEXT NOT NULL GENERATED ALWAYS AS (lower(trim(brand))) STORED` + `UNIQUE (brand_normalized, model_normalized, reference_normalized)`. Postgres generated columns are deterministic and indexable.
- For pre-existing duplicates discovered during backfill: log them, halt backfill, present a deduplication report to the user (admin task — small data set, manual merge in v4.0; the admin tooling is out of scope but the report-and-halt step is in scope).
- Document the policy: "Catalog identity is normalized; user-facing display preserves original input."

**Warning signs:**
- Backfill produces N+M catalog rows where N = unique watches, M = casing duplicates.
- /explore trending watches shows the same model twice with different `owners_count`.
- Catalog row count grows linearly with `watches` row count instead of plateauing.
- A schema column named `brand` is queried with `WHERE brand = 'Rolex'` (case-sensitive bug) instead of `WHERE brand_normalized = 'rolex'`.

**Phase to address:** Phase 1 (Catalog Schema) — generated columns and normalization MUST be in the initial table definition, not retrofitted.

---

### Pitfall 4: `watches_catalog` Public-Read RLS Policy Forgotten — Table Becomes Anon-Invisible After RLS-Default-On 🆕

**What goes wrong:**
Project-wide RLS was audited ON in v3.0 Phase 11 (DEBT-02). When the migration adds `watches_catalog`, **every** new table inherits "no RLS policies → no rows visible to non-service-role connections". /search Watches and /explore Trending — both anon-tolerable read paths — silently return empty arrays. The bug is invisible in dev (where the developer is signed in as service role through Drizzle) and only manifests on the live anon viewer.

**Why it happens:**
Drizzle migrations create the table; RLS policies live in raw SQL Supabase migrations. The project established this dual-track in v3.0 (Drizzle for column shapes; raw `supabase/migrations/*.sql` for RLS, partial indexes, CHECK constraints). Forgetting the second file is a paperwork-only mistake with a security/availability footgun.

**How to avoid:**
- Mandate that EVERY phase plan that adds a table includes BOTH a Drizzle migration AND a sibling `supabase/migrations/*.sql` migration that calls `ALTER TABLE … ENABLE ROW LEVEL SECURITY` and creates SELECT policies (and any INSERT/UPDATE/DELETE policies if applicable).
- For `watches_catalog` specifically:
  ```sql
  ALTER TABLE watches_catalog ENABLE ROW LEVEL SECURITY;
  CREATE POLICY watches_catalog_select_all ON watches_catalog
    FOR SELECT USING (true);
  -- Intentionally no INSERT/UPDATE/DELETE policies — Server Actions use service role
  -- (verify in DAL: catalog inserts MUST go through the SECDEF / service-role path).
  ```
- Add a regression test: `tests/integration/catalog-rls.test.ts` that opens an anon connection and asserts `SELECT * FROM watches_catalog LIMIT 1` returns >0 rows after seeding.
- Add a Drizzle introspection guard in CI: any `pgTable` whose name doesn't appear in a `supabase/migrations/*.sql` policy file fails review.

**Warning signs:**
- /search Watches tab returns empty array for every query in production but works locally.
- Anon connection (logged-out user) sees empty /explore.
- New migration file created in `drizzle/` with no companion file in `supabase/migrations/`.
- The phrase `ENABLE ROW LEVEL SECURITY` does not appear in the v4.0 catalog phase commits.

**Phase to address:** Phase 1 (Catalog Schema) — include the RLS migration in the SAME commit as the table.

---

### Pitfall 5: `cookies()` / `auth.getUser()` Called in `/evaluate` Page Body — Cache Components Strict Build Failure 🆕 ♻️

**What goes wrong:**
`/evaluate` is per-viewer (it loads the user's collection and preferences to compute similarity) but the natural Server Component shape is to fetch `auth.getUser()` and `getWatchesForUser(userId)` directly in the page body. With `cacheComponents: true`, **any cookies/headers/auth call outside a Suspense boundary** in a route component throws at build/prerender time. The page builds locally because dev mode is permissive, then fails on Vercel deploy.

**Why it happens:**
Phase 11–14 already taught this lesson (`<Header>` was moved into Suspense for exactly this reason). New pages don't automatically inherit that knowledge — the implementer copies the layout pattern of a different existing page (e.g., a public marketing page), which doesn't have the constraint, and the test environment passes.

**How to avoid:**
- The `/evaluate` page must follow the canonical Cache Components shape:
  ```tsx
  // src/app/evaluate/page.tsx — Server Component
  export default function EvaluatePage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
    return (
      <Suspense fallback={<EvaluateSkeleton />}>
        <EvaluateContent searchParams={searchParams} />
      </Suspense>
    )
  }
  
  async function EvaluateContent({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
    const supabase = await createServerClient() // cookies() lives here, INSIDE Suspense
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/signin?next=/evaluate')
    // ...fetch collection + preferences, run similarity...
  }
  ```
- Anonymous evaluation: redirect to /signin with `?next=/evaluate` (don't try to render read-only mode — similarity needs collection + preferences to be meaningful; an unauthed verdict is uninteresting).
- Run `next build` locally before merging — `next dev` will not catch this.

**Warning signs:**
- Page calls `cookies()` or `await createServerClient()` directly inside `export default function PageName()`.
- No `<Suspense>` wrapping the dynamic data fetch.
- `next dev` works; `next build` fails with "cookies() was called outside a request scope".
- Review of phase plan does not reference Phase 14 / Phase 15 layout patterns.

**Phase to address:** Phase 4 of v4.0 ("Evaluate this Watch" route).

---

### Pitfall 6: /search Collections Privacy Two-Layer Drift — Gates `profile_public` at SQL but Forgets `collection_public` at DAL 🆕 ♻️

**What goes wrong:**
/search Collections (Tab) joins `watches` to `profiles` to find matches. The natural query gates `profile_public = true` (because the people-search Phase 16 pattern does this). But Collections has a second privacy gate: `profile_settings.collection_public`. A user with `profile_public = true` but `collection_public = false` (private collection on a public profile) leaks their watch list through Collections search.

**Why it happens:**
The two-layer privacy pattern from v2.0/v3.0 is "RLS at DB + DAL WHERE at app". Phase 16 people-search successfully implemented this for `profile_public`. The collections variant requires gating on TWO booleans — one of which (`collection_public`) lives on a DIFFERENT table (`profile_settings`, not `profiles`). Joining the third table is an extra step that's easy to forget when copying the people-search pattern.

**How to avoid:**
- Build the privacy gate as a reusable SQL helper or DAL primitive:
  ```typescript
  // src/data/search.ts
  function publicCollectionPredicate(viewerId: string | null) {
    return and(
      eq(profileSettings.profilePublic, true),
      eq(profileSettings.collectionPublic, true),
      viewerId ? ne(profiles.id, viewerId) : sql`true`,
    )
  }
  ```
- Three-layer test fixture: viewer is User A; create User B (`profile_public=true, collection_public=true`) and User C (`profile_public=true, collection_public=false`). /search Collections must find B and NOT find C.
- Add a SECURITY DEFINER helper or DB-level VIEW `public_collection_watches` that pre-applies both gates — DAL queries hit the view, never the raw `watches` table for cross-user reads.
- Verify with the `EXPLAIN` plan in Phase 6 that the three predicates push down to indexes (a sequential scan of `watches` joined to two boolean columns at scale becomes the next pitfall — see Pitfall 17).

**Warning signs:**
- DAL function name says "public collection" but only filters one boolean.
- Test fixtures don't include the (profile_public=true, collection_public=false) edge case.
- Code review finds the `profile_settings` join missing from the Collections-search query.

**Phase to address:** Phase 5 of v4.0 (/search Watches + Collections Tabs).

---

### Pitfall 7: /search Collections N+1 on `isOwned` / `isWishlisted` Badges — Anti-Pattern Re-emerges After Phase 16 ♻️

**What goes wrong:**
/search Collections returns up to 50 collection-result rows. Each row may show "you also own 3 of these watches" — requiring a per-row lookup against the viewer's collection. The naive implementation runs 50 DB queries per search keystroke. With 250ms debounce + AbortController, this is "only" a handful of requests per second, but each query is uncached and produces a load-amplification factor of 50×.

**Why it happens:**
Phase 16 people-search SOLVED this for `isFollowing` via batched `inArray(follows.followingId, topIds)`. The Collections variant requires the same trick but with a different predicate (`watches.userId IN (...) AND watches.brand=... AND ...`). Implementers see the people-search pattern, think "yeah I know N+1," then write `await Promise.all(rows.map(r => getOverlapForViewer(r.userId, viewerId)))` — which is parallel-N+1, still N round trips.

**How to avoid:**
- Pre-LIMIT to 50 in SQL → JS-sort → ONE batched lookup with `inArray`:
  ```typescript
  const topUserIds = topRows.map(r => r.userId)
  const overlapRows = await db
    .select({ otherUserId: watches.userId, brand: watches.brand, model: watches.model })
    .from(watches)
    .where(and(
      inArray(watches.userId, topUserIds),
      eq(watches.userId, /* viewer */)  // Wait, viewer's collection — separate query
    ))
  ```
- Recognize that the anti-N+1 trick from Phase 16 (`isFollowing` was a single boolean per row) is HARDER for Collections (overlap is a count or a list per row). Two-step pattern: (1) fetch viewer's full collection ONCE; (2) for each result row, intersect with the in-memory viewer collection (no further DB round trips).
- Test with 50 result rows — assert ≤2 DB queries in the integration test (one for results, one for viewer collection).

**Warning signs:**
- DAL function uses `await Promise.all(rows.map(...))`.
- Integration test passes with N=1 fixture row but never tested with N=50.
- /search Collections feels noticeably slower than /search People at the same row count.

**Phase to address:** Phase 5 (/search Watches + Collections Tabs) — write the anti-N+1 test BEFORE the implementation.

---

### Pitfall 8: Settings Email-Change UX Lies — "Email Updated" Toast Fires Before Confirmation Click 🆕

**What goes wrong:**
`supabase.auth.updateUser({ email: 'new@x.com' })` resolves successfully when the confirmation emails are dispatched (one to old, one to new — Supabase's "Secure email change" mode). The user has NOT yet clicked either link. The natural flow shows a "Email updated to new@x.com" toast and immediately reflects the new address in the UI. But Supabase Auth has not actually rotated the email on the user record yet — it's pending. The user closes the tab, never clicks the link, and is then mystified why login still uses the old email.

**Why it happens:**
The Supabase JS reference docs say `updateUser({ email })` returns a User object that includes the new email in `email_change_sent_at` / `new_email` fields, BUT the canonical `email` field is unchanged until verification. Reading the response naively (`data.user.email`) gives the OLD email, while the form just submitted the NEW one — leading developers to think "the response is wrong, let me just optimistically update from the form value."

**How to avoid:**
- Separate "submitted change request" from "change confirmed" UI states:
  - Toast: "Confirmation link sent to **both** new@x.com and old@x.com — click both to complete the change."
  - UI shows: "Current email: old@x.com (pending change to new@x.com)" — do NOT display the new email as current.
- Detect pending state: read `supabase.auth.getUser()` after the update; check `user.new_email` field. If non-null, render the pending banner.
- Confirmation handler at `/auth/confirm?type=email_change` shows the success toast with `?status=email_changed`, NOT the form submission handler.
- Add a "Resend confirmation" button after the initial submit (Resend dashboard caps + Supabase per-hour limits — see Pitfall 14).

**Warning signs:**
- Settings/Account UI shows the new email as "Current" before any link is clicked.
- No "pending" state in the email-change UX.
- Code reads `data.user.email` from the `updateUser` response and treats it as authoritative.
- Toast copy says "Email updated" instead of "Confirmation sent."

**Phase to address:** Phase 6 of v4.0 (Settings Account section).

---

### Pitfall 9: Custom SMTP Goes Live Before DKIM Verifies — Confirmation Emails Land in Spam, Lock Out New Signups 🆕

**What goes wrong:**
Order of operations matters: (1) Add Resend account, (2) Add domain in Resend, (3) Add DNS records (SPF + DKIM + bounce MX) at registrar, (4) WAIT for DNS propagation (5min – 48hr depending on registrar TTL), (5) Click "Verify" in Resend, (6) Once verified, copy SMTP creds to Supabase Dashboard, (7) Toggle "Confirm email" ON, (8) Disable Supabase's hosted 2/h SMTP fallback (auto-disabled when custom is saved). Skipping step 4 — flipping the Supabase config to use Resend creds before DKIM is verified — means Resend rejects messages OR ESPs (Gmail, Outlook) silently spam-filter them. New signups never see the confirmation email; their account is stuck pre-confirmation forever.

Worse: with "Confirm email" toggled ON, the personal-MVP Horlo account itself can be locked out if a session is invalidated and the password reset email never delivers.

**Why it happens:**
Excitement to "ship the SMTP change" runs ahead of the DNS reality. Vercel doesn't host Horlo's DNS — the registrar does — adding a propagation step that's invisible from the developer's terminal. Resend's "domain pending verification" state is not blocking from the Resend side; only the receiving ESP's DKIM check fails.

**How to avoid:**
- Mandatory ordered checklist in the migration phase plan, with each step requiring pasted evidence of completion (DNS dig output, Resend "Verified ✓" screenshot, Supabase Dashboard config screenshot):
  1. ✅ Resend account + horlo.app domain added
  2. ✅ DNS records added at registrar (paste `dig TXT send.horlo.app +short` output showing the SPF + DKIM records)
  3. ✅ Wait minimum 1 hour for propagation (set a calendar reminder; do NOT proceed before)
  4. ✅ Resend dashboard shows "Verified" green badge
  5. ✅ Send test email from Resend dashboard to the dev's personal account; confirm inbox (not spam)
  6. ✅ Copy SMTP creds to Supabase Dashboard
  7. ✅ Send Supabase Auth test email (sign-up confirmation) to a fresh test address
  8. ✅ ONLY THEN toggle "Confirm email" ON in production
- Backout plan: keep the Supabase hosted SMTP toggle accessible. If verification fails post-flip, revert to hosted SMTP (2/h cap) until DKIM resolves.
- Two domain setup recommended: `noreply@horlo.app` for production, `noreply@staging.horlo.app` for staging — separate Resend domain entries, separate verification cycles, no risk of staging email contaminating prod sender reputation.

**Warning signs:**
- Phase plan checklist has fewer than 7 ordered steps.
- "Confirm email ON" appears in the same commit as "Add Resend SMTP creds."
- `dig TXT resend._domainkey.horlo.app +short` returns NXDOMAIN or wrong TXT value at flip time.
- Emails from `noreply@horlo.app` are landing in Gmail spam during smoke test.

**Phase to address:** Phase 9 of v4.0 (Custom SMTP) — DNS setup must be the first commit; flip happens in the LAST commit of the phase, not the first.

---

### Pitfall 10: ALTER TYPE DROP VALUE Doesn't Exist — Removing `price_drop` + `trending_collector` Enum Values Requires Type Recreation 🆕

**What goes wrong:**
The phase plan to "remove dead notification stubs" naturally writes:
```sql
ALTER TYPE notification_type DROP VALUE 'price_drop';
ALTER TYPE notification_type DROP VALUE 'trending_collector';
```
Postgres does not support `ALTER TYPE … DROP VALUE`. The migration fails with `ERROR: cannot drop value from enum type`. The workaround is a multi-step rename + recreate that's irreversible without data loss IF any rows in `notifications.type` use those values.

**Why it happens:**
ALTER TYPE supports `ADD VALUE` (added in PG 9.1) and `RENAME VALUE` (added in PG 10) but NOT `DROP VALUE` — by design, because dropped values could leave orphan references in any column using the type. Drizzle's `pgEnum` definition update doesn't handle drops either; introspection produces a DROP+CREATE that fails for the same reason.

**How to avoid:**
- BEFORE writing the migration: assert the values are unused.
  ```sql
  SELECT type, COUNT(*) FROM notifications WHERE type IN ('price_drop', 'trending_collector') GROUP BY type;
  -- Expect: empty result (zero rows)
  ```
  If non-zero, decide: delete the rows? remap? defer the enum cleanup?
- Two-step migration pattern (only safe path):
  ```sql
  -- Step 1: Rename old type
  ALTER TYPE notification_type RENAME TO notification_type_old;
  -- Step 2: Create new type without the dead values
  CREATE TYPE notification_type AS ENUM ('follow', 'watch_overlap');
  -- Step 3: Migrate the column (requires temporary text cast)
  ALTER TABLE notifications 
    ALTER COLUMN type TYPE notification_type 
    USING type::text::notification_type;
  -- Step 4: Drop old type
  DROP TYPE notification_type_old;
  ```
- Test fixtures and seed data: `grep -r 'price_drop\|trending_collector'` across the entire repo (including `tests/`, `scripts/`, `seed/`) BEFORE running step 1. Any test fixture seeding these values will explode at step 3.
- Drizzle source of truth update: AFTER the SQL migration ships, update `pgEnum('notification_type', [...])` in `src/db/schema.ts` to drop the two values; commit AFTER the prod migration applied (otherwise drizzle-kit push regenerates them locally).

**Warning signs:**
- Migration uses `ALTER TYPE … DROP VALUE` (will fail at runtime).
- No pre-flight count of `WHERE type IN ('price_drop', 'trending_collector')`.
- Drizzle schema update lands BEFORE the SQL migration on prod.
- `grep -r 'price_drop'` finds matches in `tests/` that aren't updated in the same PR.

**Phase to address:** Phase 8 of v4.0 (Notification Stub Cleanup) — write the count-rows assertion as the first migration step.

---

## High Pitfalls

### Pitfall 11: Denormalized `owners_count` Drifts; pg_cron Not Installed in Local Supabase Docker Causes "Works in Prod, Empty Locally" Bug 🆕

**What goes wrong:**
`owners_count` and `wishlist_count` on `watches_catalog` power /explore "trending watches". The plan calls for a daily `pg_cron` job: `UPDATE watches_catalog SET owners_count = ...`. Local Supabase Docker (`supabase start`) ships with `pg_cron` available but NOT scheduled by default. Developer runs locally, sees empty trending list, tries to debug, eventually realizes pg_cron isn't running. Worse: a developer who doesn't know about pg_cron writes `AFTER INSERT/UPDATE/DELETE` triggers on `watches` instead, which works locally — and creates **write amplification** (every watch insert fires three trigger updates on `watches_catalog`, holding row locks and causing contention under load).

**Why it happens:**
pg_cron is enabled per-database via `CREATE EXTENSION IF NOT EXISTS pg_cron` AND requires the `cron.database_name` postgresql.conf setting AND requires the cron schema/permissions setup. On Supabase managed prod, the dashboard exposes pg_cron natively (Database → Extensions → enable). Locally, the Docker image may or may not ship with cron preconfigured depending on Supabase CLI version. Triggers feel "more reliable" because they don't depend on a scheduler.

**How to avoid:**
- Make `owners_count` / `wishlist_count` updates a SCHEDULED batch job, not a trigger:
  ```sql
  -- supabase/migrations/2026XXXX_owners_count_cron.sql
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  
  CREATE OR REPLACE FUNCTION refresh_catalog_counts() RETURNS void AS $$
  BEGIN
    UPDATE watches_catalog c
    SET owners_count = sub.owned, wishlist_count = sub.wishlisted, updated_at = NOW()
    FROM (
      SELECT catalog_id,
        COUNT(*) FILTER (WHERE status = 'owned') AS owned,
        COUNT(*) FILTER (WHERE status = 'wishlist') AS wishlisted
      FROM watches WHERE catalog_id IS NOT NULL GROUP BY catalog_id
    ) sub
    WHERE c.id = sub.catalog_id;
  END $$ LANGUAGE plpgsql;
  
  SELECT cron.schedule('refresh-catalog-counts', '0 4 * * *', 'SELECT refresh_catalog_counts()');
  ```
- For local development: add `npm run db:refresh-counts` script that calls `SELECT refresh_catalog_counts()` directly. Document in README that pg_cron is prod-only; locally invoke manually.
- Acceptable staleness: 24h is fine for "trending" — a watch added today appears in trending tomorrow. Document this in PROJECT.md Key Decisions.
- If sub-hour freshness needed later: switch to materialized view + `REFRESH MATERIALIZED VIEW CONCURRENTLY` on a 5-min cron, OR add a `pg_notify` trigger that batches updates in a queue — both are v5.0+ scope.

**Warning signs:**
- Phase plan uses `CREATE TRIGGER ... AFTER INSERT ON watches` for count maintenance.
- /explore trending is empty in local dev with seed data.
- pg_cron not mentioned in `docs/deploy-db-setup.md`.
- /explore /search Watches takes >500ms because counts are computed on-the-fly via `COUNT(*)` GROUP BY.

**Phase to address:** Phase 1 (Catalog Schema) for the schema; Phase 3 (/explore) for cron job activation.

---

### Pitfall 12: BottomNav Profile-Slot Addition Breaks Muscle Memory — User Taps "Wear" and Lands on "Profile" 🆕

**What goes wrong:**
Current BottomNav: 5 slots (Home / Search / **Wear** / Notifications / Discover-or-similar) shipped in Phase 14, with the elevated Wear cradle in the center. v4.0 wants Profile prominence. Two options:
- (a) Replace one of the 5 with Profile → muscle memory shifts. The Wear button position is sacred (centered, elevated); moving anything else risks tapping wrong icon.
- (b) Keep 5 slots; add avatar to SlimTopNav top-right.

Option (a) chosen naively often replaces "Discover" with "Profile" — and now /explore (which the milestone is shipping!) loses its bottom-nav entry. Option (a) chosen as "replace Notifications" leaves the unread-bell affordance only on top-nav, which is invisible on small viewports.

**Why it happens:**
"Profile prominence" is articulated as a milestone goal. The natural path is "add a Profile slot". But the BottomNav is a finite resource; every addition is a removal.

**How to avoid:**
- Choose option (b): Profile lives in SlimTopNav as a top-right avatar. BottomNav stays 5 slots: Home / Search / Wear / Notifications / **Explore** (the new /explore page replaces whatever was there as the "discovery" entry).
- Reasoning:
  - /explore is the v4.0 marquee feature; it deserves bottom-nav real estate.
  - Profile is a "settle into your profile" action — top-right avatar is the universal pattern (Twitter, Letterboxd, GitHub, Instagram all use this).
  - Avoids the muscle-memory nuke of moving the Wear cradle's neighbors.
- Document the BottomNav slot decision as a Key Decision in PROJECT.md so future milestones don't relitigate it.
- Visual regression test for the BottomNav layout (Playwright screenshot or simpler: position assertions).

**Warning signs:**
- Phase plan says "add Profile to BottomNav" without specifying which slot is removed.
- Designer mockup shows 6 slots in BottomNav (no, that's not 5).
- "Discover" / "Explore" missing from BottomNav while /explore page is live.

**Phase to address:** Phase 11 of v4.0 (Profile Nav Prominence) — decision must be locked BEFORE BottomNav code is touched.

---

### Pitfall 13: WYWT Auto-Nav to /wear/[id] Races Storage Upload Completion — User Lands on 404 🆕 ♻️

**What goes wrong:**
v3.0 Phase 15 ships the WYWT photo flow with client-direct Supabase Storage upload + Server Action that inserts the row + orphan-cleanup on row-insert failure. v4.0 adds the auto-navigation: after submit success, `router.push(\`/wear/${wearEventId}\`)`. The race condition: the Server Action returns the `wearEventId` BEFORE the storage upload's signed-URL is propagated through Supabase's storage CDN. The user lands on `/wear/[id]`, the page tries to fetch the image, and the signed URL doesn't resolve for 200–800ms — black image, "image not found" fallback flashes, then it loads.

A second variant: React 19 `useTransition` + `router.push` ordering. The transition wraps the Server Action call; `router.push` runs INSIDE the transition. If the toast fires from outside the transition (Sonner has its own update path), the toast and the navigation race. User sees toast "Posted ✓" twice if the navigation re-renders the toast emitter.

**Why it happens:**
- Storage upload is client-direct, which means the Server Action only sees the storage KEY, not whether the CDN has cached it.
- React 19 transitions are not new but the interaction with Server Actions is subtle: `startTransition(() => { action(...).then(() => router.push(...)) })` does NOT actually await the action correctly.
- Phase 15 deferred the auto-nav explicitly because the simpler "dialog closes + toast" flow had no race.

**How to avoid:**
- Auto-nav AFTER both promises resolve, in this order:
  1. `await uploadResult` — confirm storage put returned 200 (already done in Phase 15's flow).
  2. `await logWearWithPhoto(...)` — Server Action returns `wearEventId`.
  3. `router.push(\`/wear/${wearEventId}\`)` — navigate.
- Inside the new `/wear/[id]` page, use `<Suspense fallback={<PhotoSkeleton />}>` around the photo render. The signed URL fetches per-request; the skeleton covers the 200–800ms CDN window.
- For useTransition + Sonner ordering: fire the toast and `router.push` in sequence INSIDE the transition's `.then()`, NOT separately. Pattern:
  ```tsx
  startTransition(async () => {
    const result = await logWearWithPhoto(formData)
    if (result.error) { toast.error(result.error); return }
    router.push(`/wear/${result.wearEventId}`)
    toast.success('Posted ✓')  // Fires AFTER navigation starts; survives client transition
  })
  ```
- Alternative (safer): close the dialog + toast immediately on success; navigate to /wear/[id] only AFTER 500ms delay. Less elegant but eliminates the race entirely.

**Warning signs:**
- Phase plan describes auto-nav as "router.push after action returns" without addressing the storage CDN propagation.
- /wear/[id] page does NOT wrap the photo render in Suspense.
- E2E test for WYWT post + auto-nav passes locally but flakes 1/10 in CI (timing-dependent).
- User reports "I posted a wear and it took me to a 404 / blank page that loaded after a second."

**Phase to address:** Phase 12 of v4.0 (WYWT Auto-Nav).

---

### Pitfall 14: Resend Free-Tier Cap Burned by Email-Change Cycles — 100/day Hits in an Afternoon 🆕

**What goes wrong:**
Resend free tier: 3000/mo, **100/day**. Each email-change request fires TWO emails (Secure email change mode: confirmation to old + new). Password reset cycles fire one. A user who toggles email back and forth during testing burns 10–20 emails. A leaked test loop (e.g., a CI job that loops through "create user → change email → change email → ...") burns the daily 100-cap in minutes. Once capped, no signup confirmation, no password reset, no email-change for the rest of the day.

Add Supabase's separate per-hour limit (default 30/h after custom SMTP enabled), and the cap profile is layered: Supabase 30/h × Resend 100/day. The narrower of the two trips first. For a personal-MVP the 100/day is the binding constraint.

**Why it happens:**
Free tier limits are easy to forget when local development = no SMTP fires (local uses inbucket / mailpit). Production behavior differs sharply.

**How to avoid:**
- Use a non-prod Resend domain (`mail.staging.horlo.app`) for staging; prod-only Resend for production. Quotas don't share.
- For local dev: keep Supabase using local inbucket. NEVER point local at Resend SMTP. Document in `.env.example`.
- For test loops in CI: stub the email send. Add a `RESEND_DISABLE_FOR_TESTS=true` env that the Server Action respects.
- Real user education: If the hard cap hits, manually create the user in Supabase Dashboard (admin override) and document a recovery path in `docs/deploy-db-setup.md`.
- Monitoring: add a daily cron in Resend dashboard to email the team if usage > 70% of cap. Resend does have webhook events for "approaching quota."

**Warning signs:**
- Local Supabase config points at smtp.resend.com (should point at inbucket).
- Test fixture creates 10+ users in a single integration run with confirmation ON.
- Resend dashboard shows >50 emails sent in any 1-hour window during normal operations.

**Phase to address:** Phase 9 (Custom SMTP) — set up monitoring and quota guards in the same phase.

---

### Pitfall 15: Notification Opt-Out UI Toggles Optimistically But Server Action Eats the Change — Stale Cache Bug 🆕 ♻️

**What goes wrong:**
Settings → Notifications has two toggles: `notifyOnFollow` and `notifyOnWatchOverlap`. UI uses optimistic update + Server Action + cache invalidation. Race condition: user toggles OFF; client optimistically shows OFF; Server Action persists OFF; cache tag for the user's settings is invalidated. Meanwhile, the `logNotification` writer (fire-and-forget) reads `profile_settings.notify_on_follow` — but the writer runs in a DIFFERENT request context that hits its own cached read of profile_settings, returning TRUE (stale). One stray "follow" notification fires after the user clearly opted out.

Phase 13 already wired this correctly via `updateTag('profile_settings:viewer:${id}', 'max')` for read-your-own-writes — but the writer (`logNotification`) runs in the request context of the FOLLOW action, which has no relationship to the recipient's tag.

**Why it happens:**
Cache invalidation in Next.js 16 Cache Components is per-tag. The recipient's `profile_settings` tag is invalidated when the recipient toggles. But the FOLLOWER's request — which is the one calling `logNotification(recipientId, ...)` — never had that tag in its cache key, so its read of `profile_settings.notify_on_follow` may have been cached at follow-time on a DIFFERENT user's request and is being shared.

**How to avoid:**
- `logNotification` MUST read `profile_settings` with `cache: 'no-store'` or directly via Drizzle (no `'use cache'` wrapper) — opt-out reads must be live-from-DB.
- Verify in code review: any DAL function that reads opt-out settings is NOT inside a `'use cache'` block.
- Test: create user A; user B follows A; A toggles `notifyOnFollow` OFF; B unfollows then refollows immediately. Assert: at most 1 notification row exists (from the first follow, before opt-out). The second follow must NOT generate a notification.
- Alternative: read opt-out at the END of `logNotification` (right before the INSERT), with `await db.select().from(profileSettings)...` — shortest possible window between read and write.

**Warning signs:**
- `logNotification` source uses `'use cache'` or imports a DAL function that does.
- Test scenario "user toggled off after follow chain started" not in the test suite.
- Sentry / logs show notifications firing for opted-out users.

**Phase to address:** Phase 7 of v4.0 (Settings Notifications + Notification Stub Cleanup).

---

### Pitfall 16: Empty-State CTAs Link to Routes That Require ANTHROPIC_API_KEY in Local Dev — Personal-MVP Onboarding Friction 🆕

**What goes wrong:**
Empty-state CTAs are explicitly in scope. "Add your first watch" is the obvious primary CTA on an empty collection page. Today's "Add Watch" flow funnels through `/add` which uses URL-extract → which calls `/api/extract-watch` → which (in the LLM stage) requires `ANTHROPIC_API_KEY`. If a developer runs locally without the key set (which the `.env.example` documents but doesn't enforce), the CTA navigates to a page that errors out at the LLM stage.

Also: "Evaluate this watch" CTAs from various surfaces (profile, /explore, post-add) ALL converge on `/evaluate` which has the same dependency.

**Why it happens:**
The 3-stage extraction pipeline (structured data → HTML selectors → LLM fallback) gracefully degrades if the LLM stage is gated, but only if the gate is *explicit*. A missing env var produces an HTTP 500 from `/api/extract-watch` if the early stages didn't yield a result. Empty-state CTAs that assume the happy path break in dev.

**How to avoid:**
- Audit every empty-state CTA for its dependency chain. Document it in the phase plan:
  | CTA | Target route | Dependencies | Fallback |
  |---|---|---|---|
  | "Add your first watch" | /add | ANTHROPIC_API_KEY (LLM stage) | "Add manually" link visible if URL-extract errors |
  | "Evaluate any watch" | /evaluate | ANTHROPIC_API_KEY | "Demo with example URL" |
  | "Browse other collectors" | /explore | none | n/a |
- Add a friendlier error to `/api/extract-watch` when `ANTHROPIC_API_KEY` is unset: return 503 with `code: 'extract_unavailable'` and the page renders "URL extraction is not configured. Use manual add."
- Provide an "Add manually" affordance on the empty-state itself (parallel to the extract CTA), so the user has a non-LLM path.
- Test the empty-state interactions with `ANTHROPIC_API_KEY` UNSET (set up a CI job that explicitly clears the env var).

**Warning signs:**
- Empty-state copy promises "fast" or "instant" extraction.
- CTAs link to /add or /evaluate with no fallback.
- `.env.example` lists the key but no test asserts the unset behavior is graceful.
- Local developer reports "I cleared my .env to test something and now /add is broken."

**Phase to address:** Phase 13 of v4.0 (Empty-State CTAs).

---

### Pitfall 17: /search Watches GIN Index Plan Doesn't Get Selected — pg_trgm Bitmap Scan Falls to Seq Scan at Tiny Tables 🆕 ♻️

**What goes wrong:**
Phase 16 already has this lesson: at <127 rows, the planner picks Seq Scan over GIN+pg_trgm Bitmap Index Scan because the planner's cost model thinks Seq Scan is cheaper at tiny scale. /search Watches against `watches_catalog` will start with <100 rows in v4.0; the GIN index will not be reached. Local EXPLAIN shows Seq Scan; developer thinks "the index is broken" and starts retro-fitting.

In production, as the catalog grows past ~150 rows, the plan flips to Bitmap Index Scan automatically. The "broken" index was working — the test scale was just below the threshold.

**Why it happens:**
Postgres's cost-based planner is correct: scanning 100 rows is faster than building a bitmap from a GIN tree. This is a feature, not a bug, but it's repeatedly misread as a bug by developers used to "indexes always win."

**How to avoid:**
- The Phase 16 verification pattern: forced-plan EXPLAIN ANALYZE with `SET enable_seqscan = OFF;` to prove the index is REACHABLE, regardless of whether the planner chooses it at current scale.
  ```sql
  SET enable_seqscan = OFF;
  EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM watches_catalog WHERE brand ILIKE '%rolex%';
  -- Expect: "Bitmap Index Scan on watches_catalog_brand_trgm_idx"
  ```
- Document the result in the phase plan as `XX-VERIFICATION.md` (mirror Phase 16's evidence file).
- Don't try to "force" the planner with HINT comments at low scale — the planner is right. The index lights up automatically at scale.
- Add a benchmark test that seeds 200+ catalog rows and asserts the production plan IS `Bitmap Index Scan`.

**Warning signs:**
- Code review questions "is the GIN index even being used?"
- Phase plan adds `BTREE` indexes "just in case" (extra write cost, no read benefit).
- Verification step missing or only shows Seq Scan plan with no analysis.
- Search latency is fine in local (sub-50ms on tiny data); fine in prod (sub-50ms on bitmap scan); panic between.

**Phase to address:** Phase 5 of v4.0 (/search Watches Tab) — adopt the Phase 16 verification pattern verbatim.

---

### Pitfall 18: WatchForm `isChronometer` Toggle Lands But Catalog Field Drift — Per-User and Catalog Disagree 🆕

**What goes wrong:**
`isChronometer` exists today on `watches` (per-user). v4.0 also adds it to `watches_catalog` (canonical). User adds a watch with `isChronometer=true`; the user-promoted catalog row is created with `is_chronometer=true`. Later, ANOTHER user adds the same watch (matched by natural key) with `isChronometer=false` (mistake or different sub-reference). The existing catalog row is not updated (`ON CONFLICT DO NOTHING` for user-promoted path, see Pitfall 2). The catalog says TRUE; the new user's per-user `watches` row says FALSE. /search Watches displays "Chronometer ✓" via catalog; the user's own collection card says FALSE. Inconsistency.

**Why it happens:**
Two sources of truth (catalog + per-user) for the same field, no sync direction defined. Same problem affects `caseSizeMm`, `lugToLugMm`, `productionYearStart`, etc.

**How to avoid:**
- Define ONE source of truth per field. Recommendation: catalog is authoritative for SPEC fields (size, movement, water resistance, isChronometer); per-user `watches` is authoritative for OWNERSHIP/PROVENANCE fields (status, pricePaid, acquisitionDate, notes, condition).
- For spec fields on per-user watches: either (a) drop them from `watches` in v5.0 (read from catalog via JOIN), or (b) treat them as a per-user OVERRIDE that only exists if explicitly set, with the catalog as default. v4.0 should not yet drop columns — defer to v5.0.
- Display rule: WatchDetail shows catalog spec by default; if the user has overridden a field on their per-user row, show "(your value)" badge and the user's value.
- Alternative simpler rule for v4.0: catalog is purely advisory; the user's `watches` row is what shows in their collection. /search and /explore use catalog. No cross-display.

**Warning signs:**
- Phase plan adds isChronometer to BOTH tables without a "source of truth" decision.
- WatchDetail tries to read both and reconcile in JSX (sign of muddled ownership).
- /search Watches shows different specs than the user's own collection view of the same model.

**Phase to address:** Phase 1 (Catalog Schema) — make the source-of-truth decision before column duplication ships.

---

### Pitfall 19: `wear_events.watchId` Cascade-Deletes Block Watch Deletion — Catalog Refactor Tempts ON DELETE SET NULL ♻️

**What goes wrong:**
`wear_events.watch_id` references `watches.id` with `ON DELETE CASCADE` (deleting a watch deletes its wear history). `activities.watch_id` references with `ON DELETE SET NULL` (activity feed survives). The v4.0 migration for catalog might tempt the engineer to "harmonize" these to all be `SET NULL` — but `wear_events` cascade is INTENTIONAL because a wear event without a watch is meaningless on the user's profile (it would render as "User wore [unknown] on April 5"). Changing to SET NULL produces zombie wear events.

A second variant: the catalog phase adds `ON DELETE SET NULL` for `watches.catalog_id`, which is correct. But code review might not catch a copy-paste mistake that changes `watches.user_id`'s `ON DELETE CASCADE` to SET NULL — making user-deleted accounts leave orphan watches.

**Why it happens:**
ON DELETE policies are easy to harmonize accidentally during a refactor. Each policy is a deliberate product decision, not a stylistic choice.

**How to avoid:**
- Document the ON DELETE policy for every FK in `src/db/schema.ts` with a comment explaining WHY:
  ```typescript
  watchId: uuid('watch_id').notNull().references(() => watches.id, {
    onDelete: 'cascade'  // wear events without a watch are meaningless; cascade matches user expectation when they delete a watch
  }),
  ```
- Migration review checklist: any change to ON DELETE behavior requires explicit explanation in the phase plan.
- `catalog_id ON DELETE SET NULL`: correct (catalog merge/delete shouldn't blow up user collections).
- Test fixture: delete a watch with wear events + activities + catalog link → assert wear events GONE, activities ORPHANED with NULL watchId, catalog row UNTOUCHED.

**Warning signs:**
- Phase plan migration changes ON DELETE on existing FKs (vs only adding new ones).
- Code review skips the ON DELETE comments because "they're just FK details."
- After v4.0 ships, deleted watches leave orphan wear events on a user's profile.

**Phase to address:** Phase 1 (Catalog Schema) — explicit ON DELETE policy review.

---

## Medium Pitfalls

### Pitfall 20: Sonner Toast Persists Across `revalidateTag('max')` But Theme Change Mid-Toast Loses Theming 🔁

**What goes wrong:**
Sonner is bound to the custom ThemeProvider (Phase 15 D-15). A Server Action that fires `revalidateTag(...)` triggers a render of subtree components, and the ThemedToaster wrapper re-mounts. Active toasts at the moment of the revalidation can flash to the wrong theme briefly OR (worse) show a Provider undefined error if the re-mount races the Sonner toast's own theme listener.

**Why it happens:**
Phase 15 verified Sonner-to-ThemeProvider binding works. Phase 13 verified `revalidateTag` for cross-user fan-out works. The combination — toast from Server Action that also revalidates — wasn't a Phase 15 test scenario.

**How to avoid:**
- ThemedToaster lives at the layout level OUTSIDE any Suspense that revalidates per-action. Make sure the ThemeProvider wraps the entire app (it should, per Phase 15) and the toaster is inside the provider but outside any subtree that revalidates.
- Test scenario: trigger a Server Action that calls `toast.success(...)` AND `revalidateTag(...)` in the same handler; verify the toast theme matches the (possibly newly toggled) theme without flashing.

**Warning signs:**
- Sonner toast appears in light mode briefly when the user is in dark mode.
- Console error: "Cannot read theme from undefined provider" during a revalidation.

**Phase to address:** Phase 14 of v4.0 (Form Polish).

---

### Pitfall 21: Search-Box Debounce + AbortController Leak State Across /search Tabs 🆕 ♻️

**What goes wrong:**
Phase 16's `useSearchState` hook (250ms debounce + AbortController + URL sync) was scoped to the People tab. v4.0 adds Watches and Collections tabs, all sharing the same search box. If the user types "Rolex", switches from People to Watches mid-keystroke, the People AbortController fires its abort, but the Watches request kicks off with the latest input. If the abort signal isn't propagated to the new tab's fetch, two in-flight requests race; the slower one's response paints LAST, even if the user has already typed "Rolex Submariner".

**Why it happens:**
Tab-switching changes the active fetcher but the URL search param (`?q=...`) persists. The hook's debounce timer resets on tab switch but the abort controller is per-fetch, not per-tab.

**How to avoid:**
- One AbortController PER (tab, query) pair. On tab switch: abort the previous tab's controller; fire a fresh fetch for the new tab.
- Alternatively: derive results client-side from a SINGLE query response that includes all four (All / Watches / People / Collections) result types, capped at 5 each. Tab switching becomes a render-only filter, no extra fetches. Trade-off: bigger initial response payload (~5kB max), but simpler state.
- Test: rapid typing + tab-switch combinations. Use `react-testing-library` async utilities to assert no stale results paint.

**Warning signs:**
- Switching tabs while typing produces results from the previous tab briefly.
- Network panel shows two concurrent in-flight `/api/search?...` requests.

**Phase to address:** Phase 5 of v4.0 (/search Watches + Collections Tabs).

---

### Pitfall 22: Email Change Confirmation Link Routes to /auth/confirm — Existing Handler Doesn't Distinguish `email_change` Type 🆕

**What goes wrong:**
The `/auth/confirm` route handler shipped in v1.0 handles `type=signup`. v4.0 needs it to also handle `type=email_change` (and existing `type=recovery`, `type=magiclink`). The naive extension adds a switch on `type` but forgets that `email_change` uses a DIFFERENT verifyOtp signature OR that the redirect target is different (post-confirm should go to `/settings/account?status=email_changed`, not `/dashboard`).

**Why it happens:**
The Supabase `verifyOtp({ type, token_hash })` signature is uniform across types (good — single switch). But the post-success UX differs per type, and copy-paste from the signup branch produces a wrong-destination redirect for email_change.

**How to avoid:**
- Explicit switch with a redirect map:
  ```typescript
  const redirectMap: Record<EmailOtpType, string> = {
    signup: '/dashboard',
    recovery: '/settings/account?status=password_reset_initiated',
    email_change: '/settings/account?status=email_changed',
    magiclink: '/dashboard',
    invite: '/dashboard',
  }
  ```
- Test each type end-to-end: signup confirmation, email change, password reset.
- Verify the email template's `{{ .ConfirmationURL }}` includes the correct `type=` param.

**Warning signs:**
- Single-branch handler (`if (type !== 'signup')` etc.) — incomplete coverage.
- Redirect after email_change goes to /dashboard, not /settings/account.
- No integration test for email_change confirmation flow.

**Phase to address:** Phase 6 (Settings Account section) — extend the confirm handler in the same phase as the Settings work.

---

### Pitfall 23: Catalog Backfill Locks `watches` Table — Long-Running UPDATE Blocks Concurrent User Writes 🆕

**What goes wrong:**
The backfill script runs `UPDATE watches SET catalog_id = $1 WHERE id = $2` for every watch. At low scale (Horlo's ~few hundred watches today) this is sub-second. As the user base grows pre-v5.0, the backfill could lock rows that a user is concurrently editing. The user's "save edits" Server Action waits for the lock; UI shows "Saving..." spinner indefinitely.

The bigger risk: running the backfill against PROD in a single transaction that wraps the entire script (millions of row locks) instead of per-batch transactions. If the script halts midway, the next attempt re-locks; combined with autovacuum issues this can produce sustained latency for user writes.

**Why it happens:**
Drizzle's `db.transaction(...)` wrapper around the batch loop is tempting because it reads cleanly. At the wrong granularity it's a footgun.

**How to avoid:**
- Per-BATCH transactions (commit every 100 rows), NOT a single transaction wrapping the whole backfill.
- Run during low-traffic window (Horlo is single-user-MVP today; this is moot for now but noted for v5.0+).
- Backfill uses `UPDATE ... WHERE id = $1 AND catalog_id IS NULL` so it's idempotent on resume.
- Don't call `VACUUM FULL` after — `VACUUM FULL` takes an exclusive lock; ordinary autovacuum is fine.

**Warning signs:**
- Backfill script wraps `for (const batch of batches)` in `db.transaction(...)` (single transaction).
- No batch-commit frequency documented.
- Phase plan suggests pausing user writes (capacity issue, not v4.0 scale problem).

**Phase to address:** Phase 1 (Catalog Schema + Backfill).

---

### Pitfall 24: `notesPublic` Per-Note Visibility — Owner Edit UI Saves But Cross-User View Doesn't Refresh ♻️

**What goes wrong:**
The `notesPublic` column already exists per-watch. v4.0 exposes the OWNER edit toggle. User A flips notes from public→private. User B viewing A's profile does NOT see the change for up to 30s because B's view is cached at `viewer:` tag with `cacheLife({revalidate:30})`. This is correct cache behavior but UX-confusing — and in the WORST case, the SWR revalidation is to the OLD (public) value if the cache hadn't expired.

**Why it happens:**
Phase 13's `revalidateTag('max')` pattern is for cross-user reads. The notesPublic toggle changes need to fan out to ALL viewers' caches, not just the owner's.

**How to avoid:**
- The Server Action that toggles `notesPublic` MUST `revalidateTag(\`watches:user:${userId}\`)` and ANY higher-fan-out tag (e.g., a global `notes:public` tag if /search Notes ever materializes — out of scope for v4.0).
- Document that "private" takes effect within 30s for cross-user viewers; "public" is immediate (cache miss → fresh read).
- Owner sees the change immediately via `updateTag()`.
- Reference Phase 13's read-your-own-writes vs SWR fan-out distinction.

**Warning signs:**
- The Server Action only `updateTag`s the owner's tag.
- Test: User A toggles private; User B reload immediately sees public note.

**Phase to address:** Phase 7 (Settings Notifications + notesPublic).

---

### Pitfall 25: /evaluate Anonymous Path Skipped — Page Hard-Redirects Without Considering Marketing Intent 🆕

**What goes wrong:**
The /evaluate page is genuinely useful as a marketing demo: "paste any watch URL, see how it'd fit a sample collection." Hard-redirecting unauthenticated users to /signin makes /evaluate inaccessible to demo links shared with prospective users. v4.0 milestone scope says "Evaluate this watch flow" — does it include the unauthenticated demo case?

**Why it happens:**
The Cache Components / auth pattern naturally guides toward "auth required, redirect on miss" (per Pitfall 5). The marketing-demo case requires a deliberate decision.

**How to avoid:**
- Decide explicitly in phase plan: is /evaluate auth-only or marketing-also?
- If marketing-also: anonymous users see a sample collection (e.g., a curated "popular collector" demo profile) instead of redirecting. Verdict still computes; uses the demo collection + default preferences.
- If auth-only: redirect, but log a metric (`/evaluate?next=...` referrer) so we know how many anonymous users would have used it.
- Recommendation for v4.0: auth-only, redirect to signin. Marketing case is v5.0+ scope.

**Warning signs:**
- Phase plan doesn't explicitly handle the unauthenticated path.
- Acceptance criteria says "user evaluates a watch" without specifying signed-in vs anonymous.

**Phase to address:** Phase 4 ("Evaluate this Watch") — decision in phase plan, not in implementation.

---

### Pitfall 26: Drizzle vs Supabase Migration Drift — Schema Type Diverges from RLS Policy Definition 🆕 ♻️

**What goes wrong:**
MEMORY rule: drizzle-kit push is LOCAL ONLY; prod uses `supabase db push --linked`. v4.0 has TWO migration tracks (Drizzle for shapes, raw SQL for RLS/CHECK/partial indexes). If the Drizzle column shape ships to prod (via supabase db push including drizzle output) but the companion raw-SQL RLS file is ACCIDENTALLY skipped (e.g., not added to the `supabase/migrations/` directory), prod has the column but no policy → table is invisible to non-service-role.

Worse: if the RLS file is ADDED to a Drizzle migration directory by mistake, drizzle-kit's introspection won't recognize the policy DSL and will plan a diff that DROPS the policy on the next push.

**Why it happens:**
Two migration tools, one DB, no cross-validation. The split is intentional (Drizzle can't express partial indexes / RLS) but error-prone.

**How to avoid:**
- Pre-deploy checklist for every migration phase:
  1. ✅ Drizzle migration in `drizzle/` directory (column shapes).
  2. ✅ Companion raw SQL migration in `supabase/migrations/` (RLS, CHECK, partial indexes, triggers).
  3. ✅ Both files are referenced in the phase plan migration section.
  4. ✅ `npm run db:reset` (which runs `supabase db reset` + `drizzle push` + applies supabase migrations) succeeds locally.
  5. ✅ Prod deploy runs `supabase db push --linked --include-all` — verify the supabase migrations file is in the diff list.
- See MEMORY: project_local_db_reset.md for the local reset workflow gotcha.
- Add a CI check: any new `pgTable` in `src/db/schema.ts` must have a matching `ALTER TABLE … ENABLE ROW LEVEL SECURITY` line in some `supabase/migrations/*.sql` file.

**Warning signs:**
- Phase plan migration section says "add table X" without mentioning the RLS file.
- `supabase db push --linked --dry-run` shows policy drops you didn't write.
- Local works, staging works, prod table is empty for non-service-role.

**Phase to address:** Phase 1 (Catalog Schema) — establish the dual-migration pattern as a phase template for the milestone.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Skip catalog normalization (`brand_normalized` generated columns) | Faster initial migration | Casing duplicates accumulate; deduplication script required later | Never — solve at v4.0 ship |
| Use `ON CONFLICT DO NOTHING` for all catalog inserts (vs. enrich path) | Simpler code | URL-extracted spec sheets discarded; catalog stays low-quality forever | Only for `user_promoted` source; never for `url_extracted` |
| Defer pg_cron setup; computed counts on-the-fly | Skip the cron config phase | /explore queries become 200ms+ at scale; user-facing latency | When catalog <50 rows total |
| Trigger-based `owners_count` instead of cron | "Real-time" trending | Write amplification; lock contention on hot watches | Never at v4.0 scale; reconsider at 100k+ catalog rows |
| Skip the email-change "pending" UI state | Faster Settings ship | User confusion when confirmation lapses; support burden | Never — pending state is the safety net |
| Skip Suspense around `/evaluate` data fetch | Cleaner page code | Build fails on Vercel | Never with cacheComponents:true |
| Single AbortController across /search tabs | Less hook complexity | Stale results paint on rapid tab switch | Acceptable in v4.0 if guarded by tab-key dependency in useEffect |
| One-shot backfill (no batching) | Simpler script | Lock contention on prod, no idempotent resume | Only at <500 rows total — skip batching only for v4.0 personal-MVP scale |
| Combine schema + backfill + SET NOT NULL in one migration | "Atomic" feel | Half-completion is unrecoverable; cannot resume | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| Resend SMTP | Flip Supabase config before DKIM verifies | Wait for "Verified ✓" + send self-test email FIRST |
| Resend rate limits | Run integration tests with real SMTP credentials | Stub email send in tests via `RESEND_DISABLE_FOR_TESTS` env |
| Supabase Auth `updateUser({email})` | Treat response `data.user.email` as confirmed | Read `user.new_email` to detect pending state |
| Supabase Auth confirm handler | Single switch case for `type=signup`; missing `email_change` | Map all four EmailOtpType values with redirect targets |
| pg_cron in Supabase | Assume scheduled job runs locally | Document local manual invocation; cron is prod-only |
| Drizzle pgEnum updates | Update schema.ts before SQL migration ships | SQL migration first → wait for prod push → then schema.ts |
| Drizzle migration + Supabase RLS | Forget the raw-SQL companion migration file | Mandate both files reviewed in same PR |
| Vercel + DNS for Resend | Add records in Vercel dashboard (DNS not Vercel-managed) | Records go in registrar / authoritative DNS host |
| Anthropic API key in CTAs | Assume key is set; CTAs assume happy path | Provide `Add manually` / `Demo URL` fallback affordances |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Per-row catalog count via `COUNT(*) GROUP BY` on /explore | /explore loads >500ms | Denormalize `owners_count` + `wishlist_count` updated nightly | At >500 catalog rows or >5 concurrent /explore views |
| /search Watches GIN plan unreachable at tiny tables | Latency seems fine but verification confused | `SET enable_seqscan = OFF` proof + scale benchmark | Misleading at <127 rows; resolves automatically at scale |
| Trigger-based `owners_count` write amplification | INSERT latency 2–5× normal; lock waits | Cron-based batch update | At >10 concurrent watch adds |
| /search Collections N+1 on overlap badges | Search latency scales linearly with row count | One in-memory join after pre-fetching viewer collection | At ≥10 result rows |
| Backfill in single transaction | Other writes wait; transaction log balloons | Per-batch transactions, 100 rows each | At >1000 rows or any concurrent writes |
| /evaluate page renders without Suspense around data fetch | Build fails before perf is even measurable | Canonical Suspense + Server Component pattern | Always with cacheComponents:true |
| Notification opt-out read inside `'use cache'` | Stale opt-out → spam | `cache: 'no-store'` for opt-out reads | Whenever the recipient toggles after the actor's request started |

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| `watches_catalog` ENABLE ROW LEVEL SECURITY forgotten | Anon users see empty catalog (availability issue, not leak) | Mandatory companion RLS migration file |
| `watches_catalog` policy uses `USING (true)` for INSERT/UPDATE | Anon users could write catalog rows directly via JS SDK | Only SELECT policy `USING (true)`; writes via Server Action service role |
| /search Collections gates `profile_public` only; misses `collection_public` | Private collection content leaks via search | Three-layer predicate (profile_public AND collection_public AND viewer ≠ self) |
| Email-change UI shows new email as "Current" before confirmation | Misleads user; if they leave the tab, they think it changed | Pending state explicitly distinguished from confirmed state |
| `verifyOtp` not validating type matches expected handler context | Confirmed-recovery path could be reused for email_change reuse | Explicit switch on `type` with allowlist |
| Resend SMTP creds committed to .env.local checked into branch | Deliverability hijack | `.gitignore` enforced; rotate creds if leaked |
| Drizzle migration ships without companion supabase RLS file | New table accessible to unintended principals OR invisible | Mandate both files in same PR |
| Backfill script runs as service_role indefinitely on prod | Long-running superuser session | Run from local machine with explicit timeout; never schedule on prod cron |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| BottomNav slot reshuffle | Muscle memory broken; users tap wrong icon for days | Avatar in TopNav; BottomNav 5 slots stable |
| Email-change toast says "Updated" before link click | User confused why old email still works | Toast says "Confirmation sent — check both inboxes" |
| /evaluate hard-redirects unauthenticated users with no marketing path | Demo-link share workflow broken | Decide auth-only vs marketing demo upfront |
| Empty-state CTA links to /add which silently 500s on missing key | User stuck; no fallback | Provide "Add manually" affordance alongside URL extract |
| Notification toggle UI reflects optimistic state | Genuine vs persisted state confusion if Server Action fails | Show "Saving..." inline indicator; revert on error |
| Search box debounce + tab-switch produces stale results | Wrong results paint after typing more | One AbortController per (tab, query); cancel on tab switch |
| WYWT auto-nav lands on /wear/[id] before storage CDN propagates | Black image / loading flicker | Suspense + skeleton on /wear/[id] photo render |
| Sonner toast theme flash during revalidation | Visual noise | Toaster outside revalidating Suspense subtree |
| Catalog typo creates duplicate "trending" entries | Same model appears twice in /explore | Normalize at server boundary; display original |

## "Looks Done But Isn't" Checklist

- [ ] **`watches_catalog` table:** Often missing the companion RLS migration — verify `ENABLE ROW LEVEL SECURITY` + SELECT policy in `supabase/migrations/`.
- [ ] **Catalog UNIQUE constraint:** Often missing `NULLS NOT DISTINCT` — verify either explicit raw-SQL `NULLS NOT DISTINCT` OR `COALESCE(reference, '')` fallback.
- [ ] **Catalog backfill:** Often missing the post-run `WHERE catalog_id IS NULL` count assertion — verify zero unlinked rows.
- [ ] **Catalog normalization:** Often missing `brand_normalized` / `model_normalized` generated columns — verify casing test scenarios.
- [ ] **/evaluate page:** Often missing Suspense around the data fetch — verify `next build` runs successfully.
- [ ] **/search Collections:** Often missing `collection_public` gate — verify three-layer privacy test (profile_public ∧ collection_public ∧ viewer self-exclusion).
- [ ] **/search anti-N+1:** Often missing batched fetch for overlap badges — verify integration test with 50-row fixture.
- [ ] **Resend custom SMTP:** Often shipped before DKIM verifies — verify Resend dashboard "Verified ✓" + Supabase test email lands in inbox NOT spam.
- [ ] **Email change confirm:** Often missing `type=email_change` handler in `/auth/confirm` — verify all four EmailOtpType branches.
- [ ] **Email change UI:** Often shows new email immediately — verify "pending" state with `user.new_email` field.
- [ ] **Notification enum drop:** Often uses `ALTER TYPE … DROP VALUE` (which doesn't exist) — verify rename + recreate pattern + zero-row pre-check.
- [ ] **pg_cron `owners_count`:** Often missing schedule registration in `cron.job` — verify `SELECT * FROM cron.job` shows the job in prod.
- [ ] **BottomNav refactor:** Often replaces a slot without updating `PUBLIC_PATHS` or muscle-memory comm — verify Phase 14 nav pattern docs updated.
- [ ] **WYWT auto-nav:** Often races storage CDN — verify `<Suspense>` on /wear/[id] photo render.
- [ ] **Notification opt-out:** Often reads opt-out inside `'use cache'` — verify `cache: 'no-store'` on the opt-out branch.
- [ ] **Catalog ON DELETE policies:** Often harmonized accidentally — verify each FK's policy commented with rationale.
- [ ] **Drizzle migration vs RLS:** Often missing companion SQL file — verify PR has BOTH files.
- [ ] **Empty-state CTAs:** Often link to /add or /evaluate without LLM-key fallback — verify "Add manually" affordance exists.
- [ ] **Search across tabs:** Often shares one AbortController — verify per-(tab, query) cancellation logic.
- [ ] **isChronometer source of truth:** Often duplicated without sync rule — verify catalog-vs-watches policy is documented.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Catalog backfill half-completed (some rows NULL `catalog_id`) | LOW | Re-run backfill script; idempotent with `WHERE catalog_id IS NULL`. Identify NULL-remaining rows for manual review. |
| Catalog enrichment lost via `DO NOTHING` | MEDIUM | One-off script: re-fetch the LLM extraction for the affected URLs; UPDATE catalog rows with COALESCE pattern. |
| Casing duplicates in catalog | MEDIUM | Manual merge script: pick canonical row per `(brand_normalized, model_normalized, reference_normalized)`; UPDATE `watches.catalog_id` to the canonical; DELETE the duplicates. |
| `watches_catalog` RLS missing → empty for anon | LOW | One-line SQL migration: `CREATE POLICY watches_catalog_select_all ON watches_catalog FOR SELECT USING (true)`. |
| `cookies()` in /evaluate breaks build | LOW | Wrap in Suspense pattern; redeploy. |
| /search Collections leaks private collections | HIGH | Hotfix: deploy patched DAL gate + invalidate all viewer caches. Audit logs for any cross-user reads during the leak window. |
| Resend not verified at flip time → confirmation emails fail | MEDIUM | Backout: revert Supabase SMTP config to hosted (2/h cap); manually create blocked users in Supabase Dashboard. |
| Resend free-tier daily cap hit | MEDIUM | Upgrade to paid ($20/mo for 50k/mo); apologize to blocked users; reset cycle 24h later. |
| Email-change UI lied → user thinks email changed but didn't | LOW | Add pending banner; manually nudge user via support to click confirmation link. |
| ALTER TYPE DROP VALUE migration aborted | MEDIUM | Switch to rename + recreate pattern; assert zero rows of the dead values first. |
| Pg_cron not scheduled in prod → counts stale | LOW | One-shot: `SELECT cron.schedule(...)` via Supabase Dashboard SQL editor. |
| BottomNav slot reshuffle causes user reports | MEDIUM | Revert to 5-stable-slot layout; profile in TopNav avatar. |
| WYWT auto-nav 404 race | LOW | Add Suspense + skeleton; retry on user side resolves. |
| Notification opt-out spam after toggle | LOW | Patch `logNotification` to read `cache: 'no-store'`; backfill: no-op (false positives can't be unsent but rate is tiny). |
| `wear_events` cascade-delete misconfigured | HIGH | If accidentally `SET NULL`, manually clean up zombie rows; restore `CASCADE` in next migration. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| 1: Catalog half-backfill + premature SET NOT NULL | Phase 1 (Catalog Schema + Backfill) | Three separate migration files; final assertion `WHERE catalog_id IS NULL = 0`; `catalog_id` stays NULLABLE in v4.0 |
| 2: `ON CONFLICT DO NOTHING` discards enrichment | Phase 1 | Two separate upsert helpers; integration test asserts spec enrichment from URL extract |
| 3: Casing duplicates in catalog | Phase 1 | Generated columns in initial schema; test with mixed-casing fixtures |
| 4: `watches_catalog` RLS missing | Phase 1 | Companion `supabase/migrations/*.sql` file in same PR; anon-connection regression test |
| 5: `cookies()` outside Suspense in /evaluate | Phase 4 (/evaluate route) | `next build` step in CI; canonical Suspense pattern from Phase 11–14 |
| 6: /search Collections privacy two-layer drift | Phase 5 (/search Watches + Collections) | Three-layer fixture test (profile_public ∧ collection_public ∧ viewer ≠ self) |
| 7: /search Collections N+1 | Phase 5 | Integration test asserts ≤2 DB queries per 50-row search |
| 8: Email-change UI lies | Phase 6 (Settings Account) | "Pending" state distinguished from "confirmed"; reads `user.new_email` |
| 9: SMTP flip before DKIM verified | Phase 9 (Custom SMTP) | Mandatory ordered checklist with evidence; no "Confirm email ON" in same commit as creds |
| 10: ALTER TYPE DROP VALUE non-existent | Phase 8 (Notification Stub Cleanup) | Pre-flight zero-row count + rename-recreate pattern |
| 11: pg_cron not local + trigger write amplification | Phase 1 (schema) + Phase 3 (/explore activation) | Cron registered in prod; trigger explicitly forbidden |
| 12: BottomNav muscle memory | Phase 11 (Profile Nav Prominence) | 5-slot decision locked in phase plan; Profile in TopNav avatar |
| 13: WYWT auto-nav races storage | Phase 12 (WYWT Auto-Nav) | Suspense on /wear/[id]; toast + push ordering inside transition |
| 14: Resend free-tier burned | Phase 9 (Custom SMTP) | Local stub via env var; non-prod Resend domain for staging |
| 15: Notification opt-out stale cache | Phase 7 (Settings Notifications + notesPublic) | `cache: 'no-store'` on opt-out reads; integration test for toggle race |
| 16: Empty-state CTAs broken without ANTHROPIC_API_KEY | Phase 13 (Empty-State CTAs) | "Add manually" affordance; CI test with key UNSET |
| 17: GIN plan unreachable at tiny tables | Phase 5 (/search) | Forced-plan EXPLAIN ANALYZE evidence file |
| 18: isChronometer source of truth drift | Phase 1 (Catalog Schema) | Source-of-truth doc in PROJECT.md Key Decisions |
| 19: ON DELETE policy harmonization | Phase 1 (Catalog Schema) | Comments on every FK; explicit review checklist |
| 20: Sonner toast revalidation interaction | Phase 14 (Form Polish) | ThemedToaster outside Suspense; integration test |
| 21: Search debounce/AbortController across tabs | Phase 5 (/search) | Per-(tab, query) AbortController; rapid-tab-switch test |
| 22: /auth/confirm missing email_change branch | Phase 6 (Settings Account) | All four EmailOtpType branches covered + e2e test |
| 23: Backfill table locks user writes | Phase 1 (Catalog Schema + Backfill) | Per-batch transactions; not single-tx |
| 24: notesPublic cross-user cache stale | Phase 7 (Settings + notesPublic) | `revalidateTag('max')` fan-out + 30s staleness documented |
| 25: /evaluate anonymous path decision | Phase 4 (/evaluate route) | Phase plan explicitly handles unauth path; redirect to /signin documented |
| 26: Drizzle vs Supabase migration drift | Phase 1 + every subsequent migration phase | Pre-deploy checklist; CI guard for table without RLS file |

---

## Summary by NEW vs KNOWN Pattern Reapplication

**🆕 NEW pitfalls v4.0 introduces (12):**
- Pitfalls 1, 2, 3, 4 (catalog schema family)
- Pitfall 8 (email change pending state)
- Pitfall 9 (SMTP DKIM ordering)
- Pitfall 10 (enum drop)
- Pitfall 11 (owners_count freshness model)
- Pitfall 12 (BottomNav muscle memory)
- Pitfall 14 (Resend rate cap)
- Pitfall 16 (empty-state CTA dependencies)
- Pitfall 18 (catalog source-of-truth)
- Pitfall 22 (email_change confirm handler)
- Pitfall 23 (backfill locking)
- Pitfall 25 (/evaluate anon decision)

**♻️ KNOWN patterns needing reapplication (8):**
- Pitfall 5 (Cache Components Suspense — Phase 11–14 lesson)
- Pitfall 6 (two-layer privacy — Phase 9 lesson on a new endpoint)
- Pitfall 7 (anti-N+1 — Phase 16 lesson on Collections variant)
- Pitfall 15 (notification opt-out cache — Phase 13 lesson)
- Pitfall 17 (pg_trgm planner threshold — Phase 11/16 lesson)
- Pitfall 19 (ON DELETE policy — schema-level discipline)
- Pitfall 24 (notesPublic cross-user fan-out — Phase 13 pattern)
- Pitfall 26 (Drizzle vs Supabase migration split — MEMORY)

**🔁 HYBRID — old pattern in new context (2):**
- Pitfall 13 (WYWT auto-nav races — Phase 15 storage flow + new auto-nav)
- Pitfall 20 (Sonner + revalidateTag interaction — Phase 13 + Phase 15 patterns colliding)

---

## Sources

**Catalog schema design + UNIQUE NULLS NOT DISTINCT:**
- [PostgreSQL CREATE TABLE — UNIQUE NULLS NOT DISTINCT](https://www.postgresql.org/docs/15/sql-createtable.html) (PG 15+ feature; Supabase is PG 15+)
- [Drizzle ORM uniqueIndex docs](https://orm.drizzle.team/docs/indexes-constraints) (does not emit NULLS NOT DISTINCT by default — must drop to raw SQL)
- [Cybertec — Practical examples of normalization in PostgreSQL](https://www.cybertec-postgresql.com/en/practical-examples-data-normalization-in-postgresql/)
- [Drizzle ORM Migrations in Production: Zero-Downtime Schema Changes](https://dev.to/whoffagents/drizzle-orm-migrations-in-production-zero-downtime-schema-changes-e71) (expand-contract pattern)

**Postgres ALTER TYPE constraints:**
- [PostgreSQL ALTER TYPE docs](https://www.postgresql.org/docs/current/sql-altertype.html) (no DROP VALUE; rename+recreate workaround)
- [Postgres mailing-list "DROP VALUE FROM ENUM"](https://www.postgresql.org/message-id/) (long-standing rejected request)

**Supabase Auth API:**
- [`supabase.auth.updateUser` reference](https://supabase.com/docs/reference/javascript/auth-updateuser) (response shape, `new_email` field for pending state)
- [Supabase Auth — Secure Email Change](https://supabase.com/docs/guides/auth/auth-email-passwordless) (two-link pattern)
- [Supabase Auth — verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp) (EmailOtpType union)
- [Custom SMTP rate-limit discussion (#16209)](https://github.com/orgs/supabase/discussions/16209)

**Resend / SMTP:**
- [Resend pricing (3000/mo, 100/day free)](https://resend.com/pricing)
- [Resend — Send with Supabase SMTP](https://resend.com/docs/send-with-supabase-smtp)
- [Resend domain verification (DKIM lag)](https://resend.com/docs/dashboard/domains/introduction)

**Cache Components / Suspense:**
- [Next.js — cacheComponents config](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- Project's own Phase 11–16 verification evidence files (`.planning/phases/11-VERIFICATION.md` etc.)

**pg_cron on Supabase:**
- [Supabase — pg_cron extension](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [pg_cron README](https://github.com/citusdata/pg_cron)

**RLS + Drizzle:**
- Project Phase 11 DEBT-02 audit migration (`supabase/migrations/20260423000005_phase11_debt02_audit.sql`)
- MEMORY: project_drizzle_supabase_db_mismatch.md
- MEMORY: project_local_db_reset.md
- MEMORY: project_supabase_secdef_grants.md

**Anti-N+1 / pg_trgm planner threshold:**
- Project Phase 16 verification evidence (`.planning/phases/16-VERIFICATION.md`) — forced-plan EXPLAIN ANALYZE pattern
- [PostgreSQL — Cost-based query planner](https://www.postgresql.org/docs/current/planner-stats.html)

**WYWT / Storage CDN:**
- [Supabase Storage signed URLs propagation](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- Project Phase 15 storage RLS migration

---

*Pitfalls research for: Horlo v4.0 Discovery & Polish*
*Researched: 2026-04-26*
