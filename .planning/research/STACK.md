---
dimension: stack
generated: 2026-04-26
milestone: v4.0 Discovery & Polish
---
# Stack Research — v4.0 Discovery & Polish

**Domain:** Canonical watch catalog, /explore + /search expansion, Settings expansion, Account management (email/password + custom SMTP), "Evaluate this watch" surface
**Researched:** 2026-04-26
**Confidence:** HIGH (Supabase Auth APIs, Drizzle migrations, Resend integration, Next.js routing primitives), MEDIUM (Resend free-tier rate-limit interaction with Supabase, vertical-tabs-vs-sidebar UX choice for Settings)

> This document covers ONLY what is new or changed for v4.0. The existing stack (Next.js 16 App Router with `cacheComponents: true`, React 19, TypeScript 5 strict, Supabase Auth + Postgres with project-wide RLS, Drizzle ORM 0.45.2, Tailwind 4, custom ThemeProvider, Sonner, heic2any, pg_trgm, `@base-ui/react`, `@anthropic-ai/sdk`) is validated in production through v3.0 and is not re-researched here.

---

## Summary

v4.0 requires **exactly one new npm package** — `resend@^4.0.0` — and that package is *optional* (only if we want to send transactional product emails like watch-overlap digests beyond Supabase Auth's confirmation/recovery/magic-link flow). For the Auth-email use case alone we don't even need to install Resend's SDK — Supabase consumes Resend over plain SMTP.

Everything else is schema work, route additions, and UI composition with libraries already in the tree:

| Need | Solution | New install? |
|---|---|---|
| Canonical `watches_catalog` table + FK from `watches` | Drizzle schema + raw-SQL migration with phased backfill | No |
| `/explore` discovery surface | Existing Server Components + DAL + `pg_trgm` (already enabled) | No |
| `/search` Watches tab | Server Component + DAL query against new `watches_catalog` + existing `pg_trgm` GIN indexes (mirror Phase 16 people-search pattern) | No |
| `/search` Collections tab | Server Component + DAL aggregating `watches` by `userId` with privacy gate | No |
| Custom SMTP for Supabase Auth (email confirm + recovery) | Resend native partner integration → SMTP creds copied into Supabase Dashboard | No npm install required for Auth-only path |
| Email change flow | `supabase.auth.updateUser({ email })` + new `/auth/confirm-email-change` route handler reusing `verifyOtp` PKCE pattern | No |
| Password change flow | `supabase.auth.updateUser({ password })` + Supabase "Secure password change" toggle (re-auth if session > 24h) | No |
| Settings page restructure | Sidebar pattern using `@base-ui/react` Tabs with `orientation="vertical"` on desktop, accordion fallback on mobile | No |
| "Evaluate this watch" flow | New `/evaluate` route reusing existing `/api/extract-watch` route handler + existing `analyzeSimilarity()` engine. Modal NOT recommended. | No |
| Profile nav avatar shortcut | Pure `DesktopTopNav` markup change | No |

```bash
# Optional — only if v4.0 ships product-team transactional emails
# beyond the Supabase Auth flow. Auth-only path needs ZERO new deps.
npm install resend
```

---

## Recommended Stack Additions

### resend (optional — Auth-only path needs zero installs)

| | |
|---|---|
| **Version** | `^4.0.0` (latest stable as of April 2026 — verify in Context7 / npm before install) |
| **Purpose** | Transactional email provider; SMTP creds wire into Supabase Auth, optional SDK for product emails |
| **Bundle** | Server-only — never imported into client bundles |
| **Integration point** | (a) Supabase Dashboard → Auth → SMTP (no code), (b) optional `src/lib/email/resend.ts` for product emails |

**Confidence:** HIGH — Resend has a first-party native partner integration with Supabase (one-click via Supabase Dashboard → Integrations) and Resend's docs include a dedicated Supabase SMTP guide.

#### Why Resend over Postmark / SendGrid

| | Resend | Postmark | SendGrid |
|---|---|---|---|
| Free tier | **3,000/mo, 100/day** | 100/mo total (no daily limit) | **Killed** May 27 2025 — 60-day trial only, then $19.95/mo |
| Supabase integration | Native partner, one-click in Supabase Dashboard | SMTP-only (manual) | SMTP-only (manual) |
| Vercel-friendliness | Built by ex-Vercel team; React Email native | Generic SMTP | Generic SMTP |
| Deliverability for password resets | Good | **Best in class** | Mixed |
| Domain verification | SPF + DKIM + (optional) DMARC TXT records | Same | Same |

**Decision:** Resend.

- 3,000/mo free is ~30× the headroom of Postmark's 100/mo and roughly matches our v4.0 scale (single-user → small private beta — peaks of dozens of confirmation/recovery emails per week, not hundreds).
- The native Supabase integration means we don't manually copy SMTP credentials; we OAuth Supabase ↔ Resend in the Resend dashboard and the SMTP credentials are pushed automatically.
- Same team / same DX as React Email (which we'd reach for if we ever templated overlap notifications), so adopting Resend now leaves the door open without forcing a re-platform later.
- SendGrid's permanent free tier was retired in May 2025 — using it now would mean immediate paid plan ($19.95/mo) for a personal-MVP with single-digit signups. Easy "no."
- Postmark's 100/mo is too tight: a single bug in a notification opt-in toggle could blow the cap in an afternoon. We'd survive, but it adds operational anxiety we don't need at this stage.

We are NOT adding the `resend` npm SDK in the v4.0 milestone unless a phase explicitly calls for product-side transactional emails (e.g. "watch-overlap digest"). The Auth-email path is **pure SMTP and pure Supabase Dashboard config — zero code changes**, zero new dependencies. If a later phase decides to send a product email, install `resend@^4.0.0` then.

#### DNS / SPF / DKIM Setup

Vercel hosts horlo.app — DNS is managed at the registrar, not Vercel. The integration requires three DNS records in the registrar (or wherever the authoritative zone for horlo.app lives):

```
TYPE  NAME                       VALUE                                   TTL
TXT   send.horlo.app             v=spf1 include:amazonses.com ~all       3600   (SPF)
TXT   resend._domainkey.horlo.app  <DKIM public key from Resend>         3600   (DKIM)
MX    send.horlo.app             feedback-smtp.<region>.amazonses.com    3600   (MX bounce / FBL)
```

DMARC is optional for v4.0 — Resend's domain verification only requires SPF + DKIM + the bounce MX. DMARC (`v=DMARC1; p=none; rua=mailto:dmarc@horlo.app`) can be added later in monitoring-only mode without breaking deliverability.

Once DNS propagates, click "Verify" in the Resend domain dashboard, then in Supabase Dashboard → Project Settings → Authentication → SMTP Settings:

```
Host:     smtp.resend.com
Port:     465  (TLS) — port 587 also works with STARTTLS
Username: resend
Password: <RESEND_API_KEY from Resend dashboard>
Sender:   noreply@horlo.app   (or whatever From address is verified)
```

Save. Custom SMTP is now active. Toggle "Confirm email" from OFF → ON in Supabase Dashboard → Auth → Providers → Email.

#### Supabase Rate-Limit Knob

Supabase applies a default rate limit of **30 emails/hour** the moment custom SMTP is configured. This is independent of Resend's 100/day free-tier cap. Adjustable in Supabase Dashboard → Auth → Rate Limits if a phase needs more headroom (e.g. a beta-launch email blast). For v4.0 personal-MVP scale, the default 30/h is plenty.

The **default 2/h Supabase-hosted rate limit (the one that has been blocking us)** is removed automatically the moment custom SMTP is saved — no separate toggle.

---

## Canonical Watch Catalog (`watches_catalog`) — Schema Work, No New Library

### Decision: Separate Table with Surrogate UUID PK + Optional FK from `watches.catalog_id`

**Reject:** polymorphic / single-table-inheritance designs. Polymorphism doesn't carry over well to SQL ([Cybertec analysis](https://www.cybertec-postgresql.com/en/conditional-foreign-keys-polymorphism-in-sql/)) — the alternatives (conditional foreign keys, type-discriminator columns, JSON-with-GIN) all introduce complexity that buys nothing for the watch domain. Watches and per-user `watches` rows have genuinely different lifecycles (catalog rows are shared and slowly-changing; per-user rows are ephemeral, tied to ownership status, and carry per-user metadata like `pricePaid`, `notes`, `acquisitionDate`, `lastWornDate`). They want to be different tables.

**Reject:** putting catalog-shared columns directly on `watches` and de-duping ad-hoc. This is the approach implied by the v2.0 key decision *"Per-user independent watch entries (no canonical watch table)"* — and it's exactly the decision v4.0 is reversing. We need cross-user identity (which Rolex Submariner does this user own?) to power /explore trending watches, /search Watches tab, and future taste-cluster visualization.

**Adopt:** classic e-commerce normalization — a `watches_catalog` master table holds the shared, slowly-changing "spec sheet" attributes; per-user `watches` rows reference it by FK and keep their per-user fields. This is the [standard product-catalog normalization pattern](https://catsy.com/blog/database-normalization/).

### Schema Sketch (illustrative — final shape decided in roadmap/requirements)

```typescript
// src/db/schema.ts (additions)

export const watchesCatalog = pgTable(
  'watches_catalog',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    // Natural-key trio for deduplication
    brand: text('brand').notNull(),
    model: text('model').notNull(),
    reference: text('reference'),        // nullable — many vintage pieces have none

    // Slowly-changing canonical spec sheet
    movement: text('movement', {
      enum: ['automatic', 'manual', 'quartz', 'spring-drive', 'other'],
    }),
    caseSizeMm: real('case_size_mm'),
    lugToLugMm: real('lug_to_lug_mm'),
    waterResistanceM: integer('water_resistance_m'),
    crystalType: text('crystal_type', {
      enum: ['sapphire', 'mineral', 'acrylic', 'hesalite', 'hardlex'],
    }),
    productionYearStart: integer('production_year_start'),
    productionYearEnd: integer('production_year_end'),
    isChronometer: boolean('is_chronometer'),

    // Tags — canonical defaults; per-user can still override on `watches`
    styleTags: text('style_tags').array().notNull().default(sql`'{}'::text[]`),
    designTraits: text('design_traits').array().notNull().default(sql`'{}'::text[]`),
    roleTags: text('role_tags').array().notNull().default(sql`'{}'::text[]`),

    // Provenance: how did this catalog row come into existence?
    source: text('source', { enum: ['user_promoted', 'admin_curated', 'url_extracted'] })
      .notNull()
      .default('user_promoted'),

    // Counts denormalized for /explore performance — updated via trigger or batch job
    ownersCount: integer('owners_count').notNull().default(0),
    wishlistCount: integer('wishlist_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Natural-key dedup — UNIQUE on (brand, model, reference) with NULLS NOT DISTINCT
    // requires Postgres 15+ (Supabase is 15+). Fallback: UNIQUE on (brand, model, COALESCE(reference, ''))
    uniqueIndex('watches_catalog_natural_key_idx').on(table.brand, table.model, table.reference),
    // pg_trgm GIN for /search Watches tab — same pattern as profiles_username_trgm_idx
    // (defined in raw SQL migration, not here — Drizzle doesn't express gin_trgm_ops in pg-core)
  ],
)

// Modification to existing `watches` table:
//   catalogId: uuid('catalog_id').references(() => watchesCatalog.id, { onDelete: 'set null' }),
// NULLABLE — existing rows are unlinked until backfill completes; future inserts may also be
// "rough drafts" the user is editing manually before being linked to a catalog row.
```

**Why nullable `catalog_id`:**

- Backward compatibility during phased rollout (the [expand-contract pattern](https://dev.to/whoffagents/drizzle-orm-migrations-in-production-zero-downtime-schema-changes-e71)). The migration that adds the column ships *before* any code that reads it, so the column has to be nullable or the migration fails.
- A user-typed watch row may not match any catalog entry yet (typo in brand, novel reference, hand-wound oddball). Forcing the link breaks watch creation.
- Catalog rows can be merged or deleted by an admin; per-user `watches` rows must survive that operation. `ON DELETE SET NULL` preserves them.

### How the Catalog Gets Populated

Three sources, all writing to `watches_catalog.source`:

1. **`user_promoted`** (default) — When a user adds a watch via the existing form, after save we lookup `(brand, model, reference)` in `watches_catalog`. If found, link `watches.catalog_id`. If not found, **insert a new catalog row from the user's input** and link it. This is the "everyone is a catalog contributor" model — same pattern Letterboxd / Discogs / Goodreads use to bootstrap their canonical catalogs from user submissions.
2. **`url_extracted`** — When a user uses the existing `/api/extract-watch` URL-import route, the extracted spec is upserted into `watches_catalog` using the natural-key `(brand, model, reference)`. If the row already exists, we *enrich* missing fields (e.g. user-entered row had `caseSizeMm` but no `lugToLugMm`; the extractor pulled `lugToLugMm` from the manufacturer page → fill it in). Never overwrite non-null catalog fields without admin review.
3. **`admin_curated`** — Reserved for a future admin-tool phase (out of scope for v4.0). Marker for "this row has been verified by a human and is the canonical record."

This ordering matters: **`url_extracted` rows are MORE trustworthy than `user_promoted` rows** because the LLM extraction stage reads structured data from the manufacturer's page. When backfilling from the existing `watches` table (next section), we should prefer URL-extracted rows when there's a tie.

### Backfill Strategy for ~Hundreds of Existing `watches` Rows

The expand-contract pattern with three deploys:

**Migration 1 (additive, safe to ship anytime):**
- `CREATE TABLE watches_catalog (...)` with a UNIQUE index on `(brand, model, reference)`.
- `ALTER TABLE watches ADD COLUMN catalog_id uuid REFERENCES watches_catalog(id) ON DELETE SET NULL;` — nullable, no default, no application changes yet.

**Backfill script (Node script in `scripts/backfill-watches-catalog.ts`, runs once after Migration 1 is on prod):**
- Read all `watches` rows in batches of 100 (well under the v4.0 working dataset of <500 watches/user × <10 users = ~5000 rows total — single-batch is fine, but using batches is good muscle memory).
- For each row, `INSERT INTO watches_catalog (...) ... ON CONFLICT (brand, model, reference) DO NOTHING RETURNING id` — Postgres atomically dedups against the natural key.
- If `RETURNING id` is empty (conflict), `SELECT id FROM watches_catalog WHERE brand=$1 AND model=$2 AND reference IS NOT DISTINCT FROM $3`.
- `UPDATE watches SET catalog_id = $catalogId WHERE id = $watchId`.
- Run inside a single transaction per batch so a failure rolls back cleanly and is idempotent on re-run.

**Migration 2 (post-backfill, optional — defer if scope-creeping):**
- *Don't* `ALTER TABLE watches ALTER COLUMN catalog_id SET NOT NULL` in v4.0. Keeping it nullable preserves the "user hasn't matched their watch to a catalog row yet" UX state and avoids a hard migration fence. v5.0+ can tighten this if catalog matching becomes a forced step.

**Why this is safe at our scale:**

- Existing `watches` row count is in the hundreds (single-digit users × <500 watches per user). The whole backfill runs in seconds locally, less than a minute against production over the session-mode pooler.
- No locks: `INSERT ... ON CONFLICT DO NOTHING` is a row-level operation; `UPDATE watches SET catalog_id = ...` is row-level. No table-level lock acquired.
- Idempotent: re-running the backfill is safe — `ON CONFLICT DO NOTHING` short-circuits, and `UPDATE` with the same value is a no-op.

Reference: [Drizzle ORM Migrations in Production: Zero-Downtime Schema Changes](https://dev.to/whoffagents/drizzle-orm-migrations-in-production-zero-downtime-schema-changes-e71) — adopts the same expand-contract pattern.

### What about RLS on `watches_catalog`?

The catalog is **read-public, write-restricted-to-server-actions-only**. RLS posture:

```sql
ALTER TABLE watches_catalog ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read catalog rows
CREATE POLICY watches_catalog_select_all
  ON watches_catalog
  FOR SELECT
  USING (true);

-- Only the service role can write — Server Actions use service role; user-direct
-- writes via the JS SDK are blocked. The "user_promoted" insert happens server-side
-- inside `addWatch`, never client-direct.
-- (No INSERT/UPDATE/DELETE policies for authenticated → those operations fail.)
```

This deliberately departs from the project's two-layer privacy pattern: the catalog is public-by-design (no privacy data) and writes are funneled through Server Actions, so DAL-WHERE protection is built in. Document this exception in PROJECT.md Key Decisions when v4.0 ships.

### Ripple Effects on Existing Code

The similarity engine (`src/lib/similarity.ts`) currently reads from per-user `watches` rows. After catalog landing, we have a choice:

- **Phase A (v4.0):** Keep similarity reading from per-user `watches`. Catalog is silent infrastructure — nothing user-visible changes about how similarity is computed. /search Watches tab and /explore are the only consumers.
- **Phase B (v5.0+):** Migrate similarity to read from `watches_catalog` joined to per-user `watches` for "owned/wishlist" predicates. This unlocks "Common Ground" overlap based on canonical watch identity (right now Common Ground in v2.0 already works on user-pair `watches.brand + model + reference` substring matching — catalog identity makes this exact and SQL-fast).

v4.0 should **not** rewire similarity. The catalog is laid quietly underneath; the similarity engine continues working off per-user rows as it does today. This keeps the v4.0 scope tight.

---

## /explore + /search Watches/Collections — No New Libraries

### What's already in the tree (DO NOT add)

- `pg_trgm` extension + GIN indexes on `profiles.username` / `profiles.bio` (Phase 11 + 16)
- Drizzle `ilike` + `or` query composition (`src/data/profiles.ts` people-search pattern)
- 4-tab `SearchPageClient` with `useSearchState` hook (250ms debounce + AbortController + URL sync) shipped in Phase 16
- `HighlightedText` XSS-safe component
- Two-layer privacy (RLS + DAL WHERE) for filtering hidden profiles/collections out of search

### What v4.0 adds — schema-only

```sql
-- Mirror the people-search pattern for catalog watches
CREATE INDEX watches_catalog_brand_trgm_idx ON watches_catalog USING gin (brand gin_trgm_ops);
CREATE INDEX watches_catalog_model_trgm_idx ON watches_catalog USING gin (model gin_trgm_ops);
-- Optional, depending on /search Watches UX: GIN on the natural-key concat, or per-column
```

### Tab-gating pattern from v3.0 search — REUSABLE

The Phase 16 `SearchPageClient` already renders a 4-tab UI (All / Watches / People / Collections) where People is wired and the other three show "coming soon." v4.0 fills in:

- **Watches tab**: query `watches_catalog` via new DAL function `searchCatalogWatches(q, { limit, viewerId })`. Mirrors `searchProfiles` exactly — `q.length>=2` client minimum + Server Action with `Zod .strict().max(200)` + `inArray` fan-out for "isOwned / isWishlisted" badges (like the people-search `isFollowing` pattern, anti-N+1).
- **Collections tab**: query `watches` joined to `profiles` (only public profiles — `profile_public = true` AND viewer-self-exclusion), grouped by `userId`, returning collection-level matches. Two-layer privacy preserved: RLS on `watches` already enforces `userId = auth.uid() OR <viewer permission via profile_public>` (verify in Phase 6 RLS migration); DAL adds explicit `WHERE profiles.profile_public = true OR profiles.id = $viewerId`.
- **All tab**: union of People + Watches + Collections capped at, say, 5 of each. No new query — just compose existing three.

The 250ms debounce / AbortController / 2-char client minimum from Phase 16 is reusable verbatim. The XSS-safe `HighlightedText` works for any string field.

**No new libraries.** No new search engine. No Algolia, no Meilisearch, no Typesense — they would be operational overkill for <5000 catalog rows + <500 watches/user. `pg_trgm` is fast enough until we have 100k+ catalog rows, which is a v6.0+ problem.

### /explore Page

Server Component composing existing data:

- **Popular collectors**: `SELECT users with most followers WHERE profile_public=true LIMIT 10` (already-approved Common Ground / suggested-collectors pattern from Phase 10).
- **Trending watches**: `SELECT watches_catalog ORDER BY (owners_count + wishlist_count * 0.5) DESC LIMIT 10` — relies on the denormalized counts on `watches_catalog`. Updated via a daily cron / `pg_cron` job, NOT live triggers (avoid hot-loop write amplification on `watches` insert).
- **Taste clusters**: defer to v5.0. v4.0 ships popular collectors + trending watches only — keeps scope tight.

`pg_cron` is available on Supabase (free tier included) — schedule a `REFRESH MATERIALIZED VIEW` or a plain `UPDATE watches_catalog SET owners_count = ...` daily. Document the cron expression in `docs/deploy-db-setup.md`.

---

## Email + Password Change Flows — Supabase Auth API Surface

### `supabase.auth.updateUser()` is the single API for both

```typescript
// Email change
const { data, error } = await supabase.auth.updateUser({ email: 'new@example.com' })
// Password change
const { data, error } = await supabase.auth.updateUser({ password: 'new-password' })
```

Both require an active session — call from a Client Component or Server Action with the user already signed in.

### Email Change — Confirmation Flow

By default, `updateUser({ email })` triggers Supabase to send confirmation links to **both** the user's current and new email (the "secure email change" mode). The user clicks the link in their **new** email; the email becomes their login. If "Secure email change" is disabled in Supabase Dashboard → Auth → Email, the link goes to the new email only.

**Recommendation:** keep "Secure email change" ON (default). Two-link flow is the [project's two-layer-defense ethos](#) applied to email security — protects against an attacker hijacking the session and rotating the email in one shot.

The confirmation link in the email points to `{site_url}/auth/confirm?token_hash=…&type=email_change`. The existing `/auth/confirm` route handler (shipped in v1.0 for sign-up confirmation) uses `verifyOtp({ type, token_hash })` — extend it to also handle `type === 'email_change'`. The verify call rotates the user's email atomically.

```typescript
// src/app/auth/confirm/route.ts (extend existing handler)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')   // 'signup' | 'recovery' | 'email_change' | 'magiclink'
  if (!tokenHash || !type) return redirect('/auth/error?reason=missing_token')
  const supabase = await createServerClient()
  const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash })
  if (error) return redirect(`/auth/error?reason=${encodeURIComponent(error.message)}`)
  return redirect('/settings/account?status=email_changed')
}
```

### Password Change — Re-auth Flow

`updateUser({ password })` requires an active session. If "Secure password change" is enabled in Supabase Dashboard → Auth and the session is **older than 24h**, the call returns `error: { code: 'reauthentication_needed' }`. Handle this by routing to a re-auth dialog that calls `supabase.auth.reauthenticate()` (sends a 6-digit code to the user's email), the user pastes the code, then we retry `updateUser({ password })`.

**Recommendation:** Enable "Secure password change" in Supabase Dashboard. The sub-24h grace window means the user typically doesn't see a re-auth prompt; the prompt only appears for stale sessions, which is exactly the attack-window we want to defend.

### Settings → Account UX shape

```
/settings/account   (new page)
├─ Email block
│   ├─ Current email (read-only): twwaneka@gmail.com
│   ├─ Change email button → opens form → updateUser({ email }) → toast "Check both inboxes"
│   └─ Toast on /settings/account?status=email_changed after confirm-link click
└─ Password block
    ├─ New password input + confirm input
    ├─ Submit → updateUser({ password })
    │            ├─ ok → toast "Password updated"
    │            └─ reauthentication_needed → dialog (code-input + retry)
    └─ Optional: "Send password reset link" button → resetPasswordForEmail(currentEmail)
                  for users who forgot their current password and can't re-auth
```

No new libraries. All API calls already exist in `@supabase/supabase-js` 2.103.0 and `@supabase/ssr` 0.10.2.

---

## Settings Page Restructure — Vertical Tabs Pattern

### Current state

`/preferences` is a single long page mixing similarity preferences, profile-public toggles, and notifications opt-outs. v4.0 splits this into a sectioned settings surface.

### Recommendation: Vertical Tabs (Sidebar-Style) on Desktop, Stacked Sections on Mobile

Use `@base-ui/react`'s `Tabs` component (already in tree at v1.3.0) with `orientation="vertical"`. Confirmed support: [Base UI Tabs docs](https://base-ui.com/react/components/tabs).

```
Desktop (>=md):
┌─────────────┬────────────────────────────┐
│ Account     │  [Account section content] │
│ Preferences │                            │
│ Privacy     │                            │
│ Notifications                            │
│ Appearance  │                            │
└─────────────┴────────────────────────────┘

Mobile (<md):
Single scrollable column with sticky section headers.
Use Base UI Accordion (already in @base-ui/react) OR simple <h2> + content.
```

**Why vertical tabs over a true `@/components/ui/sidebar`:**

- shadcn's Sidebar is built for app-shell navigation (collapsible, rail/icon mode, mobile sheet fallback), not for a single page's section nav. Reaching for it would mean adopting a second nav primitive alongside our `BottomNav` + `DesktopTopNav` already shipped in Phase 14 — overkill.
- Vertical tabs render the active section in the same Server Component without a navigation event. Each section's data can be fetched in the page-level `loader` and passed as props. This avoids the pitfall of each "settings sub-page" needing its own auth gate / data fetch / Suspense boundary.
- Mobile fallback is trivial: `orientation="vertical"` collapses to scrollable sections — no code split needed. With shadcn Sidebar, the mobile sheet fallback adds ~3KB and an extra interaction step.

**Routes:** `/settings` becomes a single Server Component page with the URL hash (`#account`, `#preferences`, `#privacy`, `#notifications`, `#appearance`) driving the active tab. Hash-based tab state survives `router.refresh()` and is shareable. Alternative: full route segments (`/settings/account`, etc.) — adds parent layout boilerplate but no real upside for our scale.

### Section content (no new libs needed for any of this)

| Section | Content | New work? |
|---|---|---|
| Account | Email change, password change | NEW (this milestone) |
| Preferences | `collectionGoal` + `overlapTolerance` selects, similarity tuning | UI exposure of fields that exist on `userPreferences` |
| Privacy | Existing `profilePublic` / `collectionPublic` / `wishlistPublic` toggles + new `notesPublic` per-watch (handled in WatchForm) | Mostly existing |
| Notifications | `notifyOnFollow` / `notifyOnWatchOverlap` toggles (backend wired in Phase 13) | UI exposure of existing fields |
| Appearance | Theme switch (already in UserMenu) lifted into Settings as a discoverable home | Pure UI re-paint |

---

## "Evaluate this Watch" Flow — Route, Not Modal

### Recommendation: New `/evaluate` route, NOT modal

The intercepting-routes modal pattern (`@modal/(.)evaluate/page.tsx`) is supported in Next.js 16 and could work — but two reasons argue against it for *this* feature:

1. **Output is dense and structured.** The similarity verdict from `analyzeSimilarity()` returns a `SimilarityResult` with a label, a top-3 nearest watches, a per-dimension breakdown, and rationale text. A modal scaled to fit a verdict that may run 80–120 lines vertical is a poor fit — the user wants to read, scroll, compare, maybe tab back to their collection. A dedicated route at `/evaluate` (or `/evaluate?url=…`) lets the page breathe.
2. **The flow inherently spans a server roundtrip.** Paste URL → server hits `/api/extract-watch` (which itself can take 5–15s if the LLM stage fires) → similarity computes → render verdict. This is an interruptible, refresh-survivable flow. Modal patterns work best for short/synchronous operations.

Counter-argument we considered: if the user comes from the "Add Watch" page and just wants a quick "should I add this?" check, a modal could feel less disruptive. But the cleanest UX is exactly the inverse — `/evaluate` is the *primary* flow, and "Add to collection" is the secondary CTA on the verdict page once the user has committed.

### Route structure

```
src/app/evaluate/page.tsx       — Server Component, accepts ?url= search param
src/app/evaluate/EvaluateClient.tsx — Client Component for paste form (no URL yet)
```

### Reuses

- **`/api/extract-watch` route handler** — unchanged. Already auth-gated, SSRF-hardened (Phase 1 SEC-01), LLM-gated (Phase 4).
- **`analyzeSimilarity(targetWatch, collection, preferences)` from `src/lib/similarity.ts`** — unchanged. Pure function; already takes the three inputs we need.
- **DAL `getWatchesForUser(userId)` + `getPreferencesForUser(userId)`** — unchanged. Already exists from v1.0.

### What's NEW

- `/evaluate` page that wires extract-watch → similarity → render `SimilarityResult` UI. The render UI mostly exists inside `WatchDetail` already (the in-card similarity insight) — extract that into a shared `SimilarityVerdictCard` component so it's reusable.
- "Add to my collection" button on the verdict — calls existing `addWatch` Server Action with the extracted watch payload.
- Empty-state copy on `/evaluate` for when no URL is provided yet.

**No new libraries.** No new API routes. The whole flow is composition of code already shipped.

---

## Profile Nav Avatar Shortcut

Pure markup change in `src/components/layout/DesktopTopNav.tsx`:

- Replace the current "Profile" UserMenu dropdown item with the user's avatar + chevron in the top-right.
- Click → either (a) drops to `/u/{username}` directly (Letterboxd-style — primary action is "go to my public profile"), or (b) opens the existing UserMenu (Settings / Sign out / Theme switch).
- Recommendation: avatar-itself navigates to `/u/{username}`; chevron-icon-on-the-side opens UserMenu. Two affordances on the same control.
- Mobile (`SlimTopNav` / `BottomNav`) already lacks this; adding it requires no new shipping decisions because the BottomNav already has a "Profile" tab.

No new libraries. The `Avatar` primitive is already in `src/components/ui/`.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Algolia / Meilisearch / Typesense | <5000 catalog rows × handful of users — pg_trgm GIN is two orders of magnitude under the threshold where these become useful (~100k+ rows or sub-100ms search SLOs we don't have) | `pg_trgm` (already enabled, already indexed for profiles — extend to `watches_catalog`) |
| Postmark for transactional email | 100/mo free is too tight for personal-MVP + small private beta; one bug burns through it in an afternoon | Resend (3000/mo free, native Supabase integration) |
| SendGrid for transactional email | Free tier permanently retired May 27 2025; minimum $19.95/mo for an MVP nobody else uses yet | Resend |
| Resend SDK (`npm install resend`) for v4.0 Auth-only | Auth path is 100% pure SMTP via Supabase Dashboard — never touches the npm SDK. Save the install for the day we ship product transactional email | Plain SMTP via Resend → Supabase Dashboard config |
| Supabase Realtime for catalog updates | v3.0 decision still stands — server-render + `router.refresh()` is sufficient at MVP scale, free-tier 200-WS limit is real | None — the catalog is read-mostly, daily-refresh denormalized counts are enough |
| Polymorphic / single-table-inheritance for `watches` ↔ `watches_catalog` | Doesn't translate well to SQL ([Cybertec](https://www.cybertec-postgresql.com/en/conditional-foreign-keys-polymorphism-in-sql/)); creates conditional-FK headaches | Two tables joined by FK |
| `shadcn/ui` Sidebar for the Settings page | Built for app-shell nav, not single-page section nav; would conflict with the BottomNav + DesktopTopNav already shipped in Phase 14 | `@base-ui/react` Tabs with `orientation="vertical"` |
| Modal pattern (parallel + intercepting routes) for "Evaluate this Watch" | Verdict output is too dense for a modal; the flow involves a 5–15s server roundtrip that survives well at a real route | New `/evaluate` route |
| `pg_cron` triggers on every `watches` insert/update for `owners_count` | Hot-loop write amplification — a single user adding 50 watches in a sitting fires 50 catalog updates, each holding a row lock | Daily-batch UPDATE via `pg_cron` (acceptable staleness for "trending" feature) |
| `next-themes` (still applies from v3.0) | Project has custom ThemeProvider — adding next-themes creates two competing systems | Custom ThemeProvider (already shipped) |
| New ORM, new search lib, new email lib SDK | Drift from the proven `@supabase/ssr` + Drizzle + pg_trgm stack | Reuse what's there |

---

## Installation

```bash
# Auth-only path (recommended for v4.0 — what's actually shipping)
# ZERO new npm packages.

# IF a phase explicitly adds product transactional email beyond Auth:
npm install resend@^4
```

Configuration changes (no installs):

1. **Resend account + domain verification** — DNS records in horlo.app registrar (SPF + DKIM + bounce MX).
2. **Supabase Dashboard → Auth → SMTP Settings** — paste Resend host/port/credentials.
3. **Supabase Dashboard → Auth → Providers → Email** — toggle "Confirm email" ON.
4. **Supabase Dashboard → Auth → Email Templates** — restyle confirmation/recovery email HTML to match horlo.app brand. Keep `{{ .ConfirmationURL }}` → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`.
5. **Supabase Dashboard → Auth → Settings** — enable "Secure password change" + "Secure email change" (defaults are usually ON; verify).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Resend SMTP | Postmark SMTP | When deliverability for password resets becomes mission-critical (paid tier user complaints) — Postmark's 99%+ inbox rate is industry-best |
| Resend SMTP | AWS SES | When monthly volume crosses 10k+ and Resend's $20/mo for 50k starts to bite — SES is $0.10/1000 with no monthly minimum |
| Separate `watches_catalog` table | Inline canonical fields on `watches` + de-dup via UPDATE pass | Only if we abandon /explore and /search Watches tab — unlikely |
| Vertical Tabs for Settings | Full route-per-section (`/settings/account`, `/settings/privacy`, …) | When sections grow large enough to warrant their own data fetches and we want sharable section URLs (post-v4.0) |
| `/evaluate` as a route | Modal via parallel + intercepting routes | When the verdict UI shrinks enough to fit a 50%-viewport modal (would require simplifying the SimilarityResult render — out of scope) |
| Daily-batch `owners_count` via `pg_cron` | Live `AFTER INSERT` trigger | When /explore needs sub-minute freshness on trending counts — not v4.0 |

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@supabase/ssr@^0.10.2` | `@supabase/supabase-js@^2.103.0` | Both already in tree; `updateUser` works identically in browser + server clients |
| `drizzle-orm@^0.45.2` | Postgres 15+ | UNIQUE NULLS NOT DISTINCT requires PG 15+; Supabase is PG 15+ as of 2026 |
| `@base-ui/react@^1.3.0` | React 19 | Tabs with `orientation="vertical"` confirmed in 1.3 docs |
| Resend SMTP creds | Supabase Auth SMTP | Verified via Supabase + Resend partner integration; `smtp.resend.com:465` (TLS) is the documented endpoint |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Resend = correct SMTP choice | HIGH | Native Supabase partner integration, 30× free tier of Postmark, SendGrid free tier dead, ex-Vercel team / React Email native |
| Resend free-tier 3000/mo + 100/day | HIGH | Resend pricing page + multiple 2026 comparison articles agree |
| Supabase rate-limit auto-jumps from 2/h to 30/h on custom SMTP save | HIGH | Supabase docs + GitHub Discussion #16209 |
| `supabase.auth.updateUser({ email })` triggers two-link confirmation | HIGH | Supabase Auth docs |
| `supabase.auth.updateUser({ password })` re-auth trigger at >24h session age | HIGH | Supabase Auth docs |
| `watches_catalog` separate table + nullable FK from `watches` | HIGH | Standard product-catalog normalization; expand-contract migration pattern is well-documented |
| User-promoted catalog rows on `addWatch` | MEDIUM | Pattern works (Letterboxd / Discogs / Goodreads) but exact shape of "deduplication on user typo" is a UX call I can only flag, not resolve |
| pg_trgm GIN scales for `watches_catalog` | HIGH | Already proven in Phase 16 for `profiles`; identical query shape, smaller table |
| `@base-ui/react` Tabs `orientation="vertical"` for Settings | HIGH | Confirmed in Base UI 1.3 docs |
| `/evaluate` as a route, not a modal | MEDIUM | UX argument is solid but a senior reviewer might disagree if they want lower-friction entry from the watch-add form. Easy to revisit. |
| Daily-batch via `pg_cron` for `owners_count` | MEDIUM | `pg_cron` is on Supabase free tier; live triggers vs batch is a tradeoff that should get a final read in the architecture phase |
| Backfill is single-pass safe at v4.0 scale | HIGH | <5000 rows total, INSERT...ON CONFLICT DO NOTHING is row-level, no locks |

---

## Sources

**Resend / SMTP:**
- [Resend Supabase integration (partner page)](https://supabase.com/partners/integrations/resend)
- [Resend Supabase SMTP guide](https://resend.com/docs/send-with-supabase-smtp)
- [Resend pricing 2026](https://resend.com/pricing)
- [Email API pricing comparison April 2026](https://www.buildmvpfast.com/api-costs/email)
- [Postmark pricing 2026](https://postmarkapp.com/pricing)
- [SendGrid free tier retirement May 2025](https://dreamlit.ai/blog/best-sendgrid-alternatives)
- [Supabase custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase rate limits doc](https://supabase.com/docs/guides/auth/rate-limits)
- [Custom SMTP rate-limit discussion (#16209)](https://github.com/orgs/supabase/discussions/16209)

**Supabase Auth flows:**
- [`supabase.auth.updateUser` JS reference](https://supabase.com/docs/reference/javascript/auth-updateuser)
- [Password-based Auth | Supabase Docs](https://supabase.com/docs/guides/auth/passwords)
- [Setting up Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)

**Catalog table design:**
- [Cybertec — Polymorphism in SQL: 4 Methods](https://www.cybertec-postgresql.com/en/conditional-foreign-keys-polymorphism-in-sql/)
- [Cybertec — Practical examples of normalization in PostgreSQL](https://www.cybertec-postgresql.com/en/practical-examples-data-normalization-in-postgresql/)
- [Surrogate Keys: Auto-Increment vs UUID vs Hash Keys vs Natural Keys](https://medium.com/@reliabledataengineering/surrogate-keys-auto-increment-vs-uuid-vs-hash-keys-vs-natural-keys-1285eceab0d9)
- [Database normalization for product catalogs](https://catsy.com/blog/database-normalization/)

**Migrations / backfill:**
- [Drizzle ORM migrations in production: zero-downtime schema changes](https://dev.to/whoffagents/drizzle-orm-migrations-in-production-zero-downtime-schema-changes-e71)
- [Drizzle ORM official migrations doc](https://orm.drizzle.team/docs/migrations)

**Settings page UX:**
- [Base UI Tabs docs](https://base-ui.com/react/components/tabs)
- [shadcn vertical tabs pattern](https://www.shadcn.io/patterns/tabs-layout-1)

**Routing patterns:**
- [Next.js Parallel Routes (file convention)](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)
- [Next.js Intercepting Routes (file convention)](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)

---
*Stack research for: Horlo v4.0 Discovery & Polish*
*Researched: 2026-04-26*
