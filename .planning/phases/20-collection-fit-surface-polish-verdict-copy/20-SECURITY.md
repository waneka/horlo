# Phase 20 Security Audit — Collection Fit Surface Polish + Verdict Copy

**Phase:** 20 — collection-fit-surface-polish-verdict-copy
**ASVS Level:** L1
**Audit Date:** 2026-04-29
**Result:** SECURED — 26/26 threats closed (16 mitigated + 10 accepted)

## Verification Summary

All 26 threats declared across the six Phase 20 plans were verified against current implementation. Every `mitigate` threat has concrete code evidence; every `accept` threat is documented as accepted risk with rationale. No unregistered threat flags surfaced from executor SUMMARY files (all four `## Threat Flags` sections explicitly stated "None beyond plan threat model").

## Closed — Mitigations With Code Evidence

| Threat ID | Category | Evidence (file:line) |
|-----------|----------|----------------------|
| T-20-01-02 | Tampering | `src/lib/verdict/types.ts` — `grep -E "^export (const\|function)"` returns 0; types-only file confirmed |
| T-20-02-01 | Information Disclosure | `src/lib/verdict/viewerTasteProfile.ts:42-58` — Drizzle inner-join with `inArray(watches.id, watchIds)` parameterized bind; caller passes viewer-scoped collection |
| T-20-02-02 | Tampering | `src/lib/verdict/composer.ts:87-89` — `fillTemplate` returns plain string; no innerHTML; rendered via JSX (auto-escaped) |
| T-20-03-01 | Tampering | `src/components/insights/CollectionFitCard.tsx` — `grep "dangerouslySetInnerHTML"` exits 1; phrasings painted as `{p}` JSX text |
| T-20-03-03 | Tampering | `src/app/catalog/[catalogId]/page.tsx:58` — `ownerHref: /watch/${viewerOwnedRow.id}` constructed from viewer-scoped Drizzle SELECT |
| T-20-04-01 | Information Disclosure | `src/app/watch/[id]/page.tsx:19-23` — `getWatchByIdForViewer(user.id, id)` privacy gate; `getWatchesByUser(user.id)` viewer-scoped collection |
| T-20-04-02 | Information Disclosure | `src/lib/verdict/types.ts:33-39` — `VerdictBundle` is plain JSON (string/number/boolean/array/discriminator); `mostSimilar` carries viewer's own watches only |
| T-20-04-03 | Tampering | `src/app/watch/[id]/page.tsx:44` — `watch.catalogId ? getCatalogById(...) : Promise.resolve(null)` — null-checked; Drizzle parameterized in `getCatalogById` |
| T-20-05-01 | Spoofing | `src/app/actions/verdict.ts:30,50-51` — `verdictSchema = z.object({catalogId: z.string().uuid()}).strict()`; `getWatchesByUser(user.id)` and `getPreferencesByUser(user.id)` use `user.id` from `getCurrentUser()`; `grep "viewerId:"` exits 1 |
| T-20-05-02 | Tampering | `src/app/actions/verdict.ts:30` — `.strict()` and `.uuid()` validate input; `safeParse` rejects bad input with generic `'Invalid request'` |
| T-20-05-03 | Repudiation | `src/app/actions/verdict.ts:69` — `console.error('[getVerdictForCatalogWatch] unexpected error:', err)` plus generic `"Couldn't compute verdict."` user-facing copy |
| T-20-05-04 | Information Disclosure | `src/app/actions/verdict.ts:50` — `getWatchesByUser(user.id)`; `mostSimilar` built from this viewer-scoped collection |
| T-20-05-05 | Information Disclosure | `src/lib/verdict/types.ts:22-41` — hand-typed `VerdictBundle` discriminated union; only label, headlinePhrasing, contextualPhrasings, mostSimilar (Watch[]), roleOverlap, framing exposed |
| T-20-05-07 | Tampering | `src/components/search/WatchSearchRowsAccordion.tsx:114-118` — `toastCopyForError` switches over fixed error string set; no template injection |
| T-20-06-01 | Information Disclosure | `src/app/catalog/[catalogId]/page.tsx:147` — `where(and(eq(watchesTable.userId, userId), eq(watchesTable.catalogId, catalogId)))`; both predicates required; Drizzle parameterized |
| T-20-06-02 | Tampering | `src/app/catalog/[catalogId]/page.tsx:49` — `if (!catalogEntry) notFound()`; `getCatalogById` Drizzle parameterized; URL param flows through Next.js dynamic route validation |

## Closed — Accepted Risks

| Threat ID | Category | Rationale |
|-----------|----------|-----------|
| T-20-01-01 | Information Disclosure | `tests/no-evaluate-route.test.ts` reads filesystem only via hardcoded `existsSync` paths; no user input, no path interpolation. /evaluate dir confirmed absent. |
| T-20-02-03 | Tampering | `src/lib/verdict/shims.ts:34-37` — Unknown movement coerces to `'other'`; closed-union enforcement at type boundary. No security risk. |
| T-20-02-04 | Information Disclosure | `analyzeSimilarity` (engine) consumes only caller-supplied objects (candidate Watch + viewer collection + viewer prefs). No DB access inside engine. Same posture as v1.0–v3.0; D-09 byte-lock preserved. |
| T-20-03-02 | Information Disclosure | `YouOwnThisCallout` renders the viewer's own `acquisitionDate`/`createdAt` (viewer reading own row). `Intl.DateTimeFormat` is local (no network egress). |
| T-20-04-04 | Information Disclosure | Phase 19.1 `confidence` column on `watches_catalog` is public-read by RLS contract (CAT-02); no PII. |
| T-20-05-06 | Denial of Service | Search results capped at `limit: 20` per query in `src/app/actions/search.ts:59,100,136` — viewer-mounted cache cannot grow unbounded; on revision change cache resets. |
| T-20-06-03 | Information Disclosure | Catalog page is per-viewer rendered (Server Component computes against `getCurrentUser`). No cross-viewer leak — verdict and most-similar list built from caller's own collection only. |
| T-20-06-04 | Spoofing | Direct nav to `/catalog/{any-uuid}` is intentional — catalog is global/public reference. Per-viewer verdict computed against caller's collection only; no privacy leak. |
| T-20-06-05 | Information Disclosure | `acquisitionDate` shown only when viewer is reading their own watches row (gated by `findViewerWatchByCatalogId(user.id, catalogId)`). |
| T-20-06-06 | Tampering | `imageUrl` flows from `watches_catalog.imageUrl` (admin/extracted-controlled). `next/image unoptimized` is the existing project pattern. No new SSRF surface. |

## Unregistered Flags

None. All four executor SUMMARY files with `## Threat Flags` sections (20-02, 20-04, 20-05, 20-06) explicitly stated no new threat surfaces beyond the documented threat register. SUMMARY files 20-01 and 20-03 had no `## Threat Flags` section because their plans introduced no Server Actions, no DB queries, no client-state — pure types/scaffolds and pure renderer respectively.

## Verification Method by Disposition

- **mitigate (16 threats):** Grep cited mitigation pattern in implementation files. All 16 patterns located.
- **accept (10 threats):** Documented as accepted risk in this file's "Closed — Accepted Risks" table with rationale.
- **transfer (0 threats):** None present in Phase 20 register.

## ASVS L1 Coverage

| Category | Coverage |
|----------|----------|
| V2 — Authentication | `getCurrentUser()` used in all Server Components and Server Action; `viewerId` never accepted from input |
| V4 — Access Control | DAL helpers scope by `user.id`; `findViewerWatchByCatalogId` uses both userId AND catalogId predicates |
| V5 — Input Validation | Server Action uses `z.object({catalogId: z.string().uuid()}).strict()`; URL params resolved via Drizzle parameterized binds |
| V8 — Data Protection | React JSX auto-escapes interpolated strings; no `dangerouslySetInnerHTML` anywhere in `src/components/insights/CollectionFitCard.tsx` |

## Implementation Files Audited (Read-Only)

- `src/lib/verdict/types.ts`
- `src/lib/verdict/viewerTasteProfile.ts`
- `src/lib/verdict/composer.ts`
- `src/lib/verdict/templates.ts`
- `src/lib/verdict/shims.ts`
- `src/components/insights/CollectionFitCard.tsx`
- `src/components/search/WatchSearchRowsAccordion.tsx`
- `src/app/actions/verdict.ts`
- `src/app/actions/search.ts` (cache-pollution bound)
- `src/app/watch/[id]/page.tsx`
- `src/app/catalog/[catalogId]/page.tsx`

No implementation files modified during audit.
