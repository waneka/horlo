---
id: SEED-019
status: planted
planted: 2026-06-20
planted_during: quick task 260614-f82 photo backfill — 17 of 50 manufacturer URLs returned 403 or had no og:image meta, leaving those catalog rows with image_url IS NULL
trigger_when: AFTER current active milestone closes — fold into catalog enrichment / Browse-the-Catalog polish OR ship as a standalone v9.0.x polish phase alongside SEED-009 v5.2 Catalog Expansion
scope: small
related_phases:
  - SEED-009 (v5.2 Catalog Expansion) — natural fold-in if both are still pending
  - SEED-018 (Add-Watch URL surface + catalog-only save) — admin-side upload path
---

# SEED-019: Photo Backfill for Bot-Blocked Catalog Brands

## Problem

Following the quick-task-260614-f82 explore editorial seed, 17 catalog rows have `image_url IS NULL` because their manufacturer URLs are unfetchable by the existing extraction pipeline:

**14 fetch-failed (403 / network):**
- A. Lange & Söhne (3 watches — 1815 233.026, Saxonia Thin 211.027, Odysseus 363.179)
- Baume & Mercier Riviera 10728
- Christopher Ward The Twelve C12-40A-S00K0-S00B0-K
- Jaeger-LeCoultre (3 — Master Ultra Thin Small Seconds Q1218420, Master Ultra Thin Q1342520, Polaris Date Q9068681)
- Sinn 856 UTC 856.010
- Vacheron Constantin Overseas 4500V/110A-B128
- Zenith Defy Skyline 03.9300.3620/01.I001
- Rolex Datejust 41 126334
- Rolex Explorer 40 224270
- Tudor Black Bay 58 GMT 7939G1A0NRU

**3 no-og-image (page loaded but no extractable image meta):**
- Blancpain Fifty Fathoms 5015-1130-71S
- Certina DS Action GMT Powermatic 80 C032.929.11.051.00
- Orient Bambino Version 7 FAC0000DD0

## Why the URL-fetch approach doesn't work for these

The repo's `fetchAndExtract` / `safeFetch` pipeline uses `User-Agent: WatchCollectionBot/1.0`. These brands either:
- Aggressively block non-browser UAs (Rolex, Tudor, Sinn, JLC, Vacheron — all return HTTP 403)
- Serve JS-rendered SPAs where og:image is injected client-side (Lange, B&M, CW)
- Don't include og:image in their canonical product pages at all (Blancpain, Certina, Orient — but they may have product images via `<picture>` / `<img>` tags in the page body)

## What this seed proposes

Three approaches, in order of preference:

### 1. Admin-side photo upload (recommended)
Build on SEED-018 (catalog-only save path). Add a "Replace photo" action on the admin catalog detail page. Reuse the existing `catalog-source-photos` Supabase Storage bucket and EXIF-strip / ≤1080px JPEG pipeline. Author manually grabs press photos (or screenshots) and uploads.

Pros: high-quality, brand-correct images. Author has editorial control.
Cons: ~17 manual uploads.

### 2. Headless browser extraction (Playwright/Puppeteer)
Spawn a real Chromium session for the bot-blocked URLs. Wait for network idle, then grab `og:image` or the first `<img>` in the product gallery.

Pros: gets past most bot detection. Solves all 17 watches.
Cons: requires Playwright in CI/build path. Slower. Doesn't help if site blocks based on IP/fingerprint.

### 3. Stock/press photo via Anthropic web-search tool
Call Claude with `web_search` enabled, prompt: "Find the canonical press photo URL for {brand} {model} {reference}". Take the first result. Upload via service-role to `cms-covers`.

Pros: automated, no infra change.
Cons: variable quality; some watches may not have a clean press photo available; potential license issues using random google-image-results photos.

## Success conditions

- All 17 catalog rows have `image_url IS NOT NULL`
- Images are brand-correct (no placeholder gradients)
- No copyright violations — images are either: manufacturer press photos used under fair use, or licensed stock
- No regression to existing catalog rows that already have photos

## Out of scope

- Migrating all 194 catalog rows to a unified photo source (separate decision)
- Building a photo CDN / image-optimization pipeline (Vercel handles this for og:image URLs already)
- Replacing the AI-gen list covers (separate task — author plans to upload these manually via /admin/lists)

## Decision points to resolve at plan-phase

- Approach #1 vs #2 vs #3 — pick one or hybrid
- If #1: extend `/admin/lists/[id]` pattern, or build new `/admin/catalog/[id]`?
- If #2: where does Playwright live — local script, CI job, or always-on edge function?
- Image attribution: do we need a `image_credit` column?

## Related artifacts

- `scripts/seed-data/explore-photo-backfill.json` — manifest with exact failure reason per watch
- `scripts/backfill-explore-catalog-photos.ts` — existing URL-mode pipeline (works for the 33 that succeeded)
- `src/lib/storage/catalogSourcePhotos.ts` — existing admin upload pattern reusable for approach #1
