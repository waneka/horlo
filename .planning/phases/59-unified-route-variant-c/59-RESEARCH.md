# Phase 59: Unified Route (Variant C) - Research

**Researched:** 2026-05-25
**Domain:** Next.js 16 App Router dynamic routing, URL migration, static CI guard, privacy gate preservation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Variant C unified route `src/app/w/[ref]/page.tsx` is the sole watch-detail surface.
- **D-02:** Hard cutover — `/watch/[id]` and `/catalog/[catalogId]` are **removed** (delete the `page.tsx` files; route 404s by absence). **No redirect shells.**
- **D-03:** The ref carries the **natural id of the linking surface** — ownership/per-user surfaces emit `watches.id`; discovery surfaces emit `catalogId`. No prefixed ref.
- **D-04:** Server-side resolution is raw-UUID **try-per-user-then-catalog**: try `getWatchByIdForViewer(user.id, ref)` first; if null, fall back to `getCatalogById(ref)`.
- **D-05:** An owned watch legitimately has **two resolvable `/w/` URLs**. No canonicalizing redirect.
- **D-06:** When an owner reaches `/w/[catalogId]`, the catalog-resolution branch detects ownership (reuse `findViewerWatchByCatalogId`), loads the full `Watch`, and renders the **full owned view in place**. No redirect.
- **D-07:** Ownership determined by the **viewer's relationship to the watch**, not by which id the URL carried. Both resolution branches converge on the same framing dispatch (`same-user | cross-user`).
- **D-08:** The 50.1 Variant B redirect (`redirect(\`/watch/${viewerOwnedRow.id}\`)` at `src/app/catalog/[catalogId]/page.tsx:112`) is **unwound**. No page-level redirects on the catalog path.
- **D-09:** `/watch/[id]/edit` → `/w/[ref]/edit` (keyed by `watches.id`, owner-only).
- **D-10:** `/watch/new` (add-watch flow) **stays** at its current path in this phase.
- **D-11:** A **static source-scan test that fails the build** (not a lint warning). Bans any internal link literal targeting the legacy watch-detail paths `/watch/<id>` and `/catalog/<id>`, **including template literals**.
- **D-12:** The guard must catch **computed/runtime deep-link strings** — specifically `NotificationRow.resolveHref`'s `return \`/watch/${watchId}\``.
- **D-13:** The guard **allowlists `/watch/new`** and must not false-flag non-watch paths.
- **D-14:** Two-layer privacy gate preserved with **no regression**.
- **D-15:** Owner-only write surfaces remain gated to the authenticated owner via `viewerCanEdit` on the `WatchDetail` island.

### Claude's Discretion

- **CI guard exact mechanism** — custom test-runner check vs ESLint rule vs typed-route helper.
- **404/not-found UX** for legacy paths — Next's default `not-found` is acceptable.
- **Physical merge** of the server-only catalog page and the client-island watch page into `/w/[ref]/page.tsx`.
- **`OtherOwnersRoster` / `CatalogPageActions` visibility** per viewer-state on the unified route.

### Deferred Ideas (OUT OF SCOPE)

- `/watch/new` → `/w/new` relocation (v8.0).
- CI guard evolution to typed-route enforcement (prevent, not just detect).
- Photos / carousel / wear-pic surfacing / grid engagement / IA redesign (Phases 60-64).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROUTE-01 | A watch is viewable at `/w/[ref]` resolving either per-user watch id or catalog id server-side | D-04 try/fallback pattern; `getWatchByIdForViewer` + `getCatalogById` signatures verified |
| ROUTE-02 | Legacy `/watch/[id]` and `/catalog/[catalogId]` routes are removed (no redirect) — visiting 404s | Route-404-by-absence confirmed via Next.js 16 docs; no `page.tsx` = no route |
| ROUTE-03 | A static guard test fails the build if any internal href still targets legacy paths | Vitest static-scan pattern exists in `tests/static/` and `tests/no-evaluate-route.test.ts`; hooks into `npm run build` via `npm test` pre-build check; see CI Guard section |
| ROUTE-04 | Every internal link to a watch points at `/w/[ref]` | Complete enumeration: 14 detail + 5 edit + 7 catalog = 26 literals across 21 files; see Link-Surface section |
| ROUTE-05 | Unified route preserves the two-layer privacy gate and per-viewer framing | Gate unchanged — route merge is routing-layer only; verified `getWatchByIdForViewer` signature |
| ROUTE-06 | Owner-only write surfaces remain available only to the authenticated owner | `viewerCanEdit` prop on `WatchDetail` island unchanged; sourced from `isOwner` in both resolution branches |
</phase_requirements>

---

## Summary

Phase 59 implements the Variant C hard cutover: three file-system changes (create `src/app/w/[ref]/page.tsx`, create `src/app/w/[ref]/edit/page.tsx`, delete `src/app/watch/[id]/page.tsx`, delete `src/app/catalog/[catalogId]/page.tsx`, delete `src/app/watch/[id]/edit/page.tsx`) plus 26 link-literal rewrites across 21 files, plus one new Vitest static-scan test that fails the build.

The unified page is mechanically a merge of the two legacy pages. The `/watch/[id]/page.tsx` provides the full per-user framing pattern (WatchDetail island, CommentThread, framing dispatch, privacy gate). The `/catalog/[catalogId]/page.tsx` provides the catalog-branch components (OtherOwnersRoster, CatalogPageActions) and the `findViewerWatchByCatalogId` ownership-detection function that is reused on the catalog resolution branch. Both branches converge on the same `isOwner ? 'same-user' : 'cross-user'` framing dispatch.

No schema changes. No data migrations. No redirects anywhere. The only tricky decision point is Claude's-discretion: whether to render `OtherOwnersRoster` and `CatalogPageActions` on the unified route for viewers who land via a `watches.id` URL — the spike's §4.C/§5.C flags this but does not resolve it.

**Primary recommendation:** Build the unified page as a pure composition of the two existing pages' RSC siblings around the existing `WatchDetail` client island. The catalog-branch ownership layering (`findViewerWatchByCatalogId`) is the only new logic needed. The CI guard is best implemented as a Vitest static-scan test in `tests/static/` — consistent with the existing `no-evaluate-route.test.ts` and `CollectionFitCard.no-engine.test.ts` patterns.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route resolution (UUID → watch data) | API/Backend (Next.js Server Component) | — | `getWatchByIdForViewer` + `getCatalogById` are server-only DAL functions |
| Framing dispatch (`same-user` / `cross-user`) | API/Backend (Server Component) | — | `isOwner` computed from DAL result; must be server-authoritative |
| Ownership detection on catalog branch | API/Backend (Server Component) | — | `findViewerWatchByCatalogId` is a server-only DB query |
| Privacy gate | API/Backend (Server Component DAL) | Database (RLS) | Two-layer: RLS outer + WHERE inner; both server-only |
| Write surfaces (edit, delete, mark-worn) | Frontend Server (RSC prop) + Browser | — | `viewerCanEdit` computed server-side; rendered by `'use client'` WatchDetail island |
| 404-by-absence | Frontend Server (Next.js routing) | — | Deleting `page.tsx` is sufficient; no code needed |
| CI link-literal guard | Build/CI (Vitest static scan) | — | Source-file inspection, not runtime; integrates into `npm test` |
| Link migration | Browser (JSX) | — | 26 `href` literals and one `router.push` and one `return \`...\`` |

---

## Standard Stack

### Core (verified against codebase — no new dependencies needed for this phase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | App Router dynamic routes, `notFound()`, async params | Already in use; this phase is pure routing |
| Vitest | (in package.json) | Static-scan CI guard test | Established test framework; `npm run test` is the gate |
| Node.js `fs` (built-in) | — | `readFileSync` + `readdirSync` for static scan | Used in existing static tests (`no-raw-img.test.ts`, etc.) |
| Node.js `path` (built-in) | — | `resolve`, `join` for file paths in guard | Used in `profile-route-51.test.ts` |

No new npm packages needed. [VERIFIED: codebase grep + package.json]

### Reused DAL Functions (no changes needed)

| Function | File | Signature | Role in Phase 59 |
|----------|------|-----------|-----------------|
| `getWatchByIdForViewer` | `src/data/watches.ts:193` | `(viewerId: string, watchId: string) => Promise<{ watch: Watch; isOwner: boolean; ownerUserId: string } \| null>` | Primary resolver — try first with `ref` |
| `getCatalogById` | `src/data/catalog.ts:254` | `(id: string) => Promise<CatalogEntry \| null>` | Fallback resolver — try second with `ref` |
| `findViewerWatchByCatalogId` | `src/app/catalog/[catalogId]/page.tsx:286` | `(userId: string, catalogId: string) => Promise<{ id: string } \| null>` | Ownership detection on catalog branch (D-06). Must be extracted to a shared DAL location — it currently lives in the page file being deleted. |

[VERIFIED: codebase read]

---

## Architecture Patterns

### System Architecture Diagram

```
Browser request: GET /w/[ref]
         |
         v
[Next.js 16 App Router — src/app/w/[ref]/page.tsx]
         |
   await params  (async params per Next.js 16 docs)
         |
   getCurrentUser()  →  user.id
         |
   Branch 1: getWatchByIdForViewer(user.id, ref)
         |                      |
      non-null             null → Branch 2: getCatalogById(ref)
         |                                        |
   { watch, isOwner, ownerUserId }        non-null → findViewerWatchByCatalogId(user.id, ref)
         |                                                       |
   framing = isOwner                           owned?  yes → load Watch via getWatchById
      ? 'same-user'                                             framing = 'same-user'
      : 'cross-user'                                     no  → framing = 'cross-user'
         |                                               |
         +-------------------+---------------------------+
                             |
              Shared render tree (RSC siblings):
              WatchDetail (client island, viewerCanEdit={isOwner})
              CollectionFitCard (if collection.length > 0)
              ReferenceIdentityCard (if collection.length === 0 + confidence)
              OtherOwnersRoster (if catalogId available — see Discretion)
              SameFamilyRail
              LineageRail
              CatalogPageActions (if cross-user + catalogId — see Discretion)
              CommentThread (Suspense, uncached RSC sibling — B1 invariant)
```

### Recommended Project Structure

```
src/app/
├── w/
│   └── [ref]/
│       ├── page.tsx          # NEW — unified watch detail
│       └── edit/
│           └── page.tsx      # NEW — edit form (moved from watch/[id]/edit/)
├── watch/
│   ├── new/                  # STAYS (D-10)
│   │   └── page.tsx
│   └── [id]/                 # DELETED (route 404s by absence)
│       ├── page.tsx          # DELETE
│       └── edit/
│           └── page.tsx      # DELETE (moved to w/[ref]/edit/)
└── catalog/
    └── [catalogId]/          # DELETED (route 404s by absence)
        └── page.tsx          # DELETE

tests/static/
└── legacy-watch-routes.test.ts  # NEW — CI guard (D-11/D-12/D-13)
```

### Pattern 1: Next.js 16 Async Params

Confirmed from `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`: `params` is a `Promise` in Next.js 16. Both existing pages already use this correctly.

```typescript
// Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
interface UnifiedWatchPageProps {
  params: Promise<{ ref: string }>
}

export default async function UnifiedWatchPage({ params }: UnifiedWatchPageProps) {
  const { ref } = await params
  // ... rest of page
}
```

[VERIFIED: docs read + existing pages confirmed pattern]

### Pattern 2: Route-404-by-Absence

Deleting `src/app/watch/[id]/page.tsx` and `src/app/catalog/[catalogId]/page.tsx` is the complete implementation of ROUTE-02. Next.js App Router routes are defined by file presence. No redirect shells. No `notFound()` calls needed in the deleted files — they simply cease to exist.

The root `app/not-found.tsx` already handles unmatched URLs globally per Next.js 16 docs. [VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:9 — "root `app/not-found.js` ... handle any unmatched URLs for your whole application"]

### Pattern 3: B1 Invariant Preservation

`WatchDetail.tsx` is `'use client'`. RSCs (`CommentThread`, `SameFamilyRail`, `LineageRail`, `OtherOwnersRoster`, `CatalogPageActions`, `CollectionFitCard`, `ReferenceIdentityCard`) MUST be rendered as siblings of `WatchDetail` in the server page's JSX tree — not imported inside the client island. Both legacy pages already follow this pattern. The unified page must replicate the same structure.

```typescript
// Correct (B1-compliant): RSC siblings compose around the client island
return (
  <div>
    <WatchDetail watch={watch} viewerCanEdit={isOwner} ... />  {/* 'use client' island */}
    <SameFamilyRail rows={sameFamily} />                       {/* RSC sibling */}
    <LineageRail rows={lineage} />                             {/* RSC sibling */}
    <Suspense fallback={<CommentThreadSkeleton />}>
      <CommentThread ... />                                    {/* RSC sibling, uncached */}
    </Suspense>
  </div>
)
```

[VERIFIED: codebase read of both legacy pages]

### Pattern 4: findViewerWatchByCatalogId Extraction

This function currently lives at `src/app/catalog/[catalogId]/page.tsx:286-304`. When that file is deleted, the function must be moved. Two options:

1. Move to `src/data/watches.ts` (natural home — it queries the `watches` table; consistent with `getWatchByIdForViewer`).
2. Inline the logic in `src/app/w/[ref]/page.tsx`.

Option 1 is preferred for testability and consistency with the DAL pattern. The function signature stays identical: `(userId: string, catalogId: string) => Promise<{ id: string } | null>`. The `eq(watchesTable.status, 'owned')` BUG-01 fix (line 298) must be preserved.

[VERIFIED: function code read]

### Anti-Patterns to Avoid

- **Adding any `redirect()` call on the `/w/` route:** Hard cutover means zero redirects. Even a "convenience" redirect from `/w/[catalogId]` to `/w/[watches.id]` for owners is explicitly rejected (D-05, D-06).
- **Importing RSCs inside WatchDetail island:** The B1 invariant. RSCs (`CommentThread`, rails, etc.) must be siblings in the server tree, not imported into the `'use client'` island.
- **Putting `findViewerWatchByCatalogId` in the new `w/[ref]/page.tsx` file inline:** Makes it untestable and creates a large file. Extract to `src/data/watches.ts`.
- **Calling `notFound()` from within legacy route files:** The legacy files are deleted entirely, so they have no role.
- **Router Cache poisoning:** Phase 59 adds zero `redirect()` calls on watch-related routes. The D-08 unwind removes the last such redirect from `catalog/[catalogId]/page.tsx:112`. The landmine is sidestepped by design.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static source file scanning | Custom glob + AST parser | Node.js `readFileSync` + regex, Vitest as runner | Existing `tests/static/` tests use exactly this pattern; it's already trusted in the build |
| UUID format validation | Custom regex | Existing pattern in `catalog/[catalogId]/page.tsx:54` | The UUID regex `^[0-9a-f]{8}-...$` is already established; copy it to the unified page |
| Privacy gate | Any new gating logic | Unchanged `getWatchByIdForViewer` | The two-layer gate is the established pattern; do not modify it |
| Async params | Any sync access | `const { ref } = await params` | Next.js 16 requires async params; both legacy pages already do this correctly |

---

## Link-Surface Enumeration (Research Question 1 — ROUTE-04)

**Live count:** 26 literals across 21 distinct files. CONTEXT.md's estimate (~55 literals / ~36 files) was the pre-v6.0 upper bound; the actual count is lower. [VERIFIED: grep run 2026-05-25]

### A. Must Migrate — /watch/${...} DETAIL links (→ `/w/${...}`)

All emit `watches.id` (per-user UUID). These map to ownership/per-user surfaces.

| File | Line(s) | Exact Literal | ID type | Notes |
|------|---------|---------------|---------|-------|
| `src/app/catalog/[catalogId]/page.tsx` | 112 | `redirect(\`/watch/${viewerOwnedRow.id}\`)` | `watches.id` | D-08 unwind: DELETE this file entirely |
| `src/components/insights/SleepingBeautiesSection.tsx` | 44 | `href={\`/watch/${watch.id}\`}` | `watches.id` | — |
| `src/components/insights/GoodDealsSection.tsx` | 48 | `href={\`/watch/${w.id}\`}` | `watches.id` | — |
| `src/components/insights/CollectionFitCard.tsx` | 71 | `href={\`/watch/${watch.id}\`}` | `watches.id` | — |
| `src/components/home/MostWornThisMonthCard.tsx` | 21 | `href={\`/watch/${watch.id}\`}` | `watches.id` | — |
| `src/components/home/ActivityRow.tsx` | 55 | `href={\`/watch/${row.watchId}\`}` | `watches.id` | `activities.watchId` FK → `watches.id` (schema verified) |
| `src/components/home/RecommendationCard.tsx` | 22 | `href={\`/watch/${rec.representativeWatchId}\`}` | `watches.id` | — |
| `src/components/home/SleepingBeautyCard.tsx` | 33 | `href={\`/watch/${watch.id}\`}` | `watches.id` | — |
| `src/components/profile/StatsTabContent.tsx` | 62 | `href={\`/watch/${watch.id}\`}` | `watches.id` | — |
| `src/components/profile/ProfileWatchCard.tsx` | 63 | `href={\`/watch/${watch.id}\`}` | `watches.id` | — |
| `src/components/profile/NoteRow.tsx` | 62 | `href={\`/watch/${watch.id}\`}` | `watches.id` | Also has edit link at line 96 |
| `src/components/watch/WatchCard.tsx` | 35 | `href={\`/watch/${watch.id}\`}` | `watches.id` | — |
| `src/components/wear/WearDetailHero.tsx` | 111 | `href={\`/watch/${watchId}\`}` | `watches.id` | `wearEvents.watchId` FK → `watches.id` (schema line 300 verified) |
| `src/components/notifications/NotificationRow.tsx` | 142 | `return \`/watch/${watchId}\`` | `watches.id` | Computed deep-link (D-12 — CI guard must catch this) |

**Subtotal: 14 detail literals** (13 unique callsites + 1 that becomes delete-by-file).

### B. Must Migrate — /watch/${...}/EDIT links (→ `/w/${...}/edit`)

| File | Line(s) | Exact Literal | Notes |
|------|---------|---------------|-------|
| `src/app/watch/[id]/page.tsx` | 187, 190 | `href={\`/watch/${watch.id}/edit?status=wishlist\`}` and `?status=owned` | File is deleted; these links move to the new `/w/[ref]/page.tsx` |
| `src/components/profile/NotesEmptyOwnerActions.tsx` | 53 | `router.push(\`/watch/${watchId}/edit#notes\`)` | Computed via router.push |
| `src/components/profile/NoteRow.tsx` | 96 | `render={<Link href={\`/watch/${watch.id}/edit\`} />}` | — |
| `src/components/watch/WatchDetail.tsx` | 226 | `href={\`/watch/${watch.id}/edit\`}` | Inside the `'use client'` island; `watch.id` is available as prop |

**Subtotal: 5 edit literals** (4 unique callsites + 2 inside the file being deleted).

### C. Must Migrate — /catalog/${...} links (→ `/w/${...}`)

All emit `catalogId` (catalog UUID). Discovery surfaces.

| File | Line(s) | Exact Literal | ID type |
|------|---------|---------------|---------|
| `src/app/explore/lists/[id]/page.tsx` | 91, 110 | `href={\`/catalog/${item.catalogId}\`}` | `catalogId` |
| `src/components/explore/DiscoveryWatchCard.tsx` | 30 | `href={\`/catalog/${watch.id}\`}` | `catalogId` (variable named `watch.id` but it is catalogEntry.id) |
| `src/components/explore/PathCard.tsx` | 97, 134, 143 | `href={\`/catalog/${node.catalogId}\`}` | `catalogId` |
| `src/components/search/WatchSearchRow.tsx` | 31 | `href={\`/catalog/${result.catalogId}\`}` | `catalogId` |

**Subtotal: 7 catalog literals** across 4 files.

### D. Must NOT Migrate — Allowlisted Paths (D-10/D-13)

| Path pattern | Example file | Reason |
|---|---|---|
| `/watch/new*` | `src/components/layout/DesktopTopNav.tsx`, `src/components/profile/AddWatchCard.tsx`, `src/components/home/WatchPickerDialog.tsx`, `src/components/watch/AddWatchFlow.tsx`, `src/components/profile/CollectionTabContent.tsx`, `src/components/profile/WishlistTabContent.tsx`, `src/components/watch/CatalogPageActions.tsx`, `src/components/search/WatchSearchRowsAccordion.tsx`, `src/lib/watchFlow/destinations.ts` | D-10: add-watch flow stays at current path |
| `/explore/lists/[id]` | — | Not a watch path; must not be false-flagged |
| `/admin/lists/[id]` | — | Not a watch path; must not be false-flagged |
| `/wear/[id]` | — | Not a watch path; unaffected by merge |
| `/u/[username]?focusWatch=...` | `NotificationRow.tsx:137` | Not a detail link; query param, not path |

### E. False-Flag Risk Assessment

The CI guard regex `/\/watch\/\${|\/catalog\/\${|href="\/watch\/(?!new)|href="\/catalog\//` could false-flag:
- `/watch/new` references — mitigated by allowlist (D-13)
- `/explore/lists/[id]` and `/admin/lists/[id]` — these contain `lists/` not `watch/` or `catalog/`, so no false-flag risk
- `/wear/[id]` — contains `wear/` not `watch/`, so no false-flag risk
- Comment strings like `// /watch/[id] is keyed by per-user watches.id` — caught by the regex but are comments; the guard must scope to non-comment lines OR accept that these are false positives requiring cleanup (see CI Guard section)

---

## CI Guard Mechanism (Research Question 2 — D-11/D-12/D-13)

### Recommendation: Vitest static-scan test in `tests/static/`

**Why this approach over alternatives:**

| Option | Build-failing? | Catches template literals? | Catches computed strings? | Allowlist support | Fits project pattern? |
|--------|---------------|---------------------------|--------------------------|------------------|-----------------------|
| Vitest static-scan test | YES (via `npm test` before build) | YES (regex on file content) | YES (scans ALL lines including return statements) | YES (regex exclusion) | YES — 4 existing tests follow this exact pattern |
| ESLint custom rule | Only if `lint` is in build gate | YES (AST-aware) | YES | YES | No — ESLint runs separately; `npm run lint` is not in build gate |
| Typed-route helper | Compile-time only | NO (runtime TS only) | NO | — | No — deferred (CONTEXT deferred ideas) |

The project's build gate is `npm run build`. The test suite (`npm run test` / `vitest run`) is the appropriate hook: the CI guard test must be added to the pre-build check. The pattern already exists in `tests/static/CollectionFitCard.no-engine.test.ts`, `tests/no-evaluate-route.test.ts`, and `tests/profile-route-51.test.ts` — all use `readFileSync` + regex assertions on source files.

**No GitHub Actions workflow exists** — the project deploys via Vercel. Vercel runs `npm run build` on each push. To make the guard build-failing, the test must run as part of the Vercel build command, OR the `package.json` `build` script must be updated to `npm test && next build`. [VERIFIED: no `.github/workflows/` directory; no `vercel.json`]

The recommended approach: update `package.json` `"build"` script to `"vitest run && next build"` so the static guard fires on every Vercel deploy. Alternatively, add the guard as a `prebuild` npm script hook (`"prebuild": "vitest run tests/static/legacy-watch-routes.test.ts"`).

**Guard file:** `tests/static/legacy-watch-routes.test.ts`

**Logic sketch:**

```typescript
// tests/static/legacy-watch-routes.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Recursively collect all .ts/.tsx files under src/
function collectSourceFiles(dir: string): string[] { /* ... */ }

// Patterns that flag a legacy watch-detail link
const FORBIDDEN_PATTERNS = [
  // Template literal: `/watch/${...}` (detail path, NOT /watch/new)
  /`\/watch\/\$\{(?!.*\/edit)/,  // /watch/${} not followed by /edit context — catches detail links
  // Template literal: `/watch/${...}/edit` 
  /`\/watch\/\$\{.*?}\/edit/,
  // Template literal: `/catalog/${...}`
  /`\/catalog\/\$\{/,
  // Computed return: return `/watch/${...}`
  /return\s+`\/watch\/\$\{/,
  // Static href: href="/watch/  (not /watch/new)
  /href="\/watch\/(?!new)/,
  // Static href: href="/catalog/
  /href="\/catalog\//,
]

// Lines that are allowlisted — never flag
const ALLOWLIST_PATTERNS = [
  /\/watch\/new/,          // D-10: /watch/new stays
  /\/watch\/\[id\]/,       // path segment in comments/docs
  /\/catalog\/\[catalogId\]/, // same
  /^\s*\/\//,              // pure comment lines (optional — see below)
  /\/explore\/lists\//,    // not a watch path
  /\/admin\/lists\//,      // not a watch path
  /\/wear\/\[id\]/,        // not a watch path
]
```

**Nuance on comment lines:** The existing codebase has many comments like `// /watch/[id] is keyed by per-user watches.id`. Two approaches:
1. Allowlist lines starting with `//` or `*` — risks missing real violations in commented-out code
2. Require clearing all comments too (consistent with hard cutover posture) — more work but cleaner

Recommendation: allowlist pure comment lines (starting with optional whitespace + `//` or ` * `) to reduce noise; flag `//` lines that contain template literal `${` patterns (commented-out live code should be deleted anyway).

**False-flag exclusions (verified):**
- `/explore/lists/[id]/page.tsx` and `/admin/lists/[id]/page.tsx` — their paths contain `lists/`, not `watch/` or `catalog/`, so they will NOT be false-flagged by the above patterns.
- `/wear/[wearEventId]/page.tsx` — contains `wear/`, not `watch/`, no false-flag.
- `src/app/watch/new/page.tsx` — allowlisted by `/watch\/new/` pattern.

---

## Unified `/w/[ref]/page.tsx` Composition (Research Question 3 — D-04/D-06/D-07)

### Verified DAL Signatures

```typescript
// src/data/watches.ts:193
getWatchByIdForViewer(viewerId: string, watchId: string)
  => Promise<{ watch: Watch; isOwner: boolean; ownerUserId: string } | null>

// src/data/catalog.ts:254
getCatalogById(id: string)
  => Promise<CatalogEntry | null>

// src/app/catalog/[catalogId]/page.tsx:286 (MUST MOVE to src/data/watches.ts)
findViewerWatchByCatalogId(userId: string, catalogId: string)
  => Promise<{ id: string } | null>
```

[VERIFIED: codebase read]

### Resolution Logic

```typescript
export default async function UnifiedWatchPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params

  // UUID format guard (from catalog/[catalogId]/page.tsx:54)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
    notFound()
  }

  const user = await getCurrentUser()

  // Branch 1: Try per-user resolver
  const perUserResult = await getWatchByIdForViewer(user.id, ref)

  if (perUserResult) {
    // Framing: same-user or cross-user based on isOwner
    const { watch, isOwner, ownerUserId } = perUserResult
    // ... render with WatchDetail island (viewerCanEdit={isOwner})
    // ... no OtherOwnersRoster (was catalog-only per UI-SPEC — see discretion)
    // ... CatalogPageActions only if !isOwner (D-15 intent)
  } else {
    // Branch 2: Try catalog resolver
    const catalogEntry = await getCatalogById(ref)
    if (!catalogEntry) notFound()

    // D-06: Detect ownership on catalog branch
    const viewerOwnedRow = await findViewerWatchByCatalogId(user.id, ref)
    if (viewerOwnedRow) {
      // Owner arrived via catalogId URL — full owned view in place (D-06)
      const watch = await getWatchById(user.id, viewerOwnedRow.id)
      const isOwner = true
      // ... render same tree as Branch 1 same-user framing
    } else {
      // Pure cross-user catalog view
      const isOwner = false
      // ... render catalog components (OtherOwnersRoster, CatalogPageActions)
    }
  }
}
```

### Prop/Type Differences to Reconcile

The legacy pages use different data shapes:

| Data | `/watch/[id]/page.tsx` | `/catalog/[catalogId]/page.tsx` |
|------|------------------------|--------------------------------|
| Watch data | `Watch` domain object (from `getWatchByIdForViewer`) | `CatalogEntry` (from `getCatalogById`) |
| `catalogTaste` | `watch.catalogTaste` (LEFT JOIN in `getWatchesByUser`) | Manually projected `catalogTaste` object from `catalogEntry.*` fields |
| `ownerUserId` | From `getWatchByIdForViewer` result | Not available (catalog page doesn't have it) |
| `likeState` | Pre-fetched via `getLikesForTargetCached` | Not fetched |
| `commentCount` | Pre-fetched | Not fetched |
| `canComment` | Pre-fetched | Not fetched |
| `sameFamily` | From `getSameFamilyForCatalog(watch.catalogId)` | From `getSameFamilyForCatalog(catalogId)` |
| `lineage` | From `getLineageForReference(watch.catalogId)` | From `getLineageForReference(catalogId)` |
| `roster` | Not fetched | `getCollectorsForCatalog(catalogId, user.id)` |
| `actionsSpec` | Not built | Built from `CatalogEntry` fields |
| `viewerUsername` | Not fetched | From `getProfileById(user.id)` |

**Reconciliation strategy for the unified page:**

- For Branch 1 (per-user hit): mirror `/watch/[id]/page.tsx` exactly. Add `getCollectorsForCatalog` fetch if OtherOwnersRoster is rendered on this branch (discretion choice).
- For Branch 2, non-owned (catalog-only cross-user): mirror `/catalog/[catalogId]/page.tsx` exactly.
- For Branch 2, owned (D-06): load full `Watch` via `getWatchById(user.id, viewerOwnedRow.id)` and fetch the same data as Branch 1.
- The `target = { type: 'watch', id }` for likes/comments: on Branch 2 owned, `id` should be `viewerOwnedRow.id` (the `watches.id`), not `ref` (the `catalogId`). On Branch 2 cross-user, likes/comments are catalogId-keyed — confirm with `watch_likes.watchId` FK type (`watches.id`, schema line 324); cross-user viewers don't like/comment on catalog pages today, so this is a Phase 60+ concern, not Phase 59.

### `OtherOwnersRoster` and `CatalogPageActions` Discretion (Claude's Choice)

The spike §4.C/§5.C flags this as a "forcing-function note." Current UI-SPEC: catalog-only (not rendered on `/watch/[id]`). The unified page must decide.

**Recommendation:** Carry the current UI-SPEC behavior into the unified page:

- `OtherOwnersRoster`: render when `catalogId` is available AND framing is cross-user (non-owner). Do NOT render for owners (consistent with D-05 from the Phase 50 spike, where `CatalogPageActions` was suppressed for owners).
- `CatalogPageActions`: render when framing is cross-user AND a `catalogId` is resolvable. Do NOT render for owners (`viewerCanEdit=true` path).

This deferral to Phase 64 (IA Redesign) is the explicit CONTEXT.md guidance: "carry the spike §4.D/E forcing-function note to the planner; resolve here or defer to Phase 64 IA redesign."

---

## Next.js 16 Dynamic Route + Not-Found Behavior (Research Question 4)

### Async Params

Both legacy pages already use `const { id } = await params` and `const { catalogId } = await params`. The unified page uses the same pattern:

```typescript
interface UnifiedWatchPageProps {
  params: Promise<{ ref: string }>
}
export default async function UnifiedWatchPage({ params }: UnifiedWatchPageProps) {
  const { ref } = await params
```

[VERIFIED: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md:43-49 + existing pages]

### Route 404-by-Absence

Deleting `src/app/watch/[id]/page.tsx` is the complete ROUTE-02 implementation for the `/watch/[id]` path. Deleting `src/app/catalog/[catalogId]/page.tsx` is the complete ROUTE-02 implementation for the `/catalog/[catalogId]` path. The root `app/not-found.tsx` (or `app/global-not-found.js`) handles all unmatched URLs globally. No redirect shells are needed or wanted (D-02).

[VERIFIED: Next.js 16 docs confirm "root `app/not-found.js` handles any unmatched URLs for your whole application"]

### Router Cache Poisoning Avoidance

Phase 59 adds zero `redirect()` calls on watch routes. The D-08 unwind removes the only existing `redirect()` on a watch-related route (line 112 of `catalog/[catalogId]/page.tsx`). The D-06 in-place owner render (no redirect) was specifically chosen to avoid the Router Cache poisoning landmine documented in MEMORY (`feedback_proxy_router_cache_poisoning`). [VERIFIED: CONTEXT.md code_context section]

---

## Privacy Gate Preservation (Research Question 5 — ROUTE-05)

### Verified Gate Implementation

`getWatchByIdForViewer` (`src/data/watches.ts:193-235`) implements:

1. **OUTER gate (RLS):** `watches` RLS policy is owner-only at the anon key — the DB enforces this before the WHERE clause.
2. **INNER gate (WHERE clause):** `OR(eq(watches.userId, viewerId), AND(profilePublic=true, per-tab visibility))` where per-tab visibility checks `status='wishlist' AND wishlist_public=true` OR `status IN ('owned','sold','grail') AND collection_public=true`.

This gate is called identically on the unified page — the ref is passed to `getWatchByIdForViewer(user.id, ref)` unchanged. The merge does NOT change what the DAL returns.

[VERIFIED: `src/data/watches.ts:193-235` read]

### Regression Detection

A privacy gate regression on the unified route would manifest as:

1. A non-owner viewer can access a private watch's detail page (should 404). Test: request `/w/[watchId]` as a viewer where the owner has `profile_public=false` or `collection_public=false` — expect 404/notFound.
2. An unauthenticated viewer can access any watch detail (should redirect to login via proxy). Test: proxy behavior unchanged.
3. A cross-user viewer sees `viewerCanEdit=true` (should be false). Test: `WatchDetail` renders without edit/delete actions.

The existing `tests/integration/phase12-visibility-matrix.test.ts` covers the DAL layer. A Phase 59 acceptance criterion should verify that `getWatchByIdForViewer` is called on the unified route in exactly the same way as in `/watch/[id]/page.tsx`.

---

## Common Pitfalls

### Pitfall 1: Leaving Any redirect() on Watch Routes

**What goes wrong:** Any `redirect()` call on the `/w/` route or in a middleware layer for watch paths will trigger the Router Cache poisoning bug (MEMORY `feedback_proxy_router_cache_poisoning`). The symptom is: works first visit, 404s on soft-navigation revisit.
**Why it happens:** Next.js 16 Cache Components + prefetch mechanism caches 307 redirects and replays stale ones.
**How to avoid:** D-02 + D-06 + D-08 collectively guarantee zero redirects. The CI guard (ROUTE-03) does not catch server-side `redirect()` calls — this must be enforced by code review.
**Warning signs:** Any `import { redirect } from 'next/navigation'` in `src/app/w/[ref]/page.tsx`.

### Pitfall 2: Forgetting findViewerWatchByCatalogId Extraction

**What goes wrong:** `findViewerWatchByCatalogId` currently lives in `src/app/catalog/[catalogId]/page.tsx`. When that file is deleted, the function is gone. If the unified page was written with an inline copy, it becomes untestable.
**Why it happens:** The function is defined at the bottom of the page file as a local helper, not in a shared module.
**How to avoid:** Move to `src/data/watches.ts` as part of the first plan task. The BUG-01 fix (`eq(watchesTable.status, 'owned')`) must be preserved in the moved function.

### Pitfall 3: CI Guard Allowlist Gap for Template Literals

**What goes wrong:** The regex catches `href={\`/watch/${...}\`}` but misses `return \`/watch/${watchId}\`` in `NotificationRow.tsx` (the computed deep-link at line 142).
**Why it happens:** The guard is written only for `href=` patterns and misses return-statement deep-links.
**How to avoid:** D-12 explicitly requires this. The guard regex must include `return\s+\`\/watch\/\$\{` as a separate pattern.
**Warning signs:** `NotificationRow.tsx` still has `/watch/${watchId}` after the rewrite, and the guard test passes — this means the guard has an allowlist gap.

### Pitfall 4: Watch ID vs Catalog ID Confusion in Link Migration

**What goes wrong:** Discovery surfaces (Explore, Search) emit `catalogId`; ownership surfaces emit `watches.id`. After migration, all emit to `/w/[ref]`, but the ID type must match the linking surface. Mixing them causes resolution to fail.
**Why it happens:** All IDs are UUIDs; they look identical. A developer migrates `DiscoveryWatchCard.tsx` using `watch.id` instead of `watch.catalogId`.
**How to avoid:** The table in the Link-Surface section specifies which ID type each link emits. Follow D-03 strictly.
**Warning signs:** A catalog-keyed discovery link resolves to a per-user watch page (or vice versa) — would happen if a discovery surface accidentally emits `watches.id`.

### Pitfall 5: Leaving /watch/ or /catalog/ Directories Partially

**What goes wrong:** Deleting `page.tsx` from `src/app/watch/[id]/` but leaving `src/app/watch/[id]/edit/page.tsx` (or vice versa) causes the edit route to exist at `/watch/[id]/edit` when the detail route 404s. The edit form at the old path would be reachable.
**How to avoid:** The deletion plan must explicitly: (a) delete `src/app/watch/[id]/page.tsx`, (b) delete `src/app/watch/[id]/edit/page.tsx` (because it moves to `/w/[ref]/edit/`), (c) delete `src/app/catalog/[catalogId]/page.tsx`. The `/watch/new/` directory is NOT deleted (D-10).

### Pitfall 6: OtherOwnersRoster/CatalogPageActions Showing for Owners

**What goes wrong:** The unified page always renders `OtherOwnersRoster` and `CatalogPageActions` regardless of branch, showing CTAs ("Add to Collection", "Add to Wishlist") to the owner of the watch.
**How to avoid:** Gate `CatalogPageActions` on `!isOwner`. Gate `OtherOwnersRoster` on `!isOwner && catalog-resolution-available`. Per spike §4.D forcing-function note.

---

## Code Examples

### Unified Page Structure (B1-invariant, both branches)

```typescript
// src/app/w/[ref]/page.tsx
// Source: derived from src/app/watch/[id]/page.tsx (verified) + src/app/catalog/[catalogId]/page.tsx (verified)

import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { getWatchByIdForViewer, getWatchById, findViewerWatchByCatalogId } from '@/data/watches'
// ... (other imports mirror both legacy pages)

export default async function UnifiedWatchPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params

  // UUID guard (from catalog page:54)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
    notFound()
  }

  const user = await getCurrentUser()
  const perUserResult = await getWatchByIdForViewer(user.id, ref)

  if (perUserResult) {
    // Branch 1: per-user resolution — mirrors /watch/[id]/page.tsx exactly
    const { watch, isOwner, ownerUserId } = perUserResult
    // ... fetch collection, preferences, likeState, canComment, comments, sameFamily, lineage
    // framing: isOwner ? 'same-user' : 'cross-user'
    return (
      <div>
        <WatchDetail watch={watch} viewerCanEdit={isOwner} ... />  {/* 'use client' island */}
        {/* RSC siblings per B1 invariant */}
        <SameFamilyRail rows={sameFamily} />
        <LineageRail rows={lineage} />
        <Suspense fallback={<CommentThreadSkeleton />}>
          <CommentThread ... />
        </Suspense>
      </div>
    )
  }

  // Branch 2: catalog resolution
  const catalogEntry = await getCatalogById(ref)
  if (!catalogEntry) notFound()

  const viewerOwnedRow = await findViewerWatchByCatalogId(user.id, ref)
  if (viewerOwnedRow) {
    // D-06: Owner arrived via catalogId — full owned view in place
    const watch = await getWatchById(user.id, viewerOwnedRow.id)
    if (!watch) notFound()
    // ... render same as Branch 1 same-user framing
  }

  // Pure cross-user catalog view
  // ... mirrors /catalog/[catalogId]/page.tsx structure
  return (
    <div>
      {/* No WatchDetail island for pure catalog view */}
      <OtherOwnersRoster ... />
      <SameFamilyRail ... />
      <LineageRail ... />
      <CatalogPageActions ... />
    </div>
  )
}
```

### CI Guard Test Skeleton

```typescript
// tests/static/legacy-watch-routes.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectSourceFiles(fullPath))
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.includes('.test.')) {
      results.push(fullPath)
    }
  }
  return results
}

describe('ROUTE-03: no internal links to legacy watch-detail paths', () => {
  const srcFiles = collectSourceFiles('src')

  const FORBIDDEN = [
    { pattern: /`\/watch\/\${(?!.*?}\/edit)/, label: '/watch/${...} detail template literal' },
    { pattern: /`\/watch\/\${.*?}\/edit/, label: '/watch/${...}/edit template literal' },
    { pattern: /`\/catalog\/\${/, label: '/catalog/${...} template literal' },
    { pattern: /return\s+`\/watch\/\${/, label: 'return `/watch/${...}` computed deep-link' },
    { pattern: /router\.push\(`\/watch\/\${(?!.*?new)/, label: 'router.push(/watch/${...}) not /new' },
  ]

  const ALLOWLIST = [
    /\/watch\/new/,
    /\/watch\/\[id\]/,
    /\/catalog\/\[catalogId\]/,
    /^\s*\/\//,   // pure comment lines
    /^\s*\*/      // JSDoc lines
  ]

  for (const file of srcFiles) {
    it(`${file} has no legacy watch-detail links`, () => {
      const lines = readFileSync(file, 'utf8').split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (ALLOWLIST.some(al => al.test(line))) continue
        for (const { pattern, label } of FORBIDDEN) {
          expect(pattern.test(line), `${file}:${i + 1} — ${label}: ${line.trim()}`).toBe(false)
        }
      }
    })
  }
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `self-via-cross-user` framing (D-08 inline flip) | Removed by Phase 50.1 | 2026-05-20 | Retired BUG-01 class; `redirect()` took its place |
| Redirect from `/catalog/[catalogId]` to `/watch/[id]` for owners (Phase 50.1) | Removed by Phase 59 (D-08 unwind) | This phase | Full Variant C hard cutover |
| Two separate detail routes | Single `/w/[ref]` route | This phase | Eliminates ref-identity split |

**Deprecated/outdated:**
- `CatalogPage`'s `findViewerWatchByCatalogId` local helper: moves to `src/data/watches.ts`
- `self-via-cross-user` framing string: already removed in Phase 50.1 (`lib/verdict/types.ts` confirms this)
- `/watch/[id]` and `/catalog/[catalogId]` routes: deleted this phase

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `WatchDetail.tsx` can receive all needed props from both resolution branches without signature change | Composition section | WatchDetail may need new props for catalog-branch data; verify all props during implementation |
| A2 | `OtherOwnersRoster` should not render for owners on the unified route (consistent with spike §4.D/§5.C) | Composition — Discretion | If operators want owners to see the roster, the render condition changes |
| A3 | `CatalogPageActions` should not render for owners on the unified route | Composition — Discretion | Same as A2 |
| A4 | The guard test fires as part of `npm run build` if `package.json` `"build"` script is updated to `"vitest run && next build"` | CI Guard section | If Vercel's build config overrides `package.json` scripts, the guard may not fire on deploy |
| A5 | `wearEvents.watchId` contains `watches.id` (not `catalogId`) for wear-detail hero links | Link-Surface section | Verified via schema line 300 — LOW risk |
| A6 | `activities.watchId` contains `watches.id` for activity-feed links | Link-Surface section | Verified via schema line 285 — LOW risk |

---

## Open Questions

1. **Does WatchDetail.tsx need any prop changes for the catalog-branch owned case?**
   - What we know: `WatchDetail` receives `watch: Watch`, `viewerCanEdit`, `verdict`, `initialLikeState`, `commentCount`, `viewerId`, etc.
   - What's unclear: On Branch 2 owned (D-06), `watch` is loaded via `getWatchById(user.id, viewerOwnedRow.id)`. The `target = { type: 'watch', id }` for likes/comments should use `viewerOwnedRow.id`, not `ref`. This is correct behavior.
   - Recommendation: No prop changes needed; the `id` used for `target` comes from the resolved watch, not from `ref`.

2. **How does the package.json build script change affect Vercel?**
   - What we know: No `vercel.json` exists; Vercel auto-detects Next.js and runs `npm run build`.
   - What's unclear: Whether Vercel will honor a `prebuild` script hook.
   - Recommendation: Use `"prebuild": "vitest run tests/static/legacy-watch-routes.test.ts"` — npm lifecycle hooks are honored by Vercel's build pipeline for Node.js projects.

3. **Should the unified route render `OtherOwnersRoster` for viewers arriving via `watches.id` (Branch 1)?**
   - What we know: Today `/watch/[id]` does NOT render `OtherOwnersRoster`; `/catalog/[catalogId]` does. The spike §4.C does not resolve this.
   - What's unclear: Whether the roster should appear for cross-user viewers on Branch 1 (cross-user arrive via `/w/[watches.id]`).
   - Recommendation: Carry current behavior (roster only on catalog-branch, cross-user framing). Phase 64 IA redesign resolves this for good.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 59 is purely code changes (routing, link migration, static test). No external tools, services, databases, or CLIs beyond the existing `npm run build` / `npm test` pipeline are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (in package.json) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |
| Build gate command | `npm run build` (must include test gate — see CI Guard section) |
| E2E command | `npm run test:e2e` (Playwright; skips on empty test DB) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROUTE-01 | `/w/[ref]` resolves per-user watch id correctly | Integration (server) | `npm run test` — integration tests | ❌ Wave 0 |
| ROUTE-01 | `/w/[ref]` resolves catalog id correctly | Integration (server) | `npm run test` | ❌ Wave 0 |
| ROUTE-01 | `same-user` framing when viewer is owner | Integration (server) | `npm run test` | ❌ Wave 0 |
| ROUTE-01 | `cross-user` framing when viewer is not owner | Integration (server) | `npm run test` | ❌ Wave 0 |
| ROUTE-02 | `/watch/[id]` 404s by absence | Static (fs) | `npm run test -- tests/static/legacy-watch-routes.test.ts` | ❌ Wave 0 |
| ROUTE-02 | `/catalog/[catalogId]` 404s by absence | Static (fs) | `npm run test -- tests/static/legacy-watch-routes.test.ts` | ❌ Wave 0 |
| ROUTE-03 | Build fails if any legacy link literal present | Static (grep) | `npm run test` | ❌ Wave 0 |
| ROUTE-04 | All internal links use `/w/[ref]` | Static (grep) | `npm run test` (guard is ROUTE-03) | ❌ Wave 0 |
| ROUTE-04 | `NotificationRow.resolveHref` returns `/w/[ref]` | Unit | `npm run test` | ❌ Wave 0 |
| ROUTE-05 | Privacy gate: private watch 404s for non-owner | Integration | `npm run test` (existing `phase12-visibility-matrix.test.ts` covers DAL; verify route-level) | ✅ (DAL) / ❌ Wave 0 (route) |
| ROUTE-06 | `viewerCanEdit=false` for non-owners | Unit (prop check) | `npm run test` | ❌ Wave 0 |
| ROUTE-06 | Edit/delete actions absent for non-owners | Manual (prod) | Human UAT | Human-needed |

### Sampling Rate

- **Per task commit:** `npm test -- tests/static/legacy-watch-routes.test.ts` (the guard; fast)
- **Per wave merge:** `npm run test` (full Vitest suite)
- **Phase gate:** Full Vitest suite green + manual prod verification of `/w/[ref]` routing before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/static/legacy-watch-routes.test.ts` — ROUTE-03 CI guard (new file)
- [ ] `tests/static/legacy-route-absence.test.ts` OR inline in above — ROUTE-02 `existsSync` checks for deleted files
- [ ] `tests/integration/phase59-unified-route.test.ts` — ROUTE-01 resolution coverage (per-user branch, catalog branch, owned-via-catalog D-06 branch)
- [ ] `package.json` `"prebuild"` script update — makes guard build-failing on Vercel

*(No new test framework install needed — Vitest already configured)*

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `getCurrentUser()` unchanged; auth-gated at proxy layer |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes | `viewerCanEdit={isOwner}` on WatchDetail island; `findViewerWatchByCatalogId` scoped by userId |
| V5 Input Validation | yes | UUID regex gate on `ref` param (copied from catalog page) |
| V6 Cryptography | no | No crypto changes |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| URL parameter injection (malformed UUID) | Tampering | UUID regex gate at top of unified page (verified pattern from catalog page:54) |
| Cross-user watch access via guessed `watches.id` | Information Disclosure | Two-layer privacy gate in `getWatchByIdForViewer` unchanged |
| Owner actions accessible to non-owners | Elevation of Privilege | `viewerCanEdit={isOwner}` on `WatchDetail` island; Server Actions also validate ownership |
| Open redirect via `returnTo` after edit | Tampering | `validateReturnTo` in `src/lib/watchFlow/destinations.ts` unchanged; edit form uses same logic |

---

## Sources

### Primary (HIGH confidence)
- `src/app/catalog/[catalogId]/page.tsx` — read in full; current code, line numbers verified
- `src/app/watch/[id]/page.tsx` — read in full; current code, line numbers verified
- `src/data/watches.ts` — read in full; `getWatchByIdForViewer` signature and gate verified
- `src/data/catalog.ts` — `getCatalogById` signature verified
- `.planning/phases/59-unified-route-variant-c/59-CONTEXT.md` — D-01..D-15 locked decisions
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` — async params confirmed
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md` — 404-by-absence behavior confirmed
- `vitest.config.ts` — test infrastructure confirmed
- `tests/static/CollectionFitCard.no-engine.test.ts`, `tests/no-evaluate-route.test.ts`, `tests/profile-route-51.test.ts` — CI guard pattern verified

### Secondary (MEDIUM confidence)
- `.planning/milestones/v5.2-phases/50-watch-detail-architecture-spike/50-SPIKE.md` — Variant C spec; §4.C/§5.C/§6 verified against current code
- `src/db/schema.ts` — `wearEvents.watchId` FK, `activities.watchId` FK verified at schema lines 285, 300
- Grep enumeration of all `/watch/` and `/catalog/` literals — current live count: 26 literals / 21 files

### Tertiary (LOW confidence)
- CONTEXT.md estimate of ~55 literals / ~36 files — pre-v6.0 count; live count is 26/21 [ASSUMED pre-grep; now VERIFIED]

---

## Metadata

**Confidence breakdown:**
- Link-surface enumeration: HIGH — grep run against live codebase 2026-05-25
- Standard stack: HIGH — no new dependencies; all functions verified in codebase
- Architecture (unified page composition): HIGH — both legacy pages read in full; DAL signatures confirmed
- CI guard mechanism: HIGH — pattern confirmed by existing static tests; integration with Vercel build MEDIUM (no `vercel.json` to inspect)
- Next.js 16 routing behavior: HIGH — confirmed via docs in `node_modules/next/dist/docs/`
- Privacy gate: HIGH — verified by reading `getWatchByIdForViewer` source

**Research date:** 2026-05-25
**Valid until:** 2026-06-24 (stable codebase; 30-day window)
