---
id: SEED-018
status: planted
planted: 2026-06-17
planted_during: quick task 260614-f82 (seed editorial content for /explore — author hit the UX friction firsthand while batch-adding ~40 catalog watches for the editorial seed)
trigger_when: AFTER current active milestone closes — this is a Add-Watch flow UX phase, related to SEED-010 (v5.3 Add-Watch Redesign) but a more surgical slice
scope: small
related_phases:
  - SEED-010 (v5.3 Add-Watch Redesign) — this seed is a tighter, content-author-driven subset of that broader redesign; resolve here OR fold into v5.3 scope
---

# SEED-018: Add-Watch Surface URL Extraction + Catalog-Only Save Path

## Problem

Surfaced during quick task `260614-f82` (Explore editorial seed) when the author needed to add ~40 specific watches to the prod catalog to back curated lists and collection paths. Two distinct UX failures in the current Add-Watch Flow:

### Problem 1 — Extraction URL screen is buried

The `/api/extract-watch` URL-extraction path is the fastest way to add a real watch with real metadata — but the UI to access it is too deep in the Add-Watch Flow. A user (or content author) who knows the manufacturer URL still has to click through preamble steps before they can paste a URL.

### Problem 2 — No "save to catalog only" exit

After a successful URL extraction, every save path forces the watch into the user's collection (`watches` table) — owned, wishlist, sold, grail. There is **no way to add a watch to the catalog (`watches_catalog`) without also adding it to the current user's collection**.

For content authoring this is a blocker: the author doesn't want 40 watches showing up in their own wishlist just so editorial lists can reference them.

## Workaround for the current quick task

For 260614-f82 specifically, the workaround is `scripts/seed-explore-catalog.ts` — a Node script that calls `fetchAndExtract` + `upsertCatalogFromExtractedUrl` + `updateCatalogTaste` directly, batching from a markdown URLs file. Catalog-only writes, no user-side rows. This proves the underlying server-side path works; the gap is purely in the user-facing surface.

## What this seed proposes

### Surface URL extraction earlier

Make the URL extraction entry point a **top-level option on the Add-Watch landing screen**, not a downstream step. Three roughly-equivalent design directions:

1. URL-paste field at the top of the Add-Watch landing — paste a URL, hit extract, jump straight to the confirm step
2. A "From manufacturer URL" tile alongside the existing "Search catalog" / "Add new" tiles
3. URL detection in the Search field — if the user pastes a URL into the search bar, auto-pivot to extract mode

Pick whichever fits the v5.3 Add-Watch Redesign (SEED-010) framing best; the requirement is just "fewer taps from app-open to URL-extract."

### Catalog-only save (admin-gated)

Add an admin-only "Add to catalog only" save option on the extraction confirm screen. RLS gate via the existing `is_admin` predicate (already used for `cms-covers` writes). UX shape:

- Save options become: "Add to my Owned" / "Add to my Wishlist" / "Catalog only (admin)" / "Add to my Sold" / "Add to my Grail"
- Catalog-only option hidden entirely for non-admins
- Catalog-only writes to `watches_catalog` (via `upsertCatalogFromExtractedUrl`) and skips the `watches` insert

This unblocks future editorial content seeding without writing a one-off Node script each time. It also matches the seed editorial pattern (SEED-008): "Admin-authored via CMS" — but for catalog rows, not just lists.

## Success conditions

- A content author can add 10+ watches to the catalog in under 5 minutes without writing scripts or touching SQL.
- A non-admin user **cannot** trigger the catalog-only save (RLS verified).
- The URL extraction entry is reachable in ≤2 taps from `/watch/new` (vs the current ≥3).
- No regression to existing add-to-collection flow.

## Out of scope

- Batch URL import (the script handles batch; users can iterate per-URL in UI).
- Catalog editing UI beyond the post-extraction confirm step (separate phase — admin catalog management).
- Bulk catalog cleanup tools (separate phase).

## Decision points to resolve at plan-phase

- Fold into v5.3 Add-Watch Redesign (SEED-010), or ship as a standalone v5.2.x polish phase?
- "Admin" gating mechanism — reuse the existing `is_admin` boolean on profiles (Phase 45 CMS pattern), or a new role enum?
- Do non-admin users still see the catalog-only option but get a "request admin" hint, or is the option entirely hidden?

## v6.0+ context

- v6.0 social interaction is shipped — admin gating exists for CMS already.
- Seed editorial pattern (SEED-008) already establishes admin-only writes to editorial tables via the `cms-covers` bucket pattern.
