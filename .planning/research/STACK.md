# Stack Research

**Domain:** v5.1 Explore Page Redesign — in-app CMS, catalog enrichment, polish pass, /explore
**Researched:** 2026-05-16
**Confidence:** HIGH — all version claims verified via Context7, official Anthropic docs, and npm

---

## Existing Stack (Validated — Do Not Re-Research)

| Technology | Version | Status |
|------------|---------|--------|
| Next.js App Router | 16.2.3 | Locked |
| React | 19.2.4 | Locked |
| TypeScript | ^5 | Locked |
| Tailwind CSS 4 | ^4 | Locked |
| Zustand | ^5.0.12 | Locked |
| Supabase (Postgres + Auth + Storage + RLS) | @supabase/supabase-js ^2.103.0 | Locked |
| Drizzle ORM | ^0.45.2 | Locked |
| @anthropic-ai/sdk | ^0.88.0 | Locked — see enrichment section |
| @base-ui/react | 1.3.0 | Locked — includes Drawer (see below) |
| embla-carousel-react | 8.6.0 | Already installed |
| lucide-react | ^1.8.0 | Locked |

---

## v5.1 Stack Analysis by Feature Area

### (a) In-App CMS: Rich Text vs Plain Textarea + Markdown Renderer

**Verdict: Plain `<textarea>` inputs + `react-markdown` renderer. No rich-text editor.**

**Rationale:**

The CMS authors two content types: list intro copy (a few sentences of editorial context) and per-item watch commentary (1-3 sentence callouts per watch). Neither requires embedded images, tables, footnotes, or inline media. The audience is a single owner on a personal app — the authoring surface is not a public editorial tool.

A rich-text editor (TipTap, Quill, Slate.js, Lexical) introduces 150–400 kB of bundle weight, a shadow DOM or ProseMirror/Y.js dependency, and serialization complexity (HTML vs JSON vs markdown storage). None of that complexity is justified here.

The right split is:
- **Authoring:** plain `<textarea>` (already in `src/components/ui/textarea.tsx`). Store the value as a markdown string column on the DB row (text, no special type).
- **Reading/display:** render with `react-markdown` on the list detail page and the hero. This is a pure renderer — no editor runtime, no interactive state. Bundle weight is ~11 kB gzip (no plugins). It handles `**bold**`, `_italic_`, `[links](url)`, paragraph breaks, and numbered/bulleted lists — everything the CMS copy needs.

`react-markdown` at latest (10.1.0 as of 2026-05-16) is React 19 compatible and has no peer dependency conflicts with the existing stack.

**What NOT to add:** TipTap, Quill, Slate.js, Lexical, Contentlayer, Sanity, or any third-party CMS. The CMS decision was already resolved in PROJECT.md (2026-05-16): in-app admin route only.

**Integration point:** The existing `<Textarea>` component in `src/components/ui/textarea.tsx` is used as-is. The markdown renderer is added alongside it on the display side.

**New dependency: `react-markdown@^10.1.0`**

```bash
npm install react-markdown
```

---

### (b) Images: Hero, Curated-List Covers, Avatars

**Verdict: Supabase Storage for upload/serving + Next.js `<Image>` for display. No image transformation library needed. Supabase image transforms are NOT available on the free plan.**

**Rationale:**

**Supabase Storage image transformation is a Pro Plan feature** (confirmed via official Supabase docs, 2026-05-16). The project runs on the free tier. Do not add the Supabase custom Next.js image loader — it would silently fail on the free plan.

The existing `next.config.ts` already has `images: { unoptimized: true }` to avoid SSRF risk from arbitrary watch page URLs. This setting applies project-wide. For user-controlled Supabase storage images (avatars, cover photos), the approach is:
- Upload pre-resized JPEGs from the client (the existing pattern in `src/lib/storage/catalogSourcePhotos.ts` and `src/lib/storage/wearPhotos.ts` already does canvas-reencoded JPEG ≤1080px with EXIF strip before upload).
- Serve via signed URLs for private buckets, or via public bucket URLs for public cover/hero images. Use standard `<img>` tags or Next.js `<Image unoptimized>` for display.
- Hero and curated-list cover images should live in a new **public** Supabase Storage bucket (no signed URL required — public read RLS). This avoids signed URL expiry on the `/explore` page which is globally cached.

**Avatar upload** reuses the EXIF-strip + ≤1080px JPEG canvas pattern already in place from the WYWT photo flow (`heic2any`, canvas re-encode, client-direct upload). No new tooling needed. The existing `exifr` devDependency handles EXIF stripping during development.

**What NOT to add:** Cloudinary, Imgix, Sharp, or any server-side image processing library. Sharp would require a native Node.js binary and complicates Vercel deploys. The client-side canvas resize approach already ships and works.

**No new dependencies.**

---

### (c) Bottom-Sheet Drag/Swipe-to-Dismiss

**Verdict: Migrate `FilterSheet.tsx` from `@base-ui/react/dialog` to `@base-ui/react/drawer`. No new library needed. Do NOT add vaul.**

**Rationale:**

The existing `src/components/ui/sheet.tsx` wraps `@base-ui/react/dialog` (a Dialog primitive — `import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"`). The Dialog does not handle touch-swipe gestures. The fix from the bug report ("filter sheet felt stuck, could not be dismissed during a pending query") is a separate logical issue — but drag-to-dismiss requires switching the primitive.

`@base-ui/react` version 1.3.0 is already installed and ships a `drawer` package at `@base-ui/react/drawer`. The Drawer component includes:
- Native swipe-to-dismiss with `swipeDirection` prop (`'up' | 'down' | 'left' | 'right'`; default `'down'` for bottom sheets)
- CSS data attributes for swipe-direction-aware exit animations (`data-swipe-direction`, `data-ending-style`)
- A `Drawer.SwipeArea` sub-component for drag handle affordance
- `data-base-ui-swipe-ignore` attribute to opt specific children out of swipe dismissal (important for filter chip scroll areas)

The correct migration is: replace `@base-ui/react/dialog` with `@base-ui/react/drawer` inside `sheet.tsx`, add `swipeDirection="down"`, and add CSS exit animations keyed on `data-swipe-direction`. The component's public API (`Sheet`, `SheetContent`, `SheetTrigger`, etc.) stays identical — `FilterSheet.tsx` (now `WatchFacetSheet`) needs no changes beyond the import.

**vaul is NOT needed.** vaul (Emil Kowalski's drawer) is a React-specific gesture library that predates base-ui's Drawer. Since `@base-ui/react` 1.3.0 is already installed and provides equivalent functionality natively, adding vaul would be redundant weight. vaul also has a different component API that would require a larger migration surface.

**No new dependencies.** The change is a refactor of `src/components/ui/sheet.tsx` to use the already-installed `@base-ui/react/drawer`.

**Integration note:** The "fix dismiss during pending query" bug is orthogonal to swipe-to-dismiss and should be handled separately — it is a state management issue in `FilterSheet.tsx`, not a primitive issue. Do not conflate the two fixes.

---

### (d) Catalog Enrichment: Anthropic Vision + Model Verification

**Verdict: Everything already in place. No new dependencies. Use sequential processing, not the Batch API. Model ID `claude-sonnet-4-6` is current.**

**Model ID:**

`claude-sonnet-4-6` is confirmed as the **current recommended API ID** for Claude Sonnet, verified against the official Anthropic models overview page (2026-05-16). It is a pinned snapshot (not an evergreen pointer). The existing `src/lib/taste/enricher.ts` already uses this exact model ID. No change needed.

Note: `claude-sonnet-4-20250514` (the previous ID used in `src/lib/extractors/llm.ts`) is **deprecated and retires June 15, 2026**. That file should be updated to `claude-sonnet-4-6` as part of v5.1 — but this is a one-line change, not a new dependency.

**Vision input mechanics:**

The existing enricher already implements vision mode correctly:
- Fetches photo bytes from Supabase Storage via a 60-second signed URL
- Re-encodes as base64 JPEG
- Passes `{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photoBase64 } }` in the `messages` content array alongside a text prompt
- Degrades to text-only mode if photo fetch fails

This pattern is confirmed correct against current Anthropic SDK docs. No changes needed.

**Batch API vs Sequential:**

The v5.1 enrichment task is ~100 rows. The Anthropic Batch API is appropriate for 1,000+ rows where 24-hour async processing is acceptable. The existing `scripts/backfill-taste.ts` runs sequentially with a configurable `--batch-size` flag (default 20 rows per invocation), which is the right approach for a one-time ~100-row operator task. The sequential script already handles idempotency (first-write-wins via `AND confidence IS NULL` predicate), resume, dry-run, and cost logging.

The Batch API DOES support tool_use and vision (confirmed via official Anthropic batch processing docs) — it is technically usable here. But it is overkill: most batches of 100 finish in under an hour sequentially anyway, and the existing sequential script already has all the scaffolding. The Batch API would require additional polling logic to wait for results before writing to the DB.

**Recommendation:** Reuse `scripts/backfill-taste.ts` directly or extend it with a `--catalog-v5-1` flag. Do not introduce the Batch API for this scale.

**No new dependencies.**

---

### (e) Hero + Curated Lists Rail: Carousel

**embla-carousel-react 8.6.0 is already installed.** The rotating hero does not require a carousel library — it shows one item per page load (server-selected). The curated lists rail is a horizontally scrollable container; CSS `overflow-x: auto` with `-webkit-overflow-scrolling: touch` suffices on mobile. If a snap-scroll rail is needed, embla-carousel-react is already available.

**No new dependencies.**

---

### (f) Admin CMS Route: Auth Gating

The admin route (`/admin/lists`, `/admin/lists/[id]`) must be owner-gated. The existing auth system (Supabase Auth + `src/lib/auth.ts` proxy enforcement) handles this. Add a server-side check comparing the session user to a hardcoded owner email constant (the single-user pattern already used in the codebase). No new auth library or middleware needed.

---

## Summary: New Dependencies

| Package | Version | Why Needed | Justified? |
|---------|---------|------------|------------|
| `react-markdown` | `^10.1.0` | Render markdown intro copy + per-item commentary on list detail + hero | YES — lightest viable renderer; no rich-text editor needed |

**All other v5.1 features are covered by the existing stack.** The base-ui/drawer migration, avatar upload, hero images, and catalog enrichment are refactors and configuration changes, not new dependencies.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| TipTap / Quill / Slate / Lexical | Rich-text editors are overkill for single-owner editorial copy; 150–400 kB bundle | Plain `<Textarea>` + `react-markdown` |
| vaul | `@base-ui/react/drawer` (already installed, v1.3.0) provides equivalent swipe-to-dismiss natively | `@base-ui/react/drawer` |
| Sanity / Contentlayer / any third-party CMS | Rejected in PROJECT.md — adds auth surface, webhook complexity, and external billing | In-app admin route (Next.js) |
| Supabase image transform loader | Requires Pro Plan; project is on free tier | Client-side canvas resize before upload (already in place) |
| Sharp / Imgix / Cloudinary | Native binaries, server-side complexity, not needed at this scale | Client-side canvas resize (already in place) |
| Anthropic Batch API | Appropriate for 1,000+ rows; 100 rows is sequential territory | Existing `scripts/backfill-taste.ts` sequential script |

---

## Version Compatibility Notes

| Change | Impact |
|--------|--------|
| `@base-ui/react/drawer` replaces `@base-ui/react/dialog` in `sheet.tsx` | Internal to `sheet.tsx`; external API (`Sheet`, `SheetContent`, etc.) unchanged. `WatchFacetSheet.tsx` has no import changes. |
| `react-markdown@^10.1.0` | React 19 compatible; no peer conflicts. Server Component safe (pure renderer, no client hooks). |
| `claude-sonnet-4-6` model ID | Already in `enricher.ts`. Update `src/lib/extractors/llm.ts` to replace deprecated `claude-sonnet-4-20250514` before June 15, 2026. |

---

## Installation

```bash
# Only one new runtime dependency for v5.1
npm install react-markdown
```

---

## Sources

- `@base-ui/react` Drawer docs — Context7 `/mui/base-ui`, verified swipe-to-dismiss, `swipeDirection` prop, `data-base-ui-swipe-ignore` attribute (HIGH confidence)
- Anthropic models overview — https://platform.claude.com/docs/en/about-claude/models/overview — confirmed `claude-sonnet-4-6` as current Sonnet ID; `claude-sonnet-4-20250514` deprecated June 15, 2026 (HIGH confidence)
- Anthropic batch processing — https://platform.claude.com/docs/en/build-with-claude/batch-processing — confirmed tool_use + vision supported in Batch API; 100,000 request limit; 50% cost reduction (HIGH confidence)
- Supabase Storage image transformations — https://supabase.com/docs/guides/storage/serving/image-transformations — confirmed Pro Plan required; free tier excluded (HIGH confidence)
- `react-markdown` — Context7 `/remarkjs/react-markdown`; npm latest 10.1.0 (HIGH confidence)
- Existing codebase — `src/components/ui/sheet.tsx`, `src/lib/taste/enricher.ts`, `scripts/backfill-taste.ts`, `next.config.ts` — read directly (HIGH confidence)

---
*Stack research for: Horlo v5.1 Explore Page Redesign*
*Researched: 2026-05-16*
